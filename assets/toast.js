/**
 * 공용 「하단 안내」 — 모양은 assets/toast.css 의 .cc-toast.
 * 머무는 시간은 성공·오류 모두 글자 수 규칙(글자머묾) 하나다 — 2026-10-15 사용자 결정(「성공 알림·404 v8」 비교 뒤).
 * 시간은 **화면이 실제로 보인 뒤부터** 센다 — steady.js 가 글꼴을 기다리며 본문을 감추는 동안(최대 1.2초)
 * 시계가 먼저 돌면 그만큼 덜 보인다.
 */
export const 들어옴 = 240, 나감 = 260;

const 타이머 = new WeakMap();

function 보인뒤(fn) {
  const root = document.documentElement;
  if (!root.classList.contains('cc-wait')) return fn();
  const mo = new MutationObserver(() => { if (!root.classList.contains('cc-wait')) { mo.disconnect(); fn(); } });
  mo.observe(root, { attributes: true, attributeFilter: ['class'] });
}

/** el 을 띄우고 머묾(ms) 뒤에 거둔다. 떠 있는 중에 다시 부르면 처음부터 다시 센다.
 *  가라앉는 시간은 그 화면 CSS 의 .out 전환 시간을 그대로 읽는다 — 값을 CSS 한 곳에만 둔다. */
export function 하단안내(el, 머묾 = 글자머묾(el.textContent)) {
  clearTimeout(타이머.get(el));
  el.classList.remove('in', 'out');
  el.hidden = false;
  보인뒤(() => {
    // 한 프레임 그린 뒤에 in 을 붙여야 시작 위치(12px 아래)에서 전환이 걸린다.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    타이머.set(el, setTimeout(() => {
      el.classList.add('out');
      const 사라짐 = parseFloat(getComputedStyle(el).transitionDuration) * 1000 || 나감;
      타이머.set(el, setTimeout(() => { el.hidden = true; el.classList.remove('in', 'out'); }, 사라짐));
    }, 들어옴 + 머묾));
  });
}

/** 안내의 머묾 — 1.5초 + 글자 1개당 0.13초(띄어쓰기·줄바꿈은 안 센다).
 *  2026-10-15 사용자 결정(글자당 0.07·0.1·0.15·0.2초 시뮬레이터 비교 뒤 0.13초). 「오류 대체 화면 제안 v5」. */
export function 글자머묾(문구) {
  return 1500 + String(문구).replace(/\s/g, '').length * 130;
}

/** 오류 안내 — el 에 문구를 넣고 글자 수만큼 머문 뒤 거둔다. 실패 문구는 화면 자리에 쓰지 않고 이것 하나로 말한다
 *  (「오류 대체 화면」 2026-10-15 사용자 확정 — 빨간 글 대신 이 알약). 세 줄부터는 .multi(모서리 18). */
export function 오류안내(el, 문구) {
  window.ccNoKeep?.();   // 실패를 알린 화면(막대가 깔린 화면)을 「지난 값」으로 적지 않는다 — assets/steady.js
  el.textContent = 문구;
  el.hidden = false;
  el.classList.toggle('multi', el.offsetHeight > 60);   // 세 줄부터(두 줄은 54px)
  하단안내(el, 글자머묾(문구));
}
