/* eslint-disable no-console */
/**
 * 从 Upstash 提取全量用户数据生成官方格式备份文件（只读，不改写原平台）
 *
 * 用法：
 *   UPSTASH_URL=... UPSTASH_TOKEN=... node scripts/generate-full-backup.js [输出文件路径] [备份密码]
 *
 * 说明：
 *   - 用户列表从 sys:users 字符串解析（兼容 Upstash 上以 JSON 字符串存储用户列表的结构）
 *   - 密码哈希原样迁移（已验证 scrypt 参数与项目一致，原样存储后原密码仍可登录）
 *   - qing122 是原平台站长（走 env 登录），使用已知明文密码，保证 EdgeOne 上现密码可用
 *   - adminConfig 直接复用官方备份文件里的配置（含 UserConfig 角色表）
 */
const fs = require('fs');
const zlib = require('zlib');
const CryptoJS = require('crypto-js');
const { createClient } = require('redis');

const UPSTASH_URL = process.env.UPSTASH_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN;
const STATION_OWNER = 'qing122';
const STATION_PASSWORD = '2858970'; // 站长明文密码（与官方备份一致）
const OFFICIAL_BACKUP = process.argv[2] || '/root/.dsh/attachments/v1/files/be/beff28a3c66e7570af5ae048077144af59bcf1de192c6973c33bfb5af59682de/moontv-backup-20260920-141416.dat';
const OUT_FILE = process.argv[3] || '/root/dsh/tiktok安卓端修改/moontv-full-backup.dat';
const BACKUP_PASSWORD = process.argv[4] || '123';

function decrypt(encryptedData, password) {
  const bytes = CryptoJS.AES.decrypt(encryptedData, password);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error('解密失败');
  return decrypted;
}

async function main() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error('缺少 UPSTASH_URL / UPSTASH_TOKEN');
    process.exit(1);
  }

  const client = createClient({
    url: `redis://default:${UPSTASH_TOKEN}@${UPSTASH_URL.replace(/^https?:\/\//, '')}`,
    socket: { tls: true, connectTimeout: 15000 },
  });
  client.on('error', (e) => console.error('client error:', e.message));
  await client.connect();
  console.log('✅ 已连接 Upstash');

  // 1. 用户列表：sys:users 是 Set，但其成员是 JSON 数组字符串（如 '["a1","a2",...]'），需解析展开
  const members = await client.sMembers('sys:users');
  const users = [];
  for (const m of members) {
    try {
      const parsed = JSON.parse(m);
      if (Array.isArray(parsed)) users.push(...parsed);
      else users.push(m);
    } catch {
      users.push(m);
    }
  }
  if (users.length === 0) {
    // 兜底：直接尝试 GET（若为 string 类型）
    const rawUsers = await client.get('sys:users');
    try { users.push(...JSON.parse(rawUsers)); } catch { /* ignore */ }
  }
  console.log('📋 用户列表(' + users.length + '):', users.join(', '));

  // 2. adminConfig：读取原平台最新配置，失败则用官方备份里的
  let adminConfig = null;
  try {
    const raw = await client.get('admin:config');
    if (raw) adminConfig = JSON.parse(raw);
  } catch (e) { console.warn('读取 admin:config 失败:', e.message); }
  if (adminConfig && adminConfig.SiteConfig) {
    console.log('✅ adminConfig 来自 Upstash 实时数据');
  } else {
    const enc = fs.readFileSync(OFFICIAL_BACKUP, 'utf8').trim();
    const dec = decrypt(enc, '123');
    const data = JSON.parse(zlib.gunzipSync(Buffer.from(dec, 'base64')).toString());
    adminConfig = data.data.adminConfig;
    console.log('✅ adminConfig 复用官方备份文件');
  }

  // 3. 逐个用户提取数据
  const userData = {};
  for (const username of users) {
    const u = {};
    const prRaw = await client.hGetAll(`u:${username}:pr`);
    u.playRecords = {};
    for (const [k, v] of Object.entries(prRaw)) {
      try { u.playRecords[k] = JSON.parse(v); } catch { u.playRecords[k] = v; }
    }
    const favRaw = await client.hGetAll(`u:${username}:fav`);
    u.favorites = {};
    for (const [k, v] of Object.entries(favRaw)) {
      try { u.favorites[k] = JSON.parse(v); } catch { u.favorites[k] = v; }
    }
    u.searchHistory = await client.lRange(`u:${username}:sh`, 0, -1);
    const skipRaw = await client.hGetAll(`u:${username}:skip`);
    u.skipConfigs = {};
    for (const [k, v] of Object.entries(skipRaw)) {
      try { u.skipConfigs[k] = JSON.parse(v); } catch { u.skipConfigs[k] = v; }
    }
    // 密码：站长用明文，其余用户原样迁移哈希（算法已确认兼容）
    let pwd = await client.get(`u:${username}:pwd`);
    if (username === STATION_OWNER) {
      pwd = STATION_PASSWORD;
      console.log(`  ${username}: 密码使用站长明文 ${JSON.stringify(STATION_PASSWORD)}`);
    } else {
      const isHash = typeof pwd === 'string' && /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(pwd);
      console.log(`  ${username}: 密码${isHash ? '原样迁移哈希' : pwd ? '⚠️ 非标准格式原样保留' : '无'}`);
    }
    u.password = pwd;
    userData[username] = u;
    console.log(`  ✅ ${username}: 播放${Object.keys(u.playRecords).length} 收藏${Object.keys(u.favorites).length} 搜索${u.searchHistory.length} 跳过${Object.keys(u.skipConfigs).length}`);
  }

  // 4. 组装 + 压缩 + 加密
  const exportData = {
    timestamp: new Date().toISOString(),
    serverVersion: '100.1.3',
    data: { adminConfig, userData },
  };
  const json = JSON.stringify(exportData);
  const gz = zlib.gzipSync(Buffer.from(json, 'utf8'));
  const encrypted = CryptoJS.AES.encrypt(gz.toString('base64'), BACKUP_PASSWORD).toString();
  fs.writeFileSync(OUT_FILE, encrypted, 'utf8');
  console.log(`\n📦 已生成备份: ${OUT_FILE} (${(encrypted.length / 1024).toFixed(1)} KB, 密码: ${BACKUP_PASSWORD})`);
  console.log(`   共 ${Object.keys(userData).length} 个用户，adminConfig 已包含`);
  await client.quit();
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });