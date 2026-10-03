/**
 * 마이페이지 데이터 층 — 여섯 화면(01~06)이 **이 파일 하나**에서 자료를 받는다.
 *
 * 왜 있나 (2026-09-11)
 *   여섯 화면이 같은 사람·같은 아티클 목록을 보여주는데, 값이 화면마다 따로 박혀 있었다.
 *   배선(실제 서버 연결)할 때 여섯 곳을 따로 고치면 한 곳이 빠진 채로 나간다.
 *   그래서 자료가 나오는 자리를 하나로 모으고, 화면은 여기서 받은 값만 그린다.
 *
 * 무엇이 서버에서 오나 (2026-09-21 배선)
 *   프로필·구독·결제수단·소장 목록은 career-coach 0086 의 RPC 에서 온다.
 *   직군·연차·근무지·주제는 assets/onboarding-store.js 가 정본이다 — 온보딩과 같은 값이라
 *   통로도 같다(user_preference* 직접 조회 + save_onboarding).
 *   일요일 추가 열람(01 배너 · 06 화면)도 서버다 — 받은 편은 0089, 「이번 주에 썼나」와
 *   쓰기는 0115. 브라우저에 남기던 기록(cc_mypage)은 2026-10-03 에 걷었다.
 *
 * 모양
 *   읽기 함수는 전부 async 이고 **실패하면 던진다.** 삼키고 빈 값을 돌려주면 화면이 그것을
 *   「아직 없음」으로 그려, 결제한 사람에게 「등록된 결제수단 없음」을 보여 주게 된다
 *   (2026-09-17 검사관 ①). 빈 상태와 실패는 화면에서 서로 다른 것을 그린다.
 *   그리는 문구는 아래 **view 함수**가 정한다 — 화면은 DOM 에 넣기만 한다. 그래야
 *   tools/mypage-data-check.mjs 가 브라우저 없이 그 문구를 마크업과 맞대 볼 수 있다.
 *
 * ⚠️ 정적 HTML 에도 **빈 상태** 한 벌이 있다 (피그마 기준 프레임 상태 — docs-audit 대조용).
 *   두 벌이 어긋나면 tools/mypage-data-check.mjs 가 푸시를 막는다. 직군 목록은 build.mjs 가 만든다.
 */

/**
 * supabase-js 클라이언트. 온보딩과 **같은 하나**를 쓴다 — 둘이면 로그인 세션을 두 벌 들고
 * 서로 모르게 갱신한다.
 * ⚠️ 정적 import 로 쓰지 않는다. 이 파일은 tools/mypage-data-check.mjs 가 node 에서 그대로
 *    불러 표기 규칙을 대조하는데, 브라우저 절대경로('/assets/…')는 node 가 못 푼다.
 *    아래 view 함수들은 순수 함수라 이 갈래를 안 지나고, 그래서 검사가 브라우저 없이 돈다.
 */
async function supa() {
  const { client } = await import('/assets/onboarding-store.js');
  return client();
}

/* 🔴 사람 정보는 목값으로 만들지 않는다 (2026-09-17 사용자 지시 ③).
   여기 「김서연 / 카카오 계정 / seoyeon@kakao.com / 128」 이 박혀 있으면 심사관이 심사용
   계정으로 로그인해 **남의 정보**를 보게 되고, 심사에서는 이것을 「운영 중인 상점이 아니라
   만들다 만 목업」 으로 읽는다(포트원 「서비스 필수 구축요건」 — 상품명 TEST·0원 결제를
   카드사 심사 불가로 보는 것과 같은 신호).

   빈 상태 문구는 EMPTY 한 곳에서만 말한다 — 정적 마크업(피그마 기준 상태)의 같은 문구와
   tools/mypage-data-check.mjs 가 대조하므로 한쪽만 고치면 푸시가 막힌다. */
export const EMPTY = {
  insight: '받은 인사이트가 여기에 쌓여요',
  name: '내 계정',
  account: '로그인한 계정으로 이용 중이에요',
  archive: '소장한 아티클이 여기에 모여요',
  // 05 화면에서만 쓰는 둘째 줄. 01 의 같은 문구 아래에 붙는 설명이라 여기 둔다.
  archiveHint: '아티클 전문을 읽으면 여기에 담겨요',
  plan: '구독 정보는 결제 후 여기에 표시돼요',
  card: '등록된 결제수단 없음',
  cardSub: '등록 후 여기에 표시돼요',
  next: '다음 결제일 · 결제 후 표시',
};

