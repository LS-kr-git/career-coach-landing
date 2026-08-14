// ops 셸의 **왼쪽 탭바** 확인 — 함수는 스텁으로 대신한다.
//   node tools/ops-audit/nav.mjs
//
// 왜 이 파일이 있나 (2026-08-13)
//   탭바는 하루에 열 번 넘게 바뀌었는데(선택 표시 · 묶음 위계 · 폭 · 호버 · 탭 제목)
//   **그중 무엇도 검사가 물고 있지 않았다.** 되돌려도 아무도 모르는 상태였고, 실제로
//   폭 하나는 잘못 잰 값이 라이브까지 나갔다가 검사관이 잡았다.
//   여기 있는 것은 전부 **사용자가 직접 정한 것**이다. 바꾸려면 사용자에게 물어야 한다.
//
// 훅에 없는 이유는 `route.mjs` 머리말과 `README.md` 가 정본이다.
import { 서버열기, 브라우저열기, 검사기 } from './harness.mjs';

const { server, origin } = await 서버열기();

// 🔴 **운영 화면의 실제 이름을 여기 적지 않는다.** `ops/index.html` 이 그렇게 정해 뒀다 —
//    "화면 id 목록은 함수가 준 nav 에서만 온다. 여기에 화이트리스트를 두지 마라 — 두는 순간
//    화면 목록이 공개 저장소에 박힌다." 이 저장소는 공개다.
//    (`route.mjs`·`session.mjs` 의 스텁도 2026-08-13 에 같은 규칙으로 갈았다. 여기에
//     "그쪽은 아직 진짜 id 를 쓴다" 는 경고가 남아 있었는데 지금은 사실이 아니다.)
//
// 그래서 **성질만 같게** 만든다. 검사가 보는 것은 이름의 뜻이 아니라 아래 셋뿐이다.
//    · 라틴+한글이 섞인 **가장 긴 칸**이 하나 있다 — 굵기 예약과 폭 검사의 최악 조건.
//    · 칸이 14개다 — 짧은 화면에서 탭바가 스크롤된다(③ 검사의 전제).
//    · 묶음이 여럿이다 — 라벨/항목 들여쓰기 위계를 볼 수 있다.
const NAV = [
  { id: 's01', title: '가나다 라마바', group: '묶음 하나', order: 10 },
  { id: 's02', title: '사아자 차카타', group: '묶음 하나', order: 20 },
  { id: 's03', title: '가나다라 마바사', group: '묶음 둘', order: 10 },
  { id: 's04', title: '아자차 카타파하', group: '묶음 둘', order: 20 },
  { id: 's05', title: '가나다라마 바사아자', group: '묶음 둘', order: 30 },
  { id: 's06', title: '차카타파 하가나', group: '묶음 셋', order: 10 },
  { id: 's07', title: '다라마바 사아자차', group: '묶음 셋', order: 20 },
  { id: 's08', title: '카타파하 가나다라', group: '묶음 셋', order: 30 },
  { id: 's09', title: 'Sample Metrics 시뮬레이터', group: '묶음 넷', order: 10 },  // ← 가장 긴 칸
  { id: 's10', title: '마바사아 자차카타', group: '묶음 넷', order: 20 },
  { id: 's11', title: '파하가나 다라마바', group: '묶음 넷', order: 30 },
  { id: 's12', title: '사아자차 카타파', group: '묶음 다섯', order: 10 },
  { id: 's13', title: '하가나다 라마바사', group: '묶음 다섯', order: 20 },
  { id: 's14', title: '아자차카 타파하가', group: '묶음 다섯', order: 30 },
];
const IDS = NAV.map((p) => p.id);
const 긴칸 = 's09';   // 가장 긴 이름. 폭·잘림 검사의 최악 조건이다.
const 끝칸 = 's14'; // 목록 맨 아래. 짧은 화면에서 스크롤 밖으로 나가는 칸이다.

const browser = await 브라우저열기();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

// 「불러오는 중」 을 볼 수 있어야 하므로 한 화면만 일부러 늦게 준다.
const 느린칸 = 's02';
await page.route('**/functions/v1/**', async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname.endsWith('/auth/login')) {
    return route.fulfill({ json: { access_token: 'T', user: { email: 'a@b.c' } } });
  }
  if (u.pathname.endsWith('/bootstrap')) {
    return route.fulfill({ json: { user: { email: 'a@b.c' }, nav: NAV } });
  }
  // 글자 종류로 좁히지 않는다 — 이유는 `route.mjs` 의 같은 자리 주석에 있다.
  const m = u.pathname.match(/\/view\/([^/]+)$/);
  if (m) {
    if (m[1] === 느린칸) await new Promise((r) => setTimeout(r, 700));
    return route.fulfill({ body: `<h1 id="t">${m[1]}</h1>`, contentType: 'text/html; charset=utf-8' });
  }
  return route.fulfill({ status: 404, json: { error: 'nf' } });
});

