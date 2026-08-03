#!/usr/bin/env node
/**
 * 온보딩 1단계(직군) 아코디언을 taxonomy.json 에서 다시 만든다.
 *
 *   node tools/roles/build.mjs          # onboarding/1/index.html 의 .scroll 블록을 갱신
 *   node tools/roles/build.mjs --check  # 갱신 없이 다르면 종료코드 1 (훅·CI 용)
 *
 * 왜 생성기인가
 *   대분류 18 · 중분류 174 개를 손으로 고치면 code(조회 표기)와 label(화면 표기) 이 반드시 어긋난다.
 *   기준은 taxonomy.json 하나이고, HTML 은 파생물이다. 피그마 스크립트도 같은 JSON 을 읽는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const TAX = JSON.parse(readFileSync(join(HERE, 'taxonomy.json'), 'utf8'));
const PAGE = join(ROOT, 'onboarding', '1', 'index.html');

const CHECK_SVG =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none">' +
  '<path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 시작 상태 = 전부 접힘 · 아무것도 안 골라 CTA 잠김 (피그마 278:2693) */
const build = () =>
  '<div class="scroll">' +
  TAX.groups
    .map((g) => {
      const chips =
        `<span class="call">${CHECK_SVG}전체</span>` +
        g.children.map(([code, label]) => `<div class="c" data-d2="${esc(code)}">${esc(label)}</div>`).join('');
      return (
        `<div class="acc" data-d1="${esc(g.code)}">` +
        `<div class="arow"><div class="nm">${esc(g.label)}</div><div class="cv">▼</div></div>` +
        `<div class="abody" hidden><div class="chips">${chips}</div></div>` +
        `</div>`
      );
    })
    .join('') +
  '</div>';

const html = readFileSync(PAGE, 'utf8');
const start = html.indexOf('<div class="scroll">');
const end = html.indexOf('\n</div>', start); // .scroll 다음 줄의 .board 닫힘
if (start < 0 || end < 0) {
  console.error('❌ onboarding/1/index.html 에서 .scroll 블록을 찾지 못했습니다.');
  process.exit(2);
}
const next = html.slice(0, start) + build() + html.slice(end);

if (process.argv.includes('--check')) {
  if (next === html) { console.log('✅ 온보딩 1단계 직군 목록이 taxonomy.json 과 일치합니다.'); process.exit(0); }
  console.error('❌ 온보딩 1단계 직군 목록이 taxonomy.json 과 다릅니다 — node tools/roles/build.mjs 를 돌리세요.');
  process.exit(1);
}

writeFileSync(PAGE, next);
const n = TAX.groups.reduce((a, g) => a + g.children.length, 0);
console.log(`✅ 온보딩 1단계 갱신 — 대분류 ${TAX.groups.length}개 · 중분류 ${n}개`);