/* 🔴 실패는 빈 상태와 **다른 글자**로 그린다 (2026-09-21 사용자 지시 6번 · 협상 대상 아님).
   EMPTY 를 실패에도 쓰면 결제한 사람이 「등록된 결제수단 없음」을 보게 된다 — 화면이
   「아직 안 했다」고 말하는데 실제로는 「물어보지 못했다」인 상태다. 자리는 그대로 쓰고
   글자만 바꾼다(새 부품을 만들지 않는다). */
export const FAIL = {
  line: '정보를 불러오지 못했어요',
  hint: '잠시 후 다시 열어 주세요',
  list: '목록을 불러오지 못했어요',
};

/* 🔴 **발송이 받는 트랙 이름 그대로다** (career-coach `sources.TRACK_CAREER` · 2026-10-03).
   앞 판의 「일하는 사람 공통」은 발송 쪽 이름표에 없어 그 칩을 고른 사람에게 직군 트랙이 나갔다. */
export const COMMON_TOPIC = '일 잘하는 법 · 커리어(공통)';

/** 가입 경로 표기. 서버는 Supabase 가 적은 코드('kakao'·'email')를 그대로 준다. */
const PROVIDER_LABEL = { kakao: '카카오', email: '이메일' };

/* 04 화면 칩 순서 그대로 — 공통 칩이 항상 첫 번째다. */
const TOPICS = [
  COMMON_TOPIC,
  'UI·UX 디자인',
  '디자인',
  '개발·AI',
  '마케팅·그로스',
  '프로덕트·전략',
  '세일즈·GTM',
  '제조·R&D',
  '재무·회계',
  '조직·피플',
  '커머스·리테일',
  '금융·마켓',
  '물류·공급망',
  '법률·규제',
  '미디어·콘텐츠',
  '고객경험·CX',
  '의료·헬스케어',
  '건설',
  '공간',
  '게임',
];

/* 이번 주 발행 5편 — read 가 true 면 발행 당일에 읽어 이미 소장한 것이다.
   🔴 목값이다. 머리말 「무엇이 서버에서 오나」 참조 — 서버에 누가 어느 편을 받았는지가 없다. */
/* 일요일 화면(06)의 **정적 마크업 사본** — 검사 전용이다.
   화면은 2026-09-24 부터 서버(`mypage_received`)에서 그린다. 그런데 마크업에는 여전히
   피그마 기준 상태의 5줄이 있어야 한다(docs-audit 대조용). 두 벌이 어긋나면
   tools/mypage-data-check.mjs 가 막는다 — 이 목록이 그 대조의 한쪽이다.
   🔴 **화면이 이 값을 그리지 않는다.** 여기 사람 이름·이메일을 넣지 않는 것과 같은 이유로
      실제 데이터인 척하는 값을 여기 두지 않는다. 글 제목은 피그마 프레임의 그 글자다. */
export const SUNDAY_STATIC = [
  { date: '08. 08 금', topic: '디자인', title: '핸드오프 문서를 줄이는 다섯 가지 습관', read: false },
  { date: '08. 07 목', topic: '디자인', title: '디자인 시스템을 팀에 정착시키는 6개월', read: true },
  { date: '08. 06 수', topic: '커리어·이직', title: '이직 오퍼를 비교하는 세 가지 기준', read: true },
  { date: '08. 05 화', topic: 'AI로 일하기', title: '요약을 믿지 말고 근거를 남겨라', read: false },
  { date: '08. 04 월', topic: '디자인', title: '리서치 없이 만든 화면이 실패하는 이유', read: false },
];

/* ── 로그인 ───────────────────────────────────────────────── */

/**
 * 로그인한 사람인지 본다. 아니면 /login/ 으로 보내고 **거짓**을 돌려준다 —
 * 부른 화면은 그때 아무것도 그리지 않는다(잠깐 남의 것처럼 보이는 빈 화면을 안 그린다).
 * 세션 확인 자체가 실패하면 던진다 — 로그인 안 한 것과 못 물어본 것은 다르다.
 * `next` 를 주면 로그인 뒤 그리로 돌아온다(assets/return-to.js 의 허용 목록 안에서만).
 */
