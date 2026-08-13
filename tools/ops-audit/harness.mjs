// ops-audit 두 스크립트가 같이 쓰는 것 — 정적 서버 · 크로미움 열기 · 결과 세기.
// 두 파일에 같은 코드가 20줄 넘게 겹쳐 있어서 뽑았다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 저장소 루트. 이 파일이 tools/ops-audit/ 에 있으므로 두 칸 위다. */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** ops 셸을 그대로 내주는 정적 서버. 포트는 0 = 임의 할당 —
 *  고정 포트로 두면 다른 세션이 같은 포트를 잡고 있을 때 EADDRINUSE 로 죽는다(실측). */
export async function 서버열기() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

/** 크로미움이 없는 PC 에서는 건너뛴다 (저장소의 figma-audit 과 같은 규약).
 *  다만 CI 에서는 종료코드 1 이다 — "브라우저가 없어서 조용히 통과" 가 CI 에서는 사고다.
 *  새 스위치를 만들지 않고 `CI` 를 본다. GitHub Actions 가 알아서 넣어 준다. */
export function 건너뜀(이유) {
  const 엄격 = !!process.env.CI;
  console.log(`\n건너뜀 — ${이유}${엄격 ? ' (CI 라 실패로 센다)' : ''}\n`);
  process.exit(엄격 ? 1 : 0);
}

export async function 브라우저열기() {
  let chromium;
  // 이유를 그대로 붙인다. "미설치" 로 뭉개면 깨진 설치·ESM 로드 실패가 같은 얼굴이 된다.
  try { ({ chromium } = await import('playwright')); }
  catch (e) { 건너뜀(`playwright 를 못 불렀다 (${e.message.split('\n')[0]})`); }
  const exe = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].filter(Boolean).find((p) => fs.existsSync(p));
  try { return await chromium.launch(exe ? { executablePath: exe } : {}); }
  catch (e) { 건너뜀(`크로미움 실행 실패 (${e.message.split('\n')[0]})`); }
}

export function 검사기() {
  const 실패 = [];
  const ok = (name, cond, extra = '') => {
    console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`);
    if (!cond) 실패.push(name);
  };
  const 마무리 = () => {
    console.log(실패.length ? `\n실패 ${실패.length}건: ${실패.join(', ')}` : '\n전부 통과');
    process.exit(실패.length ? 1 : 0);
  };
  return { ok, 마무리 };
}
