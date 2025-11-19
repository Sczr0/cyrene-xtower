import https from 'https';
import 'dotenv/config';

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const API_TOKEN = process.env.CACHE_PURGE_TOKEN;

const data = JSON.stringify({ purge_everything: true });

const options = {
  hostname: 'api.cloudflare.com',
  port: 443,
  path: `/client/v4/zones/${ZONE_ID}/purge_cache`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Length': data.length
  }
};

console.log('正在请求 Cloudflare 清除缓存...');

const req = https.request(options, (res) => {
  let responseBody = '';

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('缓存清除成功！');
    } else {
      console.error(`清除失败 (状态码: ${res.statusCode})`);
      console.error('错误详情:', responseBody);
    }
  });
});

req.on('error', (error) => {
  console.error('请求发送失败:', error);
});

req.write(data);
req.end();