const { ok, 마무리 } = 검사기();

/** route.mjs 의 것과 같은 이유로 이렇게 쓴다 — 그 파일 주석이 정본이다. */
async function login(hash) {
  await page.goto(origin + '/ops/?r=' + Math.random() + hash);
  for (let i = 0; i < 3; i++) {
    if (await page.locator('#main h1').count()) break;
    try {
      await page.fill('#email', 'a@b.c', { timeout: 2000 });
      await page.fill('#pw', 'x', { timeout: 2000 });
      await page.click('#go', { timeout: 2000 });
      break;
    } catch { /* 부팅이 먼저 끝났다 */ }
  }
  // 🔴 `#main h1` 로 기다리면 안 된다 — 셸의 **오류 화면도** `<h1>화면을 불러오지 못했습니다</h1>` 다.
  //    스텁 경로가 어긋나면 20항목이 오류 화면을 상대로 재고도 전부 초록일 수 있다.
  //    `#t` 는 이 파일의 스텁만 붙이는 표식이라, 그 구멍이 구조적으로 닫힌다.
  await page.waitForSelector('#main h1#t');
}

const 재기 = () => page.evaluate(() => {
  const nav = document.querySelector('#nav');
  const on = nav.querySelector('a.on');
  const c = on ? getComputedStyle(on) : null;
  const bar = on ? getComputedStyle(on, '::before') : null;
  return {
    navW: Math.round(nav.getBoundingClientRect().width),
    onId: on?.dataset.id ?? null,
    onBg: c?.backgroundColor ?? null,
    onWeight: c?.fontWeight ?? null,
    barW: bar?.width ?? null,
    barBg: bar?.backgroundColor ?? null,
    aria: [...nav.querySelectorAll('[aria-current]')].map((a) => a.dataset.id),
    nowrap: on ? c.whiteSpace : null,
    // 🔴 글자가 상자 밖으로 나간 칸. `white-space:nowrap` 이라 넘치면 **접히는 게 아니라 잘린다** —
    //    그래서 높이만 보면 `max-width` 가 조여도 영영 초록이다(검사관 지적).
    잘린칸: [...nav.querySelectorAll('a[data-id]')]
      .filter((a) => a.scrollWidth > a.clientWidth + 1).map((a) => a.dataset.id),
  };
});

// ── ① 선택 표시 — 사용자가 "배경색은 바뀌지 않게" 로 못 박은 자리다 ──────────────
await login('#' + 긴칸);
{
  const m = await 재기();
  ok('선택된 칸에 배경색이 없다', m.onBg === 'rgba(0, 0, 0, 0)', m.onBg);
  ok('선택된 칸이 굵다', Number(m.onWeight) >= 700, m.onWeight);
  ok('선택된 칸에 왼쪽 바가 있다', m.barW === '3px' && m.barBg === 'rgb(245, 158, 11)',
     `${m.barW} / ${m.barBg}`);
  ok('aria-current 는 선택된 칸 하나뿐이다', m.aria.length === 1 && m.aria[0] === 긴칸,
     JSON.stringify(m.aria));
}

// 화면을 옮기면 aria-current 도 같이 옮겨야 한다. 안 옮기면 스크린리더에는
// **두 곳이 현재 페이지**이거나 옛 자리에 그대로 남는다.
await page.evaluate((id) => { location.hash = '#' + id; }, 끝칸);
await page.waitForFunction((id) => document.querySelector('#nav a.on')?.dataset.id === id, 끝칸);
{
  const m = await 재기();
  ok('화면을 옮기면 aria-current 도 옮겨간다', m.aria.length === 1 && m.aria[0] === 끝칸,
     JSON.stringify(m.aria));
}

// ── ② 자동 폭 — 셋이 한 벌이라는 것을 여기서 문다 ────────────────────────────
// 어느 칸을 선택하든 폭이 같아야 한다. 다르면 `::after` 굵기 예약이 빠진 것이다
// (그 상태에서는 가장 긴 칸을 누를 때만 폭이 튀어 오른쪽 본문이 밀린다).
const 폭 = new Set();
const 잘림 = new Set();
for (const id of IDS) {
  await page.evaluate((x) => { location.hash = '#' + x; }, id);
  await page.waitForFunction((x) => document.querySelector('#nav a.on')?.dataset.id === x, id);
  const m = await 재기();
  폭.add(m.navW);
  m.잘린칸.forEach((x) => 잘림.add(x));
}
ok('어느 칸을 선택해도 탭바 폭이 같다', 폭.size === 1, [...폭].join(', '));
ok('어느 칸도 글자가 잘리지 않는다', 잘림.size === 0, [...잘림].join(', '));

