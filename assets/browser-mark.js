/**
 * 브라우저 표식(cc_b) — 랜딩 track.js 와 어드민 셸이 같은 규칙을 쓰도록 한 곳에 둔다(2026-10-15).
 * 이름·계정과 묶이지 않은 난수다. 운영 DB 는 우리(운영자) 브라우저의 것만 따로 적어 집계에서 뺀다(career-coach 0111).
 * 처음 부를 때 한 번 만들고 그대로 쓴다. 못 만들면 null(사파리 프라이빗 등 — 표식 없이 보낸다).
 *
 * 🔴 한 화면 안에서는 표식이 바뀌지 않는다 (2026-10-19 실측). 인스타·페이스북 앱 안 창(아이폰 폭 375~430)에서
 *    광고를 눌러 연 랜딩이 방문 기록은 표식 A 로 보내고, 4~18초 뒤 도달·클릭 기록부터는 처음 보는 표식 B 로 보냈다 —
 *    같은 화면(같은 vid)인데 저장공간이 그사이 비워진 것이다(21건, A 는 그 뒤 다시 안 나온다). 그러면 방문과 가입이
 *    다른 브라우저로 갈려 퍼널의 랜딩 버전·유입 경로가 빈다. 그래서 처음 읽은 값을 기억해 두고, 저장공간이 다른 값이면
 *    기억한 값을 도로 적는다 — 그 뒤 화면(온보딩·결제)도 같은 표식을 읽는다.
 */
let 기억 = null;

export function browserMark() {
  try {
    let b = localStorage.getItem('cc_b');
    if (기억 && b !== 기억) {
      localStorage.setItem('cc_b', 기억);
      return 기억;
    }
    if (!b || !/^[A-Za-z0-9_-]{8,64}$/.test(b)) {
      b = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '');
      localStorage.setItem('cc_b', b);
    }
    기억 = b;
    return b;
  } catch { return 기억; }
}
