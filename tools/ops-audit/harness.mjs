// ops-audit 두 스크립트가 같이 쓰는 것 — 정적 서버 · 크로미움 열기 · 결과 세기.
// 두 파일에 같은 코드가 20줄 넘게 겹쳐 있어서 뽑았다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

/** 저장소 루트. 이 파일이 tools/ops-audit/ 에 있으므로 두 칸 위다. */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** ops 셸을 그대로 내주는 정적 서버. 포트는 0 = 임의 할당 —
 *  고정 포트로 두면 다른 세션이 같은 포트를 잡고 있을 때 EADDRINUSE 로 죽는다(실측). */
export async function 서버열기() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
    // 화면 전환 검사(tools/transition-audit)가 구독자 화면 전체를 내므로 CSS·글꼴·그림 형식도 맞춘다 —
    // 틀리면 브라우저가 스타일시트를 버려 맨 화면으로 잰다.
    const 형식 = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
    res.writeHead(200, { 'content-type': 형식[path.extname(f)] || 'text/html; charset=utf-8' });
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
  // 🔴 글꼴 목록은 정본과 **글자 하나까지** 같아야 한다 — 아래 폭 검사가 글꼴에 좌우된다.
  '--adm-font:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,'
    + '"Apple SD Gothic Neo","Malgun Gothic",sans-serif',
  '--adm-bg:#f1f5f9', '--adm-surface:#ffffff', '--adm-surface-soft:#f8fafc',
  '--adm-line:#cbd5e1', '--adm-text:#0f172a', '--adm-text-muted:#475569', '--adm-text-dim:#64748b',
  '--adm-ok-fg:#047857', '--adm-ok-bg:#d1fae5', '--adm-warn-fg:#b45309', '--adm-warn-bg:#fef3c7',
  '--adm-bad-fg:#b91c1c', '--adm-bad-bg:#fee2e2',
  '--adm-brand:#f59e0b', '--adm-btn-bg:#1e293b', '--adm-btn-fg:#ffffff',
  '--adm-t-11:11px', '--adm-t-12:12px', '--adm-t-13:13px', '--adm-t-14:14px',
  '--adm-t-16:16px', '--adm-t-20:20px',
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

/** playwright 를 저장소 안에서 먼저, 없으면 전역(npm -g)에서 불러온다. 둘 다 안 되면 두 이유를 다 붙여 던진다.
 *  PC 는 클론·작업 트리(git worktree)가 여럿이라 저장소 안 node_modules 가 안 보이는 자리에서 돌 때가 많다 —
 *  그래서 PC 에는 전역에 한 번 깔고 여기서도 찾는다(2026-10-21 사용자 승인으로 PC 에 설치).
 *    npm install -g playwright@<워크플로의 PLAYWRIGHT_VERSION> && npx playwright@<같은 판> install chromium
 *  브라우저를 띄우는 검수(flow-audit · doctor 의 크로미움 줄 포함)는 전부 이 함수 하나로 찾는다. */
export async function playwright불러오기() {
  try { return await import('playwright'); }
  catch (안) {
    let 전역 = '';
    try {
      전역 = path.join(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 'playwright');
      return await import(pathToFileURL(path.join(전역, 'index.mjs')).href);
    } catch (밖) {
      // 이유를 그대로 붙인다. "미설치" 로 뭉개면 깨진 설치·ESM 로드 실패·npm 없음이 같은 얼굴이 된다.
      throw new Error(`저장소 안: ${안.message.split('\n')[0]} · 전역${전역 ? `(${전역})` : ''}: ${밖.message.split('\n')[0]}`);
    }
  }
}

export async function 브라우저열기() {
  let chromium;
  try { ({ chromium } = await playwright불러오기()); }
  catch (e) { 건너뜀(`playwright 를 못 불렀다 (${e.message})`); }
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

/** 구독자 화면 목록 — 화면 전환 검사와 첫 화면 덜컹임 검사가 같이 쓴다.
 *  폴더 주소 화면은 저장소에서 찾는다 — 새 화면이 생기면 저절로 들어온다.
 *  어드민·로그인 처리·가입 입구는 사람이 링크로 오가는 화면이 아니라 뺀다. 링크로 여는 두 화면은 토큰 모양만 맞춘 주소로 연다. */
export function 구독자화면(T) {
  return [
    '/', '/terms.html', '/privacy.html', '/404.html',
    `/insight/?t=${T}&id=1301`, `/jobs/?t=${T}&d=2026-10-13`,
    ...fs.readdirSync(ROOT, { recursive: true })
      .filter((f) => f.endsWith(`${path.sep}index.html`) && !/^(\.git|node_modules|ops|auth|signup|tools)\b/.test(f))
      .map((f) => '/' + path.dirname(f).split(path.sep).join('/') + '/')
      .filter((u) => !/^\/(insight|jobs)\/$/.test(u)),
  ];
}
