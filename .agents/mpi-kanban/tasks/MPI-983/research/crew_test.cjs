// MPI-973: headless check of the landing's crew clips (a hidden browser pane plays no video).
const { chromium } = require('C:/AI/Mpi/Cubric-Vision/node_modules/playwright');
const URL = 'http://127.0.0.1:8743/';
const fails = [];
const check = (ok, msg) => { console.log(ok ? 'ok  ' : 'FAIL', msg); if (!ok) fails.push(msg); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // A. Opened at the top: all five swap to live clips, alpha survives.
  let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(4000);
  let s = await page.evaluate(() => ({
    clip: document.querySelectorAll('.crew__member.has-clip').length,
    noAlpha: document.documentElement.classList.contains('no-alpha'),
  }));
  check(s.clip === 5 && !s.noAlpha, `A top load: ${s.clip}/5 live, no-alpha=${s.noAlpha}`);

  // C. Hover greets.
  await page.hover('.crew__member--studio');
  await page.waitForTimeout(600);
  check(await page.evaluate(() => document.querySelector('.crew__member--studio').classList.contains('is-awake')), 'C hover wakes Cosmo');
  await page.close();

  // B. Opened at #download, then scrolled up: the crew still starts.
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL + '#download');
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(4000);
  s = await page.evaluate(() => document.querySelectorAll('.crew__member.has-clip').length);
  check(s === 5, `B #download then top: ${s}/5 live`);
  await page.close();

  // D. Reduced motion: stills only, no clip requested.
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForTimeout(2500);
  s = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => v.getAttribute('src')).length);
  check(s === 0, `D reduced motion: ${s} videos loaded`);
  await ctx.close();

  // E. Phone width: no horizontal overflow.
  page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(URL);
  await page.waitForTimeout(1500);
  s = await page.evaluate(() => document.documentElement.scrollWidth);
  check(s === 375, `E 375px: scrollWidth ${s}`);
  await page.screenshot({ path: require('path').join(require('os').tmpdir(), 'mpi983-mobile-full.png'), fullPage: true });
  await page.close();

  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
