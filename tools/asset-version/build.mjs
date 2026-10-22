#!/usr/bin/env node
/**
 * /assets/*.js · *.css 주소에 판 번호(?v=내용 해시)를 붙인다 (2026-10-22 사용자 지시 「JS 파일 버전 붙이기를 해 줘」).
 *
 *   node tools/asset-version/build.mjs          # 모든 페이지·모듈의 주소를 지금 내용의 판으로 다시 쓴다
 *   node tools/asset-version/build.mjs --check  # 쓰지 않고, 판이 낡았으면 종료코드 1 (훅·CI)
 *
 * 왜 — GitHub Pages 는 모든 파일을 10분(max-age=600) 기억하라고 보낸다. HTML 과 JS 는 따로 받으므로 배포 직후
 * 10분 동안 「새 HTML + 기억해 둔 옛 모듈」이 섞인다. 새 HTML 이 옛 모듈에 없는 이름을 import 하면 그 화면의
 * 스크립트가 통째로 멈춘다 — 2026-10-15 598b09f 에서 실제로 났다(assets/track.js 머리말). 주소에 판을 붙이면
 * 새 HTML 은 새 주소를 부르므로 옛 것을 쓸 수 없다.
 *
 * 규칙
 *  - 판 = 그 파일 내용(안에 적힌 다른 자산의 ?v= 는 떼고)의 sha256 앞 8자리. 내용이 그대로면 판도 그대로라
 *    안 바뀐 파일은 배포해도 브라우저가 기억한 것을 그대로 쓴다.
 *  - 같은 파일은 **어디서 부르든 같은 주소**여야 한다 — 주소가 다르면 브라우저가 모듈을 두 벌 띄워
 *    상태(로그인 클라이언트·저장 대기열)가 갈라진다. 그래서 손으로 붙이지 말고 이 도구만 쓴다.
 *  - 다시 쓰는 곳: 따옴표 안의 "/assets/<이름>.js|css" (뒤에 ?v=… 가 있으면 갈아 끼운다).
 *    대상 파일: 저장소의 모든 *.html(tools·node_modules 제외)과 assets/*.js.
 *  - 글꼴(assets/fonts/)은 이름이 바뀌지 않는 묶음이고 미리받기 도구가 정확한 주소로 찾으므로 뺀다.
 *  - 미리받기 묶음(tools/preload/build.mjs)은 import 주소를 그대로 옮겨 적으므로 이 도구 다음에 돌린다.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = process.argv.includes('--check');
const SKIP = new Set(['.git', 'tools', 'node_modules']);

const 자산 = readdirSync(join(ROOT, 'assets')).filter((n) => /\.(js|css)$/.test(n) && statSync(join(ROOT, 'assets', n)).isFile());
const 이름들 = new Set(자산);
// 따옴표 바로 뒤의 /assets/<이름> (+ 옛 판). 이름에 / 가 없으므로 fonts/ 아래는 걸리지 않는다.
const 주소 = /(["'])\/assets\/([A-Za-z0-9_.-]+\.(?:js|css))(?:\?v=[0-9a-f]*)?(?=["'])/g;
const 판떼기 = (t) => t.replace(주소, (m, q, n) => (이름들.has(n) ? `${q}/assets/${n}` : m));

// 판에는 그 파일이 부르는 자산의 판도 넣는다 — 안 넣으면 B 만 고쳤을 때 B 를 부르는 A 의 판이 그대로라,
// 기억해 둔 옛 A 가 옛 B 주소를 불러 같은 B 가 두 주소로 뜬다(2026-10-22 검사관 ①). 서로 부르는 고리면 멈춘다.
const 원문들 = new Map(자산.map((n) => [n, readFileSync(join(ROOT, 'assets', n), 'utf8')]));
const 판 = new Map(), 도는중 = new Set();
function 판구하기(n) {
  if (판.has(n)) return 판.get(n);
  if (도는중.has(n)) throw new Error(`자산끼리 서로 부르는 고리가 있다: ${[...도는중, n].join(' → ')}`);
  도는중.add(n);
  const 부름 = [...new Set([...원문들.get(n).matchAll(주소)].map((m) => m[2]).filter((d) => 이름들.has(d) && d !== n))].sort();
  const v = createHash('sha256').update(판떼기(원문들.get(n)) + '\n' + 부름.map((d) => `${d}=${판구하기(d)}`).join('\n')).digest('hex').slice(0, 8);
  도는중.delete(n); 판.set(n, v); return v;
}
자산.forEach(판구하기);
const 붙이기 = (t) => t.replace(주소, (m, q, n) => (이름들.has(n) ? `${q}/assets/${n}?v=${판.get(n)}` : m));

function htmls(dir = ROOT) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP.has(n)) out.push(...htmls(p)); }
    else if (n.endsWith('.html')) out.push(relative(ROOT, p));
  }
  return out;
}

let 낡음 = 0;
for (const f of [...htmls(), ...자산.filter((n) => n.endsWith('.js')).map((n) => join('assets', n))].sort()) {
  const 원문 = readFileSync(join(ROOT, f), 'utf8');
  const 새것 = 붙이기(원문);
  if (새것 === 원문) continue;
  낡음++;
  if (CHECK) console.error(`❌ ${f} — 자산 주소의 판이 낡았다`);
  else { writeFileSync(join(ROOT, f), 새것); console.log(`✏️  ${f}`); }
}
if (CHECK && 낡음) { console.error(`\n→ node tools/asset-version/build.mjs 다음 node tools/preload/build.mjs 로 다시 쓰고 커밋하라 (${낡음}곳)`); process.exit(1); }
if (CHECK) console.log(`✅ 자산 판 — 전부 최신 (${자산.length}개 파일)`);
