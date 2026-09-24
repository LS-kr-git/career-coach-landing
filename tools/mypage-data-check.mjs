#!/usr/bin/env node
/**
 * 마이페이지 데이터 층 ↔ 정적 마크업 대조 (pre-push 1.6겹 · CI)
 *
 *   node tools/mypage-data-check.mjs     # 어긋나면 종료코드 1
 *
 * 왜 있나 (2026-09-11 검사관 ②)
 *   01·04·05·06 은 화면을 assets/mypage-data.js 의 값으로 다시 그리는데, 정적 HTML 에도
 *   같은 값이 한 벌 있다(피그마 기준 프레임 상태 — docs-audit 이 그 마크업을 피그마와 대조한다).
 *   docs-audit 은 <script> 를 떼고 보므로 데이터 층만 고치면 화면 문구가 피그마와 달라져도
 *   초록이다. 그 틈을 여기서 막는다.
 *   (직군 목록은 tools/roles/build.mjs --check 가 같은 방식으로 본다.)
 *
 * 2026-09-21 배선 뒤 — 무엇이 바뀌었나
 *   프로필·구독·소장 목록이 서버에서 온다. 그래서 **값을 여기서 마크업과 맞대 볼 수 없다**
 *   (서버가 없으면 값 자체가 없다). 대신 값이 없을 때·실패했을 때 화면이 그리는 **문구**를
 *   데이터 층의 순수 함수에서 받아 본다. 세 가지를 문다.
 *     ① 빈 상태 문구가 마크업에 그 순서로 있는가        (종전 그대로 — 피그마 기준 상태)
 *     ② 실패 문구가 빈 상태 문구와 **다른가**            (2026-09-21 사용자 지시 6번)
 *     ③ 각 화면이 실패 갈래를 실제로 부르는가            (안 부르면 ②가 있어도 안 쓰인다)
 *   값 갈래는 순수 함수(profileView·billingView·archiveView·monthChips)에 픽스처를 넣어
 *   표기 규칙(「… 님」·「08. 07」·「8월」)이 마크업과 같은 모양인지 본다.
 *   🔴 픽스처에 **사람을 지어내지 않는다** (2026-09-17 사용자 지시). 이름은 한 글자,
 *      메일은 우리 도메인이다 — 화면에 안 나가는 검사용 값이지만 같은 규칙을 지킨다.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = await import(pathToFileURL(join(ROOT, 'assets', 'mypage-data.js')).href);

const key = (s) => s.replace(/\s+/g, '');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
/* docs-audit 과 같은 눈으로 본다 — script·style·주석을 뗀 마크업 */
const staticHtml = (rel) => key(read(rel)
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
/* 반대로 **스크립트만** 본다. 주석은 뗀다 — 안 떼면 주석에 남은 이름만으로 초록이 된다
   (career-coach CLAUDE.md 「테스트에 대한 규칙」 5번). */
const scriptOnly = (rel) => (read(rel).match(/<script[\s\S]*?<\/script>/gi) || []).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  /* import 줄도 뗀다 — 부르지 않고 가져오기만 해도 초록이 되면 ③ 이 아무것도 안 본다 */
  .replace(/^\s*import[\s\S]*?;\s*$/gm, ' ');

const problems = [];
/* texts 가 html 에 이 순서대로 있는가 */
function expectInOrder(rel, html, texts) {
  let at = 0;
  for (const t of texts) {
    const i = html.indexOf(key(t), at);
    if (i < 0) { problems.push(`${rel}: 데이터 층의 「${t}」 가 마크업에 없거나 순서가 다릅니다`); return; }
    at = i + key(t).length;
  }
}

/* ── ① 빈 상태 문구 ↔ 마크업 ───────────────────────────────── */
const { EMPTY, FAIL } = data;
expectInOrder('mypage/index.html', staticHtml('mypage/index.html'),
  [EMPTY.insight, EMPTY.name, EMPTY.account, EMPTY.archive]);
expectInOrder('mypage/billing/index.html', staticHtml('mypage/billing/index.html'),
  [EMPTY.plan, EMPTY.card, EMPTY.cardSub, EMPTY.next]);

expectInOrder('mypage/topics/index.html', staticHtml('mypage/topics/index.html'), await data.getTopics());

/* 일요일 화면은 2026-09-24 부터 **서버**(mypage_received)에서 그린다. 그래서 여기서
   `getThisWeek()` 를 부르지 않는다 — 부르면 이 검사가 네트워크를 타고, 서버가 안 뜬 자리에서
   조용히 건너뛰게 된다. 대신 둘을 따로 문다.
     ① 정적 마크업(피그마 기준 상태) ↔ `SUNDAY_STATIC` — 한쪽만 고치면 막힌다
     ② 서버 행을 화면 모양으로 옮기는 순수 함수(`weekRows`)가 그 마크업과 **같은 표기**를 내는가
   ② 가 없으면 날짜 모양이 '2026-09-21' 로 바뀌어도 아무도 모른다. */
const week = data.SUNDAY_STATIC;
const row = (a) => [a.topic, a.date, a.title];
expectInOrder('mypage/sunday/index.html', staticHtml('mypage/sunday/index.html'),
  [...week.filter((a) => !a.read).flatMap(row), ...week.filter((a) => a.read).flatMap(row)]);

{
  /* 2026-08-08 은 토요일이고 그 주는 08-03(월)~08-09(일)이다. 경계 양쪽을 하나씩 둔다 —
     한쪽만 두면 `<=`/`<` 를 뒤집어도 통과한다. */
  const 옮긴것 = data.weekRows(
    [{ publish_date: '2026-08-10', track: '디자인', title: '다음주 월', read: false },
     { publish_date: '2026-08-09', track: '디자인', title: '이번주 일', read: false },
     { publish_date: '2026-08-03', track: '디자인', title: '이번주 월', read: true },
     { publish_date: '2026-08-02', track: '디자인', title: '지난주 일', read: false }],
    '2026-08-08');
  const 기대 = [{ date: '08. 09 일', topic: '디자인', title: '이번주 일', read: false },
               { date: '08. 03 월', topic: '디자인', title: '이번주 월', read: true }];
  if (JSON.stringify(옮긴것) !== JSON.stringify(기대)) {
    problems.push(`mypage/sunday/index.html: weekRows 가 주 경계(월~일)나 날짜 표기를 바꿨다 — ${JSON.stringify(옮긴것)}`);
  }
  // 마크업의 표기와 같은 자로 찍히는가 — 위 기대값의 모양이 SUNDAY_STATIC 과 같아야 한다.
  if (!/^\d{2}\. \d{2} [일월화수목금토]$/.test(data.SUNDAY_STATIC[0].date)) {
    problems.push(`mypage/sunday/index.html: SUNDAY_STATIC 의 날짜 표기가 weekRows 와 다르다 — ${data.SUNDAY_STATIC[0].date}`);
  }
}

/* ── ② 실패 문구는 빈 상태 문구와 달라야 한다 ────────────────── */
/* 결제한 사람에게 「등록된 결제수단 없음」을 보여 주지 않기 위한 불변식이다.
   한 자리라도 같은 글자가 되면 그 자리는 실패와 빈 상태를 못 가른다. */
const 빈것 = data.profileView(null);
const 실패한것 = data.profileFail();
/* 금액은 **아무 값이나** 쓴다 — 우리 가격을 여기 적으면 금액을 말하는 곳이 하나 더 생긴다. */
const 빈결제 = data.billingView(null, { price_krw: 1234, period_unit: 'month', period_count: 1 });
const 실패결제 = data.billingFail();
for (const [화면, a, b] of [['01 프로필', 빈것, 실패한것], ['03 결제', 빈결제, 실패결제]]) {
  for (const k of Object.keys(a)) {
    if (typeof a[k] === 'string' && a[k] && a[k] === b[k]) {
      problems.push(`${화면}: 「${k}」 자리의 실패 문구가 빈 상태 문구와 같습니다 (「${a[k]}」)`);
    }
  }
}
if (FAIL.list === EMPTY.archive) problems.push('05 저장소: 목록 실패 문구가 빈 상태 문구와 같습니다');

/* ── ③ 화면이 **값 갈래와 실패 갈래를 둘 다** 부르는가 ────────── */
/* 실패 갈래만 보면 「서버를 아예 안 읽는」 화면이 초록으로 지나간다 — 배선을 지워도
   빈 상태가 그대로 그려져서 눈으로도 안 보인다. 두 갈래를 같이 문다
   (career-coach 검사관 2026-08-10 「단위 검사와 배선 검사는 다르다」). */
for (const [rel, 값갈래, 실패갈래] of [
  ['mypage/index.html', 'getProfile', 'profileFail'],
  ['mypage/billing/index.html', 'getSubscription', 'billingFail'],
  ['mypage/archive/index.html', 'getArchive', 'FAIL.list'],
  ['mypage/topics/index.html', 'pullFromServer', 'FAIL.line'],
  ['mypage/jobs/index.html', 'pullFromServer', 'FAIL.line'],
  ['checkout/index.html', 'getPlan', 'FAIL.line'],
]) {
  const src = scriptOnly(rel);
  if (!src.includes(값갈래)) {
    problems.push(`${rel}: 서버 조회(${값갈래})를 부르지 않습니다 — 배선이 끊겼는데 빈 상태로 보입니다`);
  }
  if (!src.includes(실패갈래)) {
    problems.push(`${rel}: 조회 실패 갈래(${실패갈래})를 부르지 않습니다 — 실패가 빈 상태로 보입니다`);
  }
}
/* 로그인 확인도 같은 자리에서 본다 — 빠지면 비로그인이 남의 것처럼 보이는 빈 화면을 본다. */
for (const rel of ['mypage/index.html', 'mypage/billing/index.html', 'mypage/archive/index.html',
                   'mypage/topics/index.html', 'mypage/jobs/index.html', 'mypage/sunday/index.html']) {
  if (!scriptOnly(rel).includes('requireLogin')) {
    problems.push(`${rel}: 로그인 확인(requireLogin)을 부르지 않습니다`);
  }
}

/* ── 값 갈래 — 표기 규칙이 마크업과 같은 모양인가 ───────────── */
const 프로필 = data.profileView({ name: '가', provider: 'kakao', email: 'user@careercoach.my', saved_count: 3 });
if (프로필.name !== '가 님') problems.push(`01 프로필: 이름 표기가 「${프로필.name}」 입니다 (「가 님」 이어야 합니다)`);
if (프로필.account !== '카카오 · user@careercoach.my') problems.push(`01 프로필: 가입 경로 표기가 「${프로필.account}」 입니다`);
if (프로필.count !== 3) problems.push('01 프로필: 소장 편수가 그대로 안 나옵니다');

/* 05 은 값이 서버에서 오지만 **표기 규칙은 피그마 기준 마크업**이다 — 날짜 「08. 07」,
   월 칩 「8월」, 해가 바뀌는 자리의 연도 구분. 그 세 모양이 마크업에 그대로 있는지 본다. */
const 목록 = data.archiveView([
  { insight_id: 1, title: '제목', track: '디자인', publish_date: '2026-08-07' },
  { insight_id: 2, title: '제목', track: '디자인', publish_date: '2025-12-18' },
]);
const 칩 = data.monthChips(목록);
const 저장소 = staticHtml('mypage/archive/index.html');
for (const [무엇, 값] of [['날짜', 목록[0].date], ['월 칩', 칩[0].label]]) {
  if (!저장소.includes(key(값))) {
    problems.push(`mypage/archive/index.html: ${무엇} 표기 「${값}」 가 마크업(피그마 기준 상태)에 없습니다`);
  }
}
/* 연도 구분은 **그 자리에** 있어야 한다. 「마크업 어딘가에 2025 가 있다」로 보면 다른 곳의
   숫자만으로 초록이 된다 — 화면이 해가 바뀌는 자리를 안 그려도 모른다. */
if (!new RegExp(`ybreak[\\s\\S]{0,160}${칩[1].year}`).test(read('mypage/archive/index.html'))) {
  problems.push(`mypage/archive/index.html: 연도 구분(ybreak) 안에 「${칩[1].year}」 가 없습니다`);
}
if (칩.length !== 2) problems.push(`05 저장소: 두 달치인데 월 칩이 ${칩.length}개입니다`);

/* ── 금액은 화면에 안 박혀 있어야 한다 ─────────────────────── */
/* 배선 뒤 금액을 말하는 곳은 서버(plan 표)뿐이다. 상수가 되살아나면 여기서 문다 —
   page-audit 의 「가격 하드코딩」 검사는 <script> 를 떼고 보므로 그 자리를 못 본다. */
/* 랜딩 마크업이 말하는 요금. 심사가 로그인 없이 보는 자리라 거기만 글자로 남는다
   (page-audit 이 그 값과 서버 plan 을 맞댄다). 여기서는 **그 값이 다른 화면 스크립트에
   되살아났는지**를 본다 — 상수 이름만 보면 `var 요금 = 3900` 으로 이름을 바꿔 빠져나간다. */
/* 🔴 자리와 표기가 둘 다 있다 (2026-09-24 심사 기간). 랜딩은 `briefing/index.html` 로
   옮겨 갔고 루트는 상품 목록이며, 상품 요약은 「N원 / 월」로 적는다. **page-audit 의
   `priceOf` 와 같은 자를 쓴다** — 한쪽만 고치면 이 검사가 조용히 빈손이 된다. */
const 요금표기 = (h) => (h.match(/월\s*([0-9][0-9,]*)원/) || h.match(/([0-9][0-9,]*)원\s*(?:<[^>]+>\s*)*\/\s*월/) || [])[1];
const 랜딩요금 = ['briefing/index.html', 'index.html'].map((f) => 요금표기(read(f))).find(Boolean);
if (!랜딩요금) problems.push('briefing/index.html·index.html: 「월 N원」·「N원 / 월」 표기를 찾지 못했습니다 — page-audit 의 요금 대조도 같이 멈춥니다');
for (const rel of ['checkout/index.html', 'mypage/billing/index.html']) {
  const src = scriptOnly(rel);
  const 이름으로 = src.match(/(?:PRICE_KRW|priceKrw|price_krw)\s*[=:]\s*\d/);
  const 값으로 = 랜딩요금 && new RegExp(`\\b${랜딩요금.replace(/,/g, '')}\\b|${랜딩요금}\\s*원`).test(src);
  if (이름으로 || 값으로) {
    problems.push(`${rel}: 금액이 화면에 다시 박혔습니다 (${이름으로 ? `「${이름으로[0]}」` : `「${랜딩요금}」`}) — 금액은 plan 표에서 읽습니다`);
  }
}

if (problems.length) {
  console.error('❌ 마이페이지 데이터 층 ↔ 마크업이 어긋납니다:\n' + problems.map((p) => '   · ' + p).join('\n'));
  process.exit(1);
}
console.log(`✅ 마이페이지 데이터 층 ↔ 마크업 일치 (주제 ${(await data.getTopics()).length} · 이번 주 ${week.length} · 배선·실패 갈래 6화면 · 로그인 확인 6화면)`);
