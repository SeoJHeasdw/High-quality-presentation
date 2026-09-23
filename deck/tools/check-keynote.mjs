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
 // 사진 속 휴대전화 화면(.np-screen)은 원근으로 기울어 있어 글줄의 직사각형 경계가 서로 겹친다. 실제 글은 겹치지 않으므로 제외한다.
 const all=[...root.querySelectorAll('h1,h2,p,blockquote,.engine-world-label,.life-timeline strong')].filter(el=>!el.closest('.np-screen')).filter(visible);
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
  if(step){await page.keyboard.press('ArrowRight');await page.waitForTimeout(1500);if(await page.locator('.nm[data-scroll-page]').count())await page.waitForSelector('.nm[data-settled="true"]',{timeout:15000})}
  report.slides.push(await audit());
 }
 const file=`slide-${String(n).padStart(2,'0')}.png`;await page.screenshot({path:path.join(out,file)});frames.push({file,label:await page.locator('.kn-slide').getAttribute('aria-label')});
}
// 2~3 · 사진에서 강의 영상까지: 하나의 3D 공간이 두 장 동안 유지되고, 네 큐를 앞뒤로 오가며, 마지막 큐에서 실제 영상이 재생된다.
await go(slideNumber('story-cat'));await page.waitForSelector('.op-canvas[data-ready]',{timeout:10000});await page.waitForTimeout(600);
await page.evaluate(()=>{window.__opening=document.querySelector('.op-canvas')});
const cue=()=>page.evaluate(()=>Number(document.querySelector('.op').dataset.cue));
report.cat={start:await cue()===0};
await page.keyboard.press('ArrowRight');await page.waitForTimeout(700);await page.screenshot({path:path.join(out,'cat-midpoint.png')});
await page.waitForTimeout(5200);report.cat.word=await cue()===1;
await page.keyboard.press('ArrowRight');await page.waitForTimeout(2600);
report.cat.nextSlideSameSpace=await page.evaluate(()=>document.querySelector('.op-canvas')===window.__opening);
report.cat.request=await cue()===2&&await page.locator('.op-request[data-on]').count()===1;
await page.keyboard.press('ArrowRight');await page.waitForTimeout(3900);
report.cat.lecturePlays=await page.evaluate(()=>{const v=document.querySelector('.op-screen video');return !!v&&!v.paused&&!v.muted&&v.currentTime>0});
report.cat.singleHeading=await page.locator('.op-heading').count()===1;
for(let i=0;i<3;i++)await page.keyboard.press('ArrowLeft');await page.waitForTimeout(1300);
report.cat.reverse=await cue()===0&&await page.evaluate(()=>document.querySelector('.op-canvas')===window.__opening&&document.querySelector('.op-screen video').paused);
// 6 · 요청의 흐름이 숫자가 되고, 다음 큐에서 자동화가 세 칸으로 나뉜다. 같은 캔버스가 두 큐를 지나고 뒤로 가면 숫자로 돌아온다.
await go(slideNumber('story-bots'));await page.waitForSelector('.bt-canvas[data-ready]',{timeout:10000});
await page.evaluate(()=>{window.__bots=document.querySelector('.bt-canvas')});
await page.waitForTimeout(5000);
report.bots={numbers:await page.evaluate(()=>document.querySelector('.bt').dataset.cue==='0'&&Number(getComputedStyle(document.querySelector('.bt-group')).opacity)>.99)};
// 질문은 칸이 나뉜 뒤 3.3초에 떠올라 4.2초에 다 선다(bots.css).
await page.keyboard.press('ArrowRight');await page.waitForTimeout(4600);
report.bots.parts=await page.evaluate(()=>document.querySelector('.bt').dataset.cue==='1'&&document.querySelectorAll('.bt-part').length===3&&Number(getComputedStyle(document.querySelector('.bt-question')).opacity)>.99);
await page.keyboard.press('ArrowLeft');await page.waitForTimeout(600);
report.bots.reverse=await page.evaluate(()=>document.querySelector('.bt-canvas')===window.__bots&&document.querySelector('.bt').dataset.cue==='0'&&!document.querySelector('.bt-part')&&!document.querySelector('.bt[data-fallback]'));
// 9 → 10 · 연결 장면에서 사건 공간으로. 같은 캔버스가 이어지고(-2 → -1 → 0), 라벨이 제목을 덮지 않으며, 뒤로 가면 연결 장면으로 돌아온다.
await go(slideNumber('story-closed-door'));await page.waitForSelector('.iw-canvas[data-ready]',{timeout:10000});
await page.evaluate(()=>{window.__bridge=document.querySelector('.iw-canvas')});
const bridgeBeat=()=>page.evaluate(()=>{const c=document.querySelector('.iw-canvas'),h=document.querySelector('.i3-heading h1').getBoundingClientRect(),n=document.querySelector('.i3-narrative').getBoundingClientRect();
 const hit=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4;
 const boxes=[...document.querySelectorAll('.iw-label[data-on] .iw-label-box')].map(el=>el.getBoundingClientRect());
 return{phase:Number(c.dataset.phase),same:c===window.__bridge,labels:boxes.length,covers:boxes.filter(b=>hit(b,h)||hit(b,n)).length}});
