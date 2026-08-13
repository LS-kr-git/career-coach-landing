// 세션 이어가기 확인 — 함수는 스텁으로 대신한다.
//   node tools/ops-audit/session.mjs
//
// 보는 것: 만료돼도 로그인 화면으로 안 떨어지는가 · 브라우저를 껐다 켜도 이어지는가 ·
//          갱신이 한 번만 도는가 · 7일이 지나면(갱신 401) 로그인으로 돌아가는가 · 로그아웃.
//
// 🔴 pre-push 훅에 안 달려 있다 — 이유는 route.mjs 머리말에 적었다.
import { 서버열기, 브라우저열기, 검사기 } from './harness.mjs';

const { server, origin } = await 서버열기();

// 진짜 화면 이름을 쓰지 않는 이유는 `route.mjs` 의 같은 자리 주석에 있다 (공개 저장소).
const NAV = [{ id: 's01', title: '가나다 라마바', group: '묶음 하나', order: 5 }];

// 스텁 상태 — 테스트가 조종한다
// 🔴 `살아있는갱신토큰` 은 장식이 아니다. 진짜 GoTrue 는 갱신 토큰을 **회전**시켜서
//    낡은 것을 401 로 거절한다. 스텁이 본문을 안 보고 무조건 200 을 주면, 탭이 둘일 때
//    낡은 토큰으로 서로를 죽이는 사고(⑧)가 스텁 안에서는 일어날 수 없고 그 검사는
//    셸의 방어를 통째로 걷어내도 초록이다 — 실제로 그랬다(검사관 지적, 변이로 재현됨).
const S = { good: 'A1', refreshCount: 0, loginCount: 0, refreshMode: 'ok',
            logoutCount: 0, logoutMode: 'ok', logoutBearer: null,
            살아있는갱신토큰: 'R1', 회전: 1 };

const browser = await 브라우저열기();
const ctx = await browser.newContext();
const page = await ctx.newPage();

await ctx.route('**/functions/v1/**', async (route) => {
  const req = route.request();
  const u = new URL(req.url());
  const bearer = (req.headers()['authorization'] || '').replace('Bearer ', '');

  if (u.pathname.endsWith('/auth/login')) {
    S.loginCount++;
    S.살아있는갱신토큰 = 'R1'; S.회전 = 1;
    return route.fulfill({ json: { access_token: S.good, refresh_token: 'R1', user: { email: 'a@b.c' } } });
  }
  if (u.pathname.endsWith('/auth/logout')) {
    S.logoutCount++;
    S.logoutBearer = bearer;
    if (S.logoutMode === 'fail') return route.fulfill({ status: 502, json: { error: '세션을 끊지 못했습니다' } });
    if (bearer !== S.good) return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
    return route.fulfill({ json: { ok: true } });
  }
  if (u.pathname.endsWith('/auth/refresh')) {
    S.refreshCount++;
    if (S.refreshMode === 'abort') return route.abort('failed');      // 네트워크가 끊겼다
    if (S.refreshMode === '500') return route.fulfill({ status: 500, json: { error: 'boom' } });
    if (S.refreshMode === '401') return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
    // 회전 — 낡은(이미 쓴) 갱신 토큰은 거절한다. 진짜 GoTrue 가 그렇게 한다.
    let 낸것 = null;
    try { 낸것 = JSON.parse(req.postData() || '{}').refresh_token || null; } catch { /* 깨진 본문 = 낡은 것과 같다 */ }
    if (낸것 !== S.살아있는갱신토큰) return route.fulfill({ status: 401, json: { error: 'used refresh token' } });
    // 🔴 액세스 토큰도 같이 회전시킨다. 매번 같은 'A2' 를 돌려주면 앞서 갱신한 탭의 토큰이
    //    뒤 갱신 뒤에도 우연히 유효해서, 뒤 탭이 갱신 토큰을 쓸 일이 없어진다 —
    //    그러면 ⑧ 은 방어를 셋 다 걷어내도 초록이다(직접 변이로 확인).
    S.회전 += 1;
    S.살아있는갱신토큰 = 'R' + S.회전;
    S.good = 'A' + S.회전;
    return route.fulfill({ json: { access_token: S.good, refresh_token: S.살아있는갱신토큰, user: { email: 'a@b.c' } } });
  }
  // 여기부터는 토큰을 본다 — 낡은 토큰이면 401 (= 한 시간이 지난 상태)
  if (bearer !== S.good) return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
  if (u.pathname.endsWith('/bootstrap')) {
    return route.fulfill({ json: { user: { email: 'a@b.c' }, nav: NAV } });
  }
  return route.fulfill({ body: '<h1 id="t">오류 리포트</h1>', contentType: 'text/html; charset=utf-8' });
});

