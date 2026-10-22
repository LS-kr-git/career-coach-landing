/**
 * 누르는 <div> 를 키보드로도 누르게 한다 — 온보딩 1~4 단계 (2026-10-21 전체 점검 ③).
 * 직군 줄·칩·「다음」 이 click 만 단 <div> 라 Tab 이 닿지 않아, 키보드·화면 낭독기로는 가입을 끝낼 수 없었다.
 * 마크업(온보딩 1 단계 목록은 tools/roles 생성물이다)은 손대지 않고, 이 스크립트를 부른 <script> 의
 * data-sel 에 적힌 것에만 tabindex·role 을 붙이고 Enter·Space 를 click 으로 바꾼다. 생김새는 그대로다
 * (포커스 테두리는 키보드로 옮겨 갈 때만 — 브라우저 기본 :focus-visible).
 */
(() => {
  const sel = document.currentScript && document.currentScript.dataset.sel;
  if (!sel) return;
  const mark = () => document.querySelectorAll(sel).forEach((el) => {
    if (el.matches('button,a[href],input,select,textarea')) return;   // 이미 누를 수 있는 것은 그대로
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark); else mark();
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target;
    if (!(el instanceof Element) || !el.matches(sel) || el.matches('button,a[href],input,select,textarea')) return;
    e.preventDefault();   // Space 가 화면을 내리지 않게
    el.click();
  });
})();
