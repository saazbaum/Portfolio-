import fs from 'node:fs';
const W = [{ a: '0xbfe0b47d3155d85318aecdef21caa8adf80e88dc', n: 'Wallet 1' }, { a: '0x5152bee7840e3a6261034e7fecaf8ffbff5cb6ee', n: 'Wallet 2' }];
const BS = { ETH: ['eth.blockscout.com', 'ETH'], Base: ['base.blockscout.com', 'ETH'], Optimism: ['optimism.blockscout.com', 'ETH'], Arbitrum: ['arbitrum.blockscout.com', 'ETH'], Polygon: ['polygon.blockscout.com', 'POL'] };
const prev = fs.existsSync('wallets.json') ? JSON.parse(fs.readFileSync('wallets.json', 'utf8')) : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
async function J(url, opt) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, opt);
    if (r.status === 429) { await sleep(3000 * (i + 1)); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  throw new Error('HTTP 429');
}
async function debank(w) {
  const d = await J('https://pro-openapi.debank.com/v1/user/all_token_list?is_all=false&id=' + w.a, { headers: { AccessKey: process.env.DEBANK_KEY } });
  return d.filter(x => (x.is_core || x.is_verified) && !x.is_suspicious && x.price > 0 && x.amount > 0)
    .map(x => ({ ch: x.chain, id: x.id, sym: x.symbol, name: x.name, amt: x.amount, price: x.price, logo: x.logo_url }));
}
async function chain(w, ch, h, nat) {
  const out = [], base = 'https://' + h + '/api/v2/addresses/' + w.a;
  const ad = await J(base), tb = await J(base + '/token-balances');
  if (ad.coin_balance && +ad.exchange_rate > 0) out.push({ ch, id: 'native', sym: nat, name: nat, amt: ad.coin_balance / 1e18, price: +ad.exchange_rate });
  for (const x of Array.isArray(tb) ? tb : []) {
    const k = x.token || {};
    if (k.type !== 'ERC-20' || !(+k.exchange_rate > 0) || !(+k.holders_count >= 100)) continue;
    const amt = x.value / Math.pow(10, +k.decimals || 0);
    if (amt > 0) out.push({ ch, id: k.address_hash || k.address, sym: k.symbol, name: k.name, amt, price: +k.exchange_rate, logo: k.icon_url });
  }
  return out;
}
const wallets = [];
for (const w of W) {
  let items = [];
  if (process.env.DEBANK_KEY) {
    try { items = await debank(w); log.push(`${w.n} DeBank: ${items.length}`); } catch (e) { log.push(`${w.n} DeBank: ${e.message}`); }
  }
  if (!items.length) {
    for (const [ch, [h, nat]] of Object.entries(BS)) {
      try { const r = await chain(w, ch, h, nat); items.push(...r); log.push(`${w.n} ${ch}: ${r.length}`); }
      catch (e) {
        const old = prev?.wallets?.find(x => x.a === w.a)?.items.filter(x => x.ch === ch) || [];
        items.push(...old); log.push(`${w.n} ${ch}: ${e.message} (ใช้ค่าเดิม ${old.length})`);
      }
      await sleep(800);
    }
  }
  wallets.push({ a: w.a, n: w.n, items });
}
console.log(log.join('\n'));
if (!wallets.some(w => w.items.length)) { console.log('no data, keep old file'); process.exit(0); }
fs.writeFileSync('wallets.json', JSON.stringify({ updated: Date.now(), log, wallets }));
