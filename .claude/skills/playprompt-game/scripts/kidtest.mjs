// "4-year-old" chaos tester. usage: node kidtest.mjs <file.html> <outprefix> [roundWaitMs]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => import('/opt/node-tools/node_modules/playwright/index.mjs'));
const [,, file, out, waitArg] = process.argv;
const W = +(waitArg || 3000);
const b = await chromium.launch();
const results = [];
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const rnd = (a, b) => a + Math.random() * (b - a);

async function newPage(vp = { width: 1180, height: 820 }) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: vp.width < 900 });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => m.type() === 'error' && p.errs.push(m.text()));
  await p.addInitScript(() => { window.__said = []; const s = window.speechSynthesis; if (s) { const o = s.speak.bind(s); s.speak = u => { window.__said.push(u.text); }; } });
  await p.goto('file://' + file); await p.waitForTimeout(700);
  return p;
}
const state = p => p.evaluate(() => ({ round: S.round, stars: S.stars, busy: S.busy, demo: S.demo, win: document.querySelector('#win').classList.contains('on'), play: document.querySelector('#play').classList.contains('on'), home: document.querySelector('#home').classList.contains('on') }));
async function tapStage(p, x, y) { const box = await p.locator('#stage').boundingBox(); const k = box.width / 1180; await p.touchscreen.tap(box.x + x * k, box.y + y * k); }
async function finish(p, maxRounds = 8) {           // can the game still be won after chaos?
  for (let i = 0; i < maxRounds; i++) { const s = await state(p); if (s.win) return true; await p.evaluate(() => { if (!S.busy || S.demo) Game.autoSolve(); }); await p.waitForTimeout(W); }
  return (await state(p)).win;
}
async function rect(p, sel) { return p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), sr = document.querySelector('#stage').getBoundingClientRect(), k = sr.width / 1180; return { x: (r.left - sr.left + r.width / 2) / k, y: (r.top - sr.top + r.height / 2) / k }; }, sel); }