const { ok, 마무리 } = 검사기();
const 저장된값 = () => page.evaluate(() => JSON.parse(localStorage.getItem('ops_session') || 'null'));

/** 저장된 세션을 비우고 새로 로그인한다. 안 비우면 앞 검사가 남긴 세션으로 앱이 바로 열려
 *  로그인 폼이 안 뜨고, 그 검사는 "왜 안 되지" 로 시간을 먹는다. */
async function 새로로그인() {
  // 🔴 지우는 것과 문서가 뜨는 것 사이에 경합이 있다. 앞 화면의 갱신이 아직 날고 있으면
  //    `keep()` 이 clear 직후에 토큰을 다시 써서, 새 문서가 그 세션으로 바로 열린다
  //    (= 로그인 폼이 안 뜨고 이 도우미가 멎는다). 로그인 폼이 보일 때까지 다시 지운다.
  for (let i = 0; i < 5; i++) {
    await page.goto(origin + '/ops/?r=' + Math.random() + '#s01');
    await page.evaluate(() => localStorage.clear());
    await page.goto(origin + '/ops/?r=' + Math.random() + '#s01');
    if (await page.isVisible('#login')) break;
    await page.waitForTimeout(200);
  }
  await page.waitForSelector('#login', { state: 'visible', timeout: 5000 });
  await page.fill('#email', 'a@b.c'); await page.fill('#pw', 'x'); await page.click('#go');
  await page.waitForSelector('#main h1');
}

// ① 로그인하면 토큰 쌍이 localStorage 에 남는다 (탭을 닫아도 살아 있어야 한다)
await page.goto(origin + '/ops/#s01');
await page.fill('#email', 'a@b.c'); await page.fill('#pw', 'x'); await page.click('#go');
await page.waitForSelector('#main h1');
let v = await 저장된값();
ok('로그인 → 토큰 쌍이 localStorage 에', v && v.access_token === 'A1' && v.refresh_token === 'R1', JSON.stringify(v));

// ② 액세스 토큰이 만료되면 **로그인 화면으로 안 가고** 조용히 이어간다
S.good = 'EXPIRED';                       // 서버가 지금 토큰을 거부하기 시작
S.refreshCount = 0;
await page.click('nav a[data-id="s01"]');   // 활성 탭 재클릭 = 재요청
await page.waitForFunction(() => localStorage.getItem('ops_session')?.includes('A2'), null, { timeout: 5000 })
  .catch(() => {});
v = await 저장된값();
ok('만료 → 자동 갱신', S.refreshCount === 1 && v && v.access_token === 'A2', `갱신 ${S.refreshCount}회 ${JSON.stringify(v)}`);
ok('만료 → 로그인 화면으로 안 떨어진다', !(await page.isVisible('#login')));
ok('만료 → 화면이 그대로 보인다', await page.isVisible('#main h1'));

