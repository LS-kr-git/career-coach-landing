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
 *   저장은 localStorage 세 칸 — 최초 유입(cc_attr)·브라우저 표식(cc_b, 무작위 값)·픽셀 끔(cc_nopx)뿐이다.
 *   cc_b 는 이름·계정과 묶이지 않은 난수이고, 운영 DB 는 **우리(운영자) 계정으로 로그인한
 *   브라우저**의 것만 따로 적어 가입 퍼널에서 우리 시험을 뺀다(career-coach 0111).
 */

// 접속 정보는 /assets/supabase-config.js 한 곳에만 둔다 (2026-08-06 복구 훈련 결과).
// 복원하면 프로젝트 ref 가 바뀌는데, 그때 고칠 곳이 세 군데였다. 이제 한 군데다.
// 같은 오리진 파일이라 서드파티 CDN 의존이 생기지 않는다 — 그건 아래 주의사항 그대로다.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/assets/supabase-config.js';
import { browserMark } from '/assets/browser-mark.js';

const API = SUPABASE_URL;
const KEY = SUPABASE_ANON_KEY;
const STORE = 'cc_attr';
const CLICK = 'cc_click';

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
/**
 * 광고 클릭 표식(_fbc)을 우리가 직접 적는다 (2026-10-15 출시 검수).
 * 원래는 메타 스크립트(fbevents.js)가 늦게 받아져서야 적는데, iOS 인앱에서 바로 카카오로 넘어가거나
 * 메타 스크립트가 막힌 브라우저는 그 전에 떠나 쿠키가 안 생긴다 — 그러면 서버가 보내는 Lead·Purchase 에
 * 클릭 표식이 빠져 광고 성과로 안 묶인다. 형식은 메타 문서 그대로(fb.1.<ms>.<fbclid>). 이미 있으면 안 건드린다.
 */
function keepClickId() {
  try {
    const 도메인 = onSite() ? '; domain=.careercoach.my' : '';
    const 적기 = (이름, 값) => { document.cookie = `${이름}=${값}; path=/; max-age=7776000; SameSite=Lax${도메인}`; };
    const fbclid = new URLSearchParams(location.search).get('fbclid');
    // 새 광고 클릭이면 갈아 끼운다 — 같은 클릭(같은 fbclid)이면 처음 시각을 지킨다.
    const 있던 = (document.cookie.match(/(?:^|; )_fbc=([^;]*)/) || [])[1] || '';
    if (fbclid && !있던.endsWith('.' + encodeURIComponent(fbclid))) 적기('_fbc', `fb.1.${Date.now()}.${encodeURIComponent(fbclid)}`);
    if (fbclid) rememberClick(fbclid);
    // 브라우저 표식(_fbp)도 메타 스크립트보다 먼저 만든다 — 같은 이유로 비면 서버 보고가 이 브라우저를 못 알아본다.
    // 형식은 메타 문서 그대로(fb.1.<ms>.<임의 숫자>). 메타 스크립트는 있는 값을 그대로 쓴다.
    if (!/(?:^|; )_fbp=/.test(document.cookie)) 적기('_fbp', `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`);
  } catch { /* 무시 */ }
}

/**
 * 광고를 **누른 시각과 그 광고의 꼬리표**를 이 브라우저에 적어 두고 이벤트마다 함께 보낸다(props.mc, 2026-10-16 사용자 지시).
 * 어드민 PAID ROAS 가 메타처럼 「첫 결제 전 7일 안의 마지막 클릭」으로 세려면 클릭이 **언제** 있었는지가 필요한데,
 * 이벤트의 utm 칸은 첫 유입(cc_attr)이라 다시 누른 클릭이 안 남는다. 같은 클릭(같은 fbclid)이면 처음 시각을 지킨다.
 */
function rememberClick(fbclid) {
  try {
    const 있던 = JSON.parse(localStorage.getItem(CLICK) || 'null');
    if (있던 && 있던.f === fbclid) return;
    const fbc = decodeURIComponent((document.cookie.match(/(?:^|; )_fbc=([^;]*)/) || [])[1] || '');
    const m = /^fb\.\d\.(\d+)\.(.+)$/.exec(fbc);
    const t = m && m[2] === fbclid ? Number(m[1]) : Date.now();
    const u = currentUtm();
    localStorage.setItem(CLICK, JSON.stringify({ f: fbclid, t, s: (u.source || '').slice(0, 40) || null, m: (u.medium || '').slice(0, 40) || null, c: (u.content || '').slice(0, 100) || null }));
  } catch { /* 무시 */ }
}

