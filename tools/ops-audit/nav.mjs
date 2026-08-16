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
import fs from 'node:fs';
import { 서버열기, 브라우저열기, 검사기, TOKENS_STUB } from './harness.mjs';

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
    return route.fulfill({ json: { user: { email: 'a@b.c' }, nav: NAV, css: TOKENS_STUB } });
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

// ── ②-2 오른쪽 본문 폭은 **속 내용을 따라가지 않는다** ────────────────────────
// 2026-08-16 실측 사고. `main` 이 `margin:0 auto` 만 갖고 있으면 그리드 칸 안에서 stretch 가
// 꺼져 폭이 **속 내용의 max-content** 로 정해진다. 그러면 화면 안에서 접힌 절을 하나 펴는
// 것만으로 본문이 995 → 1048 로 넓어지고, 그 폭에서 타일 줄이 한 줄에 안 들어가면
// 줄바꿈이 생겨 세로 길이가 툭 튄다(94 → 197). 사용자가 「토글을 열면 세로 길이가 갑자기
// 바뀐다」고 잡은 것이 이것이다. `width:100%` 한 줄이 그것을 없앤다.
//
// 이 항목은 규칙이 아니라 **효과**를 잰다 — 좁은 내용과 넓은 내용에서 본문 폭이 같은지 본다.
await page.setViewportSize({ width: 1200, height: 900 });
await login('#' + 긴칸);
{
  // 🔴 넓은 상자를 끼워 넣어 재면 안 된다. `1fr` 은 `minmax(auto,1fr)` 이라 **줄어들 수 없는**
  //    자식(고정 폭 div)은 칸 자체를 밀어 넓힌다 — 그러면 규칙이 있든 없든 둘이 같아진다.
  //    스텁 화면은 `<h1>` 하나뿐이라 max-content 가 아주 좁다. 그래서 **칸 폭과 본문 폭을
  //    직접 맞대는 것**이 가장 곧다: 규칙이 없으면 본문이 글자 폭까지 쪼그라든다.
  const 폭들 = await page.evaluate(() => {
    const app = document.querySelector('#app').getBoundingClientRect();
    const nav = document.querySelector('#nav').getBoundingClientRect();
    return { 본문: Math.round(document.querySelector('#main').getBoundingClientRect().width),
             칸: Math.round(app.width - nav.width),
             gutter: getComputedStyle(document.documentElement).scrollbarGutter };
  });
  ok('본문이 칸을 꽉 채운다 — 속 내용 폭을 따라가면 토글마다 세로가 튄다',
     폭들.본문 === 폭들.칸, `본문 ${폭들.본문} / 칸 ${폭들.칸}`);
  // 🔴 위 `scrollbar-gutter` 항목과 같은 이유로 **규칙이 있는지만 본다** — headless 는
  //    오버레이 스크롤바라 자리를 안 먹어서 효과를 잴 수 없다. 사용자 PC 의 윈도우 크롬에서는
  //    절을 펴서 문서가 길어지는 순간 스크롤바가 나며 본문이 15px 좁아진다.
  ok('문서가 스크롤바 자리를 늘 비워 둔다 (효과는 이 환경에서 못 잼)',
     폭들.gutter === 'stable', 폭들.gutter);
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
// 🔴 2026-08-16 에 **재는 대상이 바뀌었다.** 전에는 `#main` 의 **글자 수**를 봤는데,
//    그건 표시가 「불러오는 중…」 이라는 **글자였던 시절의 대용품**이다. 지금 표시는
//    도는 그림 하나(`.ld`)라 글자가 0이고, 그대로 뒀으면 화면은 멀쩡한데 검사만 빨개진다.
//    이 항목이 뜻하는 것은 "빈 화면을 두지 않는다" 이지 "글자가 있다" 가 아니므로
//    **표시 요소 자체**를 본다. (탭바 폭 검사의 `outWidth < navWidth / 2` 를 걷어낸 것과
//    같은 자리다 — 대용품을 완화하는 게 아니라 뜻하는 것을 그대로 재는 쪽으로 바꾼다.)
//
// 🔴 그리고 **「200ms 안에 오면 안 띄운다」가 규칙이 됐다** (2026-08-16 사용자 확정).
//    빠른 화면에서 표시가 깜빡 하고 지나가는 것을 없애려는 것인데, 그 규칙은 **지금까지
//    아무도 안 보고 있었다.** 그래서 한 항목을 둘로 가른다 — 이르면 아직 없어야 하고,
//    늦으면 반드시 있어야 한다. 셸의 `LD_DELAY`(200)를 바꾸면 아래 두 시점도 같이 바꾼다.
{
  await page.evaluate((x) => { location.hash = '#' + x; }, 느린칸);
  // ⓐ 지연 안쪽. 120 은 200 에서 넉넉히 떨어져 있으면서 첫 렌더보다는 뒤다.
  await page.waitForTimeout(120);
  const 이른 = await page.locator('#main .ld').count();
  ok('200ms 안에는 로딩 표시를 안 띄운다', 이른 === 0, '.ld ' + 이른 + '개');
  // ⓑ 지연을 넘긴 뒤. 응답을 700ms 늦춰 뒀으므로 이 시점엔 반드시 떠 있어야 한다.
  await page.waitForTimeout(230);   // 누적 350ms
  ok('지연을 넘기면 로딩 표시가 뜬다', await page.locator('#main .ld').count() === 1,
     '.ld ' + (await page.locator('#main .ld').count()) + '개');
  // ⓒ 🔴 **그림만으로는 절반이다.** 눈으로 안 보는 사람에게는 도는 그림이 빈 화면과 같다.
  //    셸이 `.sr`(1px + clip)로 넣은 「불러오는 중」 이 같이 있어야 한다.
  //    `opacity:0` 인 보통 글자로 바꿔도 이 검사는 통과한다 — 그래서 통과가 접근성을
  //    증명하지는 않는다. 여기서 무는 것은 **글자가 DOM 에 있다**는 것까지다.
  const 낭독 = (await page.textContent('#main')).trim();
  ok('화면 낭독기에 읽힐 글자가 같이 있다', 낭독.length > 0, 낭독.slice(0, 20));
  await page.waitForFunction(() => document.querySelector('#main h1'));
  ok('다 불러오면 그 자리가 화면으로 갈린다', await page.textContent('#t') === 느린칸,
     await page.textContent('#t'));
}

// ── ⑧ iframe 화면은 안쪽이 다 그려질 때까지 덮는다 ──────────────────────────
// 🔴 `lib/asset.ts` 의 다섯 장은 기다림이 **두 번**이다. 서버가 저장소에서 문서를 읽어
//    오는 시간(위 ⑦ 이 덮는 구간)과, 그 문서가 자기 스타일·스크립트를 다 도는 시간이다.
//    2026-08-16 이전에는 뒤쪽이 맨몸이라 **흰 화면이 지나갔다**(사용자 확정으로 덮는다).
//
// 🔴 **한 판으로는 못 잰다. 두 판이 서로 다른 것을 본다** (2026-08-16 검사관 ②).
//    ⑧-a `src` + 서버 지연 — 창이 600ms 열려 있어 **덮개의 생김새**(가리는가·비치는가)를
//         잴 수 있다. 시간을 브라우저 밖에서 잡으므로 러너 속도와 무관하다.
//         (첫 판은 iframe 안 바쁜 루프로 끌었는데 **로컬만 초록이고 CI 는 빨간불**이었다 —
//          `load` 가 먼저 나서 덮개가 걷힌 뒤를 보고 있었다.)
//    ⑧-b `srcdoc` — **운영이 실제로 쓰는 방식.** 네트워크 왕복이 없어 `load` 가 아주
//         이르게 날 수 있다. 창을 못 여니 **생김새 대신 사건**을 본다 — 덮개가 한 번이라도
//         붙었는지를 MutationObserver 의 addedNodes 로 기록한다(붙자마자 걷혀도 남는다).
//         ⚠️ **이 판이 무는 것과 안 무는 것을 분명히 해 둔다.** 무는 것은 「srcdoc 경로에도
//         덮개가 실제로 붙었다가 걷힌다」 뿐이다. 「load 가 리스너보다 먼저 나지 않는다」는
//         **못 문다** — 리스너 부착을 한 차례(setTimeout 0) 늦추는 변이를 넣어도 안 깨졌다
//         (2026-08-16 실측). 그 축은 이 검사가 아니라 브라우저의 이벤트 차례가 보장한다.
//         이름을 그렇게 붙이면 안 재는 것을 잰다고 말하는 셈이라 좁혀 적었다.
//    두 판 모두 운영이 같이 보내는 style 을 그대로 싣는다. 안 실으면 iframe 이 기본
//    300×150 이라, 여백이 남아 있는 main 이 덮는 그림을 재게 되어 운영 기하와 달라진다.
const 운영스타일 = '<style>main{padding:0;margin:0;max-width:none}'
  + '.doc{display:block;width:100%;height:100vh;border:0;background:#fff}</style>';

{ // ⑧-a  src + 서버가 늦게 준다 → 덮개의 생김새를 잰다
  await page.route('**/ops/slowdoc.html', async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><h1>doc</h1>' });
  });
  await page.route('**/functions/v1/**/view/s03', (route) => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<iframe class="doc" src="slowdoc.html"></iframe>' + 운영스타일,
  }));
  await page.evaluate(() => { location.hash = '#s03'; });
  await page.waitForSelector('#main iframe.doc');
  const 덮개수 = await page.locator('#main .ld-ov').count();
  ok('iframe 이 들어온 직후에도 덮개가 있다', 덮개수 === 1, '.ld-ov ' + 덮개수 + '개');
  // 덮개는 **가려야** 뜻이 있다. 자리만 잡고 투명하면 흰 화면이 그대로 보인다.
  // 🔴 없을 때 던지지 않는다 — 첫 판이 `getComputedStyle(null)` 로 스크립트를 통째로
  //    죽여서, 뒤에 남은 두 항목이 판정도 못 받고 사라졌다(2026-08-16).
  const 덮개모양 = await page.evaluate(() => {
    const o = document.querySelector('#main .ld-ov');
    const f = document.querySelector('#main iframe.doc');
    if (!o || !f) return { 없음: true };
    const c = getComputedStyle(o), r = o.getBoundingClientRect(), b = f.getBoundingClientRect();
    return { bg: c.backgroundColor, iframe: Math.round(b.width) + 'x' + Math.round(b.height),
             안가림: r.width < b.width - 1 || r.height < b.height - 1 };
  });
  ok('덮개가 iframe 을 다 가리고 배경이 비치지 않는다',
     !덮개모양.없음 && !덮개모양.안가림 && 덮개모양.bg !== 'rgba(0, 0, 0, 0)',
     JSON.stringify(덮개모양));
  const 걷힘 = await page.waitForFunction(() => !document.querySelector('#main .ld-ov'),
    null, { timeout: 5000 }).then(() => true).catch(() => false);
  ok('안쪽이 다 그려지면 덮개가 걷힌다', 걷힘, 걷힘 ? '걷힘' : '5초 안에 안 걷혔다');
  await page.unroute('**/functions/v1/**/view/s03');
  await page.unroute('**/ops/slowdoc.html');
}