export async function requireLogin(next) {
  const supabase = await supa();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    if (next) (await import('/assets/return-to.js')).rememberNext(next);
    location.replace('/login/');
    return false;
  }
  return true;
}

/* ── 서버 조회 ─────────────────────────────────────────────── */

/**
 * RPC 한 번. 실패는 그대로 올린다.
 * `one` 이면 행 하나를 꺼내는데, **0행도 실패로 본다** — 이 통로들은 서버가 「없음」을 null 칸으로
 * 말하기로 돼 있어서(0086), 행이 안 오는 것은 못 물어본 것이다. 접어서 null 을 돌려주면
 * 화면이 그것을 빈 상태로 그려 결제한 사람에게 「등록된 결제수단 없음」을 보여 준다.
 */
async function rpc(name, one, args) {
  const supabase = await supa();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  if (one && !(data && data[0])) throw new Error(`${name}: 행이 오지 않았습니다`);
  return one ? data[0] : (data || []);
}

/** 프로필 — { name, provider, email, saved_count }. 회원 행이 없으면 서버가 예외를 던진다. */
export async function getProfile() { return rpc('mypage_profile', true); }

/** 구독·결제수단. 서버가 **항상 한 행**을 준다 — 없는 값은 null 이다. */
export async function getSubscription() { return rpc('mypage_subscription', true); }

/** 해지. 기간 끝 해지라 다음 결제일이 그대로 「이용 종료일」이 된다. */
export async function cancelSubscription() { return rpc('mypage_cancel_subscription', true); }

/** 소장한 편 전부 — { insight_id, title, track, publish_date }. */
export async function getArchive() { return rpc('mypage_archive', false); }

/** 살아 있는 요금제. 구독 전에도 금액을 보여 줘야 해서 구독과 따로 읽는다.
 *  결제 화면(checkout)도 이 함수를 쓴다 — 금액을 말하는 곳이 서버 한 곳이어야 한다. */
export async function getPlan() {
  const supabase = await supa();
  const { data, error } = await supabase
    .from('plan').select('code, name, price_krw, period_unit, period_count').eq('is_active', true);
  if (error) throw error;
  // 살아 있는 요금제가 둘이면 어느 것으로 청구되는지 화면이 고를 수 없다. 조용히 첫 줄을
  // 집으면 사람마다 다른 금액을 볼 수 있으므로 실패로 본다.
  if (!data || data.length !== 1) throw new Error(`살아 있는 요금제가 ${data ? data.length : 0}개입니다`);
  // 화면 문구가 「월 …원」 한 모양뿐이라 2기간 이상 요금제는 그릴 수가 없다. 조용히
  // 「월」로 그리면 3개월 요금제가 월 요금처럼 보인다 — 그리기 전에 멈춘다.
  if (data[0].period_count !== 1) throw new Error(`이 화면이 못 그리는 요금제입니다 (기간 ${data[0].period_count})`);
  return data[0];
}

/* ── 결제수단 보관 ─────────────────────────────────────────── */

// 배포된 엣지 함수 슬러그. 이름을 못 맞히게 길게 지은 값이라 주소가 곧 접근 통제의 일부다
// (career-coach `supabase/functions/portone-6r2k9tvq`). 바뀌면 이 한 줄만 고친다.
const BILLING_FN = 'portone-6r2k9tvq';

/**
 * 결제창이 발급한 빌링키를 **서버에 넘겨 확인·보관시킨다.** 브라우저가 쥔 채로 끝나면
 * 구독이 안 열린다.
 *
 * 🔴 브라우저가 DB 에 직접 쓰지 않는다. `private.billing_key` 는 Data API 밖에 있고,
 *    쓰기 전에 포트원에 되물어 **우리 상점의 살아 있는 키인지** 확인해야 한다 — 안 하면
 *    아무 문자열이나 넣어 남의 구독을 열 수 있다. 그 판단은 엣지 함수 한 곳에 있다.
 * 🔴 **200 이 아니면 던진다.** 보관 안 된 것을 「등록했다」로 그리면 사용자는 결제될 줄
 *    알고 기다리다 아무것도 안 온다 — 이 파일이 지키는 「실패를 빈 상태로 그리지 않는다」와
 *    같은 규칙이다.
 * ⚠️ 신원은 몸통이 아니라 **토큰**으로 간다. 함수가 그 토큰을 되물어 회원을 알아낸다.
 */