/** 적어 둔 마지막 광고 클릭 — 보낼 때는 fbclid(f)를 뺀다. 없으면 null. */
function lastClick() {
  try {
    const x = JSON.parse(localStorage.getItem(CLICK) || 'null');
    return x && x.t ? { t: x.t, s: x.s, m: x.m, c: x.c } : null;
  } catch { return null; }
}

/**
 * 광고 클릭 표식을 **주소에 실어 둔다** (2026-10-15 사용자 지시 「남는 틈도 막아 줘」).
 * 인스타·페북·카톡 앱 안 브라우저에서 「다른 브라우저로 열기」를 누르거나 주소를 복사해 사파리·크롬에
 * 붙이면, 넘어가는 것은 **주소뿐**이다 — 쿠키·저장소는 따라가지 않는다. 랜딩 첫 주소에는 fbclid 가 있지만
 * 온보딩으로 넘어가면 사라져, 거기서 옮긴 사람은 새 브라우저에서 광고 표식이 없었다.
 * 그래서 로그인 전 화면(랜딩·온보딩)에서는 지금 주소에 fbclid·utm 을 다시 붙여 둔다(화면은 안 바뀐다).
 * - 클릭한 지 7일이 지났으면 안 붙인다 — 메타가 구매를 광고에 묶는 기간(클릭 후 7일)이 지난 표식을 퍼뜨리지 않는다.
 * - 로그인 처리·결제·마이페이지·열람 화면은 건드리지 않는다(주소에 열쇠·토큰이 있거나, 로그인 뒤라 서버가 이미 안다).
 */
function carryClickInUrl() {
  // 미리 그리는 중(speculationrules)에는 주소를 바꾸지 않는다 — 활성화 매칭을 흔들 수 있다. 실제로 보일 때 한다(검사관).
  if (document.prerendering) return 보일때(carryClickInUrl);
  try {
    if (!/^\/(onboarding\/(\d|done)\/)?$/.test(location.pathname)) return;
    const 주소 = new URLSearchParams(location.search);
    if (주소.has('fbclid')) return;
    const fbc = (document.cookie.match(/(?:^|; )_fbc=([^;]*)/) || [])[1];
    const m = fbc && /^fb\.\d\.(\d+)\.(.+)$/.exec(decodeURIComponent(fbc));
    if (!m || Date.now() - Number(m[1]) > 7 * 864e5) return;
    주소.set('fbclid', m[2]);
    // 저장된 첫 유입이 메타 광고일 때만 utm 을 같이 붙인다 — 다른 경로의 utm 이 이 클릭과 섞이지 않게(검사관).
    const utm = attribution();
    if (!/^(meta|facebook|fb|ig|instagram)$/i.test(utm.source || '')) { history.replaceState(history.state, '', location.pathname + '?' + 주소 + location.hash); return; }
    for (const k of ['source', 'medium', 'campaign', 'content', 'term']) if (utm[k] && !주소.has('utm_' + k)) 주소.set('utm_' + k, utm[k]);
    history.replaceState(history.state, '', location.pathname + '?' + 주소 + location.hash);
  } catch { /* 무시 — 주소를 못 바꿔도 화면은 그대로다 */ }
}