// 화면이 짧으면 탭바에 세로 스크롤바가 생긴다. `scrollbar-gutter:stable` 이 없으면
// 그때만 폭이 달라져서 **그 PC 에서만** 나는 차이가 된다.
//
// 🔴 **이 항목은 규칙이 있는지만 본다. 효과는 여기서 못 잰다** — 잴 수 없는 것을 잰 척하지 않는다.
//    headless 크로미움은 **오버레이 스크롤바**라 스크롤바가 자리를 안 먹는다. 그래서 규칙을
//    빼도 긴 화면과 짧은 화면의 폭이 똑같이 나온다(변이로 확인: 규칙 없이 둘 다 225).
//    `::-webkit-scrollbar{width:15px}` 로 클래식을 흉내 내 봐도 안 바뀐다(그것도 확인했다).
//    자리를 실제로 먹는 것은 사용자 PC 의 윈도우 크롬이고(실측 15px), 거기서는 이 규칙이
//    없으면 화면이 짧은 PC 에서만 폭이 223 으로 줄어 가장 긴 칸이 두 줄이 된다.
//    그 사고를 여기서 재현할 수는 없으므로, **규칙이 조용히 사라지는 것**만 막는다.
await page.setViewportSize({ width: 1200, height: 420 });
await page.evaluate((x) => { location.hash = '#' + x; }, 긴칸);
await page.waitForFunction((x) => document.querySelector('#nav a.on')?.dataset.id === x, 긴칸);
{
  const m = await 재기();
  const { gutter, 스크롤생김 } = await page.evaluate(() => {
    const n = document.querySelector('#nav');
    return { gutter: getComputedStyle(n).scrollbarGutter, 스크롤생김: n.scrollHeight > n.clientHeight + 1 };
  });
  ok('짧은 화면에서 탭바가 스크롤된다 (아래 검사의 전제)', 스크롤생김, String(스크롤생김));
  ok('탭바가 스크롤바 자리를 늘 비워 둔다 (효과는 이 환경에서 못 잼)', gutter === 'stable', gutter);
  ok('짧은 화면에서도 글자가 안 잘린다', m.잘린칸.length === 0, m.잘린칸.join(', '));
  ok('칸은 한 줄로 유지된다 (white-space)', m.nowrap === 'nowrap', m.nowrap);
}

// ── ③ 선택된 칸이 화면 안에 보인다 (짧은 화면 + 맨 아래 칸) ──────────────────
await login('#' + 끝칸);
{
  const 보임 = await page.evaluate(() => {
    const n = document.querySelector('#nav').getBoundingClientRect();
    const a = document.querySelector('#nav a.on').getBoundingClientRect();
    return { 위: Math.round(a.top - n.top), 아래: Math.round(n.bottom - a.bottom) };
  });
  ok('짧은 화면에서 열어도 선택된 칸이 탭바 안에 보인다',
     보임.위 >= -1 && 보임.아래 >= -1, JSON.stringify(보임));
}
await page.setViewportSize({ width: 1200, height: 900 });

// ── ④ 묶음 위계 — 시안 13. 라벨이 왼쪽으로 나오고 항목이 들여쓰기된다 ───────────
await login('#' + 긴칸);
{
  const 정렬 = await page.evaluate(() => {
    const px = (el, k) => Math.round(parseFloat(getComputedStyle(el)[k]));
    return {
      라벨: px(document.querySelector('#nav .grp'), 'paddingLeft'),
      항목: px(document.querySelector('#nav a[data-id]'), 'paddingLeft'),
      이메일: px(document.querySelector('#nav .who'), 'paddingLeft'),
      로그아웃: px(document.querySelector('#nav .out'), 'paddingLeft'),
      라벨굵기: getComputedStyle(document.querySelector('#nav .grp')).fontWeight,
    };
  });
  ok('묶음 라벨이 항목보다 왼쪽으로 나온다', 정렬.라벨 < 정렬.항목, JSON.stringify(정렬));
  ok('계정 블록이 라벨과 같은 선이다', 정렬.이메일 === 정렬.라벨 && 정렬.로그아웃 === 정렬.라벨,
     JSON.stringify(정렬));
}

