// 화면 전환 검사 — 구독자 화면의 내부 링크를 하나씩 눌러, 넘어가는 동안 **빈 화면이 끼는지** 본다.
//   node tools/transition-audit/run.mjs
//
// 왜 이 파일이 있나 (2026-10-15)
//   새 화면은 내용이 준비될 때까지 숨겨 두는데(assets/steady.js), 그 순간 전환을 건너뛰게 짜 두었더니
//   앞 화면 → 바탕만 있는 빈 화면 → 새 화면으로 두 번 바뀌었다. 사용자는 「앞 화면이 한 번 더 보이고
//   넘어간다」로 봤다(랜딩↔마이페이지). 고친 뒤 재 보니 같은 일이 링크 40개 중 39개에 있었다 —
//   한 곳만 보고 고쳤으면 몰랐다. 이 검사가 그 측정을 그대로 되풀이한다.
//
// 무엇을 보나: 링크마다 ① 눌러서 넘어갈 때 ② 브라우저 뒤로가기로 돌아올 때, 화면을 약 60장/초로 찍어
//   - 빈 화면: 출발·도착 화면엔 내용이 있는데 중간 한 장이 거의 한 색이다
//   - 되돌아감: 도착 화면에 닿은 뒤 다시 크게 달라진다
//   스켈레톤으로 스며드는 것·0.15초 페이드는 정상이라 세지 않는다.
//
// 훅에 안 단 이유는 tools/ops-audit 과 같다 — 크로미움이 필요하고, 이 저장소 훅엔 부분 우회가 없다.
// 크로미움이 없으면 건너뛴다(CI 에서만 실패). 5분 남짓 걸린다.
import fs from 'node:fs';
import path from 'node:path';
import { 서버열기, 브라우저열기, 검사기, 구독자화면 } from '../ops-audit/harness.mjs';

const STUB = fs.readFileSync(new URL('./stub-supabase.mjs', import.meta.url), 'utf8');
const T = 'AbCdEfGhIjKlMnOpQrStUv';   // 링크로 여는 화면의 토큰 모양만 맞춘 가짜 값
const 출발 = 구독자화면(T);
const 진행 = JSON.stringify({ jobs: ['퍼포먼스마케팅'], years: 2, yearsMax: 5, regions: ['서울'], topic: null, topicClear: false, pending: false, owner: 'u1' });

const { server, origin } = await 서버열기();
const browser = await 브라우저열기();
const { ok, 마무리 } = 검사기();

async function 새창() {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'text/javascript', body: STUB }));
  await ctx.route(/kakao|facebook|google|doubleclick|supabase\.co/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(origin + '/404.html');
  // 로그인한 회원 · 온보딩을 마친 상태 — 마이페이지까지 들어갈 수 있어야 링크가 다 보인다
  await page.evaluate((v) => {
    localStorage.setItem('sb-sxooygwggxeplzkfdbth-auth-token', JSON.stringify({ user: { id: 'u1' } }));
    localStorage.setItem('cc_onboarding', v);
  }, 진행);
  return { ctx, page };
}

async function 찍기(page, 동작) {
  const cdp = await page.context().newCDPSession(page);
  const 장 = [];
  cdp.on('Page.screencastFrame', (f) => { 장.push(f.data); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60 });
  await page.waitForTimeout(150);
  await 동작();
  await page.waitForTimeout(2800);
  await cdp.send('Page.stopScreencast').catch(() => {});
  return 장;
}