export function captureAttribution() {
  keepClickId();
  carryClickInUrl();
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

/**
 * 이벤트 1건.
 * @param {string} name   career-coach 의 analytics.event_name 에 있는 이름만 통과한다
 * @param {object} props  개인정보를 넣지 말 것
 * @param {string|null} accessToken  로그인 상태면 넘긴다. 그래야 사람 단위로 묶인다
 */
// 다음 화면을 미리 그려 두는 중(Speculation Rules prerender)이면 사람이 아직 안 본 것이다 —
// 실제로 그 화면으로 넘어온 순간에 보낸다. 안 넘어오면 아무것도 안 보낸다.
const 보일때 = (fn) => (typeof document !== 'undefined' && document.prerendering)
  ? document.addEventListener('prerenderingchange', fn, { once: true }) : fn();

export function track(name, props = {}, accessToken = null) {
  if (typeof document !== 'undefined' && document.prerendering) return 보일때(() => track(name, props, accessToken));
  try {
    // 운영 주소에서만 보낸다. 2026-10-03 에 localhost 에서 돈 자동 시험(헤드리스 크롬)이
    // 운영 원장에 onboarding_done 4건·「저장 실패」 1건을 남겼다 — 로그인을 안 하니
    // 우리 브라우저 표식(0111)으로도 안 걸러진다. 받는 쪽은 주소를 모르므로 여기서 막는다.
    if (!onSite()) return;
    // 자동화 브라우저(헤드리스·playwright 등 navigator.webdriver 가 켜진 것)는 보내지 않는다(2026-10-15).
    // 그날 우리 자동 점검이 매번 새 브라우저로 운영 주소를 열어 방문·온보딩 5건을 남겼다 — 새 브라우저라 표식으로도 안 걸러진다.
    if (navigator.webdriver) return;
    if (META_OF[name] && 처음보내나(name, props)) metaEvent(META_OF[name]);
    const mark = browserMark();
    const mc = lastClick();
    const body = JSON.stringify({
      p_name: name,
      p_utm: attribution(),
      // b 는 맨 뒤에 둔다 — 부르는 쪽 props 가 같은 이름을 써도 표식이 이긴다.
      p_props: { ...props, w: window.innerWidth, ...(mc ? { mc } : {}), ...(mark ? { b: mark } : {}) },
    });
    // keepalive — 버튼 누르고 바로 페이지가 넘어가도 요청이 살아남는다.
    // 다만 그 브라우저의 첫 기록은 사전 확인(OPTIONS)부터 오가야 해서, 그 전에 페이지가 떠나면 같이 끊긴다
    // (2026-10-16 실측 — 삼성 인터넷의 「가입 시작」). 그래서 응답을 기다릴 수 있게 약속(promise)을 돌려준다.
    return fetch(API + '/rest/v1/rpc/track', {
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
// Lead 는 브라우저가 안 보낸다 — 카카오 가입을 마친 순간 서버가 보낸다(2026-10-14, career-coach 0135 report_signup_lead).
const META_OF = { onboarding_done: 'CompleteRegistration' };

/** 가입 완료는 사람마다 **한 번**이다 (2026-10-15 출시 검수). onboarding_done 은 저장할 때마다 남는데
 *  — 3·4단계 · 재시도 · 마이페이지에서 직군·연차를 고칠 때까지 — 그대로 메타에 보내면 한 사람이 여러 번
 *  「가입 완료」로 세어져 광고 학습이 흐려진다. 마이페이지 수정은 빼고, 이 기기에서 한 번만 보낸다. */
function 처음보내나(name, props) {
  if (name !== 'onboarding_done') return true;
  // 재시도로 늦게 성공한 첫 저장(온보딩·결제 화면의 retryPending)도 가입 완료다 — 막는 것은 마이페이지 수정뿐(검사관 ①).
  if (location.pathname.startsWith('/mypage/')) return false;
  try {
    if (localStorage.getItem('cc_px_reg')) return false;
    localStorage.setItem('cc_px_reg', '1');
  } catch { /* 못 적으면 보낸다 — 빠뜨리는 것보다 낫다 */ }
  return true;
}

function urlIsClean() {
  if (location.hash.includes('=')) return false;
  return [...new URLSearchParams(location.search).keys()].every((k) => /^(utm_\w+|fbclid|gclid|plan|dest|from)$/.test(k));
  // plan(결제 화면 요금제) · dest(로그인 뒤 행선지 못 물음) · from(온보딩 「바꾸기」) — 우리 화면이 스스로 붙이는 값이라
  // 개인정보가 아니다. 빠져 있어 그 화면에서는 PageView 부터 통째로 안 나갔다(2026-10-15 출시 검수).
}

/**
 * 운영자 브라우저에서는 픽셀을 켜지 않는다(cc_nopx, 2026-10-15 사용자 지시) — 우리 시험이 광고 학습에 섞이지 않게.
 * 켜는 길 셋: 어드민을 연다(ops 셸이 같은 칸을 1 로 적는다) · 어드민 로그인이 남은 브라우저(아래) · 주소 끝 ?cc_px=off.
 * 되돌리기 ?cc_px=on 은 그 화면에서만 듣는다 — 어드민 로그인이 남은 브라우저는 다음 화면에서 다시 꺼진다(의도다).
 * 🔴 이 파일 안에 둔다. browser-mark.js 의 새 export 로 두었더니 배포 직후 캐시된 옛 browser-mark.js 와 섞여
 *    import 가 실패하고 이 파일을 부르는 화면의 스크립트가 통째로 죽었다(2026-10-15 실측, 598b09f).
 */
function pixelOff() {
  try {
    const q = new URLSearchParams(location.search).get('cc_px');
    // 어드민에 로그인한 브라우저(셸의 세션 칸 ops_session — ops/index.html 의 KEY)도 운영자 것이다.
    // 그 기기에서 어드민을 다시 열지 않아도, 사이트를 여는 순간 꺼진다(2026-10-15 사용자 지시).
    if (q === 'on') localStorage.removeItem('cc_nopx');
    else if (q === 'off' || localStorage.getItem('ops_session')) localStorage.setItem('cc_nopx', '1');
    return localStorage.getItem('cc_nopx') === '1';
  } catch { return false; }
}

/**
 * 서버의 운영자 브라우저 표(career-coach 0153 browser_flag · private.internal_browser)와 맞춘다 (2026-10-15 사용자 지시).
 *   · 픽셀이 꺼진 브라우저는 그 표에 한 번 적는다 → 어드민 집계에서 빠지고, 이 브라우저로 로그인한 계정도
 *     운영자 계정이 된다(0111). 적은 표식은 cc_nopx_reg 에 남겨 다시 안 보낸다.
 *   · 아닌 브라우저는 픽셀 스크립트를 넣기 전에 표에 있는지 묻는다(카카오 로그인·어드민으로 이미 적힌 기기).
 *     물을 동안 생긴 신호는 fbq 대기열에 쌓였다가 「아니다」면 그대로 나가고, 「맞다」면 버려진다.
 *     못 물으면(1.5초·오류) 지금처럼 켠다 — 진짜 방문자 측정이 끊기는 쪽보다 낫다. 정상 응답의 「아니다」만 탭 하나 동안 기억한다.
 */
function 브라우저표(body, keepalive) {
  return fetch(API + '/rest/v1/rpc/browser_flag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
    body: JSON.stringify(body),
    keepalive,
  });
}

// 적기에 실패하면 cc_nopx_reg 가 안 남으므로 다음 화면에서 다시 적는다 — 따로 알리지 않는다.
function 운영자로적기(b) {
  try { if (!b || localStorage.getItem('cc_nopx_reg') === b) return; } catch { return; }
  브라우저표({ p_b: b, p_mark: true }, true)
    .then((r) => { if (r.ok) localStorage.setItem('cc_nopx_reg', b); })
    .catch(() => {});
}

// 답: true(우리 것) · false(아님 — 정상 응답일 때만 탭 동안 기억) · null(오류·1.5초 넘김 — 기억하지 않고 켠다).
// 시간 제한은 AbortSignal.timeout 대신 타이머 경주다 — 옛 사파리(15)에는 그 함수가 없어 요청이 걸리면 픽셀이 끝내 안 켜졌다.
async function 운영자인가(b) {
  if (!b) return false;
  try { if (sessionStorage.getItem('cc_px_chk') === '0') return false; } catch { /* 그냥 묻는다 */ }
  const 묻기 = 브라우저표({ p_b: b }).then(async (r) => (r.ok ? (await r.json()) === true : null)).catch(() => null);
  const 답 = await Promise.race([묻기, new Promise((r) => setTimeout(() => r(null), 1500))]);
  if (답 === false) try { sessionStorage.setItem('cc_px_chk', '0'); } catch { /* 다음 화면에서 또 묻는다 */ }
  return 답 === true;
}

function loadPixel() {
  if (!onSite()) return;
  // pixelOff 를 urlIsClean 보다 먼저 둔다 — ?cc_px=off 주소는 urlIsClean 에서 걸리므로 그보다 먼저 읽어야 표시가 남는다.
  if (pixelOff()) { 운영자로적기(browserMark()); return; }
  if (window.fbq || location.pathname.startsWith('/ops/') || !urlIsClean()) return;
  // 메타의 붙여넣기 코드에서 스크립트를 넣는 부분만 뒤로 뺐다 — 대기열(fbq)은 지금 만들어 둔다.
  const f = window, n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
  if (!f._fbq) f._fbq = n;
  n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
  n('set', 'autoConfig', false, PIXEL_ID);
  n('init', PIXEL_ID);
  n('track', 'PageView');
  운영자인가(browserMark()).then((맞다) => {
    if (맞다) {
      try { localStorage.setItem('cc_nopx', '1'); } catch { /* 다음 화면에서 또 묻는다 */ }
      delete window.fbq; delete window._fbq;
      return;
    }
    const t = document.createElement('script'); t.async = true;
    t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(t, s);
  });
}

/**
 * 메타 표준 이벤트 1건. 픽셀이 안 켜진 화면에서는 아무 일도 안 한다.
 * @param {string} name   Purchase·InitiateCheckout 같은 메타 표준 이름
 * @param {object} props  value·currency 정도만. 개인정보를 넣지 말 것
 * @param {string} [eventID]  같은 결제가 두 번 세어지지 않게 메타가 묶는 열쇠
 */
// 메타 전환 API 가 서버에서 보낼 때 브라우저 픽셀의 같은 사람으로 이어 붙이는 쿠키(_fbp·_fbc).
// 픽셀이 안 떴으면 빈 값이다 — 서버는 없으면 없는 대로 보낸다. (결제 화면 · 가입 직후 콜백이 쓴다)
export function metaCookies() {
  const 값 = (이름) => (document.cookie.match(new RegExp('(?:^|; )' + 이름 + '=([^;]*)')) || [])[1];
  return { fbp: 값('_fbp'), fbc: 값('_fbc') };
}

export function metaEvent(name, props = {}, eventID) {
  if (document.prerendering) return 보일때(() => metaEvent(name, props, eventID));
  try { if (window.fbq) window.fbq('track', name, props, eventID ? { eventID } : undefined); } catch { /* 무시 */ }
}

if (typeof window !== 'undefined') 보일때(() => { try { loadPixel(); } catch { /* 픽셀 때문에 화면이 깨지면 안 된다 */ } });

/** 대부분의 페이지가 쓰는 형태: 유입 저장 + 진입 이벤트 1건. */
export function pageView(name, props = {}, accessToken = null) {
  captureAttribution();
  // 온보딩 단계마다 어디서 그만두는지 메타에서도 보이게(2026-10-03 사용자 요청). 표준 이벤트에
  // 맞는 이름이 없어 맞춤 이벤트이고, 광고 관리자에서 단계별로 바로 고를 수 있게 이름을 나눈다.
  if (name === 'onboarding_step') {
    if (document.prerendering) return 보일때(() => pageView(name, props, accessToken));
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

/* 우리 파일에서 난 화면 오류는 사람에게도 한 번 말한다 (2026-10-15 사용자 확정 「오류 대체 화면」 D10).
   바깥 스크립트(광고·카카오 SDK)에서 난 오류에는 띄우지 않는다 — 멀쩡한 화면에 알약이 뜨게 된다. */
let 화면오류안내 = false;
function 화면오류(src) {
  if (화면오류안내) return;
  try { if (new URL(src).origin !== location.origin) return; } catch { return; }
  화면오류안내 = true;
  import('/assets/toast.js').then(({ 오류안내 }) => {
    if (!document.querySelector('link[href="/assets/toast.css"]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/toast.css'; document.head.appendChild(l);
    }
    const p = document.createElement('p');
    p.className = 'cc-toast float'; p.setAttribute('role', 'alert'); p.hidden = true;
    document.body.appendChild(p);
    오류안내(p, '화면을 그리다 문제가 생겼어요. 새로고침해 주세요');
  }).catch(() => {});
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
    화면오류(e.filename);
  }, true);                            // 캡처 단계 — 리소스 오류는 버블링하지 않는다

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    reportError('unhandled rejection: ' + (r && r.message ? r.message : String(r)),
      (r && r.stack ? String(r.stack).split('\n')[1] || '' : '').trim(), 0, 0);
  });
}
