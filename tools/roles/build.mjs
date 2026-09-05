#!/usr/bin/env node
/**
 * 온보딩 1단계(직군) 아코디언과 완료 화면의 주제 목록을 데이터에서 다시 만든다.
 *
 *   node tools/roles/build.mjs          # onboarding/1 의 .scroll · onboarding/done 의 표식 두 곳을 갱신
 *   node tools/roles/build.mjs --check  # 갱신 없이 다르면 종료코드 1 (훅·CI 용)
 *
 * 세 가지를 한다.
 *   1) 표기 검증 — code = sourceLabel.replace('·','_') 를 296개 전부에 건다.
 *      label(화면 표기)은 자유롭게 다듬을 수 있고, code 와의 관계는 sourceLabel 이 잡는다.
 *   2) 볼륨 필터·정렬 — volume.json 실측으로 "골라도 아무것도 못 받는" 항목을 화면에서 빼고,
 *      남은 것을 신규 공고 많은 순으로 세운다(대분류·중분류 모두).
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
const TRK = JSON.parse(readFileSync(join(HERE, 'tracks.json'), 'utf8'));
const PAGE = join(ROOT, 'onboarding', '1', 'index.html');
const DONE = join(ROOT, 'onboarding', 'done', 'index.html');

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
  // 트랙은 **없어도 된다**(교육·서비스·식음료·공공복지 넷). 다만 적혀 있으면 목록 안이어야 한다 —
  // 오타 하나가 완료 화면에서 "주제 미선택" 으로만 보이고 조용히 지나간다.
  const t = TRK.byGroup[g.code];
  if (t !== undefined && !TRK.tracks.includes(t)) bad.push(`${g.code} → "${t}" 는 tracks 목록에 없다`);
}
const groupCodes = new Set(TAX.groups.map((g) => g.code));
for (const code of Object.keys(TRK.byGroup)) if (!groupCodes.has(code)) bad.push(`byGroup 의 "${code}" 는 없는 대분류다`);
for (const t of TRK.tracks) {
  if (!Object.values(TRK.byGroup).includes(t)) bad.push(`트랙 "${t}" 에 붙은 대분류가 하나도 없다`);
}
if (bad.length) {
  console.error('❌ 직무 표기·실측 검증 실패\n   ' + bad.join('\n   '));
  console.error("\n   규칙: code = sourceLabel.replace('·','_'). 화면 표기를 바꾸려면 label 만 고치세요.");
  console.error('   실측이 없으면 tools/roles/measure.mjs 를 다시 돌리세요.');
  process.exit(2);
}

// ── 2. 볼륨 필터 + 정렬 ─────────────────────────────────────
/** 정렬 기준은 **거르는 기준과 같은 값**이다 (대분류 주당 신규, 중분류 30일 신규).
 *  화면에 "주 12건" 을 적어 놓고 다른 값으로 줄을 세우면 사용자가 보는 순서가 어긋난다.
 *  taxonomy.json 의 배열 순서는 손대지 않는다 — 그 파일은 분류표지 화면 순서가 아니다. */
const perWeek = (code) => VOL.depthOne[code].new30 / WEEKS;
const childNew30 = (gcode, ccode) => VOL.depthTwo[gcode][ccode].new30;
const desc = (f) => (a, b) => f(b) - f(a);
const visible = TAX.groups
  .filter((g) => perWeek(g.code) >= MIN_D1_PER_WEEK)
  .map((g) => ({
    ...g,
    children: g.children
      .filter((c) => childNew30(g.code, c.code) >= MIN_D2_NEW30)
      .sort(desc((c) => childNew30(g.code, c.code))),
  }))
  .sort(desc((g) => perWeek(g.code)));

