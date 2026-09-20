/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { getStore } from '@edgeone/pages-blob';
import type { Store } from '@edgeone/pages-blob';

import { AdminConfig } from './admin.types';
import { hashPassword, isHashed, verifyPassword } from './password';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

/**
 * EdgeOne Blob 存储后端。
 *
 * 将项目原有的 Redis 数据结构（Hash / List / Set / String）映射为 Blob 的
 * 平面 key + JSON 对象模型，key 布局如下（用 `/` 分组，便于控制台目录化浏览）：
 *
 *   pr/{user}/{source}+{id}    -> JSON PlayRecord
 *   fav/{user}/{source}+{id}   -> JSON Favorite
 *   user/{user}                -> 文本：加盐哈希后的密码
 *   sh/{user}                  -> JSON string[]（搜索历史，最多 20 条）
 *   skip/{user}/{source}+{id}  -> JSON SkipConfig
 *   sys/admin-config           -> JSON AdminConfig
 *
 * 读取统一走强一致（strong）模式，规避 Blob 边缘缓存带来的短暂不一致，
 * 保证登录校验、站长配置、收藏/播放记录的实时性（个人小站延迟可接受）。
 */

// 搜索历史最大条数
const SEARCH_HISTORY_LIMIT = 20;

// 数据类型转换辅助函数
function ensureString(value: any): string {
  return String(value);
}

function ensureStringArray(value: any[]): string[] {
  return value.map((item) => String(item));
}

// 重试包装器（Blob 请求偶发的限流 / 网络抖动）
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      const isLastAttempt = i === maxRetries - 1;
      const isRetryable =
        err?.name === 'RateLimitedError' ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('network') ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNREFUSED';

      if (isRetryable && !isLastAttempt) {
        console.log(
          `Blob operation failed, retrying... (${i + 1}/${maxRetries})`
        );
        console.error('Error:', err.message);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }

      throw err;
    }
  }

  throw new Error('Max retries exceeded');
}

// 单例 Blob Store
function getBlobStore(): Store {
  const globalKey = Symbol.for('__MOONTV_BLOB_STORE__');
  let store: Store | undefined = (global as any)[globalKey];

  if (!store) {
    const name = process.env.BLOB_STORE_NAME || 'moontv';
    const projectId = process.env.BLOB_PROJECT_ID;
    const token = process.env.BLOB_API_TOKEN;

    if (projectId && token) {
      // 外部访问模式（本地脚本 / 非 Pages Functions 环境）：需显式 projectId + token
      store = getStore({ name, projectId, token, consistency: 'strong' });
    } else {
      // Pages Functions 内自动鉴权，仅需命名空间名
      store = getStore(name);
    }

    console.log('EdgeOne Blob store created successfully');
    (global as any)[globalKey] = store;
  }

  return store;
}

export class BlobStorage implements IStorage {
  private store: Store;

  constructor() {
    this.store = getBlobStore();
  }

  // ---------- 通用工具 ----------
  private async readJSON<T>(key: string): Promise<T | null> {
    return withRetry(() =>
      this.store.get(key, { type: 'json', consistency: 'strong' })
    );
  }

  private async readText(key: string): Promise<string | null> {
    return withRetry(() =>
      this.store.get(key, { type: 'text', consistency: 'strong' })
    );
  }

  private async listKeys(prefix: string): Promise<string[]> {
    const result = await withRetry(() =>
      this.store.list({ prefix, consistency: 'strong' })
    );
    return result.blobs.map((b) => b.key);
  }

  private async deletePrefix(prefix: string): Promise<void> {
    const keys = await this.listKeys(prefix);
    for (const key of keys) {
      await withRetry(() => this.store.delete(key));
    }
  }

  // ---------- 播放记录 ----------
  private prKey(user: string, key: string) {
    return `pr/${user}/${key}`;
  }

  async getPlayRecord(
    userName: string,
    key: string
  ): Promise<PlayRecord | null> {
    return this.readJSON<PlayRecord>(this.prKey(userName, key));
  }

