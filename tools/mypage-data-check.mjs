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
  [EMPTY.name, EMPTY.account]);   // 2026-10-12 옛 히어로 문구(EMPTY.insight)는 심사 계정 화면과 함께 걷었다. 저장소 줄은 2026-10-05 부터 「소장한 아티클 N편」이다(EMPTY.archive 는 05 화면만 쓴다)
expectInOrder('mypage/billing/index.html', staticHtml('mypage/billing/index.html'),
  [EMPTY.card, EMPTY.cardSub]);

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
    [{ insight_id: 4, publish_date: '2026-08-10', track: '디자인', title: '다음주 월', read: false },
     { insight_id: 3, publish_date: '2026-08-09', track: '디자인', title: '이번주 일', read: false },
     { insight_id: 2, publish_date: '2026-08-03', track: '디자인', title: '이번주 월', read: true },
     { insight_id: 1, publish_date: '2026-08-02', track: '디자인', title: '지난주 일', read: false }],
    '2026-08-08');
  // id 는 06 에서 고른 편을 서버(0115 mypage_use_makeup)에 넘기는 값이다 — 빠지면 고를 수 없다.
  const 기대 = [{ id: 3, date: '08. 09 일', topic: '디자인', title: '이번주 일', read: false },
               { id: 2, date: '08. 03 월', topic: '디자인', title: '이번주 월', read: true }];
  if (JSON.stringify(옮긴것) !== JSON.stringify(기대)) {
    problems.push(`mypage/sunday/index.html: weekRows 가 주 경계(월~일)나 날짜 표기를 바꿨다 — ${JSON.stringify(옮긴것)}`);
  }
  // 01 배너 세 상태 — 서버 두 칸(0115)을 그대로 옮긴다. 평일에 썼다는 기록이 있어도 잠김이다.
  const 배너 = [[{ is_sunday: false, used: false }, 'locked'], [{ is_sunday: false, used: true }, 'locked'],
               [{ is_sunday: true, used: false }, 'open'], [{ is_sunday: true, used: true }, 'done']];
  for (const [s, 기대상태] of 배너) {
    if (data.sundayStateOf(s) !== 기대상태) problems.push(`mypage/index.html: sundayStateOf(${JSON.stringify(s)}) 가 ${data.sundayStateOf(s)} 다 (${기대상태} 여야 한다)`);
  }
  // 결제 완료 화면의 첫 발송일 — 영업일 08:00(KST) 전이면 그날, 아니면 다음 영업일. 주말·공휴일은 건너뛴다.
  const 첫발송 = [['2026-10-05T22:59:00Z', '2026-10-06', '화 07:59 → 그날'], ['2026-10-05T23:00:00Z', '2026-10-07', '화 08:00 → 다음 날'],
                ['2026-10-02T22:30:00Z', '2026-10-06', '토(개천절) → 대체공휴일 월 건너뜀'], ['2026-10-08T23:30:00Z', '2026-10-12', '목 08:30 → 금 한글날 건너뜀'],
                ['2026-12-31T00:00:00Z', '2027-01-04', '해를 넘긴다']];
  for (const [now, 기대일, 왜] of 첫발송) {
    const got = data.firstSendDay(new Date(now));
    if (got !== 기대일) problems.push(`checkout/done/index.html: firstSendDay(${now}) 가 ${got} 다 (${기대일} — ${왜})`);
  }
  for (const [lo, hi, 기대글] of [[1, 3, '1 ~ 3년'], [0, 0, '0년'], [7, 15, '7 ~ 15년+'], [15, 15, '15년+'], [2, null, '2년']]) {
    if (data.yearsText(lo, hi) !== 기대글) problems.push(`mypage/years/index.html: yearsText(${lo}, ${hi}) 가 「${data.yearsText(lo, hi)}」 다 (「${기대글}」)`);
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
/* 03 끝난 해지 예약 — 이용 종료일이 지난 해지 예약은 끝난 것이다. 서버(career-coach 0137 mypage_resume_subscription)가
   그 구간의 해지 취소를 거절하므로 「해지 취소하기」를 주면 안 된다. 결제 화면 `끝난해지`(0136)와 같은 판정.
   경계 양쪽을 둔다 — 한쪽만 두면 `<=`/`<` 를 뒤집어도 통과한다. 미납은 날짜와 상관없이 되돌릴 수 있다. */
{
  const 지금 = Date.parse('2026-10-15T00:00:00Z');
  const 행 = (status, end) => ({ status, cancel_at_period_end: true, current_period_end: end,
                                price_krw: 1000, period_unit: 'month', period_count: 1, card_last4: null });
  const 사례 = [
    ['종료일 1초 뒤(남음)', 행('active', '2026-10-15T00:00:01Z'), true],
    ['종료일 그 순간(끝남)', 행('active', '2026-10-15T00:00:00Z'), false],
    ['종료일 지남(끝남)', 행('trialing', '2026-10-14T00:00:00Z'), false],
    ['미납·종료일 지남(되돌릴 수 있음)', 행('past_due', '2026-10-01T00:00:00Z'), true],
  ];
  for (const [이름, s, 살아있음] of 사례) {
    const v = data.billingView(s, null, 지금);
    const 바람 = 살아있음 ? 'true|true|true' : 'false|false|false';
    const 값 = `${v.subscribed}|${v.canResume}|${Boolean(v.live)}`;
    if (값 !== 바람) problems.push(`03 결제: 해지 예약 ${이름} — subscribed|canResume|live 가 ${값} 다 (${바람})`);
  }
}

/* 03 요금 표기 — 금액은 아무 값이나(위와 같은 이유). 결제 화면 26판의 칸과 같은 모양이어야 한다. */
{
  const 한달 = { code: 'm', price_krw: 1000, period_unit: 'month', period_count: 1 };
  const 일년 = { code: 'y', price_krw: 8000, period_unit: 'month', period_count: 12, bonus_months: 4 };
  // 덤 달 수는 요금제마다 서버 값이다 — 같은 12개월이어도 4+8 로 그린다(career-coach 0208 · 2026-10-22)
  const 일년48 = { code: 'y2', price_krw: 8000, period_unit: 'month', period_count: 12, bonus_months: 8 };
  const 기대 = [
    [data.planLabel(일년48), '12개월권(4+8개월)'],
    [data.priceText(일년48), '12개월(4+8개월) 8,000원'],
    [(([c]) => `${c.name}|${c.gift}|${c.parts}`)(data.planCards([일년48])), '4개월+8개월|8개월 무료 증정|4개월 + 8개월'],
    [data.planLabel({ code: 'z', price_krw: 8000, period_unit: 'month', period_count: 12 }), '12개월권'],
    [data.priceText(한달), '월 1,000원'],
    [data.priceText(일년), '12개월(8+4개월) 8,000원'],
    [data.planLabel(일년), '12개월권(8+4개월)'],
    [data.planLabel(한달), '1개월권'],
  ];
  const [y, m] = data.planCards([한달, 일년]);
  기대.push([`${y.name}|${y.day}|${y.strike}|${y.pct}|${y.price}|${y.cta}|${y.rec}|${y.on}`,
             '8개월+4개월|22원|12,000원|33%|8,000원|12개월권 · 8,000원 결제하기|true|true'],
            [`${m.name}|${m.day}|${m.strike}|${m.per}|${m.on}`, '1개월|33원|null|/월|false'],
            [`${y.ticket}|${y.buy}|${y.gift}|${y.parts}|${y.month}`, '12개월권|12개월권 구독하기|4개월 무료 증정|8개월 + 4개월|667원'],
            [`${m.ticket}|${m.buy}|${m.gift}|${m.parts}|${m.month}`, '1개월권|1개월권 구독하기|null|null|null']);
  for (const [값, 바람] of 기대) if (값 !== 바람) problems.push(`03 결제: 「${바람}」 이어야 할 자리가 「${값}」 입니다`);
}

/* 실패 문구는 데이터 층에만 있어 docs-audit 이 못 본다(스냅샷에서 jsRenderedText 로 뺐다).
   그래서 피그마 실패 상태 프레임의 스냅샷과 여기서 맞댄다 — 한쪽만 고치면 걸린다. */
const 스냅샷 = JSON.parse(read('tools/figma-audit/figma-docs-text.json'));
for (const [html, 노드, 문구들] of [
  // 2026-10-15 「오류 대체 화면」 — 실패 자리는 스켈레톤, 문구는 하단 안내 알약 하나(FAIL.line)만 남았다
  ['mypage/index.html', '2157:941', [FAIL.line]],
  ['mypage/billing/index.html', '2157:997', [FAIL.line]],
  ['mypage/archive/index.html', '2157:1048', [FAIL.line]],
  ['checkout/index.html', '2616:3276', [FAIL.line]],
]) {
  const 프레임 = (스냅샷.pages.find((p) => p.html === html)?.stateFrames || []).find((f) => f.figmaNode === 노드);
  if (!프레임) { problems.push(`${html}: 실패 상태 프레임 ${노드} 가 스냅샷에 없습니다`); continue; }
  for (const t of 문구들) {
    if (!프레임.texts.includes(t)) problems.push(`${html}: 실패 문구 「${t}」 가 피그마 ${노드} 에 없습니다`);
  }
}

/* ── ③ 화면이 **값 갈래와 실패 갈래를 둘 다** 부르는가 ────────── */
/* 실패 갈래만 보면 「서버를 아예 안 읽는」 화면이 초록으로 지나간다 — 배선을 지워도
   빈 상태가 그대로 그려져서 눈으로도 안 보인다. 두 갈래를 같이 문다
   (career-coach 검사관 2026-08-10 「단위 검사와 배선 검사는 다르다」). */
for (const [rel, 값갈래, 실패갈래] of [
  ['mypage/index.html', 'getProfile', 'profileFail'],
  ['mypage/billing/index.html', 'getSubscription', 'billingFail'],
  ['mypage/archive/index.html', 'getArchive', '목록실패'],   // 2026-10-15 — FAIL.line 은 토큰 실패 갈래도 불러 목록 실패를 못 가른다
  ['mypage/topics/index.html', 'pullFromServer', 'FAIL.line'],
  ['mypage/jobs/index.html', 'pullFromServer', 'FAIL.line'],
  ['checkout/index.html', 'getPlans', 'FAIL.line'],
  ['mypage/years/index.html', 'pullFromServer', 'FAIL.line'],
  ['mypage/regions/index.html', 'pullFromServer', 'FAIL.line'],
  ['mypage/leave/index.html', 'getSubscription', 'FAIL.line'],
  ['checkout/done/index.html', 'getSubscription', null],   // 2026-10-05 새판은 서버 값을 그리지 않는다 — 구독 확인(되돌려 보내기)·구매 이벤트에만 쓴다
]) {
  const src = scriptOnly(rel);
  if (!src.includes(값갈래)) {
    problems.push(`${rel}: 서버 조회(${값갈래})를 부르지 않습니다 — 배선이 끊겼는데 빈 상태로 보입니다`);
  }
  if (실패갈래 && !src.includes(실패갈래)) {
    problems.push(`${rel}: 조회 실패 갈래(${실패갈래})를 부르지 않습니다 — 실패가 빈 상태로 보입니다`);
  }
}
/* 로그인 확인도 같은 자리에서 본다 — 빠지면 비로그인이 남의 것처럼 보이는 빈 화면을 본다. */
for (const rel of ['mypage/index.html', 'mypage/billing/index.html', 'mypage/archive/index.html',
                   'mypage/topics/index.html', 'mypage/jobs/index.html', 'mypage/sunday/index.html',
                   'mypage/years/index.html', 'mypage/regions/index.html', 'mypage/leave/index.html', 'checkout/done/index.html']) {
  // requireOnboarded 는 requireLogin 을 먼저 부르고 온보딩까지 본다(수정 화면 입구 — 2026-10-14).
  if (!/\brequire(Login|Onboarded)\(/.test(scriptOnly(rel))) {
    problems.push(`${rel}: 로그인 확인(requireLogin·requireOnboarded)을 부르지 않습니다`);
  }
}

/* ── 값 갈래 — 표기 규칙이 마크업과 같은 모양인가 ───────────── */
const 프로필 = data.profileView({ name: '가', provider: 'kakao', email: 'user@careercoach.my', saved_count: 3, received_count: 0 });
if (프로필.name !== '가 님') problems.push(`01 프로필: 이름 표기가 「${프로필.name}」 입니다 (「가 님」 이어야 합니다)`);
if (프로필.account !== '카카오 · user@careercoach.my') problems.push(`01 프로필: 가입 경로 표기가 「${프로필.account}」 입니다`);
if (프로필.count !== 3) problems.push('01 프로필: 소장 편수가 그대로 안 나옵니다');
if (프로필.received !== 0 || 프로필.receivedFail) problems.push('01 프로필: 받은 편수 0 이 숫자로 안 나옵니다');
const 옛서버 = data.profileView({ name: '가', provider: 'kakao', email: 'user@careercoach.my', saved_count: 3 });
if (옛서버.received !== null || !옛서버.receivedFail) problems.push('01 프로필: 받은 편수가 없는데 실패 문구가 아닙니다 (지어낸 0)');
// 머리글자는 글자 단위로 — 이모지를 반쪽 잘라 「�」 가 찍혔다. 공백뿐인 이름은 없는 것이다 — 「 님」 이 찍혔다(2026-10-21 점검).
const 이모지 = data.profileView({ name: '🐶가', provider: 'kakao', email: 'u@x' });
if (이모지.initial !== '🐶') problems.push(`01 프로필: 이모지 이름의 머리글자가 「${이모지.initial}」 입니다 (「🐶」 이어야 합니다)`);
const 공백 = data.profileView({ name: '   ', provider: 'kakao', email: 'u@x' });
if (공백.name !== EMPTY.name || 공백.initial !== '') problems.push(`01 프로필: 공백뿐인 이름이 「${공백.name}」 로 그려집니다 (EMPTY.name 이어야 합니다)`);
/* 탈퇴 막힘 창의 날짜는 결제 화면과 같은 값(billingView.next)이다 — current_period_end 를 그대로 쓰면 미납인 사람에게 지난 날을 말했다(2026-10-21 점검) */
{ const 탈퇴 = scriptOnly('mypage/leave/index.html');
  if (/current_period_end/.test(탈퇴) || !/billingView\(/.test(탈퇴)) problems.push('탈퇴 화면: 막힘 창 날짜가 billingView 를 안 거치고 current_period_end 를 그대로 씁니다'); }

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
/* 랜딩은 루트 `index.html` 이다(2026-10-12 PG 통과 뒤). 1개월권은 「N원 /월」로 적는다. */
const 요금표기 = (h) => (h.match(/월\s*([0-9][0-9,]*)원/) || h.match(/([0-9][0-9,]*)원\s*(?:<[^>]+>\s*)*\/\s*월/) || [])[1];
const 랜딩요금 = 요금표기(read('index.html').replace(/<!--[\s\S]*?-->/g, ''));
if (!랜딩요금) problems.push('index.html: 「월 N원」·「N원 /월」 표기를 찾지 못했습니다 — page-audit 의 요금 대조와 같이 보세요');
/* 요금제가 둘 이상이라 첫 매치 하나만 보면 나머지 금액이 스크립트에 되살아나도 못 문다(2026-10-12 검사관 ②).
   랜딩 마크업의 1천원 이상 금액을 전부 모아 같이 본다. */
const 랜딩마크업 = read('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '');
const 랜딩금액들 = [...new Set([...랜딩마크업.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+)원/g)].map((m) => m[1]))];
for (const rel of ['checkout/index.html', 'mypage/billing/index.html']) {
  const src = scriptOnly(rel);
  const 이름으로 = src.match(/(?:PRICE_KRW|priceKrw|price_krw)\s*[=:]\s*\d/);
  const 값으로 = 랜딩금액들.find((v) => new RegExp(`\\b${v.replace(/,/g, '')}\\b|${v}\\s*원`).test(src));
  if (이름으로 || 값으로) {
    problems.push(`${rel}: 금액이 화면에 다시 박혔습니다 (${이름으로 ? `「${이름으로[0]}」` : `「${값으로}」`}) — 금액은 plan 표에서 읽습니다`);
  }
}

// 다시 들어온 사람이 이어서 갈 곳 (2026-10-16 사용자 지시) — 로그인 콜백과 랜딩 「시작하기」가 같은 판정을 쓴다.
{
  const 빈 = { jobs: [], years: null, regions: [] };
  const 요금 = { price_krw: 5900, period_unit: 'month', period_count: 1, cancel_at_period_end: false };
  const 구독중 = { ...요금, status: 'active', current_period_end: new Date(Date.now() + 864e5).toISOString() };
  const 끝남 = { ...요금, status: 'canceled', current_period_end: new Date(Date.now() - 864e5).toISOString() };
  const 기대 = [
    [[true, 구독중, 빈], '/mypage/'], [[true, 끝남, 빈], '/checkout/'], [[true, { status: null }, 빈], '/checkout/'],
    [[false, null, 빈], '/onboarding/1/'], [[false, null, { ...빈, jobs: ['a'] }], '/onboarding/2/'],
    [[false, null, { ...빈, jobs: ['a'], years: 2 }], '/onboarding/3/'],
  ];
  for (const [인자, 답] of 기대) {
    const 나옴 = data.이어갈곳판정(...인자);
    if (나옴 !== 답) problems.push(`이어갈곳판정 — ${JSON.stringify(인자[0])}·${인자[1]?.status ?? '없음'} 에서 ${답} 이어야 하는데 ${나옴}`);
  }
  const 콜백 = scriptOnly('auth/callback/index.html');
  if (!/이어갈곳판정\(/.test(콜백)) problems.push('auth/callback: 다시 들어온 사람의 행선지를 이어갈곳판정으로 정하지 않습니다');
  if (!/온보딩마침판정\(/.test(콜백)) problems.push('auth/callback: 온보딩을 마쳤는지를 onboardingDone 과 다른 기준으로 봅니다 — 온보딩마침판정을 쓰세요');
  if (data.온보딩마침판정({}, []) || !data.온보딩마침판정({}, [{}]) || data.온보딩마침판정(null, [{}])) problems.push('온보딩마침판정이 「선호 행 + 직군 1개 이상」이 아닙니다');
}

if (problems.length) {
  console.error('❌ 마이페이지 데이터 층 ↔ 마크업이 어긋납니다:\n' + problems.map((p) => '   · ' + p).join('\n'));
  process.exit(1);
}
console.log(`✅ 마이페이지 데이터 층 ↔ 마크업 일치 (주제 ${(await data.getTopics()).length} · 이번 주 ${week.length} · 배선·실패 갈래 10화면 · 로그인 확인 10화면)`);
