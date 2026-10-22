// 화면 전환 검사용 가짜 supabase-js — 로그인된 세션 + 화면 코드가 읽는 모양 그대로의 그럴듯한 값.
// 응답은 0.3초 늦게 준다(실제 망과 비슷하게). 구독 중인 회원이라 결제 화면(/checkout/)은 /mypage/ 로 간다.
// 사람 이름은 지어내지 않는다 — 이름 「회원」, 메일 user@careercoach.my.
const lat = () => 300;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const USER = { id: '00000000-0000-0000-0000-000000000001', email: 'user@careercoach.my', app_metadata: { provider: 'kakao' } };
const session = {
  access_token: 'stub-access-token', refresh_token: 'stub-refresh', token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600, provider_token: 'stub-provider-token', user: USER,
};

/* ── 날짜 (서울 기준, 호출 시점에 센다 — 일요일 화면의 「이번 주」가 늘 차게) ── */
const kstNow = () => new Date(Date.now() + 9 * 3600e3);              // 서울 시각을 UTC 칸에
const iso = (t) => t.toISOString().slice(0, 10);
const addDays = (t, n) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() + n); return x; };
function thisWeekDays() {                                             // 이번 주 월~금 중 오늘까지(오늘이 주말이면 월~금 전부)
  const now = kstNow(), dow = now.getUTCDay();
  const mon = addDays(now, -((dow + 6) % 7));
  const last = dow === 0 || dow === 6 ? 4 : dow - 1;
  return Array.from({ length: last + 1 }, (_, i) => iso(addDays(mon, i)));
}

/* ── 글 목록 (지어낸 실존 인물·회사 없음) ── */
const ARTICLES = [
  ['퍼포먼스 마케터가 대시보드보다 먼저 봐야 할 숫자', '마케팅·그로스'],
  ['리텐션을 올린 팀들이 공통으로 버린 지표 하나', '마케팅·그로스'],
  ['연차 3년 차, 이직보다 먼저 정리해야 할 성과 문장', '일 잘하는 법 · 커리어(공통)'],
  ['CRM 메시지 빈도를 줄였더니 전환이 오른 이유', '마케팅·그로스'],
  ['회의록을 남기는 사람이 결국 결정권을 갖는다', '일 잘하는 법 · 커리어(공통)'],
  ['브랜드 캠페인의 효과를 숫자로 설명하는 세 가지 방법', '마케팅·그로스'],
  ['AI 요약을 보고서에 쓸 때 남겨야 할 근거', '일 잘하는 법 · 커리어(공통)'],
  ['콘텐츠 마케팅, 조회수 다음에 봐야 할 것', '마케팅·그로스'],
];

function archiveRows() {                                              // 소장 7편 · 여러 달에 걸쳐
  const now = kstNow();
  const offsets = [2, 9, 23, 37, 52, 81, 118];
  return offsets.map((d, i) => ({
    insight_id: 1200 - i * 17,
    title: ARTICLES[i][0], track: ARTICLES[i][1],
    publish_date: iso(addDays(now, -d)),
  }));
}
function receivedRows() {                                             // 이번 주 받은 편 + 지난 편 몇 개
  const week = thisWeekDays().slice().reverse();                      // 최신 발행일 먼저
  const cur = week.map((d, i) => ({
    insight_id: 1300 + i, title: ARTICLES[(i + 3) % ARTICLES.length][0], track: ARTICLES[(i + 3) % ARTICLES.length][1],
    publish_date: d, read: i % 2 === 1,
  }));
  const past = archiveRows().filter((r) => r.publish_date < thisWeekDays()[0]).map((r) => ({ ...r, read: true }));   // 이번 주와 겹치는 소장 편은 빼 중복을 막는다
  return [...cur, ...past];
}

