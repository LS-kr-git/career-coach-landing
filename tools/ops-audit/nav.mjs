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

// 🔴 스텁 목록은 **실제와 같은 성질**을 가져야 한다.
//    · 가장 긴 이름(「Unit Economics 시뮬레이터」)이 있어야 폭 검사가 뜻을 가진다.
//    · 칸이 충분히 많아야 짧은 화면에서 탭바가 스크롤된다 — 그게 ④ 검사의 전제다.
const NAV = [
  { id: 'errors', title: '오류 리포트', group: '운영', order: 10 },
  { id: 'cost', title: '비용 리포트', group: '운영', order: 20 },
  { id: 'crawl', title: '채용공고 크롤링', group: '채용공고', order: 10 },
  { id: 'jobscreen', title: '채용공고 정렬', group: '채용공고', order: 50 },
  { id: 'rank', title: '채용공고 발송 시뮬레이터', group: '채용공고', order: 60 },
  { id: 'isources', title: '인사이트 소스 수집', group: '인사이트 아티클', order: 10 },
  { id: 'ipick', title: '인사이트 소스 선별', group: '인사이트 아티클', order: 15 },
  { id: 'iprompt', title: '인사이트 아티클 생성', group: '인사이트 아티클', order: 30 },
  { id: 'bprice', title: 'Unit Economics 시뮬레이터', group: '비즈니스', order: 10 },
  { id: 'bshare', title: '시장 점유율별 기대매출', group: '비즈니스', order: 20 },
  { id: 'bretention', title: '리텐션/LTV 시뮬레이터', group: '비즈니스', order: 30 },
  { id: 'bmonitor', title: '경쟁사 모니터링', group: '시장·레퍼런스', order: 10 },
  { id: 'mbench24', title: '국내외 뉴스레터 2년 성과', group: '시장·레퍼런스', order: 20 },
  { id: 'mkrletter', title: '국내 뉴스레터 장기 성과', group: '시장·레퍼런스', order: 30 },
];
const IDS = NAV.map((p) => p.id);
const 긴칸 = 'bprice';   // 가장 긴 이름. 폭·줄바꿈 검사의 최악 조건이다.
const 끝칸 = 'mkrletter'; // 목록 맨 아래. 짧은 화면에서 스크롤 밖으로 나가는 칸이다.

const browser = await 브라우저열기();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

// 「불러오는 중」 을 볼 수 있어야 하므로 한 화면만 일부러 늦게 준다.
const 느린칸 = 'cost';
await page.route('**/functions/v1/**', async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname.endsWith('/auth/login')) {
    return route.fulfill({ json: { access_token: 'T', user: { email: 'a@b.c' } } });
  }
  if (u.pathname.endsWith('/bootstrap')) {
    return route.fulfill({ json: { user: { email: 'a@b.c' }, nav: NAV } });
  }
  const m = u.pathname.match(/\/view\/([a-z0-9]+)$/);
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
  await page.waitForSelector('#main h1');
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
    // 두 줄이 된 칸. 항목 한 줄은 22.4 + padding 14 ≈ 36 이라 37 을 넘으면 접힌 것이다.
    접힌칸: [...nav.querySelectorAll('a[data-id]')]
      .filter((a) => a.getBoundingClientRect().height > 37).map((a) => a.dataset.id),
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
const 접힘 = new Set();
for (const id of IDS) {
  await page.evaluate((x) => { location.hash = '#' + x; }, id);
  await page.waitForFunction((x) => document.querySelector('#nav a.on')?.dataset.id === x, id);
  const m = await 재기();
  폭.add(m.navW);
  m.접힌칸.forEach((x) => 접힘.add(x));
}
ok('어느 칸을 선택해도 탭바 폭이 같다', 폭.size === 1, [...폭].join(', '));
ok('어느 칸도 두 줄이 되지 않는다', 접힘.size === 0, [...접힘].join(', '));

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
  ok('짧은 화면에서도 두 줄이 안 된다', m.접힌칸.length === 0, m.접힌칸.join(', '));
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

// ── ⑥ 탭 제목 ─────────────────────────────────────────────────────────────
{
  const t1 = await page.title();
  ok('탭 제목에 지금 화면 이름이 있다', t1.startsWith('Unit Economics 시뮬레이터'), t1);
  ok('탭 제목에 서비스명이 있다', t1.includes('커리어코치'), t1);
  await page.evaluate((x) => { location.hash = '#' + x; }, 끝칸);
  await page.waitForFunction((x) => document.title.startsWith(x), '국내 뉴스레터 장기 성과');
  ok('화면을 옮기면 탭 제목도 따라간다', (await page.title()).startsWith('국내 뉴스레터 장기 성과'),
     await page.title());
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
