/**
 * 페이지에 들어설 때 화면이 덜컹이지 않게 한다 (2026-10-14 사용자 지시 — 모든 페이지 · 모든 전환).
 * 모든 페이지의 <head> 에서 Pretendard 스타일시트 **바로 다음에** 동기로 부른다(async·defer·module 아님):
 *   <script src="/assets/steady.js"></script>
 *
 * 덜컹임의 정체 (2026-10-14 실측 — 360px · 느린 망·CPU 4배에서 화면을 프레임 단위로 녹화)
 *   ① 글꼴 바꿔치기 — 첫 그림은 기본 글꼴로 그렸다가 Pretendard 조각이 도착할 때마다 다시 그린다.
 *   ② 뒤늦게 채우는 값 — 저장해 둔 선택·서버 값이 첫 그림 **뒤에** 들어와 칸이 생기거나 밀렸다.
 *   ③ PC 에서 스크롤바가 있는 페이지와 없는 페이지를 오가면 가운데 카드가 좌우로 약 8px 튄다.
 *
 * 하는 일
 *   - 글꼴과 페이지가 맡긴 기다림(아래 ccHold)이 끝날 때까지 본문을 그리지 않는다(cc-wait).
 *     같은 사이트 안에서 넘어갈 때는 브라우저가 앞 페이지를 그대로 보여 주며 기다린다.
 *   - **스켈레톤** (2026-10-15 사용자 확정 — 「B 바탕 맞춤 + 숨쉬기」, 시뮬레이터 v3):
 *     SKEL_AT 이 지나도 값을 기다리는 중이고 페이지에 [data-sk] 자리가 있으면, 그 자리의 글자를
 *     막대로 바꿔 먼저 보여 주고 값이 오면 0.15초에 걸쳐 채운다. 막대는 흰 바탕에서 옅은 검정(7%),
 *     검정·주황 같은 진한 바탕에서 옅은 흰색(30%)이고, 그 절반 진하기까지 천천히 깜빡인다.
 *     자리 표시는 마크업에 한다 — data-sk(그 글자가 막대) · data-sk="box"/"lines"(비어 있다 채워지는 묶음) ·
 *     data-sk-show(스켈레톤 동안 보일 숨은 묶음) · data-sk-hide(스켈레톤 동안 감출 「불러오는 중」).
 *   - **지난 값부터** — <html data-keep> 인 화면은 다 그려진 [data-sk…] 자리를 이 탭에 적어 두었다가
 *     다음에 오면 스크립트가 돌기 전에 그대로 깔고 바로 보여 준다. 새 값이 같으면 화면이 안 바뀐다.
 *     조회가 실패했으면(ccNoKeep) 적지 않는다. 기록 이름에 주인(로그인 사용자 id · 링크 토큰)이 들어간다.
 *   - 화면 사이 0.15초 페이드(View Transitions). 그 순간 아직 못 보여 줄 화면이면 앞 화면 사진을 멈춰 세워 두고,
 *     보여 줄 때 이어서 페이드한다 — 감춘 화면(바탕만)이 비치지 않게.
 *   - 아무리 늦어도 HOLD_MAX 에는 보여 준다. 이 파일이 못 불려 오면 숨기는 일도 없다.
 *   - 스크롤바 자리를 늘 비워 둔다(③). 어드민 셸(ops/index.html)과 같은 처방이다.
 *
 * 페이지 쪽 접점
 *   `window.ccHold?.(약속)` — 그 약속이 끝나야(성공·실패 무관) 다 된 화면으로 본다. 다 끝나기 전이면 언제 불러도 센다.
 *   `window.ccLeave?.()` — 다른 주소로 떠나는 중. 이 화면은 끝까지 감춘다(스켈레톤도 안 띄운다).
 *   `window.ccMaybeLeave?.(약속)` — 떠날지 모르는 동안 ccLeave 처럼 감춘다. 약속이 거짓이면 평소대로 보여 준다.
 *   `window.ccNoKeep?.()` — 이번 화면은 실패 화면이라 「지난 값」으로 적지 않는다.
 *   `await window.ccGlyphs?.(글자)` — 긴 값을 그리기 전에 그 글자의 글꼴 조각부터 받는다(상한 있음).
 *   `window.ccFontCap` — 글꼴이 상한(FONT_MAX)까지 안 와서 기본 글꼴로 먼저 보여 줬다(검사 도구가 읽는다).
 */
