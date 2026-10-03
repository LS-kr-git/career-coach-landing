/**
 * 로그인 뒤 돌아갈 곳 (2026-10-03 사용자 확정 「3번」).
 * 전문 페이지 → 결제 화면으로 온 사람이 로그인이 안 돼 있으면 로그인 화면으로 보낸다. 로그인은
 * 카카오를 거쳐 /auth/callback/ 으로 돌아오고 그 페이지는 늘 온보딩으로 보내므로, 결제 화면을
 * 여기 적어 두고 로그인이 끝나는 자리(callback · login)에서 꺼낸다.
 *
 * localStorage 인 이유 — 카카오 로그인이 카톡 앱을 거쳐 돌아오면 다른 탭이 될 수 있다.
 * 목적지는 허용 목록 안에서만 받는다. 아무 주소나 받으면 남이 만든 링크로 엉뚱한 곳에 보낼 수 있다.
 */
const KEY = 'cc_next';
const TTL = 30 * 60 * 1000;   // 30분이 지난 기록은 버린다 — 며칠 뒤 로그인한 사람을 결제 화면에 세우지 않게
const ALLOWED = new Set(['/checkout/']);

export function rememberNext(path) {
  try { localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })); } catch {}
}

/** 적어 둔 곳을 꺼내고 지운다. 없거나 낡았거나 허용 목록 밖이면 fallback. */
export function takeNext(fallback) {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(KEY)); localStorage.removeItem(KEY); } catch {}
  if (!v || Date.now() - v.at >= TTL) return fallback;
  // 질의는 살린다 — 카드 변경(`/checkout/?mode=change`)이 로그인 뒤에도 카드 변경이어야 한다.
  let u;
  try { u = new URL(v.path, location.origin); } catch { return fallback; }
  return u.origin === location.origin && ALLOWED.has(u.pathname) ? u.pathname + u.search : fallback;
}
