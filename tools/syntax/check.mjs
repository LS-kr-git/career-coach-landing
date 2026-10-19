// 옛 브라우저가 못 읽는 문법 검사 (2026-10-19 — 같은 날 두 번 났다).
// iOS 14·크롬 88 이하는 모듈 최상위 await · ??= · 숫자 구분자(1_000) 같은 ES2021+ 문법을 만나면 그 스크립트 전체를
// 문법 오류로 버린다 — 화면이 통째로 안 뜨는데 새 브라우저에서는 멀쩡해 아무도 못 본다. 모든 *.html 의 인라인 스크립트와
// assets/*.js 를 ES2020 으로 읽어 보고, 못 읽으면 막는다. (JSON 스크립트 — ld+json·speculationrules·importmap — 는 뺀다.)
// 쓰는 법: node tools/syntax/check.mjs   (종료코드 1 이면 걸린 곳이 있다)
import { parse } from './acorn.mjs';
import fs from 'node:fs';
import path from 'node:path';

const 뿌리 = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const 빼기 = new Set(['.git', 'node_modules', 'tools', '.github']);
const 파일 = [];
(function 걷기(d) {
  for (const f of fs.readdirSync(d)) {
    if (빼기.has(f)) continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) 걷기(p);
    else if (/\.(html|js|mjs)$/.test(f)) 파일.push(p);
  }
})(뿌리);

let 걸림 = 0;
for (const f of 파일) {
  const 원문 = fs.readFileSync(f, 'utf8');
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
    조각.push({ 코드: 원문, 모듈: /^\s*(import|export)\b/m.test(원문), 줄: 1 });
  }
  for (const c of 조각) {
    try {
      parse(c.코드, { ecmaVersion: 2020, sourceType: c.모듈 ? 'module' : 'script', allowHashBang: true });
    } catch (e) {
      걸림++;
      const 몇째 = c.줄 + (e.loc ? e.loc.line - 1 : 0);
      const 그줄 = (c.코드.split('\n')[(e.loc ? e.loc.line : 1) - 1] || '').trim().slice(0, 120);
      console.log(`❌ ${path.relative(뿌리, f)}:${몇째}  ${e.message}\n   ${그줄}`);
    }
  }
}
if (걸림) {
  console.log(`\n옛 브라우저(iOS 14·크롬 88)가 못 읽는 문법 ${걸림}곳 — 최상위 await 은 (async function () { … })() 로 감싸고, ??= · 1_000 같은 ES2021+ 문법은 풀어 쓴다.`);
  process.exit(1);
}
console.log(`✅ 옛 브라우저 문법 — 스크립트 ${파일.length}개 파일 통과 (ES2020)`);
