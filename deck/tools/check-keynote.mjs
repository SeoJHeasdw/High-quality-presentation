import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'render/keynote');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)){external.push(u.href);return route.abort()}return route.continue()});
await page.goto('http://127.0.0.1:5180/#keynote');await page.waitForSelector('.kn-slide');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
const specs=await page.evaluate(async()=>{const d=await import('/src/keynote/KeynoteDeck.tsx');return d.default.slides.map(s=>({id:s.id,steps:s.steps||0,group:s.group}))});
const scriptMissing=await page.evaluate(async()=>{const d=await import('/src/keynote/KeynoteDeck.tsx'),{SCRIPT}=await import('/src/script.ts');return d.default.slides.flatMap(s=>Array.from({length:(s.steps||0)+1},(_,i)=>SCRIPT[s.scriptKey]?.[i]?null:`${s.id}:${i}`).filter(Boolean))});
const report={slides:[],errors,external,scriptMissing,filmShots:[]},frames=[];
const slideNumber=id=>specs.findIndex(s=>s.id===id)+1;
const factoryStart=slideNumber('factory-enter');
async function go(n){await page.keyboard.type(String(n));await page.keyboard.press('Enter');await page.waitForSelector(`.kn-slide[data-slide="${n}"]`)}
async function audit(){return page.evaluate(()=>{
 const root=document.querySelector('.kn-slide');
 const visible=el=>{for(let n=el;n&&n!==root.parentElement;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.05)return false}return true};
 const all=[...root.querySelectorAll('h1,h2,p,blockquote,.engine-world-label,.life-timeline strong')].filter(visible);
 const overflow=all.filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>1921||r.top<0||r.bottom>1000}).map(el=>el.textContent);
 const overlap=[];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){if(all[i].contains(all[j])||all[j].contains(all[i]))continue;const a=all[i].getBoundingClientRect(),b=all[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4)overlap.push([all[i].textContent,all[j].textContent])}
 const canvas=root.querySelector('canvas');return{n:Number(root.dataset.slide),step:Number(root.dataset.step),overflow,overlap,webgl:canvas?{frames:Number(canvas.dataset.frames||0),ready:canvas.dataset.ready,fallback:!!root.querySelector('[data-fallback]')}:null};
})}
for(let n=1;n<=specs.length;n++){
 await go(n);
 if(specs[n-1].group==='factory-flight'){
  await page.waitForSelector('.factory-film[data-status="held"]',{timeout:15000});await page.waitForTimeout(500);
  report.filmShots.push(await page.locator('.factory-film').evaluate(el=>{const v=el.querySelector('video[data-visible="true"]');return{phase:Number(el.dataset.phase),source:el.dataset.source,status:el.dataset.status,duration:v?.duration,muted:v?.muted}}));
 }else await page.waitForTimeout(1150);
 for(let step=0;step<=specs[n-1].steps;step++){
  if(step){await page.keyboard.press('ArrowRight');await page.waitForTimeout(1500)}
  report.slides.push(await audit());
 }
 const file=`slide-${String(n).padStart(2,'0')}.png`;await page.screenshot({path:path.join(out,file)});frames.push({file,label:await page.locator('.kn-slide').getAttribute('aria-label')});
}
// Verify lecturer-controlled image continuity, movement and reverse navigation.
await go(slideNumber('story-cat'));await page.waitForTimeout(1300);
await page.evaluate(()=>{window.__cat=document.querySelector('.cat-subject img');window.__catStart=document.querySelector('.cat-subject').getBoundingClientRect().toJSON()});
await page.keyboard.press('ArrowRight');await page.waitForTimeout(350);
const catMiddle=await page.locator('.cat-subject').evaluate(el=>el.getBoundingClientRect().toJSON());
await page.screenshot({path:path.join(out,'cat-midpoint.png')});
await page.waitForTimeout(1000);
report.cat=await page.evaluate(mid=>{const end=document.querySelector('.cat-subject').getBoundingClientRect(),start=window.__catStart;return{sameImage:document.querySelector('.cat-subject img')===window.__cat,movesLeft:end.x<start.x-200,shrinks:end.width<start.width*.8,interpolates:mid.x> end.x+1&&mid.x<start.x-1}},catMiddle);
await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.waitForTimeout(1300);
report.cat.nextSlideSameImage=await page.evaluate(()=>document.querySelector('.cat-subject img')===window.__cat);
report.cat.singleHeading=await page.locator('.cat-scene-heading').count()===1;
for(let i=0;i<3;i++)await page.keyboard.press('ArrowLeft');await page.waitForTimeout(1300);
report.cat.reverse=await page.evaluate(()=>Math.abs(document.querySelector('.cat-subject').getBoundingClientRect().x-window.__catStart.x)<1);
// Measure rendered connector endpoints against the actual HTML node ports.
await go(slideNumber('story-board'));await page.waitForTimeout(1000);
report.connections=await page.evaluate(()=>{
 const svg=document.querySelector('.incident-wiring'),paths=[...svg.querySelectorAll(':scope > g:not(.outside-wire) .wire-track')];
 const ports=[...document.querySelectorAll('.study-room-port')],board=document.querySelector('.shared-board').getBoundingClientRect();
 return paths.map((path,i)=>{const m=svg.getScreenCTM(),a=path.getPointAtLength(0).matrixTransform(m),b=path.getPointAtLength(path.getTotalLength()).matrixTransform(m),p=ports[i].getBoundingClientRect();return{roomError:Math.hypot(a.x-(p.x+p.width/2),a.y-(p.y+p.height/2)),boardError:Math.hypot(b.x-(board.x+board.width/2),b.y-board.y)}});
});
// Each authored film cue plays once, holds, and stays under presenter control.
await go(factoryStart);await page.waitForSelector('.factory-film[data-status="held"]',{timeout:15000});
await page.evaluate(()=>window.__film=document.querySelector('.factory-film'));
await page.keyboard.press('ArrowRight');await page.waitForSelector('.factory-film[data-status="playing"]');
await page.waitForTimeout(650);await page.screenshot({path:path.join(out,'film-transition.png')});
report.film={samePlayer:await page.evaluate(()=>window.__film===document.querySelector('.factory-film')),muted:await page.locator('.factory-film video[data-visible="true"]').evaluate(el=>el.muted)};
await page.waitForSelector('.factory-film[data-status="held"]',{timeout:15000});
await page.waitForTimeout(400);report.film.noAutoAdvance=await page.locator('.kn-slide').getAttribute('data-slide')===String(factoryStart+1);
await page.keyboard.press('ArrowLeft');await page.waitForSelector('.factory-film[data-phase="0"][data-status="held"]');
report.film.reverse=await page.locator('.factory-film').getAttribute('data-transition')==='reverse';
for(const key of ['ArrowRight','ArrowRight','ArrowRight'])await page.keyboard.press(key);
await page.waitForSelector('.factory-film[data-phase="3"][data-status="held"]',{timeout:15000});
report.film.rapidNavigation=await page.locator('.factory-film').getAttribute('data-source').then(x=>x.endsWith('04-music.mp4'));
await page.keyboard.press('r');await page.waitForSelector('.factory-film[data-status="playing"]');await page.waitForTimeout(250);
await page.keyboard.press('m');await page.waitForSelector('.factory-film[data-status="paused"]');
report.film.motionOff=await page.locator('.factory-film').evaluate(el=>[...el.querySelectorAll('video')].every(v=>v.paused)&&!!el.querySelector('img[data-visible="true"]'));
await page.keyboard.press('m');await page.waitForSelector('.factory-film[data-status="held"]');await page.waitForTimeout(350);
report.film.resumeHolds=await page.locator('.factory-film').getAttribute('data-status')==='held';
const presenter=await context.newPage();await presenter.goto('http://127.0.0.1:5180/#keynote/present');await presenter.waitForFunction(()=>document.querySelector('.pv__label code')?.textContent.includes('factory-music'));
report.presenter={synced:true};await presenter.keyboard.press('ArrowRight');await page.waitForSelector('.kn-slide[data-slide="22"]');report.presenter.controlsAudience=true;await presenter.close();
await page.waitForSelector('.factory-film[data-status="held"]',{timeout:15000});
await page.evaluate(()=>window.__filmMedia=[...document.querySelectorAll('.factory-film video')]);
await page.keyboard.press('ArrowRight');report.film.stopsOnLeave=await page.evaluate(()=>window.__filmMedia.every(v=>v.paused&&!v.hasAttribute('src')));
const noGpu=await browser.newPage({viewport:{width:1280,height:720}});await noGpu.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:g.call(this,type,...args)}});await noGpu.goto('http://127.0.0.1:5180/#keynote');await noGpu.waitForSelector('[data-fallback]');await noGpu.keyboard.type(String(slideNumber('factory-tts')));await noGpu.keyboard.press('Enter');await noGpu.waitForSelector('.factory-film[data-status="held"]',{timeout:15000});report.fallback=true;await noGpu.close();
report.media=[];
for(const id of ['demo-tts','demo-assets','demo-music']){
 await go(slideNumber(id));await page.waitForTimeout(500);
 await page.waitForFunction(()=>{const m=document.querySelector('video,audio');return m&&m.readyState>=2});
 const initial=await page.evaluate(()=>{const m=document.querySelector('video,audio');return{duration:m.duration,paused:m.paused,muted:m.muted}});
 await page.keyboard.press('p');await page.waitForTimeout(550);
 const playback=await page.evaluate(()=>{const m=document.querySelector('video,audio');return{time:m.currentTime,playing:!m.paused}});
 await page.keyboard.press('p');
 const pausedByKey=await page.evaluate(()=>document.querySelector('video,audio').paused);
 await page.keyboard.press('a');
 const soundEnabled=await page.evaluate(()=>!document.querySelector('video,audio').muted);
 await page.keyboard.press('a');await page.keyboard.press('p');
 await page.evaluate(()=>{window.__previousMedia=document.querySelector('video,audio')});
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(120);
 const stoppedOnLeave=await page.evaluate(()=>window.__previousMedia.paused);
 report.media.push({id,...initial,...playback,pausedByKey,soundEnabled,stoppedOnLeave});
}
const images=await Promise.all(frames.map(async f=>({...f,data:(await fs.readFile(path.join(out,f.file))).toString('base64')})));
await page.setViewportSize({width:1920,height:1900});await page.setContent(`<body style="margin:0;background:#15191c;color:#ccc;font:15px sans-serif"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:18px">${images.map(x=>`<div><img style="width:100%;display:block" src="data:image/png;base64,${x.data}"><p style="margin:8px 0 6px">${x.label}</p></div>`).join('')}</div></body>`);await page.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
if(!Object.values(report.cat).every(Boolean)||report.connections.some(c=>c.roomError>2||c.boardError>2)||errors.length||external.length||scriptMissing.length||report.slides.some(s=>s.overflow.length||s.overlap.length||s.webgl?.fallback)||report.filmShots.length!==5||new Set(report.filmShots.map(s=>s.source)).size!==5||report.filmShots.some(s=>s.status!=='held'||!(s.duration>1)||!s.muted)||!Object.values(report.film).every(Boolean)||!report.fallback||report.media.some(m=>!m.playing||m.time<=0||!m.muted||!m.pausedByKey||!m.soundEnabled||!m.stoppedOnLeave))process.exitCode=1;
