/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

/**
 * 响应体积控制。
 *
 * 原实现把所有源、所有分页的结果连同完整 m3u8 列表一次性返回，
 * 数据量轻松超过 1.5 MB。EdgeOne 的边缘节点会按响应体上限截断 body，
 * 前端 response.json() 于是抛出
 *   "Unterminated string in JSON at position 1542387 (line 1 column 1542388)"
 *
 * 这里改成「搜索返回摘要、换源时按需拉详情」：
 * - episodes 默认只保留 1 条（用于判断该源是否有可用剧集）
 * - 真实集数放在 episodes_count 里，前端显示集数不受影响
 * - 需要完整剧集的场景走 /api/detail?source=&id=
 * - 兼容旧客户端：带 ?full=1 仍返回完整列表，但仍受体积预算约束
 */
const MAX_RESPONSE_BYTES = 640 * 1024; // 640 KB 安全线
const MAX_RESULTS = 240; // 总结果条数上限（摘要模式下每条仅数百字节）
const MAX_RESULTS_PER_SITE = 10; // 单源结果条数上限
const PREVIEW_EPISODES = 1; // 摘要模式保留的剧集地址数
const MAX_EPISODES_PER_RESULT = 2000; // 完整模式单条最多保留的剧集数
const MAX_DESC_LENGTH = 120; // 简介截断长度，详情接口会返回完整简介

function buildHeaders(cacheTime: number, noStore: boolean) {
  const cacheControl = noStore
    ? 'no-store'
    : `public, max-age=${cacheTime}, s-maxage=${cacheTime}`;

  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
    'CDN-Cache-Control': noStore ? 'no-store' : `public, s-maxage=${cacheTime}`,
    'Vercel-CDN-Cache-Control': noStore
      ? 'no-store'
      : `public, s-maxage=${cacheTime}`,
    'Netlify-Vary': 'query',
  };
}

/** 同一部剧在同一源里可能因分页重复出现，只保留集数最全的一条 */
function dedupeResults(results: any[]): any[] {
  const seen = new Map<string, any>();

  for (const result of results) {
    const key = `${result.source}::${String(result.title || '')
      .replace(/\s+/g, '')
      .toLowerCase()}::${result.year}`;
    const previous = seen.get(key);
    const previousCount = Array.isArray(previous?.episodes)
      ? previous.episodes.length
      : -1;
    const currentCount = Array.isArray(result.episodes)
      ? result.episodes.length
      : 0;

    if (!previous || currentCount >= previousCount) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values());
}

/**
 * 标题精确命中的结果排前面。
 * 换源场景下用户只关心「这部剧」在哪些源有，无关的模糊结果不应该挤占预算。
 */
function rankByQuery(results: any[], query: string): any[] {
  const normalizedQuery = query.replace(/\s+/g, '').toLowerCase();
  const score = (result: any) => {
    const title = String(result.title || '')
      .replace(/\s+/g, '')
      .toLowerCase();
    if (title === normalizedQuery) return 0;
    if (title.includes(normalizedQuery) || normalizedQuery.includes(title)) {
      return 1;
    }
    return 2;
  };

  // Array.prototype.sort 在 V8 中是稳定排序，同分项保持原有源顺序
  return [...results].sort((a, b) => score(a) - score(b));
}

/**
 * 条数分配：先保证每个源至少留下 1 条，再按相关性补足单源配额。
 *
 * 原实现从前往后累加，达到总数上限就 break，
 * 排序靠后的源会被整体丢掉，换源列表因此少一大截。
 * 换源场景下「源的数量」远比「每源多少条」重要。
 */
function limitPerSite(results: any[]): any[] {
  const kept = new Set<number>();
  const counter = new Map<string, number>();

  // 第一轮：每个源保留排名最靠前的一条，保证源覆盖
  results.forEach((result, index) => {
    const site = String(result.source ?? '');
    if (counter.has(site)) return;

    counter.set(site, 1);
    kept.add(index);
  });

  // 第二轮：按排名补足每源配额，受总条数上限约束
  results.forEach((result, index) => {
    if (kept.has(index)) return;
    if (kept.size >= MAX_RESULTS) return;

    const site = String(result.source ?? '');
    const used = counter.get(site) || 0;
    if (used >= MAX_RESULTS_PER_SITE) return;

    counter.set(site, used + 1);
    kept.add(index);
  });

  return results.filter((_, index) => kept.has(index));
}

function compactResult(result: any, full: boolean) {
  const episodes: string[] = Array.isArray(result.episodes)
    ? result.episodes
    : [];
  const titles: string[] = Array.isArray(result.episodes_titles)
    ? result.episodes_titles
    : [];
  const limit = full ? MAX_EPISODES_PER_RESULT : PREVIEW_EPISODES;

  return {
    ...result,
    episodes: episodes.slice(0, limit),
    episodes_titles: titles.slice(0, limit),
    episodes_count: episodes.length,
    desc:
      typeof result.desc === 'string' && result.desc.length > MAX_DESC_LENGTH
        ? result.desc.slice(0, MAX_DESC_LENGTH)
        : result.desc,
  };
}

/**
 * 字节预算裁剪：同样先保源、再补条数。
 * 否则预算不够时，排在尾部的源会被整段截掉。
 */
function fitBudget(results: any[], full: boolean): any[] {
  const items = results.map((result) => {
    const compact = compactResult(result, full);

    return {
      compact,
      site: String(result.source ?? ''),
      cost: Buffer.byteLength(JSON.stringify(compact), 'utf8'),
    };
  });

  const kept = new Set<number>();
  let used = 0;

  // 第一轮：每源保底一条，确保换源列表不会因预算丢失整个源
  const seenSite = new Set<string>();
  items.forEach((item, index) => {
    if (seenSite.has(item.site)) return;

    seenSite.add(item.site);
    kept.add(index);
    used += item.cost;
  });

  // 第二轮：按排名补足，放不下的条目跳过
  items.forEach((item, index) => {
    if (kept.has(index)) return;
    if (used + item.cost > MAX_RESPONSE_BYTES) return;

    kept.add(index);
    used += item.cost;
  });

  return items
    .filter((_, index) => kept.has(index))
    .map((item) => item.compact);
}

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const full = searchParams.get('full') === '1';

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      { headers: buildHeaders(cacheTime, false) }
    );
  }

  const config = await getConfig();
  const apiSites = await getAvailableApiSites(authInfo.username);

  // 添加超时控制和错误处理，避免慢接口拖累整体响应
  const searchPromises = apiSites.map((site) =>
    Promise.race([
      searchFromApi(site, query),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000)
      ),
    ]).catch((err) => {
      console.warn(`搜索失败 ${site.name}:`, err.message);
      return []; // 返回空数组而不是抛出错误
    })
  );

  try {
    const results = await Promise.allSettled(searchPromises);
    const successResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);
    let flattenedResults: any[] = successResults.flat();

    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }

    if (flattenedResults.length === 0) {
      // no cache if empty
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    // 体积控制四步：去重 -> 相关性排序 -> 单源限额 -> 按字节预算裁剪
    const deduped = dedupeResults(flattenedResults);
    const ranked = rankByQuery(deduped, query);
    const limited = limitPerSite(ranked);
    const compacted = fitBudget(limited, full);

    const cacheTime = await getCacheTime();
    const body = JSON.stringify({ results: compacted });
    const oversize = Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES;

    return new NextResponse(body, {
      status: 200,
      headers: buildHeaders(cacheTime, oversize),
    });
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