// 판정은 브라우저 캔버스로 한다 — 그림을 풀 의존성을 들이지 않으려고.
const 판정창 = await browser.newPage();
async function 판정(장) {
  if (장.length < 2) return '화면이 안 찍힘';
  return 판정창.evaluate(async (장) => {
    const c = new OffscreenCanvas(36, 74), g = c.getContext('2d', { willReadFrequently: true });
    const 회 = [];
    for (const b of 장) {
      const img = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b)).blob());
      g.drawImage(img, 0, 0, 36, 74);
      const d = g.getImageData(0, 0, 36, 74).data, v = [];
      for (let i = 0; i < d.length; i += 4) v.push((d[i] + d[i + 1] + d[i + 2]) / 3);
      회.push(v);
    }
    const 거리 = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length;
    const 흩 = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
    const A = 회[0], Z = 회[회.length - 1], 문제 = new Set();
    let 닿음 = false;
    for (const s of 회) {
      if (흩(s) < 8 && 흩(A) >= 8 && 흩(Z) >= 8) 문제.add('빈 화면');
      const dz = 거리(s, Z);
      if (dz < 1.5) 닿음 = true; else if (닿음 && dz > 6) 문제.add('되돌아감');
    }
    return [...문제].join(' · ');
  }, 장);
}

const 본 = new Set();
for (const src of 출발) {
  const { ctx, page } = await 새창();
  const 열림 = await page.goto(origin + src, { waitUntil: 'networkidle' }).then((r) => r?.ok(), () => false);
  await page.waitForTimeout(800);
  const 여기 = page.url();
  // 눌리는 위치는 「전체 링크 중 몇 번째」로 적는다 — 보이는 것만 거른 순번을 쓰면 엉뚱한 링크를 누른다(실측)
  const 링크 = (await page.$$eval('a[href]', (as) => as.map((a, i) => {
    const r = a.getBoundingClientRect(), u = new URL(a.href, location.href);
    return { i, href: a.getAttribute('href'), 키: u.origin + u.pathname + u.search, 보임: u.origin === location.origin && r.width > 0 && r.height > 0 && a.getAttribute('aria-disabled') !== 'true' };   // 잠긴 버튼(동의 전 「다음」)은 원래 안 넘어간다
  }))).filter((l) => l.보임 && l.키 !== 여기.split('#')[0]);
  await ctx.close();
  ok(`${src} 열림`, 열림, `링크 ${링크.length}개`);   // 링크가 없는 화면도 있다(인사이트 전문)
  for (const L of 링크) {
    const 쌍 = new URL(여기).pathname + ' → ' + new URL(L.키).pathname;
    if (본.has(쌍)) continue;
    본.add(쌍);
    const { ctx: c2, page: p2 } = await 새창();
    await p2.goto(origin + src, { waitUntil: 'networkidle' }).catch(() => {});
    await p2.waitForTimeout(800);
    // 둘째 창에서는 순번이 아니라 같은 href 의 보이는 링크를 다시 찾는다 — 늦게 그려지는 목록이 순번을 바꾼다
    let 눌림 = false;
    const 앞 = await 찍기(p2, async () => {
      눌림 = await p2.evaluate((h) => {
        const a = [...document.querySelectorAll('a[href]')].find((x) => x.getAttribute('href') === h && x.getBoundingClientRect().width > 0);
        if (a) a.click();
        return !!a;
      }, L.href);
    });
    const 도착 = p2.url();
    // 못 눌렀거나 제자리면 전환을 잰 것이 아니다 — 통과로 세지 않는다
    ok(`${쌍} (넘어감)`, 눌림 && 도착 !== 여기, 눌림 ? `도착 ${new URL(도착).pathname}` : '링크를 못 찾음');
    const 앞판정 = await 판정(앞);
    ok(`${쌍} (누름)`, !앞판정, 앞판정);
    if (도착 !== 여기) {
      const 뒤 = await 찍기(p2, () => p2.goBack().catch(() => {}));
      const 뒤판정 = await 판정(뒤);
      ok(`${쌍} (뒤로)`, !뒤판정, 뒤판정);
    }
    await c2.close();
  }
}
ok('전환을 하나 이상 쟀다', 본.size > 0, `${본.size}개`);   // 링크를 하나도 못 찾으면 0항목 통과가 된다
await browser.close();
server.close();
마무리();
