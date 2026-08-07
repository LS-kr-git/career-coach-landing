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
 *   저장은 localStorage 하나(cc_attr)뿐이고 개인 식별자는 담기지 않는다.
 */

// 접속 정보는 /assets/supabase-config.js 한 곳에만 둔다 (2026-08-06 복구 훈련 결과).
// 복원하면 프로젝트 ref 가 바뀌는데, 그때 고칠 곳이 세 군데였다. 이제 한 군데다.
// 같은 오리진 파일이라 서드파티 CDN 의존이 생기지 않는다 — 그건 아래 주의사항 그대로다.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/assets/supabase-config.js';

const API = SUPABASE_URL;
const KEY = SUPABASE_ANON_KEY;
const STORE = 'cc_attr';

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

/**
 * 이벤트 1건.
 * @param {string} name   career-coach 의 analytics.event_name 에 있는 이름만 통과한다
 * @param {object} props  개인정보를 넣지 말 것
 * @param {string|null} accessToken  로그인 상태면 넘긴다. 그래야 사람 단위로 묶인다
 */
export function track(name, props = {}, accessToken = null) {
  try {
    const body = JSON.stringify({
      p_name: name,
      p_utm: attribution(),
      p_props: { ...props, w: window.innerWidth },
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

/** 대부분의 페이지가 쓰는 형태: 유입 저장 + 진입 이벤트 1건. */
export function pageView(name, props = {}, accessToken = null) {
  captureAttribution();
  track(name, props, accessToken);
}