// ③ 브라우저를 껐다 켠 것과 같은 상황 — 액세스 토큰만 버리고 새로 연다
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('ops_session'));
  localStorage.setItem('ops_session', JSON.stringify({ access_token: '', refresh_token: s.refresh_token }));
});
S.refreshCount = 0; S.loginCount = 0;
// 🔴 같은 URL 로 goto 하면 **문서가 다시 안 뜬다**(해시만 같은 문서 내 이동).
//    그러면 이 검사는 앞 상태를 그대로 보고 조용히 통과한다 — 실제로 한 번 그랬다.
await page.goto(origin + '/ops/?r=' + Math.random() + '#s01');
await page.waitForSelector('#main h1', { timeout: 5000 }).catch(() => {});
ok('껐다 켜도 이어진다 (로그인 안 함)',
   await page.isVisible('#main h1') && S.loginCount === 0 && S.refreshCount === 1,
   `로그인 ${S.loginCount}회 · 갱신 ${S.refreshCount}회`);

// ④ 동시에 여러 요청이 401 을 만나도 갱신은 한 번만 — 회전 토큰을 서로 무효화하면 안 된다
S.good = 'EXPIRED2'; S.refreshCount = 0;
await page.evaluate(() => Promise.allSettled([
  window.ops.call('/view/s01'), window.ops.call('/view/s01'),
  window.ops.call('/view/s01'), window.ops.call('/view/s01'),
]));
ok('동시 4건 → 갱신 1회', S.refreshCount === 1, `${S.refreshCount}회`);

// ⑤ 7일이 지나면(함수가 갱신을 401 로 거절) 로그인 화면으로 돌아가고 저장된 값이 지워진다
S.refreshMode = '401'; S.good = 'EXPIRED3';
await page.evaluate(() => window.ops.call('/view/s01').catch(() => {}));
await page.waitForSelector('#login', { state: 'visible', timeout: 5000 }).catch(() => {});
ok('7일 초과 → 로그인 화면', await page.isVisible('#login'));
ok('7일 초과 → 저장된 세션 삭제', (await 저장된값()) === null);

// ⑥ 일시 고장(네트워크 끊김)은 **만료가 아니다** — 저장된 세션을 지우면 안 된다
S.refreshMode = 'ok'; S.good = 'A9';
await 새로로그인();
S.good = 'EXPIRED4'; S.refreshMode = 'abort';
const 오류1 = await page.evaluate(() => window.ops.call('/view/s01').then(() => '', (e) => String(e.message)));
ok('네트워크 끊김 → 세션을 안 지운다', (await 저장된값()) !== null, JSON.stringify(await 저장된값()));
ok('네트워크 끊김 → 만료라고 말하지 않는다', 오류1.includes('닿지 못했'), 오류1);

// ⑦ 함수 500 도 마찬가지 (refresh 안에서 DB 를 치므로 실제로 날 수 있다)
S.refreshMode = '500';
const 오류2 = await page.evaluate(() => window.ops.call('/view/s01').then(() => '', (e) => String(e.message)));
ok('함수 500 → 세션을 안 지운다', (await 저장된값()) !== null);
ok('함수 500 → 만료라고 말하지 않는다', 오류2.includes('닿지 못했'), 오류2);

// ⑧ 탭이 둘일 때 회전한 토큰이 서로를 죽이지 않는다
S.refreshMode = 'ok'; S.good = 'A10';
const 탭A = page;
const 탭B = await ctx.newPage();
await 탭B.goto(origin + '/ops/?r=' + Math.random() + '#s01');
await 탭B.waitForSelector('#main h1', { timeout: 5000 }).catch(() => {});
// A 가 갱신해 토큰이 회전한다
S.good = 'EXPIRED5';
await 탭A.evaluate(() => window.ops.call('/view/s01').catch(() => {}));
// 🔴 희생자는 **A** 다. B 가 먼저 갱신해 토큰이 회전했으므로, 방어가 없으면 A 는 낡은
//    갱신 토큰을 내밀고 401 을 받아 "만료" 로 읽고 공유 키를 지운다. B 만 보면 이 사고를
//    못 본다 — B 는 그 뒤 스스로 갱신해 값을 되살려 놓기 때문이다(직접 변이로 확인).
ok('탭 A 가 뒤늦게 갱신해도 세션을 안 잃는다', (await 탭A.evaluate(() => localStorage.getItem('ops_session'))) !== null);
ok('탭 A 도 로그인 화면으로 안 간다', !(await 탭A.isVisible('#login')));
// B 는 아직 옛 토큰을 들고 있다. B 가 요청하면?
await 탭B.evaluate(() => window.ops.call('/view/s01').catch(() => {}));
ok('탭 B 가 탭 A 의 세션을 안 지운다', (await 탭B.evaluate(() => localStorage.getItem('ops_session'))) !== null,
   String(await 탭B.evaluate(() => localStorage.getItem('ops_session'))).slice(0, 60));
