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

/**
 * 「이 브라우저에서는 메타 픽셀을 켜지 않는다」 표시(cc_nopx, 2026-10-15 사용자 지시) — 우리 시험이 광고 학습에 섞이지 않게.
 * 표식(cc_b)이 우리 것인지는 서버만 알고 화면은 모른다. 그래서 브라우저에 따로 남긴다.
 * 켜는 길 둘: 어드민을 연다(셸이 pixelOff(true)) · 아무 화면이나 주소 끝에 ?cc_px=off 를 붙여 한 번 연다. 되돌리기는 ?cc_px=on.
 * 못 적는 브라우저(사파리 프라이빗 등)는 꺼진 것으로 치지 않는다.
 */
export function pixelOff(turnOff) {
  try {
    const q = new URLSearchParams(location.search).get('cc_px');
    if (turnOff || q === 'off') localStorage.setItem('cc_nopx', '1');
    else if (q === 'on') localStorage.removeItem('cc_nopx');
    return localStorage.getItem('cc_nopx') === '1';
  } catch { return false; }
}