// 1. Button mashing on the start screen, then mashing during play
{
  const p = await newPage();
  for (let i = 0; i < 40; i++) await tapStage(p, rnd(0, 1180), rnd(0, 820));
  await p.waitForTimeout(500);
  let s = await state(p);
  if (!s.play) { await p.click('#playBtn', { force: true }); }
  await p.waitForTimeout(1500);
  for (let i = 0; i < 150; i++) { await tapStage(p, rnd(0, 1180), rnd(100, 820)); await p.waitForTimeout(rnd(10, 80)); }
  s = await state(p);
  check('mash: round count sane', s.round <= 5 && s.stars <= 3, JSON.stringify(s));
  await p.screenshot({ path: out + '-kid-mash.png' });
  const ok = s.home ? true : await finish(p);
  check('mash: game still winnable afterwards', ok);
  check('mash: no JS errors', !p.errs.length, p.errs.slice(0, 3).join(' | '));
  await p.context().close();
}
// 2. Double/triple tapping the correct answer must count once; tapping during transition is ignored
{
  const p = await newPage(); await p.click('#playBtn', { force: true }); await p.waitForTimeout(2000);
  await p.evaluate(() => { Game.autoSolve(); Game.autoSolve(); Game.autoSolve(); });
  await p.waitForTimeout(300);
  const s1 = await state(p);
  const t0 = Date.now(); while (Date.now() - t0 < 1000) { await tapStage(p, rnd(200, 1000), rnd(650, 800)); }   // only inside the transition window
  await p.waitForTimeout(W);
  const s2 = await state(p);
  check('triple-tap correct counts once', s1.round <= 1 && s2.round === 1, `after=${s1.round}, after transition taps=${s2.round}`);
  check('no errors', !p.errs.length, p.errs.slice(0, 3).join(' | '));
  await p.context().close();
}
// 3. Repeated wrong answers: never stuck, still winnable, encouraging words only
{
  const p = await newPage(); await p.click('#playBtn', { force: true }); await p.waitForTimeout(2000);
  const wrongSel = await p.evaluate(() => Game.wrongTarget ? (Game.wrongTarget()) : null);
  for (let i = 0; i < 12; i++) { await p.evaluate(() => { const el = Game.wrongTarget && Game.wrongTarget(); el && el.click(); }); await p.waitForTimeout(250); }
  await p.waitForTimeout(6000);
  const s = await state(p);
  check('wrong x12: not stuck busy', !s.busy, JSON.stringify(s));
  const said = await p.evaluate(() => window.__said.join(' / '));
  check('no voice: game never speaks (pictures explain it)', !said, said.slice(0, 300));
  const harsh = await p.evaluate(() => /wrong|lose|lost|fail|game over/i.test(document.querySelector('#stage').innerText));
  check('wrong x12: no harsh words on screen', !harsh);
  check('wrong x12: still winnable', await finish(p));
  check('no errors', !p.errs.length, p.errs.slice(0, 3).join(' | '));
  await p.context().close();
}
// 4. Idle child: hint hand appears
{
  const p = await newPage(); await p.click('#playBtn', { force: true }); await p.waitForTimeout(11000);
  const on = await p.evaluate(() => document.querySelector('#hand').classList.contains('on'));
  check('idle 11s: hint hand shows', on);
  await p.screenshot({ path: out + '-kid-hint.png' });
  // quick poke on home must NOT leave
  const h = await rect(p, '#homeBtn'); await tapStage(p, h.x, h.y); await p.waitForTimeout(400);
  check('quick tap on home does not quit', (await state(p)).play);
  await p.context().close();
}
// 5. Child taps all over during the "Show me how" demo
{
  const p = await newPage(); await p.click('#demoBtn', { force: true });
  for (let i = 0; i < 60; i++) { await tapStage(p, rnd(0, 1180), rnd(100, 820)); await p.waitForTimeout(rnd(80, 300)); }
  await p.waitForTimeout(25000);
  const s = await state(p);
  check('demo + mashing: demo ends, real game resumes', !s.demo && s.play && s.round <= 1, JSON.stringify(s));
  await p.screenshot({ path: out + '-kid-afterdemo.png' });
  check('demo + mashing: still winnable', await finish(p));
  check('no errors', !p.errs.length, p.errs.slice(0, 3).join(' | '));
  await p.context().close();
}
// 6. Win -> play again -> win again; win -> home
{
  const p = await newPage(); await p.click('#playBtn', { force: true }); await p.waitForTimeout(1500);
  check('first win', await finish(p));
  await p.click('#againBtn', { force: true }); await p.waitForTimeout(1500);
  const s = await state(p); check('play again resets stars/round', s.round === 0 && s.stars === 0 && s.play && !s.win, JSON.stringify(s));
  check('second win', await finish(p));
  await p.click('#winHome', { force: true }); await p.waitForTimeout(500);
  check('home from win', (await state(p)).home);
  check('no errors', !p.errs.length, p.errs.slice(0, 3).join(' | '));
  await p.context().close();
}
// 7. Harder level playable
{
  const p = await newPage(); await p.click('.lvl[data-level="1"]', { force: true }); await p.click('#playBtn', { force: true }); await p.waitForTimeout(2500);
  await p.screenshot({ path: out + '-kid-harder.png' });
  check('harder level winnable', await finish(p));
  check('no errors', !p.errs.length, p.errs.slice(0, 3).join(' | '));
  await p.context().close();
}
// 8. Phone portrait + tablet: tap targets
{
  for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
    const p = await newPage(vp); await p.click('#playBtn', { force: true }); await p.waitForTimeout(2000);
    const k = await p.evaluate(() => document.querySelector('#stage').getBoundingClientRect().width / 1180);
    await p.screenshot({ path: `${out}-kid-${vp.width}x${vp.height}.png` });
    const rot = await p.evaluate(() => { const r = document.querySelector('#rotate'); return !!r && getComputedStyle(r).display !== 'none'; });
    check(`${vp.width}x${vp.height}: tiles ${Math.round(100 * k)}px (want >= 44) or turn-sideways prompt shown`, 100 * k >= 44 || rot, rot ? 'rotate prompt' : '');
    await p.context().close();
  }
}
console.log(results.join('\n'));
await b.close();
