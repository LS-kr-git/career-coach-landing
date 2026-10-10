/**
 * 유입 경로 기록 — 의존성 없음, 실패해도 화면을 안 깬다.
 *
 * 왜 SDK 를 안 쓰나
 *   랜딩은 첫 화면 속도가 전부다. supabase-js 를 이것 하나 때문에 부르면
 *   광고로 들어온 사람에게 수백 KB 를 더 내려보내게 된다. RPC 는 그냥 POST 한 번이라
 *   fetch 로 충분하다. (로그인 페이지들은 어차피 SDK 를 쓰므로 토큰만 넘겨받는다.)
 *
 * 왜 **최초 유입(first touch)** 을 저장하나
 *   광고를 보고 들어와서 → 며칠 뒤 직접 방문해서 → 가입하는 흐름이 흔하다.
 *   가입 시점의 UTM 만 보면 그 가입은 "직접 유입" 으로 잡히고, 광고는 성과가 0 이 된다.
 *   그래서 **처음 들어온 경로를 한 번 저장해 두고 퍼널 끝까지 그걸 들고 간다.**
 *   덮어쓰지 않는 것이 핵심이다.
 *
 * 개인정보
 *   여기서 보내는 것은 이벤트 이름·유입 경로·화면 크기뿐이다.
 *   이름·전화번호·이메일은 **절대 넣지 않는다** — 넣어도 DB 의 CHECK 가 거부한다
 *   (career-coach: analytics.event.event_props_no_pii).
 *   저장은 localStorage 두 칸 — 최초 유입(cc_attr)과 브라우저 표식(cc_b, 무작위 값)뿐이다.
 *   cc_b 는 이름·계정과 묶이지 않은 난수이고, 운영 DB 는 **우리(운영자) 계정으로 로그인한
 *   브라우저**의 것만 따로 적어 가입 퍼널에서 우리 시험을 뺀다(career-coach 0111).
 */

// 접속 정보는 /assets/supabase-config.js 한 곳에만 둔다 (2026-08-06 복구 훈련 결과).
// 복원하면 프로젝트 ref 가 바뀌는데, 그때 고칠 곳이 세 군데였다. 이제 한 군데다.
// 같은 오리진 파일이라 서드파티 CDN 의존이 생기지 않는다 — 그건 아래 주의사항 그대로다.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/assets/supabase-config.js';

const API = SUPABASE_URL;
const KEY = SUPABASE_ANON_KEY;
const STORE = 'cc_attr';
const MARK = 'cc_b';

const UTM = ['source', 'medium', 'campaign', 'content', 'term'];

/** 지금 주소창의 UTM. 없으면 빈 객체. */
function currentUtm() {
  const q = new URLSearchParams(location.search);
  const out = {};
  for (const k of UTM) {
    const v = q.get('utm_' + k);
    if (v) out[k] = v.slice(0, 200);
  }
  // gclid/fbclid 만 있고 utm_* 이 없는 경우 — 자동 태깅된 광고 유입이다. 놓치지 않는다.
  if (!out.source) {
    if (q.get('gclid')) out.source = 'google';
    else if (q.get('fbclid')) out.source = 'facebook';
  }
  return out;
}

/**
 * 최초 유입을 한 번만 저장한다. **이미 있으면 덮지 않는다.**
 * 모든 페이지에서 불러도 안전하다.
 */
export function captureAttribution() {
  try {
    if (localStorage.getItem(STORE)) return;          // 최초 것을 지킨다
    const utm = currentUtm();
    const ref = document.referrer || '';
    // UTM 도 없고 외부 유입도 아니면 저장할 게 없다 — 내부 이동일 뿐이다.
    const external = ref && !ref.includes(location.hostname);
    if (!Object.keys(utm).length && !external) return;
    if (!utm.source && external) {
      // 광고 파라미터 없이 온 외부 유입. 도메인만 남긴다(경로·쿼리는 안 남긴다).
      try { utm.source = new URL(ref).hostname; utm.medium = 'referral'; } catch { /* 무시 */ }
    }
    localStorage.setItem(STORE, JSON.stringify(utm));
  } catch { /* 사파리 프라이빗 모드 등 — 추적 때문에 화면이 깨지면 안 된다 */ }
}

/** 저장해 둔 최초 유입. 없으면 지금 주소창 것, 그것도 없으면 빈 객체. */
export function attribution() {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) return JSON.parse(saved);
  } catch { /* 무시 */ }
  return currentUtm();
}

/** 브라우저 표식 — 처음 부를 때 한 번 만들고 그대로 쓴다. 못 만들면 null(표식 없이 보낸다). */
function browserMark() {
  try {
    let b = localStorage.getItem(MARK);
    if (!b || !/^[A-Za-z0-9_-]{8,64}$/.test(b)) {
      b = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '');
      localStorage.setItem(MARK, b);
    }
    return b;
  } catch { return null; }
}