{ // ⑧-b  srcdoc — 운영과 같은 방식. 창이 없으니 사건으로 본다
  const 안쪽 = '<!doctype html><meta charset="utf-8"><h1>doc</h1>';
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  await page.route('**/functions/v1/**/view/s04', (route) => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<iframe class="doc" sandbox="allow-scripts" srcdoc="' + esc(안쪽) + '"></iframe>' + 운영스타일,
  }));
  // 붙었다가 같은 차례에 걷혀도 기록이 남게 **추가된 노드**로 잡는다.
  // (콜백 시점에 DOM 을 다시 보면 이미 걷힌 뒤라 못 본다.)
  await page.evaluate(() => {
    window.__덮개붙음 = false;
    new MutationObserver((recs) => {
      for (const r of recs) {
        for (const n of r.addedNodes) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('ld-ov')) window.__덮개붙음 = true;
        }
      }
    }).observe(document.querySelector('#main'), { childList: true, subtree: true });
  });
  await page.evaluate(() => { location.hash = '#s04'; });
  await page.waitForSelector('#main iframe.doc');
  await page.waitForFunction(() => !document.querySelector('#main .ld-ov'), null, { timeout: 5000 })
    .catch(() => {});
  ok('srcdoc 판에서도 덮개가 실제로 붙는다',
     await page.evaluate(() => window.__덮개붙음), '');
  ok('srcdoc 판에서도 덮개가 끝내 걷힌다',
     (await page.locator('#main .ld-ov').count()) === 0,
     '.ld-ov ' + (await page.locator('#main .ld-ov').count()) + '개');
  await page.unroute('**/functions/v1/**/view/s04');
}

