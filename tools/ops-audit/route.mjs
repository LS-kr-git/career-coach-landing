// ops 셸의 해시 라우팅 확인 — 함수는 스텁으로 대신한다.
//   node tools/ops-audit/route.mjs
//
// 🔴 pre-push 훅에 안 달려 있다. 일부러다.
//    이 검사는 크로미움 600MB 를 필요로 하는데 사용자 PC 3대 중 어디에 깔려 있는지 모른다.
//    훅에 달면 브라우저 없는 PC 에서 매번 막히고, 그러면 `--no-verify` 를 쓰게 된다 —
//    랜딩 훅에는 CC_SKIP_HOOK 같은 부분 우회가 없어서 그 순간 **검수 전체가 꺼진다**.
//    (career-coach/CLAUDE.md 에 같은 일이 이미 한 번 있었다고 적혀 있다.)
//    CI(공개 저장소라 무료)에서 돌리는 것이 이 검사의 자리다.
import { 서버열기, 브라우저열기, 검사기 } from './harness.mjs';

const { server, origin } = await 서버열기();

const NAV = [
  { id: 'errors', title: '오류 리포트', group: '운영', order: 5 },
  { id: 'cost', title: '비용·한도', group: '운영', order: 20 },
  { id: 'crawl', title: '공고 크롤링', group: '채용공고', order: 10 },
];

const browser = await 브라우저열기();
const page = await browser.newPage();
const viewed = [];
await page.route('**/functions/v1/**', async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname.endsWith('/auth/login')) {
    return route.fulfill({ json: { access_token: 'T', user: { email: 'a@b.c' } } });
  }
  if (u.pathname.endsWith('/bootstrap')) {
    return route.fulfill({ json: { user: { email: 'a@b.c' }, nav: NAV } });
  }
  const m = u.pathname.match(/\/view\/([a-z]+)$/);
  if (m) {
    viewed.push(m[1]);
    return route.fulfill({ body: `<h1 id="t">${m[1]}</h1>`, contentType: 'text/html; charset=utf-8' });
  }
  return route.fulfill({ status: 404, json: { error: 'nf' } });
});

const { ok, 마무리 } = 검사기();

/** 🔴 `isVisible('#login')` 로 한 번 보고 채우면 안 된다. 저장된 세션이 있으면 부팅 응답이
 *  도착하는 순간 폼이 사라지는데, 그 사이에 fill 이 걸리면 30초를 기다리다 죽는다
 *  (병렬로 셋을 돌렸더니 실제로 났다). 채우다 실패하면 부팅이 먼저 끝난 것으로 보고 넘어간다. */
async function login(hash) {
  await page.goto(origin + '/ops/?r=' + Math.random() + hash);
  for (let i = 0; i < 3; i++) {
    if (await page.locator('#main h1').count()) break;
    try {
      await page.fill('#email', 'a@b.c', { timeout: 2000 });
      await page.fill('#pw', 'x', { timeout: 2000 });
      await page.click('#go', { timeout: 2000 });
      break;
    } catch { /* 부팅이 먼저 끝났다 — 아래 waitForSelector 가 확인한다 */ }
  }
  await page.waitForSelector('#main h1');
}

// ① 옛 북마크(`#<함수>`) → 첫 화면으로 내려가고 주소가 맞춰진다
await login('#errors');
ok('옛 북마크 → 첫 화면', await page.textContent('#t') === 'errors', await page.textContent('#t'));
ok('주소가 맞춰진다', page.url().endsWith('#errors'), page.url());

// ② 탭을 누르면 주소가 바뀐다
await page.click('nav a[data-id="crawl"]');
await page.waitForFunction(() => document.querySelector('#t')?.textContent === 'crawl');
ok('탭 클릭 → 주소 변경', page.url().endsWith('#crawl'), page.url());
ok('탭 클릭 → 강조 이동', await page.getAttribute('nav a[data-id="crawl"]', 'class') === 'on');

// ③ 뒤로가기
await page.goBack();
await page.waitForFunction(() => document.querySelector('#t')?.textContent === 'errors');
ok('뒤로가기가 앞 화면을 되돌린다', page.url().endsWith('#errors'));
await page.goForward();
await page.waitForFunction(() => document.querySelector('#t')?.textContent === 'crawl');
ok('앞으로가기', page.url().endsWith('#crawl'));

// ④ 새로고침이 보던 화면을 지킨다 (세션 토큰이 남아 있다)
await page.reload();
await page.waitForSelector('#main h1');
ok('새로고침이 화면을 지킨다', await page.textContent('#t') === 'crawl', await page.textContent('#t'));

// ⑤ 딥링크 — 주소로 바로 들어간다
await page.goto(origin + '/ops/#cost');
await page.waitForSelector('#main h1');
ok('딥링크로 바로 열린다', await page.textContent('#t') === 'cost', await page.textContent('#t'));

// ⑥ 모르는 화면 id → 첫 화면으로 내리고 주소를 고친다. 없는 화면을 부르지 않는다
const before = viewed.length;
await page.goto(origin + '/ops/#zzz');
await page.waitForSelector('#main h1');
ok('모르는 id → 첫 화면', await page.textContent('#t') === 'errors', await page.textContent('#t'));
ok('모르는 id → 주소 정정', page.url().endsWith('#errors'), page.url());
ok('모르는 id 를 서버에 묻지 않는다', !viewed.slice(before).includes('zzz'), viewed.slice(before).join(','));

