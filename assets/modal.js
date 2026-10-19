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
    // 한 번에 묶여 온 변화는 「열림」을 먼저, 「닫힘」을 나중에 본다 — 확인 창을 닫고 곧바로 실패 창을 여는 길(같은 배치)에서
    // 닫힌 창이 기억한 연 자리(#submit)를 새로 열린 창에 넘겨야 닫은 뒤 포커스가 사라지지 않는다(2026-10-19 점검).
    var html = false, 열림 = [], 닫힘 = [];
    rs.forEach(function (r) {
      if (r.target === document.documentElement) { html = true; return; }
      if (창인가(r.target)) (r.target.hidden ? 닫힘 : 열림).push(r.target);
    });
    열림.forEach(function (d) {
      if (d.hidden || 앞.has(d)) return;
      var 다른 = [].slice.call(document.querySelectorAll('.dim[aria-modal="true"]')).filter(function (x) { return x !== d && !x.hidden; })[0];
      if (다른 && 앞.get(다른)) { 앞.set(d, 앞.get(다른)); 앞.set(다른, null); }   // 창 위에 창 — 앞 창이 기억한 자리를 물려받는다
      else 앞.set(d, document.activeElement);
      첫단추로(d);
    });
    닫힘.forEach(function (d) {
      if (!d.hidden || !앞.has(d)) return;
      var a = 앞.get(d); 앞.delete(d);
      var 열린 = 열린창();
      if (열린) {
        var b = 앞.get(열린);
        if (a && (!b || b === document.body || d.contains(b))) 앞.set(열린, a);   // 이 창 안의 단추를 기억한 새 창에는 이 창의 연 자리를 준다
      } else if (a && a.focus && document.contains(a)) a.focus({ preventScroll: true });
    });
    // 화면을 그리기 전(html.cc-wait — assets/steady.js)에 열린 창은 포커스를 못 받는다 — 덮개가 걷히면 다시 준다.
    if (html) {
      var 지금창 = 열린창();
      if (지금창 && !document.documentElement.classList.contains('cc-wait') && !지금창.contains(document.activeElement)) 첫단추로(지금창);
    }
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
