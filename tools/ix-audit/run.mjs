// 인터렉션 기록 배선 점검 (2026-10-20 사용자 지시 — 「이런 문제가 앞으로 다시 재발하지 않도록」).
//
// 랜딩 첫 화면을 바꾸면서 손 조작을 기록하는 코드가 빠졌고, 어드민은 그 섹션 인터렉션을 아무 경고 없이 안 보였다.
// page-audit 의 「인터렉션 기록 빈자리」는 마크업의 선언(data-ix)만 본다 — 기록 코드가 실제로 그 열쇠를 보내는지는
// 돌려 봐야 안다. 그래서 여기서는 진짜 화면을 열고, data-ix 칸마다 열쇠에 맞는 손 조작을 한 번씩 한 뒤,
// 화면을 떠날 때 나가는 landing_engage 기록에 **선언한 열쇠가 전부 실렸는지** 본다.
// 기록은 운영으로 안 나간다 — 바깥 요청은 전부 여기서 받아 버린다.
//
//   node tools/ix-audit/run.mjs          (playwright 가 없으면 건너뛴다 — CI 에서는 실패로 센다)
//
// 새 열쇠 모양을 만들면 아래 「손」에 그 열쇠를 건드리는 법을 더한다. 모르는 열쇠는 실패로 센다.
import { 서버열기, 브라우저열기, 검사기 } from '../ops-audit/harness.mjs';

const { server, origin } = await 서버열기();
const 브라우저 = await 브라우저열기();
const { ok, 마무리 } = 검사기();
const 쪽 = await 브라우저.newPage({ viewport: { width: 360, height: 740 } });
const 보냄 = [];
// 기록은 운영 주소에서만 나가므로(track.js onSite) 운영 주소로 열고 내용은 이 저장소에서 내준다.
await 쪽.route(/^https:\/\/careercoach\.my\//, async (r) => {
  const u = new URL(r.request().url());
  const res = await fetch(origin + u.pathname + u.search);
  await r.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'text/html' }, body: Buffer.from(await res.arrayBuffer()) });
});
await 쪽.route((u) => !u.href.startsWith('https://careercoach.my/'), async (r) => {
  const d = r.request().postData();
  if (d) 보냄.push(d);
  await r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
// 자동화 브라우저는 기록을 안 보낸다(track.js) — 이 점검에서만 그 표시를 끈다.
await 쪽.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
const 오류 = [];
쪽.on('pageerror', (e) => 오류.push(e.message));
await 쪽.goto('https://careercoach.my/', { waitUntil: 'load' });
await 쪽.waitForTimeout(1500);

// scrollIntoView 는 랜딩의 부드러운 스크롤(scroll-behavior)에 끊겨 제자리에 남는 때가 있다 — 바로 옮기고 잠깐 기다린다.
const 가운데로 = async (loc) => {
  await loc.evaluate((e) => window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - (innerHeight - e.offsetHeight) / 2, behavior: 'instant' }));
  await 쪽.waitForTimeout(400);
};
const 옆으로 = async (loc) => {
  const b = await loc.boundingBox();
  await 쪽.mouse.move(b.x + b.width / 2, b.y + Math.min(60, b.height / 2));
  await 쪽.mouse.wheel(b.width, 0);
};
// 열쇠마다 그 기록을 일으키는 손 조작. 칸(data-ix 를 단 요소) 안에서만 한다.
const 손 = [
  [/job$/, async (칸) => { const c = 칸.locator('.chip:not(.on)').nth(1); await 가운데로(c); await c.click(); }],
  [/card$/, async (칸) => { const s = 칸.locator('.swipe'); await 가운데로(s); await 옆으로(s); await 쪽.waitForTimeout(900); }],
  [/more$/, async (칸) => {
    const 단추 = 칸.locator('.mbtn'), n = await 단추.count();
    for (let i = 0; i < n; i++) if (await 단추.nth(i).isVisible()) { await 가운데로(단추.nth(i)); await 단추.nth(i).click(); break; }
    await 쪽.waitForTimeout(900);
  }],
  [/^sal$/, async (칸) => {
    const r = 칸.locator('input[type=range]'); await 가운데로(r); await 쪽.waitForTimeout(2500);
    await r.focus(); for (let i = 0; i < 3; i++) await 쪽.keyboard.press('ArrowRight');
    await 쪽.waitForTimeout(1200);
  }],
  [/^faq$/, async (칸) => { const q = 칸.locator('summary').first(); await 가운데로(q); await q.click(); }],
  // 후기는 보이면 저절로 흐른다 — 들어오자마자 끌어서(손을 대면 흐름이 멈춘다) 그 자리보다 먼 묶음으로 넘긴다.
  [/^rv$/, async (칸) => {
    const 줄 = 칸.locator('.rvp'); await 가운데로(줄);
    const b = await 줄.boundingBox(); await 쪽.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    // 폰 폭에서는 화살표가 안 보인다 — 손가락으로 미는 것처럼 끈다(landing.js 의 끌기가 다음 묶음에 붙인다).
    await 쪽.mouse.down(); await 쪽.mouse.move(b.x + 20, b.y + b.height / 2, { steps: 8 }); await 쪽.mouse.up();
    await 쪽.waitForTimeout(1200);
  }],
];

const 칸들 = await 쪽.locator('#scr [data-ix]').evaluateAll((els) => els.map((e, i) => (e.dataset.ixAudit = String(i), e.dataset.ix)));
const 선언 = 칸들.flatMap((x) => x.split(/\s+/));
ok('기록 열쇠 칸이 있다', 칸들.length > 0, `${칸들.length}칸 · ${선언.join(' ')}`);
for (const [i, 열쇠들] of 칸들.entries()) {
  const 칸 = 쪽.locator(`[data-ix-audit="${i}"]`);
  for (const k of 열쇠들.split(/\s+/)) {
    const 법 = 손.find(([re]) => re.test(k));
    ok(`「${k}」를 건드리는 법을 안다`, !!법, 법 ? '' : 'tools/ix-audit/run.mjs 의 「손」에 더한다');
    if (법) await 법[1](칸).catch((e) => ok(`「${k}」 손 조작`, false, e.message.split('\n')[0]));
  }
}
await 쪽.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await 쪽.waitForTimeout(800);

const 기록 = 보냄.map((d) => { try { return JSON.parse(d); } catch { return null; } }).filter((j) => j?.p_name === 'landing_engage').pop();
const x = 기록?.p_props?.x ?? {};
ok('화면을 떠날 때 landing_engage 가 나간다', !!기록);
for (const k of 선언) ok(`선언한 「${k}」가 실제로 기록된다`, Array.isArray(x[k]) && x[k][0] >= 1 && x[k][1] >= 1, JSON.stringify(x[k] ?? null));
for (const k of Object.keys(x)) ok(`기록된 「${k}」가 마크업에 선언돼 있다`, 선언.includes(k));
ok('스크립트 오류가 없다', !오류.length, 오류.join(' / '));
await 브라우저.close(); server.close();
마무리();