export async function saveBillingKey(billingKey) {
  const { SUPABASE_URL } = await import('/assets/supabase-config.js');
  const supabase = await supa();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('로그인 세션이 없습니다');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${BILLING_FN}/billing-key`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${data.session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ billingKey }),
  });
  if (!res.ok) {
    // 🔴 상태코드는 **콘솔에만** 남기고 던지는 메시지는 비운다. 부르는 화면이 이 값을
    //    그대로 그리면 사용자가 「빌링키 보관 실패 (502)」를 읽게 되고, 그건 아무도
    //    지시하지 않은 화면 문구다. 화면은 자기 문구로 말한다.
    console.error('빌링키 보관 실패', res.status, await res.text().catch(() => ''));
    throw new Error('');
  }
  return res.json();
}

/**
 * 결제창에 실을 **회원 번호** — 로그인 계정 id(auth.users.id)다 (2026-10-03 사용자 지시).
 *
 * 왜 — 포트원에 카드만 등록되고 우리 보관이 실패하면(결제창을 닫음·서버 불통) 그 카드가 누구 것인지
 * 알 길이 없었다. 앞 판은 일회용 번호(issueId)를 넘겼다. 이 번호가 실려 있으면 career-coach 의
 * 결제사 대조(portone-6r2k9tvq/pg-reconcile)가 그 카드를 우리 회원과 잇는다.
 * ⚠️ 로그인 세션이 없으면 던진다 — 빈 값으로 결제창을 열면 그 카드는 다시 누구 것인지 모르게 된다.
 */
export async function billingCustomerId() {
  const supabase = await supa();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const id = data.session && data.session.user && data.session.user.id;
  if (!id) throw new Error('로그인 세션이 없습니다');
  return id;
}

export async function getTopics() { return TOPICS; }
/** 그 사람에게 **실제로 나간** 편 전부. 최신 발행일이 먼저다 (0089 `mypage_received`). */
export async function getReceived() { return rpc('mypage_received', false); }

/**
 * 이번 주(월~일, KST) 받은 편을 일요일 화면이 쓰는 모양으로. **순수 함수**라 브라우저가 없어도 돈다.
 *
 * ⚠️ 주 경계는 **월요일 00:00 KST** 다 — 서버의 `insight_week_start`(0023)와 같은 규칙이다.
 *    여기서 다르게 자르면 「보충 1편」의 대상이 화면과 서버에서 갈린다.
 * `read` 는 서버의 열람 기록이다. 「소장 완료」로 그리는 쪽이 이것이고,
 *    소장은 읽으면 자동으로 되므로(0084) 두 칸을 화면에서 다시 가르지 않는다.
 */
export function weekRows(rows, todayIso) {
  const 월요일 = 주의_월요일(todayIso);
  const 일요일 = 더한날(월요일, 6);
  return (rows || [])
    .filter((r) => r.publish_date >= 월요일 && r.publish_date <= 일요일)
    .map((r) => ({ id: r.insight_id, date: dayLabel(r.publish_date), topic: r.track, title: r.title, read: !!r.read }));
}

const 요일이름 = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → '08. 08 금'. 정적 마크업(피그마 기준 상태)과 같은 모양이어야 한다.
 *  ⚠️ 월·일은 `kstParts` 로 뽑는다 — 이 파일의 **날짜 자는 그것 하나**이고
 *     `archiveView` 의 「08. 07」도 같은 자로 만든다. 여기서 따로 쪼개면 자가 둘이 된다. */
function dayLabel(iso) {
  const { m, d } = kstParts(iso);
  return `${m}. ${d} ${요일이름[new Date(`${iso}T00:00:00Z`).getUTCDay()]}`;
}

/** 그 날짜가 속한 주의 월요일('YYYY-MM-DD').
 *  ⚠️ 여기는 표기가 아니라 **날짜 산술**이라 `kstParts`(표기용)로는 못 한다. 시간대를
 *     안 타게 UTC 자정으로만 세고, 그래서 기기 시간대와 무관하다. */
function 주의_월요일(iso) {
  const t = new Date(`${iso}T00:00:00Z`);
  return 더한날(iso, -((t.getUTCDay() + 6) % 7));
}

function 더한날(iso, n) {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export async function getThisWeek() {
  return weekRows(await getReceived(), kstToday().date);
}

/* ── 그리는 문구 (순수 함수 — 브라우저 없이도 돈다) ───────────── */

const PERIOD_LABEL = { day: '일', month: '월', year: '년' };

/** 「3,900원」 — 금액만. 결제 화면의 「오늘 결제 금액」처럼 기간이 붙지 않는 자리가 있다. */
export function wonText(krw) { return krw.toLocaleString('ko-KR') + '원'; }

/** 「월 3,900원」. period_count 가 1 인 요금제만 이 모양으로 말할 수 있다 — getPlan 이 그걸 지킨다. */
export function priceText(plan) {
  return `${PERIOD_LABEL[plan.period_unit] || plan.period_unit} ${wonText(plan.price_krw)}`;
}

/** 'YYYY-MM-DD' | ISO → 서울 기준 { y, m, d }. 기기 시간대와 무관해야 한다. */
function kstParts(value) {
  const iso = String(value);
  // date 형(YYYY-MM-DD)은 그대로 쓴다 — Date 로 돌리면 UTC 자정으로 읽혀 하루가 밀린다.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return { y, m, d };
  }
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t) => p.find((x) => x.type === t).value;
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** 「2026년 9월 21일」 — 다음 결제일 표기. */
export function dayText(value) {
  const { y, m, d } = kstParts(value);
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

/**
 * 01 프로필 카드 네 자리. 값이 없는 자리는 EMPTY 를 그대로 쓴다 —
 * 「null 님」 같은 것을 그리지 않고, 없는 사람을 지어내지도 않는다.
 * count 는 0 도 빈 상태다: 「0개의 인사이트를 쌓았어요」는 아직 아무것도 안 쌓인 사람에게
 * 할 말이 아니고, EMPTY.insight 가 그 사람에게 하는 말이다.
 */
export function profileView(p) {
  const name = (p && p.name) || null;
  const label = p && PROVIDER_LABEL[p.provider];
  const count = p && p.saved_count > 0 ? p.saved_count : null;
  return {
    count,
    insight: count == null ? EMPTY.insight : null,     // 수가 있으면 화면이 숫자 꼴로 그린다
    initial: name ? name.trim()[0] : '',
    name: name ? `${name} 님` : EMPTY.name,
    account: label && p.email ? `${label} · ${p.email}` : EMPTY.account,
  };
}

/**
 * 03 멤버십·결제 다섯 자리. 구독 전·카드 전은 EMPTY 를 쓴다.
 * plan 은 요금제 행(구독 전에도 금액을 보여 주려고 따로 읽는다).
 */
export function billingView(s, plan) {
  const 구독중 = s && s.status && ['trialing', 'active', 'past_due'].includes(s.status);
  const 해지예약 = Boolean(구독중 && s.cancel_at_period_end);
  const card = s && s.card_last4;
  /* 🔴 구독 중인 사람의 요금은 **그 사람 구독에 매달린 값**이다 — 지금 살아 있는 요금제가
     아니다. 프라이싱 테스트로 새 요금제를 켜고 옛 것을 내리면, 옛 요금으로 청구되는 사람의
     화면이 새 요금을 말하게 된다. 서버가 그 값을 같은 응답에 실어 준다(0086). */
  const 요금 = 구독중 ? priceText(s) : priceText(plan);
  return {
    live: 구독중 ? (해지예약 ? '해지 예약됨' : '구독 중') : null,
    plan: 구독중
      ? `${요금} · ${해지예약 ? '이용 종료일' : '다음 결제일'} ${dayText(s.current_period_end)}`
      : EMPTY.plan,
    card: card ? [s.card_issuer, s.card_brand].filter(Boolean).join(' ') || '등록된 카드' : EMPTY.card,
    cardSub: card ? `•••• ${s.card_last4}` : EMPTY.cardSub,
    next: 구독중
      ? `${해지예약 ? '이용 종료일' : '다음 결제일'} · ${dayText(s.current_period_end)}`
      : EMPTY.next,
    amount: 요금,
    // 해지할 것이 없거나 이미 예약된 사람에게는 누를 것을 주지 않는다.
    canCancel: Boolean(구독중 && !해지예약),
  };
}

/** 프로필 조회가 실패했을 때 그 네 자리. 같은 모양이라 화면은 한 함수로 그린다. */
export function profileFail() {
  return { count: null, insight: FAIL.line, initial: '', name: FAIL.line, account: FAIL.hint };
}

/** 구독 조회가 실패했을 때 그 다섯 자리. 금액도 안 그린다 — 못 물어본 값이다. */
export function billingFail() {
  return { live: null, plan: FAIL.line, card: FAIL.line, cardSub: FAIL.hint,
           next: FAIL.line, amount: '', canCancel: false };
}

/** 05 목록 한 줄 — 서버 행을 화면 표기로. date 는 「08. 07」, month 는 월 칩이 묶는 단위다. */
export function archiveView(rows) {
  return rows.map((r) => {
    const { y, m, d } = kstParts(r.publish_date);
    return {
      id: r.insight_id,
      month: `${y}년 ${Number(m)}월`,
      date: `${m}. ${d}`,
      topic: r.track,
      title: r.title,
    };
  });
}

/**
 * 05 월 칩 — 목록에 실제로 있는 달만, 최신순. 해가 바뀌는 자리에 구분을 넣는다.
 * **여기서 직접 정렬한다.** 서버 정렬에 기대면 그쪽 order by 가 바뀌는 날 첫 칩(자동 선택)이
 * 아무 달이나 되고, 화면은 그걸 「가장 최근 달」로 보여 준다.
 */
export function monthChips(rows) {
  const out = [];
  for (const r of rows) {
    if (out.some((c) => c.month === r.month)) continue;
    const [year, label] = r.month.split('년 ');
    out.push({ month: r.month, year, label, 정렬: Number(year) * 100 + parseInt(label, 10) });
  }
  return out.sort((a, b) => b.정렬 - a.정렬);
}

/* ── 일요일 추가 열람 ─────────────────────────────────────── */

/** 한국 시간 기준 오늘 — { date: 'YYYY-MM-DD', sunday: boolean }. 기기 시간대와 무관하게 서울 요일로 판정한다. */
export function kstToday() {
  const { y, m, d } = kstParts(new Date().toISOString());   // 날짜 자는 kstParts 하나뿐이다
  const 요일 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date());
  return { date: `${y}-${m}-${d}`, sunday: 요일 === 'Sun' };
}

/** 일요일 추가 열람 — { is_sunday, used } (0115). 「썼다」는 서버의 보충 기록이라 기기를 바꿔도 같다. */
export async function getSunday() { return rpc('mypage_sunday', true); }

/** 01 배너 상태 — 'open'(일요일·아직 안 씀) | 'done'(일요일·이번 주 씀) | 'locked'(평일). */
export function sundayStateOf(s) {
  if (!s.is_sunday) return 'locked';
  return s.used ? 'done' : 'open';
}

/**
 * 고른 편에 이번 주 보충 1편을 쓰고, 그 편 전문 주소를 돌려준다 (0115 `mypage_use_makeup`).
 * 열렸든 아니든 받은 편이면 주소가 온다 — 잠긴 이유(구독 필요·이번 주 이미 씀)는 전문 페이지가
 * 확정된 문구로 말한다. 주소가 없으면(받지 않은 편) 던진다.
 */
export async function useSunday(insightId) {
  const r = await rpc('mypage_use_makeup', true, { p_insight_id: insightId });
  if (!r.token) throw new Error('mypage_use_makeup: 받은 편이 아닙니다');
  return { state: r.state, href: insightHref(r.token, insightId, 'sunday') };
}

/**
 * 전문 페이지 주소. `from` 은 마이페이지에서 열었다는 표시다 — 전문 페이지가 그때만 로고 대신
 * 뒤로가기 헤더를 세운다(2026-10-03 사용자 컨펌 「1번」). 알림톡 링크에는 붙지 않는다.
 */
export function insightHref(token, insightId, from) {
  return `/insight/?t=${encodeURIComponent(token)}&id=${encodeURIComponent(insightId)}&from=${encodeURIComponent(from)}`;
}

/** 저장소에서 소장한 편을 열 때 쓰는 그 사람의 토큰 (0115 `mypage_insight_token`). */
export async function getInsightToken() {
  const supabase = await supa();
  const { data, error } = await supabase.rpc('mypage_insight_token');
  if (error) throw error;
  if (!data) throw new Error('mypage_insight_token: 값이 오지 않았습니다');
  return data;
}

/**
 * 탈퇴 (0116 `mypage_withdraw`). 'withdrawn' | 'membership'(멤버십이 남아 거절) | 'not_found'.
 * 서버가 멤버십을 다시 본다 — 화면이 「탈퇴할 수 있다」고 그렸어도 그 사이 결제가 걸렸으면 거절한다.
 */
export async function withdraw(reason) {
  const supabase = await supa();
  const { data, error } = await supabase.rpc('mypage_withdraw', { p_reason: reason || null });
  if (error) throw error;
  return data;
}

/**
 * 마이페이지 고치기 화면(연차·근무지)의 저장 — 고른 값을 브라우저에 먼저 써 둔 뒤 부른다.
 * 진입 때 띄운 retryPending() 이 아직 돌면 store 가 'busy' 를 준다 — 실패가 아니라 「지금은 못
 * 보낸다」라 잠깐 기다렸다 다시 보낸다(주제 화면 mypage/topics 와 같은 처리).
 * 'ok' 만 저장된 것이다. 'incomplete' 면 보낼 것이 없어 재시도 대상도 아니므로 `before` 로 되돌린다.
 */
export async function savePrefs(before) {
  const { saveOnboarding, writeState } = await import('/assets/onboarding-store.js');
  for (let 남은기회 = 5; ; 남은기회--) {
    const { status } = await saveOnboarding();
    if (status === 'busy' && 남은기회 > 0) { await new Promise((r) => setTimeout(r, 400)); continue; }
    if (status === 'incomplete') writeState(before);
    return status;
  }
}

/** 연차 구간 글자 — 「1 ~ 3년」·「0년」·「7 ~ 15년+」. 연차 고치기 화면과 마이페이지 줄이 같이 쓴다. */
export function yearsText(lo, hi) {
  const one = (v) => (v >= 15 ? '15년+' : v + '년');
  const b = hi ?? lo;
  return lo === b ? one(lo) : `${lo} ~ ${one(b)}`;
}

/* 🔴 공휴일 사본 — 정본은 career-coach `ops/holidays.json`(발송 회차가 공휴일을 건너뛰는 근거).
   이 사이트에는 서버가 영업일을 알려 주는 통로가 없어 2026·2027 날짜만 옮겨 왔다(2026-10-03).
   목록이 끝나는 해(2027) 뒤에는 주말만 거르므로 공휴일 하루가 틀릴 수 있다 — 정본이 그해를
   받으면 이 줄도 같이 늘린다. */
const HOLIDAYS = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-03-02',
  '2026-05-01', '2026-05-05', '2026-05-24', '2026-05-25', '2026-06-03', '2026-06-06',
  '2026-07-17', '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25', '2027-01-01', '2027-02-06',
  '2027-02-07', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-01', '2027-05-03',
  '2027-05-05', '2027-05-13', '2027-06-06', '2027-07-17', '2027-07-19', '2027-08-15',
  '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-03', '2027-10-04',
  '2027-10-09', '2027-10-11', '2027-12-25', '2027-12-27',
]);

/**
 * 첫 알림톡이 가는 날 — 'YYYY-MM-DD'. 발송은 영업일(월~금·공휴일 제외) 08:00 KST 한 번이고,
 * 받는 사람 명단은 그 회차가 시작될 때 정해진다(career-coach ops/send.py SELECT_TARGET).
 * 그래서 영업일 08:00 전에 결제했으면 그날, 아니면 다음 영업일이다. `now` 는 검사용 이음매다.
 */
export function firstSendDay(now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600e3);          // 서울 시각을 UTC 칸에 놓는다
  const iso = (t) => t.toISOString().slice(0, 10);
  const 영업일 = (t) => t.getUTCDay() % 6 !== 0 && !HOLIDAYS.has(iso(t));
  const t = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
  if (영업일(t) && k.getUTCHours() < 8) return iso(t);
  do t.setUTCDate(t.getUTCDate() + 1); while (!영업일(t));
  return iso(t);
}

/** 「10월 5일(월)」 */
export function shortDayText(iso) {
  const [, m, d] = iso.split('-').map(Number);
  const w = '일월화수목금토'[new Date(iso + 'T00:00:00Z').getUTCDay()];
  return `${m}월 ${d}일(${w})`;
}
