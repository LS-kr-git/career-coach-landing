/**
 * 페이지에 들어설 때 화면이 덜컹이지 않게 한다 (2026-10-14 사용자 지시 — 모든 페이지 · 모든 전환).
 * 모든 페이지의 <head> 에서 Pretendard 스타일시트 **바로 다음에** 동기로 부른다(async·defer·module 아님):
 *   <script src="/assets/steady.js"></script>
 *
 * 덜컹임의 정체 (2026-10-14 실측 — 360px · 느린 망·CPU 4배에서 화면을 프레임 단위로 녹화)
 *   ① 글꼴 바꿔치기 — 첫 그림은 기본 글꼴로 그렸다가 Pretendard 조각이 도착할 때마다 다시 그린다.
 *      글자 폭·높이가 달라 제목·칸이 한 번에서 세 번까지 들썩였다. 모든 페이지에서.
 *   ② 뒤늦게 채우는 값 — 저장해 둔 선택·서버 값이 첫 그림 **뒤에** 들어와 칸이 생기거나 밀렸다.
 *   ③ PC 에서 스크롤바가 있는 페이지와 없는 페이지를 오가면 가운데 카드가 좌우로 약 8px 튄다.
 *
 * 하는 일
 *   - 글꼴과(①) 페이지가 맡긴 기다림(②, 아래 ccHold)이 끝날 때까지 본문을 그리지 않는다.
 *     같은 사이트 안에서 넘어갈 때는 브라우저가 **앞 페이지를 그대로 보여 주며** 기다리므로
 *     흰 화면 없이 다 된 화면으로 한 번에 바뀐다.
 *   - 아무리 늦어도 HOLD_MAX 에는 보여 준다. 글꼴 CDN 이 죽어도 페이지가 안 숨는다.
 *     이 파일 자체가 못 불려 오면 숨기는 일도 없다 — 숨김 규칙을 여기서 넣기 때문이다.
 *   - 스크롤바 자리를 늘 비워 둔다(③). 어드민 셸(ops/index.html)과 같은 처방이다.
 *
 * 페이지가 기다려 달라고 하는 법 (②)
 *   `window.ccHold?.(약속)` — 그 약속이 끝나야(성공·실패 무관) 보여 준다. 화면을 내보이기 전이면
 *   언제 불러도 센다. 다른 페이지로 떠나는 중이면 끝나지 않는 약속을 맡겨 그 화면을 끝까지 감춘다.
 *   localStorage 처럼 동기로 채우는 값은 맡길 필요가 없다 — 모듈이 다 돈 뒤(DOMContentLoaded)에 보여 주므로.
 */
(function () {
  var HOLD_MAX = 1200;   // 이동 시작부터 ms. 이보다 늦은 것은 그냥 보여 준 뒤 채운다.
  var root = document.documentElement, shown = false, fontsDone = false, pending = 0;
  var css = document.createElement('style');
  css.textContent = 'html{scrollbar-gutter:stable}html.cc-wait body{visibility:hidden}';
  document.head.appendChild(css);
  root.classList.add('cc-wait');

  function show() { if (!shown) { shown = true; root.classList.remove('cc-wait'); } }
  setTimeout(show, Math.max(0, HOLD_MAX - performance.now()));
  // 떠나는 중에 감춘 채로 뒤로가기 캐시에 들어간 화면이 돌아오면 바로 보여 준다
  addEventListener('pageshow', function (e) { if (e.persisted) show(); });

  // 기다림이 다 끝난 뒤 한 박자(setTimeout 0) 더 본다 — 조회 하나가 끝나며 다음 조회를 맡기는
  // 사슬(로그인 확인 → 값 조회)이 그 사이에 끼어들 수 있게.
  function check() { if (fontsDone && !pending) setTimeout(function () { if (!pending) show(); }, 0); }
  function settle() { pending--; check(); }
  window.ccHold = function (p) {
    // 거부를 여기서 삼키지 않고 다시 던진다 — 그래야 그리다 난 오류가 전처럼 처리 안 된 거부로
    // 남아 track.js 의 오류 보고에 잡힌다.
    if (!shown) { pending++; Promise.resolve(p).then(settle, function (e) { settle(); throw e; }); }
    return p;
  };

  document.addEventListener('DOMContentLoaded', function () {
    void document.body.offsetWidth;   // 레이아웃을 지금 돌려 필요한 글꼴 조각을 바로 요청시킨다
    var fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(function () { fontsDone = true; check(); }, show);
  });
})();
