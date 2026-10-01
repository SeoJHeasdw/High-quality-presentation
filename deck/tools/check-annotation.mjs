import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: process.env.HEADFUL !== '1' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const fullscreen = () => page.evaluate(() => !!document.fullscreenElement);
const ink = () => page.locator('.annotation__canvas').evaluate(canvas => canvas.toDataURL());

try {
  await page.goto('http://127.0.0.1:5180/#keynote');
  await page.waitForSelector('.kn-slide');
  await page.keyboard.press('w');
  assert.equal(await page.locator('.annotation').getAttribute('data-active'), 'true');
  await page.getByRole('button', { name: '텍스트 · 더블클릭' }).click();
  const before = await ink();
  await page.locator('.annotation__canvas').dblclick({ position: { x: 560, y: 340 } });
  const input = page.getByRole('textbox', { name: '장표에 쓸 텍스트' });
  const initialWidth = await input.evaluate(element => element.offsetWidth);
  await input.fill('가'.repeat(45));
  const expanded = await input.evaluate(element => ({
    width: element.offsetWidth,
    height: element.offsetHeight,
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    right: element.offsetLeft + element.offsetWidth,
  }));
  assert(expanded.width > initialWidth && expanded.width > 520, 'text box should grow with its contents');
  assert(expanded.right <= 1920);
  assert(expanded.height > 60, 'long text should wrap and grow vertically');
  assert(expanded.scrollWidth <= expanded.clientWidth && expanded.scrollHeight <= expanded.clientHeight, 'text box should not scroll');
  await input.fill('강의 메모\n두 번째 줄');
  assert((await input.evaluate(element => element.offsetWidth)) < expanded.width, 'text box should shrink with shorter text');
  await page.keyboard.press('w');
  await page.keyboard.press('1');
  assert.equal(await page.locator('.annotation').getAttribute('data-active'), 'true');
  assert.match(await input.inputValue(), /w1$/);
  await page.locator('.annotation__canvas').click({ position: { x: 850, y: 650 } });
  assert.equal(await input.count(), 0);
  const committed = await ink();
  assert.notEqual(committed, before);

  await page.keyboard.press('w');
  assert.equal(await page.locator('.annotation').getAttribute('data-active'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.annotation').getAttribute('data-active'), 'false');
  await page.keyboard.press('w');
  assert.equal(await ink(), committed);
  await page.locator('.annotation__canvas').dblclick({ position: { x: 900, y: 650 } });
  const bottomInput = page.getByRole('textbox', { name: '장표에 쓸 텍스트' });
  await bottomInput.fill('아래쪽 메모\n두 번째 줄\n세 번째 줄\n네 번째 줄');
  const bottom = await bottomInput.evaluate(element => ({
    bottom: element.offsetTop + element.offsetHeight,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  assert(bottom.bottom <= 1080 && bottom.scrollHeight <= bottom.clientHeight, 'text box should grow upward near slide bottom');
  await page.locator('.annotation__canvas').click({ position: { x: 200, y: 200 } });
  await page.keyboard.press('Escape');

  await page.keyboard.press('w');
  await page.getByRole('button', { name: '텍스트 · 더블클릭' }).click();
  await page.locator('.annotation__canvas').dblclick({ position: { x: 600, y: 380 } });
  await page.getByRole('textbox', { name: '장표에 쓸 텍스트' }).fill('Esc로 확정');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.annotation').getAttribute('data-active'), 'false');
  assert.notEqual(await ink(), committed);

  await page.keyboard.press('f');
  await page.waitForFunction(() => !!document.fullscreenElement);
  assert.equal(await fullscreen(), true);
  await page.keyboard.press('w');
  assert.equal(await page.locator('.annotation').getAttribute('data-active'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.annotation').getAttribute('data-active'), 'false');
  assert.equal(await fullscreen(), true, 'first Escape should preserve fullscreen while drawing closes');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await fullscreen(), false);

  await page.keyboard.type('21');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.kn-slide[data-slide="21"]');
  const previews = page.locator('.rb-tilted-card');
  assert.equal(await previews.count(), 3);
  await page.keyboard.press('f');
  await page.waitForFunction(() => !!document.fullscreenElement);
  assert.equal(await fullscreen(), true);
  for (let i = 0; i < 3; i++) {
    await previews.nth(i).click();
    await page.waitForSelector('dialog[open]');
    if (i === 0) await page.keyboard.type('5');
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    assert.equal(await page.locator('.goto').count(), 0);
    assert.equal(await fullscreen(), true, `preview ${i + 1} should close before fullscreen`);
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await fullscreen(), false);
  assert.deepEqual(errors, []);
  console.log('auto-sizing annotation text, Escape priority, and three previews: OK');
} finally {
  await browser.close();
}
