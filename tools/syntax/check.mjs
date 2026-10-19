// 옛 브라우저가 못 읽는 문법 검사 (2026-10-19 — 같은 날 두 번 났다).
// iOS 14·크롬 88 이하는 모듈 최상위 await · ??= · 숫자 구분자(1_000) 같은 ES2021+ 문법을 만나면 그 스크립트 전체를
// 문법 오류로 버린다 — 화면이 통째로 안 뜨는데 새 브라우저에서는 멀쩡해 아무도 못 본다. 모든 *.html 의 인라인 스크립트와
// assets/*.js 를 ES2020 으로 읽어 보고, 못 읽으면 막는다. (JSON 스크립트 — ld+json·speculationrules·importmap — 는 뺀다.)
// 쓰는 법: node tools/syntax/check.mjs   (종료코드 1 이면 걸린 곳이 있다)
import { Parser } from './acorn.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const 뿌리 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// 추적되는 파일만 본다 — PC 에 남은 추적 안 되는 산출물로 로컬에서만 거짓 실패가 나지 않게. git 이 없으면 디스크를 걷는다.
const 빼기 = /^(tools|node_modules|\.github)\//;
let 목록;
try {
  목록 = execFileSync('git', ['-C', 뿌리, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
} catch {
  목록 = [];
  (function 걷기(d) {
    for (const f of fs.readdirSync(path.join(뿌리, d))) {
      if (f === '.git') continue;
      const r = d ? d + '/' + f : f;
      if (fs.statSync(path.join(뿌리, r)).isDirectory()) 걷기(r); else 목록.push(r);
    }
  })('');
}
const 파일 = 목록.filter((f) => /\.(html|js|mjs)$/.test(f) && !빼기.test(f));
const 읽기 = (f) => fs.readFileSync(path.join(뿌리, f), 'utf8');

// 모듈인지는 「어떻게 불리나」로 정한다 — <script type=module src> · import … from · import() 가 가리키는 파일은 모듈,
// <script src>(module 아님)는 클래식. 아무 데서도 안 불리면 줄 머리의 import/export 로 짐작한다.
const 모듈 = new Set(), 클래식 = new Set();
const 경로로 = (from, spec) => {
  if (!/^[./]/.test(spec)) return null;
  const 절대 = spec.startsWith('/') ? spec.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  return 절대.split(/[?#]/)[0];
};
for (const f of 파일) {
  const 원문 = 읽기(f);
  for (const m of 원문.matchAll(/<script([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/g)) {
    const t = 경로로(f, m[2]); if (!t) continue;
    (/type=["']?module/.test(m[1] + m[3]) ? 모듈 : 클래식).add(t);
  }
  for (const m of 원문.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)) {
    const t = 경로로(f, m[1]); if (t) 모듈.add(t);
  }
}

// iOS 16.4 전 사파리는 정규식 뒤보기((?<= · (?<!)가 든 스크립트를 통째로 버린다 — acorn 은 ES2018 문법이라 통과시키므로 따로 본다.
function 정규식검사(코드, 모듈인가) {
  const 걸린 = [];
  const p = new Parser({ ecmaVersion: 2020, sourceType: 모듈인가 ? 'module' : 'script', allowHashBang: true, locations: true,
    onToken: (t) => { if (t.type.label === 'regexp' && /\(\?<[=!]/.test(t.value.pattern)) 걸린.push(t); } }, 코드);
  p.parse();
  return 걸린;
}

let 걸림 = 0;
for (const f of 파일) {
  const 원문 = 읽기(f);
  const 조각 = [];
  if (f.endsWith('.html')) {
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(원문))) {
      const 속성 = m[1];
      if (/\bsrc=/.test(속성) || /type=["']?(application\/(ld\+)?json|speculationrules|importmap)/.test(속성)) continue;
      조각.push({ 코드: m[2], 모듈: /type=["']?module/.test(속성), 줄: 원문.slice(0, m.index).split('\n').length });
    }
  } else {
    const 모듈인가 = 모듈.has(f) ? true : 클래식.has(f) ? false : /^\s*(import|export)\b/m.test(원문);
    조각.push({ 코드: 원문, 모듈: 모듈인가, 줄: 1 });
  }
  for (const c of 조각) {
    try {
      for (const t of 정규식검사(c.코드, c.모듈)) {
        걸림++;
        console.log(`❌ ${f}:${c.줄 + t.loc.start.line - 1}  정규식 뒤보기 (?<= · (?<! — iOS 16.4 전 사파리가 스크립트를 통째로 버린다\n   /${t.value.pattern}/`);
      }
    } catch (e) {
      걸림++;
      const 몇째 = c.줄 + (e.loc ? e.loc.line - 1 : 0);
      const 그줄 = (c.코드.split('\n')[(e.loc ? e.loc.line : 1) - 1] || '').trim().slice(0, 120);
      console.log(`❌ ${f}:${몇째}  ${e.message}\n   ${그줄}`);
    }
  }
}
if (걸림) {
  console.log(`\n옛 브라우저(iOS 14·크롬 88)가 못 읽는 문법 ${걸림}곳 — 최상위 await 은 (async function () { … })() 로 감싸고, ??= · 1_000 같은 ES2021+ 문법과 정규식 뒤보기는 풀어 쓴다.`);
  process.exit(1);
}
console.log(`✅ 옛 브라우저 문법 — 스크립트 ${파일.length}개 파일 통과 (ES2020 · 정규식 뒤보기 없음 · 모듈 ${모듈.size}개는 불리는 방식대로)`);
