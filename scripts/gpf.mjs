import fs from 'node:fs';
import { chromium } from 'playwright';
const U = 'https://www.gpf.or.th/thai2019/About/main.php?page=memberfund&lang=th&menu=statistic';
const KW = ['หุ้นต่างประเทศ', 'หุ้นไทย', 'ตราสารหนี้ภาครัฐ', 'ตราสารหนี้', 'ตลาดเงิน', 'ทองคำ', 'อสังหาริมทรัพย์', 'สินทรัพย์ทางเลือก', 'ผสม'];
const prev = fs.existsSync('gpf.json') ? JSON.parse(fs.readFileSync('gpf.json', 'utf8')) : {};
const log = []; let plans = null, date = '', sample = '';
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ locale: 'th-TH', viewport: { width: 1280, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' });
  const p = await ctx.newPage();
  for (let i = 0; i < 3 && !plans; i++) {
    try { await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { log.push('รอบ ' + (i + 1) + ' goto: ' + e.message.slice(0, 80)); }
    await p.waitForTimeout(8000);
    const t = (await p.evaluate(() => document.body ? document.body.innerText : '')).replace(/\s+/g, ' ');
    const blocked = t.length < 500 || /Incapsula|Request unsuccessful/i.test(t);
    log.push(`รอบ ${i + 1}: ข้อความ ${t.length} ตัวอักษร${blocked ? ' (ถูกบล็อก/ยังไม่โหลด)' : ''}`);
    sample = t.slice(0, 1500);
    if (blocked) continue;
    const found = {};
    for (const k of KW) {
      let j = -1;
      while ((j = t.indexOf(k, j + 1)) >= 0) {
        const m = t.slice(j, j + 160).match(/\b(\d{1,3}\.\d{4})\b/);
        if (m) { found[k] = +m[1]; break; }
      }
    }
    const dm = t.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(25\d\d)/);
    if (Object.keys(found).length) { plans = found; date = dm ? dm[0].replace(/\s/g, '') : ''; log.push('อ่าน NAV ได้ ' + Object.keys(found).length + ' แผน'); }
    else { const k = t.indexOf('หุ้นต่างประเทศ'); sample = k >= 0 ? t.slice(Math.max(0, k - 200), k + 600) : t.slice(0, 1500); log.push('โหลดหน้าได้ แต่หา NAV ไม่เจอ (ดู sample)'); }
  }
} catch (e) { log.push('ผิดพลาด: ' + e.message.slice(0, 120)); }
finally { await b.close(); }
console.log(log.join('\n'));
let out;
if (plans) {
  if (JSON.stringify(plans) === JSON.stringify(prev.plans) && date === prev.date) process.exit(0);
  out = { updated: Date.now(), date, plans, log, sample };
} else {
  if (JSON.stringify(log) === JSON.stringify(prev.log)) process.exit(0);
  out = { ...prev, log, sample };
}
fs.writeFileSync('gpf.json', JSON.stringify(out));