  async setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord
  ): Promise<void> {
    await withRetry(() =>
      this.store.setJSON(this.prKey(userName, key), record)
    );
  }

  async getAllPlayRecords(
    userName: string
  ): Promise<Record<string, PlayRecord>> {
    const prefix = `pr/${userName}/`;
    const keys = await this.listKeys(prefix);
    const result: Record<string, PlayRecord> = {};
    for (const fullKey of keys) {
      const field = fullKey.slice(prefix.length);
      if (!field) continue;
      const record = await this.readJSON<PlayRecord>(fullKey);
      if (record) result[field] = record;
    }
    return result;
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    await withRetry(() => this.store.delete(this.prKey(userName, key)));
  }

  async deleteAllPlayRecords(userName: string): Promise<void> {
    await this.deletePrefix(`pr/${userName}/`);
  }

  // ---------- 收藏 ----------
  private favKey(user: string, key: string) {
    return `fav/${user}/${key}`;
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    return this.readJSON<Favorite>(this.favKey(userName, key));
  }

  async setFavorite(
    userName: string,
    key: string,
    favorite: Favorite
  ): Promise<void> {
    await withRetry(() =>
      this.store.setJSON(this.favKey(userName, key), favorite)
    );
  }

  async getAllFavorites(
    userName: string
  ): Promise<Record<string, Favorite>> {
    const prefix = `fav/${userName}/`;
    const keys = await this.listKeys(prefix);
    const result: Record<string, Favorite> = {};
    for (const fullKey of keys) {
      const field = fullKey.slice(prefix.length);
      if (!field) continue;
      const favorite = await this.readJSON<Favorite>(fullKey);
      if (favorite) result[field] = favorite;
    }
    return result;
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    await withRetry(() => this.store.delete(this.favKey(userName, key)));
  }

  async deleteAllFavorites(userName: string): Promise<void> {
    await this.deletePrefix(`fav/${userName}/`);
  }

  // ---------- 用户注册 / 登录 ----------
  private userPwdKey(user: string) {
    return `user/${user}`;
  }

  async registerUser(userName: string, password: string): Promise<void> {
    const hashed = hashPassword(password);
    await withRetry(() => this.store.set(this.userPwdKey(userName), hashed));
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const stored = await this.readText(this.userPwdKey(userName));
    if (stored === null) return false;
    const storedStr = ensureString(stored);
    const ok = verifyPassword(password, storedStr);
    // 平滑迁移：明文密码验证通过后自动升级为加盐哈希
    if (ok && !isHashed(storedStr)) {
      const hashed = hashPassword(password);
      await withRetry(() => this.store.set(this.userPwdKey(userName), hashed));
    }
    return ok;
  }

  async checkUserExist(userName: string): Promise<boolean> {
    const stored = await this.readText(this.userPwdKey(userName));
    return stored !== null;
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    const hashed = hashPassword(newPassword);
    await withRetry(() => this.store.set(this.userPwdKey(userName), hashed));
  }

  async deleteUser(userName: string): Promise<void> {
    // 删除密码
    await withRetry(() => this.store.delete(this.userPwdKey(userName)));
    // 删除该用户的全部数据
    await this.deletePrefix(`pr/${userName}/`);
    await this.deletePrefix(`fav/${userName}/`);
    await this.deletePrefix(`skip/${userName}/`);
    await withRetry(() => this.store.delete(`sh/${userName}`));
  }

  // ---------- 搜索历史 ----------
  private shKey(user: string) {
    return `sh/${user}`;
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const arr = await this.readJSON<any>(this.shKey(userName));
    if (!Array.isArray(arr)) return [];
    return ensureStringArray(arr);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const key = this.shKey(userName);
    const current = await this.readJSON<any>(key);
    const list = Array.isArray(current)
      ? ensureStringArray(current)
      : [];
    const kw = ensureString(keyword);
    const next = [kw, ...list.filter((it) => it !== kw)].slice(
      0,
      SEARCH_HISTORY_LIMIT
    );
    await withRetry(() => this.store.setJSON(key, next));
  }

  async deleteSearchHistory(
    userName: string,
    keyword?: string
  ): Promise<void> {
    const key = this.shKey(userName);
    if (keyword) {
      const current = await this.readJSON<any>(key);
      const list = Array.isArray(current)
        ? ensureStringArray(current)
        : [];
      const kw = ensureString(keyword);
      await withRetry(() =>
        this.store.setJSON(
          key,
          list.filter((it) => it !== kw)
        )
      );
    } else {
      await withRetry(() => this.store.delete(key));
    }
  }

  // ---------- 获取全部用户 ----------
  async getAllUsers(): Promise<string[]> {
    const keys = await this.listKeys('user/');
    return keys
      .map((k) => k.slice('user/'.length))
      .filter((name) => name.length > 0 && !name.includes('/'));
  }

  // ---------- 管理员配置 ----------
  private adminConfigKey() {
    return 'sys/admin-config';
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    return this.readJSON<AdminConfig>(this.adminConfigKey());
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await withRetry(() =>
      this.store.setJSON(this.adminConfigKey(), config)
    );
  }

  // ---------- 跳过片头片尾配置 ----------
  private skipKey(user: string, source: string, id: string) {
    return `skip/${user}/${source}+${id}`;
  }

  async getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null> {
    return this.readJSON<SkipConfig>(this.skipKey(userName, source, id));
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void> {
    await withRetry(() =>
      this.store.setJSON(this.skipKey(userName, source, id), config)
    );
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    await withRetry(() => this.store.delete(this.skipKey(userName, source, id)));
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    const prefix = `skip/${userName}/`;
    const keys = await this.listKeys(prefix);
    const configs: { [key: string]: SkipConfig } = {};
    for (const fullKey of keys) {
      const field = fullKey.slice(prefix.length);
      if (!field) continue;
      const cfg = await this.readJSON<SkipConfig>(fullKey);
      if (cfg) configs[field] = cfg;
    }
    return configs;
  }

  // ---------- 清空所有数据 ----------
  async clearAllData(): Promise<void> {
    try {
      const allUsers = await this.getAllUsers();
      for (const username of allUsers) {
        await this.deleteUser(username);
      }
      await withRetry(() => this.store.delete(this.adminConfigKey()));
      console.log('所有数据已清空');
    } catch (error) {
      console.error('清空数据失败:', error);
      throw new Error('清空数据失败');
    }
  }
}