// ⑦ nav 앵커에 href 가 있다 (가운데 클릭 새 탭)
await login('#errors');
ok('nav 가 진짜 링크다', await page.getAttribute('nav a[data-id="cost"]', 'href') === '#cost');

// ⑧ 지금 열린 탭을 다시 눌러도 다시 불러온다 (해시가 안 바뀌어도)
await login('#cost');
const n0 = viewed.length;
await page.click('nav a[data-id="cost"]');
await page.waitForTimeout(300);
ok('활성 탭 재클릭 → 재요청', viewed.length > n0 && viewed.at(-1) === 'cost', viewed.slice(n0).join(','));

// ⑨ 모르는 화면 이름이면 그 사실을 말한다
await page.goto(origin + '/ops/?r=' + Math.random() + '#zzz');
await page.waitForSelector('#main h1');
const note = await page.textContent('#main .sub').catch(() => '');
ok('모르는 id → 안내문을 남긴다', note.includes('zzz'), note);

// ⑩ 옛 북마크 `#<함수이름>` → 첫 화면으로 열리고 주소가 새 형식으로 갈린다 (안내문 없이)
await page.goto(origin + '/ops/?r=' + Math.random() + '#ops-1udm1xmi');
await page.waitForSelector('#main h1');
ok('옛 북마크(함수이름만) → 첫 화면', await page.textContent('#t') === 'errors', await page.textContent('#t'));
ok('옛 북마크 → 주소가 새 형식으로', page.url().endsWith('#errors'), page.url());
ok('옛 북마크 → 안내문 없음', (await page.locator('#main .sub').count()) === 0);

// ⑪ 옛 딥링크 `#<함수이름>/<화면id>` → 그 화면이 열리고 주소가 갈린다
await page.goto(origin + '/ops/?r=' + Math.random() + '#ops-1udm1xmi/cost');
await page.waitForSelector('#main h1');
ok('옛 딥링크 → 그 화면', await page.textContent('#t') === 'cost', await page.textContent('#t'));
ok('옛 딥링크 → 주소가 새 형식으로', page.url().endsWith('#cost'), page.url());
// 함수 이름이 주소에서 사라졌는가 — **여기서** 봐야 한다. 함수 이름을 넣고 들어온 직후라
// 정규화가 없으면 그대로 남는다. 마지막에 두면 그 자리 주소에는 애초에 함수 이름이 없어서
// 무엇을 깨도 초록이다(검사관 지적, 변이로 재현됨).
ok('주소에 함수 이름이 없다', !page.url().includes('ops-1udm1xmi'), page.url());

// ⑫ 이메일이 nav 의 마지막이고 화면 아래쪽에 있다
await login('#errors');
const 끝두개 = await page.evaluate(() => [...document.querySelector('#nav').children].slice(-2).map((n) => n.className));
ok('nav 끝은 이메일 → 로그아웃 순서', JSON.stringify(끝두개) === JSON.stringify(['who', 'out']), JSON.stringify(끝두개));
const pos = await page.evaluate(() => {
  const w = document.querySelector('#nav .who').getBoundingClientRect();
  const o = document.querySelector('#nav .out').getBoundingClientRect();
  const n = document.querySelector('#nav').getBoundingClientRect();
  return { whoTop: Math.round(w.top), whoBottom: Math.round(w.bottom),
           outTop: Math.round(o.top), outBottom: Math.round(o.bottom),
           navBottom: Math.round(n.bottom), outWidth: Math.round(o.width), navWidth: Math.round(n.width) };
});
// 맨 아래는 로그아웃이고 이메일이 그 바로 위다. 둘이 한 덩어리로 바닥에 붙어 있어야 한다.
ok('이메일 → 로그아웃이 좌하단에 붙어 있다',
   pos.navBottom - pos.outBottom <= 24 && pos.outTop >= pos.whoBottom && pos.whoTop > 200,
   JSON.stringify(pos));

// ⑬ 로그아웃은 **버튼이 아니라 글자다** — 상자가 글자에 붙어 있고 밑줄이 있다
const 로그아웃꼴 = await page.evaluate(() => {
  const o = document.querySelector('#nav .out');
  const c = getComputedStyle(o);
  return { text: o.textContent, deco: c.textDecorationLine, size: c.fontSize, color: c.color,
           weight: c.fontWeight, bg: c.backgroundColor, radius: c.borderTopLeftRadius, tag: o.tagName };
});
ok('로그아웃에 밑줄이 있다', 로그아웃꼴.deco.includes('underline'), 로그아웃꼴.deco);
ok('로그아웃이 버튼 꼴이 아니다',
   로그아웃꼴.tag === 'A' && 로그아웃꼴.bg === 'rgba(0, 0, 0, 0)' && 로그아웃꼴.radius === '0px',
   JSON.stringify(로그아웃꼴));
ok('로그아웃이 낮은 위계다 (12px · 회색 · 굵지 않음)',
   로그아웃꼴.size === '12px' && 로그아웃꼴.color === 'rgb(142, 142, 147)' && Number(로그아웃꼴.weight) < 600,
   JSON.stringify(로그아웃꼴));
ok('클릭 상자가 글자에 붙어 있다 (줄 전체가 아니다)', pos.outWidth < pos.navWidth / 2,
   `${pos.outWidth} / ${pos.navWidth}`);

await browser.close();
server.close();
마무리();