report.bridge=[];
for(let i=0;i<3;i++){if(i)await page.keyboard.press('ArrowRight');await page.waitForTimeout(i?3400:3800);report.bridge.push(await bridgeBeat())}
await page.keyboard.press('ArrowLeft');await page.waitForTimeout(2600);report.bridge.push(await bridgeBeat());
const bridgeOk=report.bridge.map(b=>b.phase).join(',')==='-2,-1,0,-1'&&report.bridge.every(b=>b.same&&b.labels>0&&!b.covers);
// 7~8, 17~20 · 묶인 3D 공간: 장이 바뀌어도 같은 캔버스가 이어지고, 모든 단계가 그려지며, 뒤로 가면 처음 단계로 돌아온다.
report.groups={};
for(const [name,first,beats] of [['agentWeb','story-web-door',5],['oneUser','manifesto-requirements',10]]){
 await go(slideNumber(first));await page.waitForSelector('.iw-canvas[data-ready]',{timeout:10000});await page.waitForTimeout(400);
 await page.evaluate(()=>{window.__groupCanvas=document.querySelector('.iw-canvas')});
 const phases=[];for(let i=0;i<beats;i++){if(i){await page.keyboard.press('ArrowRight');await page.waitForTimeout(1800)}phases.push(await page.evaluate(()=>Number(document.querySelector('.iw').dataset.phase)))}
 const same=await page.evaluate(()=>document.querySelector('.iw-canvas')===window.__groupCanvas);
 for(let i=1;i<beats;i++)await page.keyboard.press('ArrowLeft');await page.waitForTimeout(900);
 report.groups[name]={phases:phases.join(','),same,reverse:await page.evaluate(()=>Number(document.querySelector('.iw').dataset.phase))===0,fallback:await page.locator('.iw[data-fallback]').count()===0};
}
const groupsOk=Object.values(report.groups).every(g=>g.phases===Array.from({length:g.phases.split(',').length},(_,i)=>i).join(',')&&g.same&&g.reverse&&g.fallback)&&report.groups.oneUser.phases.split(',').length===10;
// 13·14 · 같은 집과 30년 눈금: 14번 세 단계 동안 배경과 눈금을 다시 그리지 않고, 뒤로 가면 13번 글이 돌아온다.
await go(slideNumber('manifesto-person'));await page.waitForTimeout(500);
await page.evaluate(()=>{window.__ruler=document.querySelector('.p13-years')});
for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await page.waitForTimeout(700)}
report.ruler={same:await page.evaluate(()=>document.querySelector('.p13-years')===window.__ruler),beat:await page.evaluate(()=>document.querySelector('.p13-years').dataset.beat)};
for(let i=0;i<3;i++)await page.keyboard.press('ArrowLeft');await page.waitForTimeout(900);
report.ruler.back=await page.evaluate(()=>document.querySelector('.p13-years')===window.__ruler&&Number(getComputedStyle(document.querySelector('.p13-copy-fade')).opacity)>.99);
const rulerOk=report.ruler.same&&report.ruler.beat==='2'&&report.ruler.back;
// 40~43 · 같은 집의 새벽과 아침: 네 장 동안 배경을 다시 그리지 않고, 43번에서만 아침 배경이 드러난다.
await go(slideNumber('manifesto-remains'));await page.waitForTimeout(600);
await page.evaluate(()=>{window.__finaleSky=document.querySelector('.fn-sky')});
const sunOpacity=()=>page.evaluate(()=>Number(getComputedStyle(document.querySelector('.fn-plate--sun')).opacity));
report.finale={beforeSun:await sunOpacity()};
// 42번은 세 단계(3D 설계도)다. 40 → 41 → 42·0 → 42·1 → 42·2 → 43
for(let i=0;i<5;i++){await page.keyboard.press('ArrowRight');await page.waitForTimeout(i===2?1200:500);if(i===2)report.finale.blueprint=await page.evaluate(()=>!!document.querySelector('.fb3-canvas[data-ready]')&&document.querySelector('.fn-sky')===window.__finaleSky)}
await page.waitForTimeout(2900);
Object.assign(report.finale,{same:await page.evaluate(()=>document.querySelector('.fn-sky')===window.__finaleSky),afterSun:await sunOpacity(),choices:await page.locator('.kn-slide .rb-true-focus__item').count()});
const finaleOk=report.finale.same&&report.finale.blueprint&&report.finale.beforeSun===0&&report.finale.afterSun>.99&&report.finale.choices===2;
// Incident reconstruction (9~11): one 3D space across three slides. Every beat must render its
// phase, keep projected labels on screen and clear of the heading/narration, and reverse cleanly.
// 첫 장면은 3.2초의 도입 카메라가 끝나야 라벨이 나타난다(world.ts).
await go(slideNumber('story-rooms'));await page.waitForTimeout(3600);
const incidentBeat=()=>page.evaluate(()=>{
 const c=document.querySelector('.iw-canvas'),box=r=>r&&r.getBoundingClientRect();
 const text=[document.querySelector('.i3-heading h1'),document.querySelector('.i3-narrative')].map(box);
 const hit=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4;
 const shown=Number(getComputedStyle(document.querySelector('.iw-labels')).opacity)>.5;
 const labels=[...document.querySelectorAll('.iw-label[data-on] .iw-label-box')].filter(()=>shown).map(el=>({text:el.textContent,r:el.getBoundingClientRect()}));
 return{phase:Number(c?.dataset.phase),frames:Number(c?.dataset.frames||0),labels:labels.length,
  offscreen:labels.filter(l=>l.r.left<0||l.r.right>1920||l.r.top<0||l.r.bottom>1000).map(l=>l.text),
  covers:labels.filter(l=>text.some(t=>t&&hit(l.r,t))).map(l=>l.text)};
});
report.incident=[];
for(let i=0;i<6;i++){if(i){await page.keyboard.press('ArrowRight');await page.waitForTimeout(2900)}report.incident.push(await incidentBeat())}
for(let i=0;i<5;i++){await page.keyboard.press('ArrowLeft');await page.waitForTimeout(400)}
await page.waitForTimeout(2200);
report.incidentReverse=await incidentBeat();
const incidentOk=report.incident.every((b,i)=>b.phase===i&&b.frames>0&&b.labels>0&&!b.offscreen.length&&!b.covers.length)&&report.incidentReverse.phase===0;
// 12 · 스크롤 페이지. 휠로 정지 지점을 넘으면 덱의 단계와 발표자 창이 따라오고, →는 다음 지점에서 멈추며, ←는 되감는다.
const scrollN=slideNumber('story-next-market');
const nm=()=>page.evaluate(()=>{const r=document.querySelector('.nm'),v=r.querySelector('video');const shown=[...r.querySelectorAll('.nm-sec')].map(e=>Number(getComputedStyle(e).opacity));
 return{step:Number(document.querySelector('.kn-slide').dataset.step),p:Number(r.dataset.progress),settled:r.dataset.settled==='true',frame:Math.round(v.currentTime*30-.5),section:shown.findIndex(o=>o>.99),visible:shown.filter(o=>o>.05).length,still:!!r.querySelector('img[data-visible]')}});