// ── ⑤ 호버가 선택 표시를 덮지 않는다 ────────────────────────────────────────
// 선택은 배경을 안 쓰기로 한 자리다. 호버 규칙에서 `.on` 을 빼지 않으면 마우스를
// 올리는 순간 배경이 생겨 그 결정이 반쯤 되돌아간다.
{
  await page.hover('#nav a.on');
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#nav a.on')).backgroundColor);
  ok('선택된 칸은 호버해도 배경이 없다', bg === 'rgba(0, 0, 0, 0)', bg);
  const 다른칸 = IDS.find((x) => x !== 긴칸);
  await page.hover(`#nav a[data-id="${다른칸}"]`);
  const bg2 = await page.evaluate((x) => getComputedStyle(
    document.querySelector(`#nav a[data-id="${x}"]`)).backgroundColor, 다른칸);
  ok('안 선택된 칸은 호버하면 배경이 생긴다', bg2 !== 'rgba(0, 0, 0, 0)', bg2);
}

// ── ⑤-2 키보드 포커스 표시 ─────────────────────────────────────────────────
// 마우스로만 다니면 안 보이는 자리라, 되돌아가도 아무도 모른다.
// 🔴 **여기서 지키는 결정은 "우리 아웃라인이 있다" 가 아니라 "브라우저 기본값을 쓴다" 다**
//    (2026-08-13 사용자 확정: 시안 E). 그래서 `outline-style` 이 `auto` 여야 한다.
//    - `none`  → 누가 `outline:none` 이나 `*{outline:0}` 을 넣어 표시를 죽였다
//    - `solid` → 누가 우리 색·두께로 덮어썼다. 그것도 결정을 뒤집은 것이다
//    `auto` 는 크로미움에서 폭이 1px 로 계산되지만 실제로는 두 겹으로 그려진다 —
//    그러니 **폭으로 판정하지 않는다.** `parseFloat(w) >= 2` 로 재면 기본값이 오답이 된다.
{
  await page.evaluate(() => document.querySelector('#nav a[data-id]').focus({ focusVisible: true }));
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const o = await page.evaluate(() => {
    const a = document.querySelector('#nav a[data-id]');
    const c = getComputedStyle(a);
    // 저자 규칙이 `nav a:focus-visible` 을 겨냥했는지 **규칙 목록에서** 본다.
    // computed style 만 보면 `outline-offset` · `outline-color` 처럼 style 을 안 건드리는
    // 되돌림이 그대로 통과한다(검사관 ②). 걷어낸 옛 규칙이 `outline-offset:-2px` 였으므로
    // 그 자리가 특히 다시 채워지기 쉽다.
    const 저자규칙 = [];
    for (const ss of document.styleSheets) {
      let rules; try { rules = ss.cssRules; } catch { continue; }   // 교차출처 시트는 못 읽는다
      for (const r of rules) {
        if (!r.selectorText || !r.selectorText.includes('focus-visible')) continue;
        if (a.matches(r.selectorText.replace(/:focus-visible/g, ''))) 저자규칙.push(r.cssText);
      }
    }
    return { w: c.outlineWidth, s: c.outlineStyle, offset: c.outlineOffset,
             focused: document.activeElement === a, visible: a.matches(':focus-visible'), 저자규칙 };
  });
  ok('키보드 포커스 표시가 브라우저 기본값 그대로다',
     o.focused && o.visible && o.s === 'auto' && o.저자규칙.length === 0,
     JSON.stringify(o));
}

// ── ⑥ 탭 제목 ─────────────────────────────────────────────────────────────
{
  // 기대값을 손으로 적지 않는다 — 위 스텁에서 가져온다. 스텁 이름을 바꿔도 검사가 안 낡는다.
  const 긴칸이름 = NAV.find((p) => p.id === 긴칸).title;
  const 끝칸이름 = NAV.find((p) => p.id === 끝칸).title;
  const t1 = await page.title();
  ok('탭 제목에 지금 화면 이름이 있다', t1.startsWith(긴칸이름), t1);
  ok('탭 제목에 서비스명이 있다', t1.includes('커리어코치'), t1);
  await page.evaluate((x) => { location.hash = '#' + x; }, 끝칸);
  await page.waitForFunction((x) => document.title.startsWith(x), 끝칸이름);
  ok('화면을 옮기면 탭 제목도 따라간다', (await page.title()).startsWith(끝칸이름), await page.title());
}

// ── ⑦ 화면 전환 중 빈 화면을 두지 않는다 ────────────────────────────────────
{
  await page.evaluate((x) => { location.hash = '#' + x; }, 느린칸);
  // 응답을 700ms 늦춰 뒀다. 그 사이 본문이 비어 있으면 "안 눌렸나" 로 읽힌다.
  await page.waitForTimeout(150);
  const 중간 = (await page.textContent('#main')).trim();
  ok('불러오는 동안 본문이 비어 있지 않다', 중간.length > 0, 중간.slice(0, 20));
  await page.waitForFunction(() => document.querySelector('#main h1'));
  ok('다 불러오면 그 자리가 화면으로 갈린다', await page.textContent('#t') === 느린칸,
     await page.textContent('#t'));
}

await browser.close();
server.close();
마무리();
