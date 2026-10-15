/**
 * 브라우저 표식(cc_b) — 랜딩 track.js 와 어드민 셸이 같은 규칙을 쓰도록 한 곳에 둔다(2026-10-15).
 * 이름·계정과 묶이지 않은 난수다. 운영 DB 는 우리(운영자) 브라우저의 것만 따로 적어 집계에서 뺀다(career-coach 0111).
 * 처음 부를 때 한 번 만들고 그대로 쓴다. 못 만들면 null(사파리 프라이빗 등 — 표식 없이 보낸다).
 */
export function browserMark() {
  try {
    let b = localStorage.getItem('cc_b');
    if (!b || !/^[A-Za-z0-9_-]{8,64}$/.test(b)) {
      b = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '');
      localStorage.setItem('cc_b', b);
    }
    return b;
  } catch { return null; }
}