/**
 * 이벤트 1건.
 * @param {string} name   career-coach 의 analytics.event_name 에 있는 이름만 통과한다
 * @param {object} props  개인정보를 넣지 말 것
 * @param {string|null} accessToken  로그인 상태면 넘긴다. 그래야 사람 단위로 묶인다
 */
export function track(name, props = {}, accessToken = null) {
  try {
    // 운영 주소에서만 보낸다. 2026-10-03 에 localhost 에서 돈 자동 시험(헤드리스 크롬)이
    // 운영 원장에 onboarding_done 4건·「저장 실패」 1건을 남겼다 — 로그인을 안 하니
    // 우리 브라우저 표식(0111)으로도 안 걸러진다. 받는 쪽은 주소를 모르므로 여기서 막는다.
    if (!onSite()) return;
    if (META_OF[name]) metaEvent(META_OF[name]);
    const mark = browserMark();
    const body = JSON.stringify({
      p_name: name,
      p_utm: attribution(),
      // b 는 맨 뒤에 둔다 — 부르는 쪽 props 가 같은 이름을 써도 표식이 이긴다.
      p_props: { ...props, w: window.innerWidth, ...(mark ? { b: mark } : {}) },
    });
    // keepalive — 버튼 누르고 바로 페이지가 넘어가도 요청이 살아남는다.
    fetch(API + '/rest/v1/rpc/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: KEY,
        Authorization: 'Bearer ' + (accessToken || KEY),
      },
      body,
      keepalive: true,
    }).catch(() => {});                 // 실패는 삼킨다. 추적이 화면을 막으면 안 된다.
  } catch { /* 무시 */ }
}

function onSite() { return /(^|\.)careercoach\.my$/.test(location.hostname); }

/**
 * 메타 픽셀 (2026-10-03) — 광고를 보고 온 사람이 결제까지 갔는지 메타가 재고 학습하게 한다.
 * 이 파일을 import 하는 모든 화면에서 PageView 가 나간다.
 *
 * 🔴 픽셀은 **현재 주소 전체**를 메타로 보낸다. 그래서 주소에 utm·fbclid·gclid 말고 다른
 *    값이 있으면 아예 안 켠다 — `/insight/?t=` 열람 토큰, `/auth/callback/` 의 `#access_token`,
 *    결제창에서 돌아올 때 `/checkout/?` 에 붙는 값이 메타에 실리면 안 된다.
 * 🔴 autoConfig 를 끈다 — 켜 두면 픽셀이 버튼·입력칸을 스스로 긁어 간다(로그인 화면에 이메일 칸이 있다).
 */
const PIXEL_ID = '1578800443456736';
const META_OF = { signup_start: 'Lead', onboarding_done: 'CompleteRegistration' };

function urlIsClean() {
  if (location.hash.includes('=')) return false;
  return [...new URLSearchParams(location.search).keys()].every((k) => /^(utm_\w+|fbclid|gclid)$/.test(k));
}

