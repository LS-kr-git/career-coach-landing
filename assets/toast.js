/**
 * 공용 「하단 안내」 — 모양은 assets/toast.css 의 .cc-toast.
 * 보이는 시간 5초는 2026-10-15 사용자 결정이다(0.5·1·2·3·5·10초 목업 비교 뒤).
 * 시간은 **화면이 실제로 보인 뒤부터** 센다 — steady.js 가 글꼴을 기다리며 본문을 감추는 동안(최대 1.2초)
 * 시계가 먼저 돌면 그만큼 덜 보인다.
 */
export const 보이는시간 = 5000, 들어옴 = 240, 나감 = 260;

const 타이머 = new WeakMap();

function 보인뒤(fn) {
  const root = document.documentElement;
  if (!root.classList.contains('cc-wait')) return fn();
  const mo = new MutationObserver(() => { if (!root.classList.contains('cc-wait')) { mo.disconnect(); fn(); } });
  mo.observe(root, { attributes: true, attributeFilter: ['class'] });
}

/** el 을 띄우고 머묾(ms) 뒤에 거둔다. 떠 있는 중에 다시 부르면 처음부터 다시 센다.
 *  가라앉는 시간은 그 화면 CSS 의 .out 전환 시간을 그대로 읽는다 — 값을 CSS 한 곳에만 둔다
 *  (마이페이지 문의 메일 복사는 2초 머문다 — 2026-10-15 사용자 결정). */
export function 하단안내(el, 머묾 = 보이는시간) {
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
