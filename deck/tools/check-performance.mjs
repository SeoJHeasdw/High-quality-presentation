import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve(import.meta.dirname, '../render/performance');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-gl=angle', '--use-angle=metal'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const errors = [], external = [], report = {};
context.on('page', page => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});
await context.route('**/*', route => {
  if (!['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
const page = await context.newPage();
async function go(number) {
  await page.keyboard.type(String(number)); await page.keyboard.press('Enter');
  await page.waitForSelector(`.kn-slide[data-slide="${number}"]`);
  await page.waitForTimeout(850);
}
async function shot(name) { await page.screenshot({ path: path.join(out, `${name}.png`) }); }
async function point(locator, x = .5, y = .5) {
  const rect = await locator.boundingBox(); assert(rect);
  return { x: rect.x + rect.width * x, y: rect.y + rect.height * y };
}
try {
  await page.goto('http://127.0.0.1:5180/#keynote');
  await page.waitForSelector('.kn-slide'); await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  await page.mouse.move(1150, 360); await page.mouse.move(920, 250, { steps: 18 });
  await page.mouse.click(920, 250); await page.waitForTimeout(100); await shot('01-cover-restored');
  assert.equal(await page.locator('.waves-canvas,.performance-click-spark,.performance-cover-cue').count(), 0);
  assert.equal(await page.locator('.kn-field canvas').count(), 1);
  report.cover = 'original cover restored; no React Bits overlay, cue, or click effect';

  await go(4);
  const ripple = page.locator('.ripple-distortion canvas');
  await ripple.waitFor();
  await page.mouse.move(1040, 320); await page.mouse.move(880, 275, { steps: 12 });
  await page.mouse.click(880, 275); await page.waitForTimeout(160); await shot('04-future-ripple');
  assert.equal(await page.locator('.performance-click-spark').getAttribute('data-active'), 'true');
  assert(Number(await ripple.getAttribute('data-interactions')) >= 2);
  await page.waitForFunction(() => document.querySelector('.ripple-distortion canvas')?.dataset.active === 'false');
  assert.equal(await page.locator('.performance-click-spark').getAttribute('data-active'), 'false');
  const frames = await ripple.getAttribute('data-frames');
  await page.waitForTimeout(250); assert.equal(await ripple.getAttribute('data-frames'), frames);
  const beforeKey = Number(await ripple.getAttribute('data-interactions'));
  await page.locator('.future-surface-touch').focus(); await page.keyboard.press('Enter');
  assert(Number(await ripple.getAttribute('data-interactions')) > beforeKey);
  await page.keyboard.press('m');
  assert.equal(await page.locator('.ripple-distortion canvas').count(), 0);
  assert.equal(await page.locator('.future-surface img').count(), 1);
  await page.keyboard.press('m');
  report.ripple = 'scaled pointer, click, keyboard pulse, idle RAF stops, M fallback';

  await go(17);
  const preview = page.locator('.rb-tilted-card').nth(1);
  const tiltPoint = await point(preview, .85, .2);
  await page.mouse.move(tiltPoint.x, tiltPoint.y); await page.waitForTimeout(500);
  assert.match(await preview.locator('.rb-tilted-card__inner').evaluate(el => getComputedStyle(el).transform), /matrix3d/);
  await shot('17-hover'); await preview.click();
  await page.waitForSelector('dialog[open]'); await shot('17-enlarged');
  await page.keyboard.type('5'); await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await page.locator('.goto').count(), 0);
  assert(await preview.evaluate(el => el === document.activeElement));
  await page.keyboard.press('Enter'); await page.waitForSelector('dialog[open]');
  await page.keyboard.press('ArrowRight'); await page.waitForSelector('.kn-slide[data-slide="18"]');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await page.locator('.performance-click-spark').count(), 0);
  await go(17); await page.keyboard.press('m');
  assert.equal(await page.locator('.rb-tilted-card__inner').first().evaluate(el => getComputedStyle(el).transform), 'none');
  await page.keyboard.press('m');
  report.preview = 'hover tilt, click/Enter enlarge, Escape restores focus, arrow continues, M resets';

  await go(27);
  const face = page.locator('.abuse-face-control');
  const facePoint = await point(face, .65, .35);
  await page.mouse.move(facePoint.x, facePoint.y); await page.waitForTimeout(200);
  assert.equal(await page.locator('.abuse-face-interactive').getAttribute('data-tracking'), 'true');
  await face.click(); await page.waitForTimeout(220); await shot('27-reconstruction');
  await page.waitForTimeout(1000);
  assert.equal(await face.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.kn-slide').getAttribute('data-step'), '0');
  await page.keyboard.press('m');
  assert.equal(await page.locator('.abuse-face-plane').evaluate(el => getComputedStyle(el).transform), 'none');
  await face.click(); assert.equal(await face.getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('m');
  report.face = 'pointer lens, pixel rebuild, does not advance cue, M still allows inspection';

  await go(31);
  const evidence = page.getByRole('button', { name: '가상의 음성 메시지 살펴보기' });
  await evidence.hover(); await page.waitForTimeout(900);
  assert.equal(await evidence.getAttribute('aria-expanded'), 'true');
  await evidence.click(); await page.mouse.move(80, 100); await evidence.blur();
  assert.equal(await evidence.getAttribute('aria-pressed'), 'true'); await shot('31-inspected');
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.kn-slide[data-step="1"] .abuse-inspection-control[aria-pressed="false"]');
  assert.equal(await evidence.getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.kn-slide').getAttribute('data-step'), '1');
  await go(32); await page.keyboard.press('ArrowRight');
  const media = page.getByRole('button', { name: '이미지의 출처와 동의 살펴보기' });
  await media.hover(); await page.waitForTimeout(1000); await media.click();
  assert.equal(await media.getAttribute('aria-pressed'), 'true'); await shot('32-inspected');
  report.inspection = 'message/media reveal, click pin, keyboard cue resets inspection';

  await go(37);
  const choices = page.locator('.rb-true-focus__item');
  await choices.nth(1).hover(); await page.waitForTimeout(500);
  assert.equal(await page.locator('.rb-true-focus').getAttribute('data-active'), '1');
  await choices.nth(1).click(); assert.equal(await choices.nth(1).getAttribute('aria-pressed'), 'true');
  await page.mouse.move(10, 10); await choices.first().focus(); await page.keyboard.press('Enter');
  assert.equal(await choices.first().getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(500); await shot('37-focus');
  const frameError = await page.locator('.rb-true-focus').evaluate(host => {
    const frame = host.querySelector('.rb-true-focus__frame').getBoundingClientRect();
    const item = host.querySelector('[data-active="true"]').getBoundingClientRect();
    return Math.max(Math.abs(frame.x-item.x), Math.abs(frame.y-item.y), Math.abs(frame.width-item.width), Math.abs(frame.height-item.height));
  });
  assert(frameError < 2, `focus frame error: ${frameError}`);
  report.closing = { keyboardSelection: true, frameError };

  const reduced = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  await reduced.goto('http://127.0.0.1:5180/#keynote'); await reduced.waitForSelector('.kn-slide');
  assert.equal(await reduced.locator('.waves-canvas,.performance-click-spark').count(), 0);
  await reduced.keyboard.type('4'); await reduced.keyboard.press('Enter');
  await reduced.waitForSelector('.future-surface img'); await reduced.close();
  const noGpu = await browser.newPage();
  await noGpu.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type,...args) { return /webgl/.test(type) ? null : get.call(this,type,...args); }; });
  await noGpu.goto('http://127.0.0.1:5180/#keynote'); await noGpu.waitForSelector('.kn-slide');
  await noGpu.keyboard.type('4'); await noGpu.keyboard.press('Enter');
  await noGpu.waitForSelector('.ripple-distortion[data-fallback="true"]');
  assert.match(await noGpu.locator('.ripple-distortion').evaluate(el => getComputedStyle(el).backgroundImage), /future-surface.svg/);
  await noGpu.close(); report.fallbacks = 'OS reduced motion and missing WebGL keep visible content';
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ ...report, errors, external }, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
