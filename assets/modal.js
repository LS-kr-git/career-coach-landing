/* 공용 「가운데 창」의 키보드·포커스 (2026-10-19 점검). 창을 여닫는 것은 각 페이지가 .dim 의 hidden 으로 한다 —
   여기는 그 변화만 보고 따라간다: 열리면 첫 단추로 포커스(뒤 화면의 카드·버튼이 키보드로 눌리지 않게),
   Tab 은 창 안에서만 돌고, ESC 는 보조 단추(.m-btn.sub · .m-btn.dark)를 누른 것과 같고, 닫히면 연 자리로 포커스를 돌려준다.
   첫 포커스를 주 버튼에 두지 않는다 — Enter 한 번에 결제가 나가지 않게. */
(function () {
  var 앞 = new WeakMap();
  function 단추들(d) {
    return [].slice.call(d.querySelectorAll('button')).filter(function (b) { return !b.hidden && !b.disabled; });
  }
  function 열린창() {
    var 다 = [].slice.call(document.querySelectorAll('.dim')).filter(function (d) { return !d.hidden; });
    return 다.length ? 다[다.length - 1] : null;
  }
  new MutationObserver(function (rs) {
    rs.forEach(function (r) {
      var d = r.target;
      if (!d.classList || !d.classList.contains('dim')) return;
      if (d.hidden) {
        var a = 앞.get(d); 앞.delete(d);
        if (a && a.focus && document.contains(a) && !열린창()) a.focus({ preventScroll: true });
      } else if (!앞.has(d)) {
        앞.set(d, document.activeElement);
        var b = 단추들(d)[0];
        if (b) b.focus({ preventScroll: true, focusVisible: false });   // 저절로 뜬 창에 테두리를 그리지 않는다(키보드로 움직이면 그때 보인다)
      }
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['hidden'], subtree: true });
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