function subscriptionRow() {
  const end = addDays(kstNow(), 214);
  const base = {
    code: 'm12', name: '12개월권', price_krw: 47200, period_unit: 'month', period_count: 12, bonus_months: 4,
    status: 'active', cancel_at_period_end: false,
    current_period_end: end.toISOString().slice(0, 10) + 'T15:00:00+00:00',
    card_issuer: '현대카드', card_brand: 'VISA', card_last4: '4417',
  };
  return base;
}

/* ── RPC: 서버가 「행 하나」를 주는 것은 [행] 모양 ── */
const RPC = {
  mypage_profile: () => [{ name: '회원', provider: 'kakao', email: 'user@careercoach.my', saved_count: 7, received_count: 23 }],
  mypage_subscription: () => [subscriptionRow()],
  mypage_archive: () => archiveRows(),
  mypage_received: () => receivedRows(),
  mypage_sunday: () => [{ is_sunday: kstNow().getUTCDay() === 0, used: false }],
  mypage_insight_token: () => 'AbCdEfGhIjKlMnOpQrStUv',            // 스칼라(22자 base64url) — 배열 아님
  mypage_use_makeup: () => [{ state: 'makeup_used', token: 'AbCdEfGhIjKlMnOpQrStUv' }],
  save_onboarding: () => null,
};

/* ── 표 ── */
const TABLE = {
  user_preference: () => [{ user_id: USER.id, years_min: 2, years_max: 5, insight_track: '마케팅·그로스' }],
  user_preference_job: () => [{ user_id: USER.id, job_code: '퍼포먼스마케팅' }, { user_id: USER.id, job_code: 'CRM마케팅' }],
  user_preference_region: () => [{ user_id: USER.id, region_code: '서울' }, { user_id: USER.id, region_code: '경기' }],
  plan: () => [
    { code: 'm12', name: '12개월권', price_krw: 47200, period_unit: 'month', period_count: 12, bonus_months: 4, is_active: true },
    { code: 'm1', name: '1개월권', price_krw: 5900, period_unit: 'month', period_count: 1, is_active: true },
  ],
};

/** 아무 메서드나 이어 붙여도 되는 체인. await 하면 { data, error }. */
function chain(produce) {
  let mode = 'many', lim = null;
  let p = null;
  const run = () => p || (p = wait(lat()).then(() => {
    let data = produce();
    if (Array.isArray(data) && lim != null) data = data.slice(0, lim);
    if (mode === 'single') data = Array.isArray(data) ? data[0] ?? null : data;
    if (mode === 'maybe') data = Array.isArray(data) ? data[0] ?? null : data;
    return { data, error: null, status: 200, statusText: 'OK', count: Array.isArray(data) ? data.length : null };
  }));
  const proxy = new Proxy(function () {}, {
    get(_, k) {
      if (k === 'then') return (a, b) => run().then(a, b);
      if (k === 'catch') return (b) => run().catch(b);
      if (k === 'finally') return (f) => run().finally(f);
      return (...args) => {
        if (k === 'single') mode = 'single';
        else if (k === 'maybeSingle') mode = 'maybe';
        else if (k === 'limit') lim = Number(args[0]);
        return proxy;
      };
    },
    apply() { return proxy; },
  });
  return proxy;
}

export function createClient() {
  return {
    auth: {
      getSession: async () => { await wait(Math.min(30, lat())); return { data: { session }, error: null }; },
      getUser: async () => { await wait(lat()); return { data: { user: USER }, error: null }; },   // liveSession: 401/403 이 아니면 살아 있음
      onAuthStateChange: (cb) => { setTimeout(() => { try { cb('SIGNED_IN', session); } catch { /* 무시 */ } }, 0);
        return { data: { subscription: { unsubscribe() {} } } }; },
      setSession: async () => ({ data: { session }, error: null }),
      refreshSession: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
      exchangeCodeForSession: async () => ({ data: { session }, error: null }),
    },
    rpc: (name) => chain(() => (RPC[name] ? RPC[name]() : null)),
    from: (table) => chain(() => (TABLE[table] ? TABLE[table]() : [])),
    functions: { invoke: async () => { await wait(lat()); return { data: null, error: null }; } },
  };
}
