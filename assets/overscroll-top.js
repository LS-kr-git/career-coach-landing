/**
 * 맨 위에서 더 당긴 자리 색 — 랜딩이 쓰던 캔버스색 스위칭(84b9b99, 2026-08-02)을 공용으로 뺐다 (2026-10-15 사용자 지시).
 *
 * iOS 웹킷은 끝을 넘어 당긴 자리를 위아래 구분 없이 html 바탕 한 색으로만 칠하고, 문서 밖에 덧댄 판·그라데이션은 안 그린다.
 * 그래서 스크롤 위치로 그 한 색을 바꿔친다: 위쪽 절반을 보는 동안은 페이지 맨 위 색, 나머지는 CSS 가 정한 바탕 그대로.
 * 바꿔치는 것은 카드 뒤라 눈에 안 보인다. 카드보다 넓은 화면은 양옆 바탕이 보이므로 건드리지 않는다.
 *
 * 쓰는 법: 페이지 :root 에 --overscroll-top(맨 위 색)을 두고 </body> 앞에서 이 파일을 부른다.
 * 맨 아래 색은 그 페이지 CSS 의 html·body 바탕이 맡는다.
 */
(function () {
  var root = document.documentElement;
  var top = getComputedStyle(root).getPropertyValue('--overscroll-top').trim();
  var mq = matchMedia('(max-width: 450px)');   // 카드(--card-max 450)가 화면을 꽉 채우는 폭
  var cur = null;
  function apply() {
    // steady.js 가 본문을 숨겨 둔 동안(cc-wait)은 바탕만 보이므로 바꾸지 않는다 — 빈 화면이 번쩍이지 않게.
    // <= : 스크롤할 거리가 없는 큰 화면에서도 맨 위 쪽을 따른다.
    var c = mq.matches && !root.classList.contains('cc-wait') &&
      scrollY <= (root.scrollHeight - innerHeight) / 2 ? top : '';
    if (c !== cur) { cur = c; root.style.backgroundColor = c; document.body.style.backgroundColor = c; }
  }
  addEventListener('scroll', apply, { passive: true });
  addEventListener('resize', apply, { passive: true });
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['class'] });
  apply();
})();
