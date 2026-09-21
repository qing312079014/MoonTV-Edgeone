/* eslint-disable no-console */
/**
 * 备份文件分析工具：解密 + 解压 + 检查 .dat 备份内容
 *
 * 用法：
 *   node scripts/analyze-backup.js <备份文件.dat> <导出密码>
 *
 * 输出：
 *   - 备份版本 / 时间戳
 *   - 每个用户的数据量统计（播放记录/收藏/搜索历史/跳过配置/密码）
 *   - 播放记录与收藏的 key 样例（用于核对格式）
 */
const fs = require('fs');
const zlib = require('zlib');
const CryptoJS = require('crypto-js');

function decrypt(encryptedData, password) {
  const bytes = CryptoJS.AES.decrypt(encryptedData, password);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error('解密失败，请检查密码是否正确');
  return decrypted;
}

function main() {
  const [,, filePath, password] = process.argv;
  if (!filePath || !password) {
    console.error('用法: node scripts/analyze-backup.js <备份文件.dat> <导出密码>');
    process.exit(1);
  }

  const encrypted = fs.readFileSync(filePath, 'utf8').trim();
  console.log(`[1/4] 读取备份文件: ${filePath} (${(encrypted.length / 1024).toFixed(1)} KB)`);

  const decrypted = decrypt(encrypted, password);
  console.log('[2/4] 解密成功');

  const compressed = Buffer.from(decrypted, 'base64');
  const decompressed = zlib.gunzipSync(compressed).toString('utf8');
  console.log('[3/4] 解压成功');

  const data = JSON.parse(decompressed);
  console.log('[4/4] 解析 JSON 完成\n');

  console.log('===== 备份概览 =====');
  console.log('timestamp:', data.timestamp);
  console.log('serverVersion:', data.serverVersion);

  if (data.data?.adminConfig) {
    const ac = data.data.adminConfig;
    console.log('adminConfig 存在, 字段:', Object.keys(ac).join(', ') || '(空对象)');
  } else {
    console.log('⚠️  adminConfig 缺失或为空');
  }

  const userData = data.data?.userData || {};
  const usernames = Object.keys(userData);
  console.log(`\n===== 用户数据 (共 ${usernames.length} 个用户) =====`);
  if (usernames.length === 0) {
    console.log('⚠️  userData 为空对象！导出端没有收集到任何用户数据。');
    return;
  }

  let totalPr = 0, totalFav = 0, totalSh = 0, totalSkip = 0, withPwd = 0;
  for (const name of usernames) {
    const u = userData[name] || {};
    const pr = u.playRecords || {};
    const fav = u.favorites || {};
    const sh = Array.isArray(u.searchHistory) ? u.searchHistory : [];
    const skip = u.skipConfigs || {};
    const prKeys = Object.keys(pr);
    const favKeys = Object.keys(fav);
    const skipKeys = Object.keys(skip);
    totalPr += prKeys.length;
    totalFav += favKeys.length;
    totalSh += sh.length;
    totalSkip += skipKeys.length;
    if (u.password) withPwd++;

    console.log(`\n--- 用户: ${name} ---`);
    console.log(`  播放记录: ${prKeys.length} 条`);
    if (prKeys.length > 0) {
      console.log(`    key 样例: ${prKeys.slice(0, 3).map((k) => `"${k}"`).join(', ')}`);
      console.log(`    record 字段: ${Object.keys(pr[prKeys[0]] || {}).join(', ')}`);
    }
    console.log(`  收藏: ${favKeys.length} 条`);
    if (favKeys.length > 0) {
      console.log(`    key 样例: ${favKeys.slice(0, 3).map((k) => `"${k}"`).join(', ')}`);
    }
    console.log(`  搜索历史: ${sh.length} 条`);
    if (sh.length > 0) console.log(`    样例: ${sh.slice(0, 3).map((s) => `"${s}"`).join(', ')}`);
    console.log(`  跳过配置: ${skipKeys.length} 条`);
    console.log(`  密码: ${u.password ? '有 (已加密/明文)' : '无 ⚠️'}`);
  }

  console.log('\n===== 汇总 =====');
  console.log(`播放记录总数: ${totalPr}`);
  console.log(`收藏总数: ${totalFav}`);
  console.log(`搜索历史总数: ${totalSh}`);
  console.log(`跳过配置总数: ${totalSkip}`);
  console.log(`带密码用户数: ${withPwd}/${usernames.length}`);
  console.log('\n结论: 若上面播放记录/收藏/搜索历史数量 > 0 且有 key 样例，说明备份文件内容正常，问题在导入环节；否则问题在导出环节。');
}

main();
