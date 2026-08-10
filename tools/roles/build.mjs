#!/usr/bin/env node
/**
 * 온보딩 1단계(직군) 아코디언을 taxonomy.json + volume.json 에서 다시 만든다.
 *
 *   node tools/roles/build.mjs          # onboarding/1/index.html 의 .scroll 블록을 갱신
 *   node tools/roles/build.mjs --check  # 갱신 없이 다르면 종료코드 1 (훅·CI 용)
 *
 * 세 가지를 한다.
 *   1) 표기 검증 — code = sourceLabel.replace('·','_') 를 296개 전부에 건다.
 *      label(화면 표기)은 자유롭게 다듬을 수 있고, code 와의 관계는 sourceLabel 이 잡는다.
 *   2) 볼륨 필터 — volume.json 실측으로 "골라도 아무것도 못 받는" 항목을 화면에서 뺀다.
 *      **taxonomy.json 에서 지우지 않는다.** 그 표는 들어오는 공고를 분류하는 데도 쓰이므로
 *      항상 전량이어야 한다. 여기서 하는 건 '보여줄지' 판단뿐이고, volume.json 을 다시 재면
 *      자동으로 늘고 준다 — 손으로 관리하는 목록이 아니게 하는 것이 요점이다.
 *   3) HTML 생성 — 대분류 18/25 를 손으로 고치면 code 와 label 이 반드시 어긋난다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const TAX = JSON.parse(readFileSync(join(HERE, 'taxonomy.json'), 'utf8'));
const VOL = JSON.parse(readFileSync(join(HERE, 'volume.json'), 'utf8'));
const PAGE = join(ROOT, 'onboarding', '1', 'index.html');

/** 노출 기준 (2026-08-04 사용자 확정 → 같은 날 10 → 5 로 완화)
 *  대분류: 주당 신규 5건 미만이면 뺀다.
 *    처음엔 10 이었는데, 그 기준이 게임(주 7)·증권(주 7)·교육(주 9)·서비스(주 9)·공공복지(주 9)·
 *    의료보건(주 6)까지 잘라내 "그 직군 사람은 온보딩에서 그냥 이탈" 하는 쪽이 더 컸다.
 *    주 5 면 한 주에 최소 몇 건은 새로 채워진다.
 *  중분류: 30일 신규 0건이면 뺀다. 한 달 내내 새 공고가 없었다 = 골라도 아무것도 안 온다.
 *  판단 지표는 재고(open)가 아니라 유입(new30)이다 — 재고만 많으면 매주 같은 공고를 다시 보낸다.
 *  (실제로 어긋난다: 게임은 재고 319건으로 15위인데 주당 신규는 7건으로 20위다) */
const MIN_D1_PER_WEEK = 5;
const MIN_D2_NEW30 = 1;
const WEEKS = 30 / 7;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── 1. 표기 검증 ────────────────────────────────────────────
const bad = [];
for (const g of TAX.groups) {
  for (const c of g.children) {
    if (c.code !== c.sourceLabel.replace(/·/g, '_')) bad.push(`${g.code}/${c.code} ↔ ${c.sourceLabel}`);
    if (!VOL.depthTwo[g.code] || !(c.code in VOL.depthTwo[g.code])) bad.push(`${g.code}/${c.code} 볼륨 실측 없음`);
  }
  if (!(g.code in VOL.depthOne)) bad.push(`${g.code} 볼륨 실측 없음`);
}
if (bad.length) {
  console.error('❌ 직무 표기·실측 검증 실패\n   ' + bad.join('\n   '));
  console.error("\n   규칙: code = sourceLabel.replace('·','_'). 화면 표기를 바꾸려면 label 만 고치세요.");
  console.error('   실측이 없으면 tools/roles/measure.mjs 를 다시 돌리세요.');
  process.exit(2);
}

// ── 2. 볼륨 필터 ────────────────────────────────────────────
const perWeek = (code) => VOL.depthOne[code].new30 / WEEKS;
const visible = TAX.groups
  .filter((g) => perWeek(g.code) >= MIN_D1_PER_WEEK)
  .map((g) => ({ ...g, children: g.children.filter((c) => VOL.depthTwo[g.code][c.code].new30 >= MIN_D2_NEW30) }));

const hiddenGroups = TAX.groups.filter((g) => perWeek(g.code) < MIN_D1_PER_WEEK);
const hiddenChips = TAX.groups.flatMap((g) =>
  perWeek(g.code) < MIN_D1_PER_WEEK ? [] : g.children.filter((c) => VOL.depthTwo[g.code][c.code].new30 < MIN_D2_NEW30).map((c) => `${g.label}/${c.label}`),
);

// ── 3. HTML 생성 ────────────────────────────────────────────
/** 시작 상태 = 전부 접힘 · 아무것도 안 골라 CTA 잠김 (피그마 278:2693) */
const build = () =>
  '<div class="scroll">' +
  visible
    .map((g) => {
      const chips = g.children.map((c) => `<div class="c" data-d2="${esc(c.code)}">${esc(c.label)}</div>`).join('');
      return (
        `<div class="acc" data-d1="${esc(g.code)}">` +
        `<div class="arow"><div class="nm">${esc(g.label)}</div>` +
        `<div class="cnt">주 ${Math.round(perWeek(g.code))}건</div><div class="cv">▼</div></div>` +
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
  if (next === html) { console.log('✅ 온보딩 1단계 직군 목록이 taxonomy.json + volume.json 과 일치합니다.'); process.exit(0); }
  console.error('❌ 온보딩 1단계 직군 목록이 기준과 다릅니다 — node tools/roles/build.mjs 를 돌리세요.');
  process.exit(1);
}

writeFileSync(PAGE, next);
const shown = visible.reduce((a, g) => a + g.children.length, 0);
const all = TAX.groups.reduce((a, g) => a + g.children.length, 0);
console.log(`✅ 온보딩 1단계 갱신 — 대분류 ${visible.length}/${TAX.groups.length} · 중분류 ${shown}/${all}`);
// 잘라낸 건 반드시 알린다. 조용히 줄이면 "다 넣었다" 로 읽힌다.
console.log(`   숨긴 대분류(주 ${MIN_D1_PER_WEEK}건 미만) ${hiddenGroups.length}개: ` +
  hiddenGroups.map((g) => `${g.label} 주${Math.round(perWeek(g.code))}`).join(' · '));
console.log(`   숨긴 중분류(30일 신규 0건) ${hiddenChips.length}개: ` + hiddenChips.join(' · '));
