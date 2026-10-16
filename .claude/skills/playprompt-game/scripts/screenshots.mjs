// Home, play and win screenshots of a game, auto-solving 5 rounds. Needs Game.autoSolve().
// usage: node screenshots.mjs <abs path to game.html> <output prefix>
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => import('/opt/node-tools/node_modules/playwright/index.mjs'));
const [,, file, out] = process.argv;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto('file://' + file); await p.waitForTimeout(800);
await p.screenshot({ path: out + '-home.png' });
await p.click('#playBtn',{force:true}); await p.waitForTimeout(2500);
await p.screenshot({ path: out + '-play.png' });
// auto-play: use the game's own answer to win 5 rounds
for (let i = 0; i < 5; i++) { await p.evaluate(() => Game.autoSolve ? Game.autoSolve() : null); await p.waitForTimeout(2600); }
await p.waitForTimeout(1500);
await p.screenshot({ path: out + '-win.png' });
console.log('errors:', JSON.stringify(errs));
await b.close();