// ── ⑨ 브랜드색을 칠하는 자리가 저쪽 저장소의 목록과 같다 ────────────────────
// 🔴 **한 이름이 저장소를 건넌다.** 허락된 자리의 정본은 career-coach 의
//    `lib/tokens.ts` 의 `BRAND_USES` 이고, 어드민 「디자인 시스템」 화면이 그것을 그려
//    "쓰도록 허락된 자리는 2곳" 이라고 **사람에게 말한다.** 그런데 실제로 칠하는 두 자리는
//    **이 파일이 아니라 이 저장소의 `ops/index.html` 에 있다.**
//    이어 주는 것이 없으면 저 화면은 여기서 뭘 하든 계속 "2곳" 이라고 말한다 —
//    2026-08-16 에 검사관이 "드리프트가 없어진 게 아니라 저장소 경계 위로 한 칸
//    옮겨졌을 뿐" 이라고 짚은 그 자리다.
//
// 🔴 **저쪽 파일을 읽을 수는 없다**(다른 저장소이고 비공개다). 그래서 목록의 사본을 여기
//    두고, 사본이 실제 CSS 와 어긋나면 빨간불을 낸다. `harness.mjs` 의 `TOKENS_STUB` 이
//    같은 방식이다 — 사본을 없앨 수는 없고, **조용히** 어긋나는 것만 막는다.
//    저쪽도 자기 몫(이 저장소 밖으로 새는 것)을 `tests/test_admin_design.py` 로 문다.
//
// ⚠️ 여기를 고쳐야 할 일이 생겼으면 **저쪽 BRAND_USES 도 같이 고치고 사용자에게 알린다** —
//    career-coach `CLAUDE.md` 의 「디자인 시스템 화면이 낡게 되는 변경은 항상 알린다」.
{
  const 허락된자리 = ['nav a.on::before', '.ld-art circle'];   // ← career-coach BRAND_USES 의 사본
  const 원문 = fs.readFileSync(new URL('../../ops/index.html', import.meta.url), 'utf-8');
  // 🔴 파일 전체를 문자열로 뒤지지 않는다. 이 파일의 주석에도 `--adm-brand` 가 적혀 있어서
  //    그렇게 세면 **산문이 위반으로 잡힌다**(저쪽 test_admin_design.py 가 같은 이유로
  //    CSS 구역만 본다). style 태그 안만 보고, 그 안의 주석도 먼저 뗀다.
  const css = [...원문.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const 칠하는자리 = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[2].includes('var(--adm-brand)'))
    .map((m) => m[1].trim().replace(/\s+/g, ' '))
    .sort();
  const 같다 = JSON.stringify(칠하는자리) === JSON.stringify([...허락된자리].sort());
  ok('브랜드색을 칠하는 자리가 career-coach 의 BRAND_USES 와 같다', 같다,
     같다 ? 칠하는자리.join(' · ')
          : `기록 [${[...허락된자리].sort().join(' · ')}] / 실제 [${칠하는자리.join(' · ')}]`);
}

await browser.close();
server.close();
마무리();
