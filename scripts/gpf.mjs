import fs from 'node:fs';
const U = 'https://www.gpf.or.th/thai2019/About/main.php?page=memberfund&lang=th&menu=statistic';
const KW = ['หุ้นต่างประเทศ', 'หุ้นไทย', 'ตราสารหนี้ภาครัฐ', 'ตราสารหนี้', 'ตลาดเงิน', 'ทองคำ', 'อสังหาริมทรัพย์', 'สินทรัพย์ทางเลือก', 'ผสม'];
const UA = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
];
const prev = fs.existsSync('gpf.json') ? JSON.parse(fs.readFileSync('gpf.json', 'utf8')) : {};
const log = []; let plans = null, date = '', sample = '';
for (const ua of UA) {
  try {
    const r = await fetch(U, { headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml', 'accept-language': 'th-TH,th;q=0.9,en;q=0.8' } });
    const h = await r.text();
    const t = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const blocked = /Incapsula|Request unsuccessful|incident_id/i.test(h) || t.length < 500;
    log.push(`${ua.slice(13, 30)}: HTTP ${r.status}, ${h.length} bytes${blocked ? ', ถูกบล็อก/ไม่มีเนื้อหา' : ''}`);
    if (blocked) continue;
    const found = {};
    for (const k of KW) {
      let i = -1;
      while ((i = t.indexOf(k, i + 1)) >= 0) {
        const m = t.slice(i, i + 160).match(/\b(\d{1,3}\.\d{4})\b/);
        if (m) { found[k] = +m[1]; break; }
      }
    }
    const dm = t.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(25\d\d)/);
    sample = t.slice(Math.max(0, t.indexOf('หุ้นต่างประเทศ') - 100), t.indexOf('หุ้นต่างประเทศ') + 400);
    if (Object.keys(found).length) { plans = found; date = dm ? dm[0].replace(/\s/g, '') : ''; log.push('อ่าน NAV ได้ ' + Object.keys(found).length + ' แผน'); break; }
    log.push('โหลดหน้าได้ แต่หา NAV ไม่เจอ (ดู sample)');
  } catch (e) { log.push(`${ua.slice(13, 30)}: ${e.message}`); }
}
console.log(log.join('\n'));
let out;
if (plans) {
  if (JSON.stringify(plans) === JSON.stringify(prev.plans) && date === prev.date) process.exit(0);
  out = { updated: Date.now(), date, plans, log, sample };
} else {
  if (JSON.stringify(log) === JSON.stringify(prev.log)) process.exit(0);
  out = { ...prev, log, sample: sample || prev.sample };
}
fs.writeFileSync('gpf.json', JSON.stringify(out));