function loadPixel() {
  if (window.fbq || !onSite() || location.pathname.startsWith('/ops/') || !urlIsClean()) return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('set', 'autoConfig', false, PIXEL_ID);
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

/**
 * 메타 표준 이벤트 1건. 픽셀이 안 켜진 화면에서는 아무 일도 안 한다.
 * @param {string} name   Purchase·InitiateCheckout 같은 메타 표준 이름
 * @param {object} props  value·currency 정도만. 개인정보를 넣지 말 것
 * @param {string} [eventID]  같은 결제가 두 번 세어지지 않게 메타가 묶는 열쇠
 */
export function metaEvent(name, props = {}, eventID) {
  try { if (window.fbq) window.fbq('track', name, props, eventID ? { eventID } : undefined); } catch { /* 무시 */ }
}

if (typeof window !== 'undefined') { try { loadPixel(); } catch { /* 픽셀 때문에 화면이 깨지면 안 된다 */ } }

/** 대부분의 페이지가 쓰는 형태: 유입 저장 + 진입 이벤트 1건. */
export function pageView(name, props = {}, accessToken = null) {
  captureAttribution();
  // 온보딩 단계마다 어디서 그만두는지 메타에서도 보이게(2026-10-03 사용자 요청). 표준 이벤트에
  // 맞는 이름이 없어 맞춤 이벤트이고, 광고 관리자에서 단계별로 바로 고를 수 있게 이름을 나눈다.
  if (name === 'onboarding_step') {
    try { if (window.fbq) window.fbq('trackCustom', props.step === 'done' ? 'OnboardingDone' : 'OnboardingStep' + props.step); } catch { /* 무시 */ }
  }
  track(name, props, accessToken);
}

/**
 * 회원 화면에서 터진 것을 남긴다 — **이 파일을 import 하는 것만으로 걸린다.**
 *
 * 왜 있나 (2026-08-13)
 *   오류가 남는 곳이 어드민 함수 하나뿐이었다(`private.error_log`). 회원이 겪는 것 —
 *   카카오 로그인이 콜백에서 죽는다 · 온보딩 저장이 실패한다 · 특정 브라우저에서만
 *   스크립트가 터진다 — 은 **아무 데도 안 남았다.** 그래서 어드민 「오류 리포트」가
 *   "오류 0건" 이라고 말하며 오히려 안심시켰다.
 *
 * 왜 페이지가 부르지 않고 자동인가
 *   부르게 하면 **다음에 만드는 페이지에서 반드시 빠진다.** 이 저장소가 이미 같은
 *   모양으로 물렸다(웹에만 만든 페이지가 어느 검수에도 안 잡힌 2026-08-07 사고).
 *   2026-10-03 부터 어드민(ops) 말고 모든 화면이 이 파일을 부른다(auth/callback 만 처리 도중에) — 여기 한 줄이 곧 전 화면이다.
 *
 * 🔴 **주소의 쿼리·해시를 절대 보내지 않는다.** `/auth/callback/` 는 해시에
 *    `access_token` 이 들어 있다 — 넣는 순간 그게 분석 원장에 박힌다.
 *    보내는 것은 `location.pathname` 뿐이다.
 *
 * 개인정보: props 키는 `msg`·`src`·`line`·`col`·`page` 뿐이다. 운영 DB 의
 * `event_props_no_pii` CHECK 가 `email`·`phone`·`name` 같은 키를 거부하고,
 * 이름은 `analytics.event_name` 허용 목록(`client_error`)에 있어야 통과한다.
 */
// 🔴 `page` 만 안전하게 해서는 부족하다. `e.filename` 은 **인라인 스크립트에서 문서
//    URL** 이고, rejection 의 스택 프레임도 주소를 그대로 들고 온다. `/auth/callback/`
//    은 스크립트가 전부 인라인 모듈이고 주소에 `?code=…` · `#access_token=…` 이 남아
//    있을 수 있다 — 그대로 실으면 **영구 보관되는 분석 원장에 자격증명이 박힌다.**
//    `event_props_no_pii` 는 **키만** 보고 값은 안 본다. 그러니 여기서 잘라 낸다.
/** 주소에서 쿼리·해시를 잘라낸다. 남는 것은 경로까지다. */
function cutUrl(v) { return String(v || '').split('#')[0].split('?')[0]; }
/** 메시지 안에 박힌 주소의 쿼리·해시만 지운다. 메시지 자체는 안 자른다. */
function redactUrls(v) {
  return String(v || '').replace(/(https?:\/\/[^\s'"]+?)[?#][^\s'"]*/g, '$1');
}

// 회원이 쓰는 기능과 무관한 바깥 스크립트 — 광고 차단기·추적 방지가 늘 막는다. 그 로드 실패는
// 고장이 아니므로 안 보낸다(2026-10-10: 메타 픽셀 하나로 오류 리포트가 빨개졌다).
// jsdelivr(로그인 SDK)·portone(결제)은 여기 넣지 않는다 — 그쪽 실패는 진짜 고장이다.
// 어드민 errors.ts 의 SQL_CLIENT 가 같은 호스트를 거른다(이미 퍼진 옛 track.js 몫).
const OPTIONAL_HOSTS = ['connect.facebook.net'];
function optionalSrc(src) {
  try { return OPTIONAL_HOSTS.includes(new URL(src).hostname); } catch { return false; }
}

const ERR_MAX = 3;          // 한 번 로드에 이만큼만. 루프 안에서 터지면 원장이 잠긴다
const ERR_CUT = 300;        // 메시지 길이 상한 (props 전체가 2,000자를 넘으면 RPC 가 거부한다)
let errSent = 0;
const errSeen = new Set();

function reportError(msg, src, line, col) {
  try {
    if (errSent >= ERR_MAX) return;
    const key = msg + '|' + src + '|' + line;
    if (errSeen.has(key)) return;     // 같은 오류가 반복되면 한 번만
    errSeen.add(key);
    errSent += 1;
    track('client_error', {
      msg: redactUrls(msg).slice(0, ERR_CUT),
      src: cutUrl(src).slice(0, 200),
      line: Number(line) || 0,
      col: Number(col) || 0,
      page: location.pathname,        // ★ search·hash 를 넣지 않는다
    });
  } catch { /* 오류를 남기다 또 터지면 조용히 접는다 — 화면을 막지 않는다 */ }
}

// import 시점에 한 번만 건다. 여러 모듈이 같은 파일을 import 해도 ES 모듈은 한 번만 평가된다.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    // 리소스 로드 실패(<img>·<script>)는 message 가 없고 target 이 있다. 그것도 고장이다.
    if (!e.message && e.target && e.target !== window) {
      const el = e.target;
      if (optionalSrc(el.src || el.href)) return;
      reportError('resource load failed: ' + (el.tagName || '?'), cutUrl(el.src || el.href), 0, 0);
      return;
    }
    reportError(e.message, e.filename, e.lineno, e.colno);
  }, true);                            // 캡처 단계 — 리소스 오류는 버블링하지 않는다

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    reportError('unhandled rejection: ' + (r && r.message ? r.message : String(r)),
      (r && r.stack ? String(r.stack).split('\n')[1] || '' : '').trim(), 0, 0);
  });
}
