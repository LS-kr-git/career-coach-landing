/* 공용 「가운데 창」의 키보드·포커스 (2026-10-19 점검). 창을 여닫는 것은 각 페이지가 .dim 의 hidden 으로 한다 —
   여기는 그 변화만 보고 따라간다: 열리면 첫 단추로 포커스(뒤 화면의 카드·버튼이 키보드로 눌리지 않게),
   Tab 은 창 안에서만 돌고, ESC 는 보조 단추(.m-btn.sub · .m-btn.dark)를 누른 것과 같고, 닫히면 연 자리로 포커스를 돌려준다.
   첫 포커스를 주 버튼에 두지 않는다 — Enter 한 번에 결제가 나가지 않게. */
(function () {
  var 앞 = new WeakMap();
  function 단추들(d) {
    return [].slice.call(d.querySelectorAll('button')).filter(function (b) { return !b.hidden && !b.disabled; });
  }
  // 창은 aria-modal 인 .dim 만 본다(role 은 dialog·alertdialog 둘 다 쓴다) — 마이페이지 메일 줄의 눌림 표시(.mail.dim)처럼
  // 같은 이름을 쓰는 것과 섞이지 않게.
  function 창인가(d) { return d.classList && d.classList.contains('dim') && d.getAttribute('aria-modal') === 'true'; }
  function 열린창() {
    var 다 = [].slice.call(document.querySelectorAll('.dim[aria-modal="true"]')).filter(function (d) { return !d.hidden; });
    return 다.length ? 다[다.length - 1] : null;
  }
  function 첫단추로(d) {
    var b = 단추들(d)[0];
    if (b) b.focus({ preventScroll: true, focusVisible: false });   // 저절로 뜬 창에 테두리를 그리지 않는다(키보드로 움직이면 그때 보인다)
  }
  new MutationObserver(function (rs) {
    rs.forEach(function (r) {
      var d = r.target;
      if (r.target === document.documentElement) {
        // 화면을 그리기 전(html.cc-wait — assets/steady.js)에 열린 창은 포커스를 못 받는다 — 덮개가 걷히면 다시 준다.
        var 열린 = 열린창();
        if (열린 && !document.documentElement.classList.contains('cc-wait') && !열린.contains(document.activeElement)) 첫단추로(열린);
        return;
      }
      if (!창인가(d)) return;
      if (d.hidden) {
        var a = 앞.get(d); 앞.delete(d);
        if (a && a.focus && document.contains(a) && !열린창()) a.focus({ preventScroll: true });
      } else if (!앞.has(d)) {
        // 다른 창에서 넘어온 것이면(확인 창 → 실패 창) 그 창이 기억한 자리를 물려받는다 — 아니면 닫은 뒤 포커스가 사라진다.
        var 다른 = [].slice.call(document.querySelectorAll('.dim[aria-modal="true"]')).filter(function (x) { return x !== d && !x.hidden; })[0];
        if (다른 && 앞.get(다른)) { 앞.set(d, 앞.get(다른)); 앞.set(다른, null); }
        else 앞.set(d, document.activeElement);
        첫단추로(d);
      }
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['hidden', 'class'], subtree: true });
  document.addEventListener('keydown', function (e) {
    var d = 열린창(); if (!d) return;
    if (e.key === 'Escape') {
      var s = d.querySelector('.m-btn.sub, .m-btn.dark');
      if (s && !s.disabled) { e.preventDefault(); s.click(); }
      return;
    }
    if (e.key !== 'Tab') return;
    var bs = 단추들(d);
    if (!bs.length) { e.preventDefault(); return; }
    var i = bs.indexOf(document.activeElement);
    if (i < 0 || (e.shiftKey && i === 0) || (!e.shiftKey && i === bs.length - 1)) {
      e.preventDefault();
      bs[e.shiftKey ? (i <= 0 ? bs.length - 1 : i - 1) : (i < 0 || i === bs.length - 1 ? 0 : i + 1)].focus();
    }
  });
})();