ok('탭 B 도 로그인 화면으로 안 간다', !(await 탭B.isVisible('#login')));
await 탭B.close();

// ⑨ 로그아웃 — 서버 세션까지 끊고, 저장된 값을 지우고, 로그인 화면으로
S.refreshMode = 'ok'; S.good = 'B1'; S.logoutMode = 'ok'; S.logoutCount = 0;
await 새로로그인();
await page.click('#nav .out');
await page.waitForSelector('#login', { state: 'visible', timeout: 5000 }).catch(() => {});
ok('로그아웃 → 서버 세션도 끊는다', S.logoutCount === 1, `${S.logoutCount}회`);
ok('로그아웃 → 저장된 세션 삭제', (await 저장된값()) === null);
ok('로그아웃 → 로그인 화면', await page.isVisible('#login'));
ok('로그아웃 → 조용하다 (오류문 없음)', (await page.textContent('#err')).trim() === '',
   await page.textContent('#err'));

// ⑩ 액세스 토큰이 만료된 채 눌러도 — 한 번 이어 본 뒤 끊는다
S.good = 'B2'; S.logoutCount = 0; S.refreshCount = 0;
await 새로로그인();
S.good = 'EXPIRED9';                       // 로그아웃도 401 을 내게 된다
await page.click('#nav .out');
await page.waitForSelector('#login', { state: 'visible', timeout: 5000 }).catch(() => {});
ok('만료 상태로 로그아웃 → 갱신 뒤 다시 끊는다', S.logoutCount === 2 && S.refreshCount === 1,
   `로그아웃 ${S.logoutCount}회 · 갱신 ${S.refreshCount}회`);
ok('만료 상태로 로그아웃 → 저장된 세션 삭제', (await 저장된값()) === null);
// 두 번째 로그아웃이 **갱신한** 토큰으로 갔는가. 낡은 토큰으로 다시 보내면 서버 세션은
// 안 끊기는데 화면만 로그인으로 돌아가 "끊었다" 로 보인다.
ok('만료 상태로 로그아웃 → 두 번째는 새 토큰으로 간다', S.logoutBearer === S.good,
   `보낸 것 ${S.logoutBearer} · 유효한 것 ${S.good}`);

// ⑪ 서버 세션을 못 끊으면 **그 사실을 말한다** — 로컬은 그래도 지운다
S.good = 'B3'; S.logoutMode = 'fail'; S.logoutCount = 0;
await 새로로그인();
await page.click('#nav .out');
await page.waitForSelector('#login', { state: 'visible', timeout: 5000 }).catch(() => {});
ok('못 끊으면 → 로컬은 지운다', (await 저장된값()) === null);
ok('못 끊으면 → 조용히 넘어가지 않는다', (await page.textContent('#err')).includes('서버 세션을 못 끊'),
   await page.textContent('#err'));

// ⑫ 연타해도 한 번만 나간다 — 두 번째가 401 을 받아 "못 끊었다" 로 오해되면 안 된다
S.good = 'B4'; S.logoutMode = 'ok'; S.logoutCount = 0;
await 새로로그인();
await page.evaluate(() => { const o = document.querySelector('#nav .out'); o.click(); o.click(); o.click(); });
await page.waitForSelector('#login', { state: 'visible', timeout: 5000 }).catch(() => {});
ok('연타해도 로그아웃은 한 번', S.logoutCount === 1, `${S.logoutCount}회`);
ok('연타해도 오류문이 안 뜬다', (await page.textContent('#err')).trim() === '', await page.textContent('#err'));

await browser.close();
server.close();
마무리();