const hiddenGroups = TAX.groups.filter((g) => perWeek(g.code) < MIN_D1_PER_WEEK);
const hiddenChips = TAX.groups.flatMap((g) =>
  perWeek(g.code) < MIN_D1_PER_WEEK ? [] : g.children.filter((c) => childNew30(g.code, c.code) < MIN_D2_NEW30).map((c) => `${g.label}/${c.label}`),
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

// ── 4. 완료 화면 (onboarding/done) — 주제 칩과 직군→주제 표 ─────
/** 완료 화면은 정적 HTML 인데 "고른 직군이면 이 주제" 를 보여줘야 한다. 대응표는 발송 시점에
 *  파이썬이 푸는 것이 정본이고 DB 에는 두지 않기로 돼 있으므로(insights/sources.py 의
 *  track_for_job 위 주석), 브라우저가 닿을 수 있는 형태로 여기서 같이 만들어 심는다.
 *  화면에 보이는 중분류만 넣는다 — 못 고르는 코드는 저장될 일이 없다. */
const topicsHtml = () =>
  '<div class="topics">' +
  TRK.tracks.map((t) => `<div class="c" data-track="${esc(t)}">${esc(t)}</div>`).join('') +
  '</div>';

const jobMapHtml = () => {
  // 🔴 **대분류 코드를 같이 싣는다.** 주제를 푸는 규칙이 발송 경로와 같아야 하는데
  //    (`ops/send.py` 의 `트랙과_직군`), 그쪽은 **대분류를 정렬해** 트랙이 있는 첫 번째를
  //    쓴다. 중분류만 실으면 화면이 다른 순서로 고르게 되고, 같은 사람이 화면에서 본
  //    주제와 실제로 받는 주제가 갈린다.
  const groups = visible.map((g) => [g.code, TRK.tracks.indexOf(TRK.byGroup[g.code] ?? '')]);
  const jobs = {};
  visible.forEach((g, gi) => { for (const c of g.children) jobs[c.code] = [c.label, gi]; });
  const json = JSON.stringify({ tracks: TRK.tracks, groups, jobs });
  return `<script id="cc-topic-map" type="application/json">${json}<\/script>`;
};

/** 표식 사이만 갈아 끼운다. 표식이 없으면 화면이 조용히 옛 값을 그리게 되므로 멈춘다. */
const patch = (src, mark, body) => {
  const a = `<!--roles:${mark}-->`, b = `<!--/roles:${mark}-->`;
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < 0) {
    console.error(`❌ onboarding/done/index.html 에서 ${a} 표식을 찾지 못했습니다.`);
    process.exit(2);
  }
  return src.slice(0, i + a.length) + body + src.slice(j);
};

const html = readFileSync(PAGE, 'utf8');
const start = html.indexOf('<div class="scroll">');
const end = html.indexOf('\n</div>', start); // .scroll 다음 줄의 .board 닫힘
if (start < 0 || end < 0) {
  console.error('❌ onboarding/1/index.html 에서 .scroll 블록을 찾지 못했습니다.');
  process.exit(2);
}
const next = html.slice(0, start) + build() + html.slice(end);

const doneHtml = readFileSync(DONE, 'utf8');
const doneNext = patch(patch(doneHtml, 'topics', topicsHtml()), 'jobmap', jobMapHtml());

if (process.argv.includes('--check')) {
  const stale = [next !== html && '온보딩 1단계 직군 목록', doneNext !== doneHtml && '완료 화면 주제 목록'].filter(Boolean);
  if (!stale.length) { console.log('✅ 온보딩 직군·주제 목록이 taxonomy.json + volume.json + tracks.json 과 일치합니다.'); process.exit(0); }
  console.error(`❌ ${stale.join(' · ')} 이(가) 기준과 다릅니다 — node tools/roles/build.mjs 를 돌리세요.`);
  process.exit(1);
}

writeFileSync(PAGE, next);
writeFileSync(DONE, doneNext);
const shown = visible.reduce((a, g) => a + g.children.length, 0);
const all = TAX.groups.reduce((a, g) => a + g.children.length, 0);
console.log(`✅ 온보딩 1단계 갱신 — 대분류 ${visible.length}/${TAX.groups.length} · 중분류 ${shown}/${all}`);
// 잘라낸 건 반드시 알린다. 조용히 줄이면 "다 넣었다" 로 읽힌다.
console.log(`   숨긴 대분류(주 ${MIN_D1_PER_WEEK}건 미만) ${hiddenGroups.length}개: ` +
  hiddenGroups.map((g) => `${g.label} 주${Math.round(perWeek(g.code))}`).join(' · '));
console.log(`   숨긴 중분류(30일 신규 0건) ${hiddenChips.length}개: ` + hiddenChips.join(' · '));
console.log(`✅ 완료 화면 갱신 — 주제 ${TRK.tracks.length}개 · 대분류 ${visible.length}개 · 중분류 ${shown}건`);