(function () {
  // FONT_MAX — 화면에 쓸 글자의 글꼴 조각을 기다리는 상한. 그 뒤에는 기본 글꼴로라도 보여 준다 — 빈 화면을 더 길게 두지 않는다.
  // 글꼴 CSS 는 font-display:block 이다 — 막대가 서 있는 동안 조각이 하나씩 오며 기본 글꼴로 그려 둔 글자의 줄바꿈이 바뀌어
  //   막대가 움직였다(swap 일 때 실측). 다 보여 준 뒤에는 swap 으로 바꾼다(reveal) — 그 뒤에 새로 치는 글자·뜨는 안내가
  //   조각을 기다리며 빈칸으로 남지 않게(2026-10-15 검사관 ⑨).
  // SKEL_FONT_MAX — 값은 왔는데 그 글자의 글꼴이 늦을 때, 막대(스켈레톤)를 세워 둔 채 기다리는 상한.
  //   막대가 서 있으면 빈 화면이 아니므로 더 기다려도 된다. 기본 글꼴로 그렸다가 바꾸면 줄바꿈이 달라져 아래가 튄다.
  var HOLD_MAX = 1200, SKEL_AT = 400, FADE = 150, FONT_MAX = 3000, SKEL_FONT_MAX = 8000;
  var root = document.documentElement, shown = false, fontsDone = false, pending = 0;
  var done = false, dcl = false, leaving = false, skel = false, wantSkel = false, restored = false, noKeep = false;
  // 기록은 누구의 것인지까지 이름에 넣는다 — 같은 탭에서 로그아웃하고 다른 사람이 들어오면 앞사람 값을 깔면 안 된다.
  // 로그인 화면은 supabase-js 가 이 기기에 둔 세션(sb-…-auth-token)의 사용자 id, 링크로 여는 화면(?t=)은 주소가 곧 주인이다.
  // 둘 다 없으면 적지도 깔지도 않는다(2026-10-15 검사관 ①).
  var KEY = (function () {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.+-auth-token$/.test(k)) { var v = JSON.parse(localStorage.getItem(k)); if (v && v.user && v.user.id) return 'cc_snap:' + v.user.id + ':' + location.pathname + location.search; }
      }
    } catch (e) { /* 막힌 저장소 */ }
    return /[?&]t=/.test(location.search) ? 'cc_snap:t:' + location.pathname + location.search : '';
  })();
  var INK = 'rgba(15,23,42,', WHITE = 'rgba(255,255,255,';
  var css = document.createElement('style');
  css.textContent = [
    'html{scrollbar-gutter:stable}',
    'html.cc-wait body{visibility:hidden}',
    '@view-transition{navigation:auto}',
    '::view-transition-group(root){animation-duration:.15s}',
    // 움직임 줄이기: 페이드 없이 바로 바꾼다. animation:none 이면 붙잡을 전환이 없어 숨은 화면이 비친다 — 길이만 0 에 가깝게.
    '@media (prefers-reduced-motion:reduce){::view-transition-group(root),::view-transition-old(root),::view-transition-new(root){animation-duration:.001s}}',
    // 스켈레톤 — 글자는 투명, 같은 자리에 굵은 가로줄(text-decoration)로 막대를 그린다.
    // DOM 을 바꾸지 않으므로 페이지 스크립트가 고르는 요소·순서가 그대로다.
    '@property --skc{syntax:"<color>";inherits:true;initial-value:' + INK + '.07)}',
    '@keyframes cc-sk{50%{--skc:' + INK + '.035)}}',
    '@keyframes cc-skd{0%,100%{--skc:' + WHITE + '.3)}50%{--skc:' + WHITE + '.15)}}',
    'html.cc-sk [data-sk]{--skc:' + INK + '.07);animation:cc-sk 1.1s ease-in-out infinite;' +
      'text-decoration:line-through .9em var(--skc)!important;text-decoration-skip-ink:none!important}',
    'html.cc-sk [data-sk][data-skd]{--skc:' + WHITE + '.3);animation-name:cc-skd}',
    'html.cc-sk [data-sk],html.cc-sk [data-sk] *{color:transparent!important;-webkit-text-fill-color:transparent!important}',
    'html.cc-sk [data-sk] *{text-decoration-line:none!important}',
    'html.cc-sk [data-sk]:empty::before{content:"";display:inline-block;vertical-align:middle;width:var(--skw,5em);height:.9em;border-radius:4px;background:var(--skc)}',
    'html.cc-sk [data-sk=lines]:empty::before{display:block;width:auto;height:var(--skh,8em);border-radius:0;' +
      'background:repeating-linear-gradient(var(--skc) 0 .9em,transparent .9em 1.75em)}',
    'html.cc-sk [data-sk=box]:empty::before{display:block;width:auto;height:var(--skh,6em);border-radius:16px}',
    'html.cc-sk [data-sk=box]:empty::after{content:"";display:var(--sk2,none);height:var(--skh,6em);margin-top:12px;border-radius:16px;background:var(--skc)}',
    'html.cc-sk [data-sk-show][hidden]{display:block!important}',
    'html.cc-sk [data-sk-hide]{display:none!important}',
    '@keyframes cc-skin{from{opacity:0}}',
    'html.cc-skout [data-sk],html.cc-skout [data-sk-show]{animation:cc-skin ' + FADE + 'ms ease-out}',
    '@media (prefers-reduced-motion:reduce){html.cc-sk [data-sk]{animation:none}html.cc-skout [data-sk],html.cc-skout [data-sk-show]{animation:none}}',
  ].join('');
  document.head.appendChild(css);
  root.classList.add('cc-wait');

  var resume = null;   // 앞 화면을 붙잡아 둔 전환 — 보여 줄 때 이어서 돌린다(아래 pagereveal)
  function show(force) { if (!shown && (!leaving || force)) { shown = true; root.classList.remove('cc-wait'); if (resume) resume(); } }
  // 끝까지 기다렸는데도 값이 안 왔으면 — 자리가 있는 화면은 예시 값 대신 스켈레톤으로, 없는 화면은 그대로 보여 준다
  var capped = false;
  // 값이 늦으면 상한에서 보여 주되, 글꼴이 아직이면 글꼴까지는 기다린다(위 FONT_MAX) — 글씨체가 바뀌는 첫 그림을 막는다
  setTimeout(function () { capped = true; if (fontsDone) { skelIfWaiting(true); show(); } }, Math.max(0, HOLD_MAX - performance.now()));
  setTimeout(function () {
    if (fontsDone) return;
    window.ccFontCap = true; fontsDone = true; capped = true;
    // 값은 이미 왔는데 그 글자의 글꼴이 아직이면 — 기본 글꼴로 그린 값을 내보이지 말고 막대를 세운다(finish 가 글꼴을 마저 기다린다)
    if (dcl && !pending && !shown && !leaving && !restored) markSkel(); else skelIfWaiting(true);
    show(); check();
  }, Math.max(0, FONT_MAX - performance.now()));
  setTimeout(function () { show(true); }, 5000);   // 떠난다더니 5초째 그대로면(이동이 막혔으면) 그래도 보여 준다
  setTimeout(function () { wantSkel = true; skelIfWaiting(); }, Math.max(0, SKEL_AT - performance.now()));
  addEventListener('pageshow', function (e) { if (e.persisted) { leaving = false; show(); } });
  // 화면 사이 전환 — 새 화면이 아직 숨어 있으면 **앞 화면 사진을 멈춰 세워 둔다.** 다 그려지면(show) 그때 0.15초로 넘긴다.
  // 전에는 이때 전환을 건너뛰어, 숨은 새 화면(바탕만)이 한 번 비쳤다가 내용이 떴다 — 랜딩↔마이페이지에서
  // 「앞 화면이 한 번 더 보이고 넘어간다」로 보였다(2026-10-15 사용자 지적). 붙잡는 시간은 위 HOLD_MAX 가 상한이다(다른 주소로 떠나는 중이면 그 이동이 막혔을 때의 5초).
  addEventListener('pagereveal', function (e) {
    var vt = e.viewTransition;
    // 건너뛴 전환의 거절이 잡히지 않은 채 남으면 오류 기록(client_error)에 「Skipping view transition」 이 쌓인다 — 늘 받아 둔다(2026-10-15 출시 검수)
    // 이 거절은 화면 전환을 못 했다는 뜻일 뿐 사용자에게 보이는 고장이 아니다(화면은 show 가 보여 준다) — 이유와 상관없이 받는다.
    if (vt) { vt.ready.catch(function () {}); vt.finished.catch(function () {}); }
    if (!vt || shown) return;
    vt.ready.then(function () {
      if (shown) return;
      var a = root.getAnimations({ subtree: true }).filter(function (x) {
        return x.effect && x.effect.pseudoElement && x.effect.pseudoElement.indexOf('::view-transition') === 0;
      });
      for (var i = 0; i < a.length; i++) a[i].pause();
      resume = function () { resume = null; for (var j = 0; j < a.length; j++) a[j].play(); };
    }, function () { /* 전환이 취소됐다 — 그냥 보여 준다 */ });
  });

  // 진한 바탕 위 자리는 흰 막대로 — 바탕을 거슬러 올라가 처음 만나는 불투명한 색을 본다
  function dark(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] > 0.5)) {
        var r = +m[0], g = +m[1], b = +m[2];
        return 0.2126 * r + 0.7152 * g + 0.0722 * b < 150 || Math.max(r, g, b) - Math.min(r, g, b) > 40;
      }
    }
    return false;
  }
  function skelIfWaiting(late) {
    if (!(wantSkel && fontsDone) && !late) return;
    if (shown || leaving || restored || (dcl && !pending)) return;   // 모듈이 아직 덜 왔어도 기다리는 중이다
    markSkel();
  }
  function markSkel() {
    var slots = document.querySelectorAll('[data-sk]');
    if (!slots.length) return;
    for (var i = 0; i < slots.length; i++) if (dark(slots[i])) slots[i].setAttribute('data-skd', '');
    skel = true; root.classList.add('cc-sk'); show();
  }
  // 값을 그린 뒤에 새로 필요해진 글꼴 조각까지 기다린다 — 회사 이름·제목처럼 늦게 들어온 글자는 첫 그림 때
  // 없던 조각을 부른다. 안 기다리면 그 글자만 늦게 나타나거나(block) 글씨체가 바뀐다(swap). 상한(max)은 부르는 쪽이 준다.
  // 레이아웃을 돌리고 document.fonts.ready 를 보는 것만으로는 안 됐다 — 조각 요청이 그 다음 틀에 나가서
  // ready 가 이미 풀린 채로 지나갔다(2026-10-15 덜컹임 전수: 전문 7조각·저장소 1조각이 다 보인 뒤에 왔다).
  // 그래서 화면에 있는 글자를 직접 넘겨 그 글자들의 조각을 불러 달라고 한다(fonts.load).
  function chars(all) {
    var seen = {}, out = '', add = function (t) { for (var i = 0; i < t.length; i++) if (!seen[t[i]]) { seen[t[i]] = 1; out += t[i]; } };
    // 숨긴 칸(hidden)의 글자는 기다리지 않는다 — 안내 카드·토스트처럼 지금 안 보이는 글자까지 기다리면 보여 주는 것만 늦어진다.
    //   그 글자는 DCL 에서 기다리지 않고 미리 받아 둔다(all) — 값이 와서 뜨는 안내창의 글자가 빈칸으로 떴다(탈퇴 화면, 2026-10-15 실측)
    var w = document.createTreeWalker(document.body, 4, { acceptNode: function (n) { var p = n.parentElement; return !p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(p.nodeName) || (!all && p.closest('[hidden]')) ? 2 : 1; } }), n;
    while ((n = w.nextNode())) add(n.nodeValue);
    var f = document.querySelectorAll('[placeholder],input[value],button[value]');
    for (var i = 0; i < f.length; i++) add((f[i].getAttribute('placeholder') || '') + (f[i].value || ''));
    return out;
  }
  function afterFonts(cb, max) {
    var fonts = document.fonts, once = false, go = function () { if (!once) { once = true; cb(); } };
    if (!fonts || !fonts.load || !document.body) return go();
    setTimeout(function () { if (!once) window.ccFontCap = true; go(); }, Math.max(200, max - performance.now()));
    Promise.all([fonts.load('16px "Pretendard Variable"', chars() || ' '), fonts.ready]).then(go, go);
  }
  function finish() {
    if (done) return;
    done = true;
    if (!document.querySelector('[data-sk]')) return afterFonts(reveal, FONT_MAX);
    // 자리가 있는 화면 — 글꼴이 FONT_MAX 까지 안 오면 막대를 세워 보여 주고, 글꼴이 오면 그때 걷는다(상한 SKEL_FONT_MAX)
    var t = setTimeout(function () { if (!shown && !leaving) markSkel(); }, Math.max(0, FONT_MAX - performance.now()));
    afterFonts(function () { clearTimeout(t); reveal(); }, SKEL_FONT_MAX);
  }
  function reveal() {
    try { document.fonts.forEach(function (f) { f.display = 'swap'; }); } catch (e) { /* 못 바꾸는 브라우저 — block 그대로 */ }
    if (skel) {
      root.classList.remove('cc-sk'); root.classList.add('cc-skout');
      setTimeout(function () { root.classList.remove('cc-skout'); }, FADE + 50);
    }
    show(); keep();
  }
  // 기다림이 다 끝난 뒤 한 박자(setTimeout 0) 더 본다 — 조회 하나가 끝나며 다음 조회를 맡기는
  // 사슬(로그인 확인 → 값 조회)이 그 사이에 끼어들 수 있게.
  // dcl 까지 본다 — 마크업을 다 읽기 전(페이지 모듈이 ccHold 를 걸기 전)에 끝내면 빈 마크업을 내보인다(2026-10-15 검사관 ①)
  function check() { if (dcl && fontsDone && !pending) setTimeout(function () { if (!pending) finish(); }, 0); }
  function settle() { pending--; check(); }
  window.ccHold = function (p) {
    // 거부를 여기서 삼키지 않고 다시 던진다 — 그래야 그리다 난 오류가 전처럼 처리 안 된 거부로
    // 남아 track.js 의 오류 보고에 잡힌다.
    if (!done) { pending++; Promise.resolve(p).then(settle, function (e) { settle(); throw e; }); }
    return p;
  };
  var 진짜떠남 = false;   // ccLeave 로 떠난 것은 ccMaybeLeave 가 「머묾」으로 되돌리지 않는다
  window.ccLeave = function () { 진짜떠남 = leaving = true; pending++; };
  // 떠날지 아직 모를 때 — 답이 올 때까지 떠나는 중처럼 감춘다(스켈레톤도 안 띄운다). 약속이 참이면 떠난 것이고,
  // 거짓·실패면 평소대로 돌아간다. 상한(HOLD_MAX)이 이미 지났으면 그 자리에서 보여 준다.
  window.ccMaybeLeave = function (p) {
    if (done) return;
    leaving = true; pending++;
    var 머묾 = function () {
      leaving = 진짜떠남; settle();
      if (!done) { if (capped && fontsDone) { skelIfWaiting(true); show(); } else skelIfWaiting(); }
    };
    Promise.resolve(p).then(function (간다) { if (!간다) 머묾(); }, 머묾);
  };
  // 값을 그리기 전에 그 글자의 글꼴 조각부터 받는다 — 막대가 선 채로 긴 글을 그려 두면 조각이 하나씩 오며
  //   줄바꿈이 바뀌어 막대가 움직인다(전문 본문, 2026-10-15 실측). 상한은 SKEL_FONT_MAX 다.
  window.ccGlyphs = function (text) {
    var fonts = document.fonts;
    if (!fonts || !fonts.load || !text) return Promise.resolve();
    return Promise.race([fonts.load('16px "Pretendard Variable"', text).catch(function () {}),
      new Promise(function (r) { setTimeout(r, Math.max(200, SKEL_FONT_MAX - performance.now())); })]);
  };
  window.ccNoKeep = function () { noKeep = true; try { sessionStorage.removeItem(KEY); } catch (e) { /* 막힌 저장소 */ } };

  // ── 지난 값부터 ── 자리 목록이 마크업 순서대로 같을 때만 쓴다(마크업이 바뀌면 옛 기록은 버린다)
  function slots() { return document.querySelectorAll('[data-sk],[data-sk-show],[data-sk-hide]'); }
  function keep() {
    if (noKeep || leaving || !KEY || !root.hasAttribute('data-keep')) return;
    try {
      var s = slots(), out = [];
      for (var i = 0; i < s.length; i++) out.push([s[i].innerHTML, s[i].hidden]);
      sessionStorage.setItem(KEY, JSON.stringify(out));
    } catch (e) { /* 막힌 저장소·용량 초과 — 기록 없이 지난다 */ }
  }
  document.addEventListener('readystatechange', function () {
    // 'interactive' 는 마크업을 다 읽은 직후, 페이지 모듈이 돌기 전이다
    if (document.readyState !== 'interactive' || !KEY || !root.hasAttribute('data-keep')) return;
    try {
      var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'), s = slots();
      if (!saved || saved.length !== s.length) return;
      for (var i = 0; i < s.length; i++) { s[i].innerHTML = saved[i][0]; s[i].hidden = saved[i][1]; }
      restored = true;
    } catch (e) { /* 깨진 기록 — 평소처럼 */ }
  });

  document.addEventListener('DOMContentLoaded', function () {
    dcl = true;
    function ready() {
      if (!fontsDone) {   // 이미 서 있으면 상한(FONT_MAX)이 먼저 보여 줬다 — 그래도 아래(끝내기)는 해야 한다
        fontsDone = true;
        if (capped) { skelIfWaiting(true); show(); }   // 값 상한은 지났는데 글꼴 때문에 붙잡아 둔 화면
      }
      if (restored) show();             // 지난 값을 깔았으면 새 값을 기다리지 않고 보여 준다
      if (!pending) return finish();    // 기다릴 것이 없으면 지금 바로
      skelIfWaiting(); check();
    }
    // 마크업에 있는 글자의 조각을 지금 부른다. 이미 다 있으면 약속이 마이크로태스크로 풀려 첫 그림 전에 보여 준다
    // — 그래야 페이드(View Transitions)가 산다. 늦으면 위 FONT_MAX 가 상한이다.
    try { document.fonts.load('16px "Pretendard Variable"', chars(true) || ' ').catch(function () {}); } catch (e) { /* 글꼴 API 없음 */ }
    if (fontsDone) ready(); else afterFonts(ready, FONT_MAX);
  });
})();
