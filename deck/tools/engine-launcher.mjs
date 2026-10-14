import { spawn } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import { constants, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const prefix = '/__javis/engines/';
const launchers = {
  tts: fileURLToPath(new URL('../demo-launchers/TTS.command', import.meta.url)),
  assets: fileURLToPath(new URL('../demo-launchers/Assets.command', import.meta.url)),
  music: fileURLToPath(new URL('../demo-launchers/Music.command', import.meta.url)),
};
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function openLauncher(launcher) {
  await access(launcher, constants.X_OK);
  // 실행 전에 엔진 위치도 확인한다. 앱의 초기 준비와 로그는 터미널에서 볼 수 있다.
  const source = await readFile(launcher, 'utf8');
  const root = source.match(/^cd (.+)$/m)?.[1];
  if (!root) throw new Error('엔진 실행 파일의 경로를 확인해주세요.');
  try {
    await access(`${root}/app.sh`, constants.X_OK);
  } catch {
    throw new Error('엔진 폴더에서 실행 가능한 app.sh를 찾지 못했습니다.');
  }
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  await new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/open', ['-a', 'Terminal', launcher], { env, stdio: 'ignore' });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error('터미널에서 엔진을 열지 못했습니다.')));
  });
}

export function createEngineLaunchMiddleware(launch = openLauncher) {
  return async (req, res, next) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!pathname.startsWith(prefix)) return next();
    if (req.method !== 'POST') return reply(res, 405, { error: '실행 버튼으로 요청해주세요.' });

    // 같은 컴퓨터의 덱 화면에서만 고정된 세 실행 파일을 열 수 있다.
    let sameOrigin = false;
    try {
      const origin = new URL(req.headers.origin);
      sameOrigin = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
        && origin.host === req.headers.host;
    } catch { /* Origin이 없는 요청은 허용하지 않는다. */ }
    if (!loopback.has(req.socket.remoteAddress) || !sameOrigin || req.headers['x-javis-launch'] !== '1') {
      return reply(res, 403, { error: '이 컴퓨터의 로컬 발표 화면에서 실행해주세요.' });
    }

    const match = pathname.match(/^\/__javis\/engines\/(tts|assets|music)\/launch$/);
    if (!match) return reply(res, 404, { error: '해당 엔진을 찾지 못했습니다.' });
    if (process.platform !== 'darwin') return reply(res, 501, { error: '엔진 실행 버튼은 macOS에서 사용할 수 있습니다.' });
    try {
      await launch(launchers[match[1]]);
      reply(res, 202, { ok: true });
    } catch (error) {
      reply(res, 500, { error: error.message ?? '엔진 실행 파일을 확인해주세요.' });
    }
  };
}

/* 31번 · 뮤직비디오. 덱 밖(../mv/render, git에 넣지 않는 179MB 파일)에 있는 렌더 결과를 그대로 내보낸다.
   Safari는 범위 요청에 답해야 mp4를 재생하므로 Range를 처리한다. */
const mvPath = '/__javis/mv/hiphop-mv-tel.mp4';
const mvFile = fileURLToPath(new URL('../../mv/render/hiphop-mv-tel.mp4', import.meta.url));

async function sendVideo(req, res) {
  let size;
  try { size = (await stat(mvFile)).size; } catch { return reply(res, 404, { error: '뮤직비디오 파일이 없습니다. mv에서 npm run render -- --ending tel 로 만들어주세요.' }); }
  const head = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (!range || (!range[1] && !range[2])) {
    res.writeHead(200, { ...head, 'Content-Length': size });
    return req.method === 'HEAD' ? res.end() : createReadStream(mvFile).pipe(res);
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
  res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
  return req.method === 'HEAD' ? res.end() : createReadStream(mvFile, { start, end }).pipe(res);
}

function createLocalMediaMiddleware() {
  return async (req, res, next) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname !== mvPath) return next();
    if (!loopback.has(req.socket.remoteAddress)) return reply(res, 403, { error: '이 컴퓨터의 로컬 발표 화면에서 열어주세요.' });
    return req.method === 'GET' || req.method === 'HEAD' ? sendVideo(req, res) : reply(res, 405, { error: '재생 링크로 열어주세요.' });
  };
}

export default function engineLauncher() {
  const install = server => {
    server.middlewares.use(createEngineLaunchMiddleware());
    server.middlewares.use(createLocalMediaMiddleware());
  };
  return { name: 'javis-engine-launcher', configureServer: install, configurePreviewServer: install };
}
