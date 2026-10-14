// 43~45 · Blender 전시관이 쓸 손그림을 선으로 풀어 render/mind-hall/drawings.json에 쓴다.
// 덱과 같은 SVG 해석(three의 SVGLoader, mind/ink.ts의 svgPolys)을 쓰려고 실행 중인 덱 서버(5180)의 브라우저에서 푼다.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, 'render/mind-hall/drawings.json');
const host = process.env.DECK_HOST ?? 'http://localhost:5180';
const browser = await chromium.launch(), page = await browser.newPage();
await page.goto(`${host}/#keynote`); await page.waitForSelector('.kn-slide');
const data = await page.evaluate(async () => {
  const { svgPolys } = await import('/src/keynote/mind/ink.ts');
  const S = await import('/src/keynote/mind/drawings.ts');
  const names = ['BAT', 'SONAR', 'BRAIN', 'MONITOR', 'CUP', 'BUST', 'SLIME', 'JELLY', 'BEE', 'OCTOPUS', 'DOG', 'BIRD', 'CRAB', 'FISH'];
  return Object.fromEntries(names.map((n) => { const [d, vw, vh] = S[n]; return [n, { vw, vh, polys: svgPolys(d, n === 'BUST' ? 6 : 3).map((p) => p.map((v) => [+v.x.toFixed(2), +v.y.toFixed(2)])) }]; }));
});
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(data));
console.log(Object.entries(data).map(([k, v]) => `${k}:${v.polys.length}`).join(' '));
await browser.close();
