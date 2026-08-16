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

/** 셸이 `/bootstrap` 에서 받아 `<style id="ds">` 에 넣는 디자인 토큰의 **검사용 표본**.
 *  🔴 **정본이 아니다.** 정본은 career-coach 의
 *  `supabase/functions/ops-1udm1xmi/lib/tokens.ts` 다 — 값을 고칠 일이 생기면 거기서 고친다.
 *  여기에는 **셸(`ops/index.html`)이 실제로 부르는 이름만** 담는다. 셸이 새 이름을 쓰기
 *  시작하면 여기 없어서 그 검사가 먼저 깨진다 — 그게 이 상수가 하는 일이다.
 *  (검사가 값 자체를 보는 곳은 폭 계산뿐이라, 글자 크기만 실제 값과 같으면 된다.) */
export const TOKENS_STUB = ':root{' + [
  '--adm-font:"Pretendard Variable",Pretendard,-apple-system,sans-serif',
  '--adm-bg:#f1f5f9', '--adm-surface:#ffffff', '--adm-surface-soft:#f8fafc',
  '--adm-line:#cbd5e1', '--adm-text:#0f172a', '--adm-text-muted:#475569', '--adm-text-dim:#64748b',
  '--adm-ok-fg:#047857', '--adm-ok-bg:#d1fae5', '--adm-warn-fg:#b45309', '--adm-warn-bg:#fef3c7',
  '--adm-bad-fg:#b91c1c', '--adm-bad-bg:#fee2e2',
  '--adm-brand:#f59e0b', '--adm-btn-bg:#1e293b', '--adm-btn-fg:#ffffff',
  '--adm-t-11:11px', '--adm-t-12:12px', '--adm-t-13:13px', '--adm-t-14:14px',
  '--adm-t-16:16px', '--adm-t-20:20px', '--adm-t-num-l:24px', '--adm-lh-num-l:28px',
  '--adm-sp-2:2px', '--adm-sp-6:6px', '--adm-sp-26:26px',
  '--adm-r-8:8px', '--adm-r-12:12px', '--adm-r-99:99px',
  '--adm-sh-card:0 1px 2px rgba(15,23,42,.08)',
].join(';') + '}';

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
  let 전체 = 0;
  const ok = (name, cond, extra = '') => {
    전체 += 1;
    console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`);
    if (!cond) 실패.push(name);
  };
  // 항목 수는 세어서 찍는다. 사람이 문서·스텝 이름에 적어 두면 검사를 지워도 그 숫자가 남는다.
  const 마무리 = () => {
    console.log(실패.length ? `\n실패 ${실패.length}건: ${실패.join(', ')}` : `\n전부 통과 (${전체}항목)`);
    process.exit(실패.length ? 1 : 0);
  };
  return { ok, 마무리 };
}