await go(scrollN);await page.waitForSelector('.nm[data-settled="true"]',{timeout:15000});
const nmPresenter=await context.newPage();await nmPresenter.goto('http://127.0.0.1:5180/#keynote/present');await nmPresenter.waitForFunction(()=>document.querySelector('.pv__label code')?.textContent.includes('story-next-market · 0'));
report.scrollPage={start:await nm()};
await page.mouse.move(960,540);for(let i=0;i<10;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(25)}
await page.waitForSelector('.nm[data-settled="true"]',{timeout:15000});report.scrollPage.wheel=await nm();
report.scrollPage.presenterFollows=await nmPresenter.waitForFunction(()=>document.querySelector('.pv__label code')?.textContent.includes('story-next-market · 1'),null,{timeout:5000}).then(()=>true,()=>false);
await nmPresenter.close();
for(let i=0;i<10;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(25)}
await page.waitForSelector('.nm[data-settled="true"]',{timeout:15000});report.scrollPage.wheelBack=await nm();
await page.keyboard.press('ArrowRight');await page.waitForTimeout(900);report.scrollPage.playing=await nm();
await page.waitForSelector('.nm[data-settled="true"]',{timeout:15000});await page.waitForTimeout(600);report.scrollPage.held=await nm();
await page.keyboard.press('ArrowLeft');await page.waitForTimeout(200);await page.waitForSelector('.nm[data-settled="true"]',{timeout:15000});report.scrollPage.rewound=await nm();
await page.keyboard.press('m');await page.keyboard.press('ArrowRight');await page.waitForTimeout(300);report.scrollPage.motionOff=await nm();await page.keyboard.press('m');
await go(scrollN+1);await page.keyboard.press('ArrowLeft');await page.waitForSelector('.nm[data-settled="true"]',{timeout:15000});report.scrollPage.enteredBack=await nm();
const sp=report.scrollPage,anchor=k=>[0,84,168,252,342,420,480,570][k];
const scrollOk=sp.start.step===0&&sp.start.section===0&&sp.wheel.step===1&&sp.wheel.visible<=1&&sp.presenterFollows&&sp.wheelBack.step===0&&sp.wheelBack.section===0
 &&sp.playing.p>0&&sp.playing.p<1&&sp.held.step===1&&Math.abs(sp.held.frame-anchor(1))<=1&&sp.held.section===1&&sp.rewound.step===0&&sp.rewound.frame<=1
 &&sp.motionOff.step===1&&sp.motionOff.p===1&&sp.motionOff.still&&sp.enteredBack.step===7&&sp.enteredBack.section===7&&Math.abs(sp.enteredBack.frame-anchor(7))<=1;
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
report.presenter={synced:true};await presenter.keyboard.press('ArrowRight');await page.waitForSelector(`.kn-slide[data-slide="${factoryStart+4}"]`);report.presenter.controlsAudience=true;await presenter.close();
await page.waitForSelector('.factory-film[data-status="held"]',{timeout:15000});
await page.evaluate(()=>window.__filmMedia=[...document.querySelectorAll('.factory-film video')]);
await page.keyboard.press('ArrowRight');report.film.stopsOnLeave=await page.evaluate(()=>window.__filmMedia.every(v=>v.paused&&!v.hasAttribute('src')));
const noGpu=await browser.newPage({viewport:{width:1280,height:720}});await noGpu.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:g.call(this,type,...args)}});await noGpu.goto('http://127.0.0.1:5180/#keynote');await noGpu.waitForSelector('[data-fallback]');await noGpu.keyboard.type(String(slideNumber('factory-tts')));await noGpu.keyboard.press('Enter');await noGpu.waitForSelector('.factory-film[data-status="held"]',{timeout:15000});report.fallback=true;await noGpu.close();
report.media=[];
for(const id of ['demo-tts','demo-assets','demo-music']){
 await go(slideNumber(id));await page.waitForTimeout(id==='demo-assets'?500:1400);
 await page.waitForFunction(()=>{const m=document.querySelector('video,audio');return m&&m.readyState>=2});
 const initial=await page.evaluate(()=>{const m=document.querySelector('video,audio');return{duration:m.duration,paused:m.paused,muted:m.muted}});
 await page.keyboard.press('p');
 const pausedByKey=await page.evaluate(()=>document.querySelector('video,audio').paused);
 await page.keyboard.press('p');await page.waitForTimeout(550);
 const playback=await page.evaluate(()=>{const m=document.querySelector('video,audio');return{time:m.currentTime,playing:!m.paused}});
 await page.keyboard.press('a');
 const soundToggled=await page.evaluate(wasMuted=>document.querySelector('video,audio').muted!==wasMuted,initial.muted);
 await page.keyboard.press('a');
 await page.evaluate(()=>{window.__previousMedia=document.querySelector('video,audio')});
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(120);
 const stoppedOnLeave=await page.evaluate(()=>window.__previousMedia.paused);
 report.media.push({id,...initial,...playback,pausedByKey,soundToggled,stoppedOnLeave});
}
await go(slideNumber('abuse-own-voice'));await page.waitForTimeout(1700);
report.voiceCue={auto:await page.locator('.ov-media').evaluate(v=>!v.paused&&!v.muted&&v.currentTime>13.81)};
await page.keyboard.press('ArrowRight');report.voiceCue.stopsOnReveal=await page.locator('.ov-media').evaluate(v=>v.paused);
await go(slideNumber('abuse-voice'));await page.keyboard.press('ArrowRight');await page.waitForTimeout(1100);
report.phoneCue={call:await page.locator('.phone-audio audio').evaluate(a=>!a.paused&&!a.muted&&a.currentTime>0)};
await page.keyboard.press('ArrowRight');report.phoneCue.stopsOnReveal=await page.locator('.phone-audio audio').evaluate(a=>a.paused);
await page.keyboard.press('ArrowRight');await page.waitForTimeout(1400);
report.phoneCue.message=await page.locator('.phone-audio audio').evaluate(a=>!a.paused&&!a.muted&&a.currentTime>0);
await page.keyboard.press('ArrowRight');report.phoneCue.stopsOnNextBeat=await page.locator('.phone-audio audio').evaluate(a=>a.paused);
await go(slideNumber('abuse-voice'));
await page.locator('.ph-btn--accept').click({force:true});
report.phoneCue.answerButton=await page.locator('.kn-slide').evaluate(el=>el.dataset.step==='1'&&el.querySelector('.np')?.scrollLeft===0&&el.querySelector('.np')?.scrollTop===0);
const images=await Promise.all(frames.map(async f=>({...f,data:(await fs.readFile(path.join(out,f.file))).toString('base64')})));
await page.setViewportSize({width:1920,height:1900});await page.setContent(`<body style="margin:0;background:#15191c;color:#ccc;font:15px sans-serif"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:18px">${images.map(x=>`<div><img style="width:100%;display:block" src="data:image/png;base64,${x.data}"><p style="margin:8px 0 6px">${x.label}</p></div>`).join('')}</div></body>`);await page.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
if(!Object.values(report.cat).every(Boolean)||!bridgeOk||!Object.values(report.bots).every(Boolean)||!groupsOk||!rulerOk||!finaleOk||!incidentOk||!scrollOk||errors.length||external.length||scriptMissing.length||report.slides.some(s=>s.overflow.length||s.overlap.length||s.webgl?.fallback)||report.filmShots.length!==5||new Set(report.filmShots.map(s=>s.source)).size!==5||report.filmShots.some(s=>s.status!=='held'||!(s.duration>1)||!s.muted)||!Object.values(report.film).every(Boolean)||!report.fallback||report.media.some(m=>m.paused||m.muted!==(m.id==='demo-assets')||!m.playing||m.time<=0||!m.pausedByKey||!m.soundToggled||!m.stoppedOnLeave)||!Object.values(report.voiceCue).every(Boolean)||!Object.values(report.phoneCue).every(Boolean))process.exitCode=1;
