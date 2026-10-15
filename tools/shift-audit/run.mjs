// 첫 화면 덜컹임 검사 — 구독자 화면을 하나씩 열어 ① 화면이 보인 뒤 내용이 밀리는지(layout shift)
// ② 화면이 다 보인 뒤(스켈레톤까지 걷힌 뒤) 글꼴 조각이 도착해 글자가 바뀌는지를 잰다.
//   node tools/shift-audit/run.mjs            # 전부 (기기 3 × 첫 방문·재방문)
//   node tools/shift-audit/run.mjs /jobs/     # 주소에 이 글자가 든 화면만
//   node tools/shift-audit/run.mjs '' PC     # 기기 이름에 이 글자가 든 기기만(이름과 똑같으면 그 하나만)
//
// 왜 이 파일이 있나 (2026-10-15 사용자 지시 — 「모든 페이지 · 모든 환경 전수」)
//   공고 화면에서 직군 줄이 늦게 나타나 아래가 24px 밀렸고, 글씨체가 한 번 바뀌는 것도 보였다.
//   한 화면만 보고 고치면 다른 화면의 같은 병은 남는다 — 화면 목록은 화면 전환 검사와 같은 것을 쓴다.
//
// 재는 조건: 휴대폰 360 · 안드로이드 412 · PC 1280 은 보통 망(지연 40ms · 12Mbps), 휴대폰 360 은 느린 망(지연 150ms · 1.6Mbps)도. CPU 는 모두 4배 느리게.
//   첫 방문(캐시 없음)과 같은 창의 재방문을 둘 다 잰다. 서버 값은 0.3초 늦게 준다.
// 판정: 보인 뒤 밀림 합이 0.01 을 넘으면 실패, 보인 뒤 도착한 글꼴 조각이 있으면 실패(느린 망에서 글꼴 상한을 다 기다린 뒤면 ⚠️ 로만 적는다).
//   스켈레톤 막대가 글자로 바뀌는 것은 밀림이 아니다(자리가 같다) — 브라우저도 세지 않는다.
// 크로미움이 없으면 건너뛴다(화면 전환 검사와 같은 규약). 기기·망 4가지 × 첫 방문·재방문 × 화면 수라 수십 분 걸린다.
import fs from 'node:fs';
import { 서버열기, 브라우저열기, 검사기, 구독자화면 } from '../ops-audit/harness.mjs';

const STUB = fs.readFileSync(new URL('../transition-audit/stub-supabase.mjs', import.meta.url), 'utf8');
const T = 'AbCdEfGhIjKlMnOpQrStUv';
const 거름 = process.argv[2] || '';
const 화면 = 구독자화면(T).filter((u) => u.includes(거름));
const 진행 = JSON.stringify({ jobs: ['퍼포먼스마케팅'], years: 2, yearsMax: 5, regions: ['서울'], topic: null, topicClear: false, pending: false, owner: 'u1' });

// 링크로 여는 두 화면은 supabase-js 가 아니라 REST 를 바로 부른다 — 그럴듯한 값을 준다(지어낸 실존 회사 없음)
const 회사 = ['가람솔루션', '나래커머스', '다온랩스', '라온페이', '마루모빌리티', '바다헬스', '사랑방미디어', '아라클라우드', '자람에듀', '차오름푸드', '카라게임즈', '타래물류'];
const 공고 = 회사.flatMap((c, i) => [0, 1].map((k) => ({ 회사: c, 제목: ['퍼포먼스 마케터 (경력)', '그로스 매니저', 'CRM 마케팅 담당', '브랜드 마케터'][(i + k) % 4], 링크: '#', 지역: ['서울'], 연차최소: 1 + (i % 3), 연차최대: 5, 마감: '2026-11-0' + (1 + (i % 8)) })));
const RPC = {
  jobs_briefing: { 상태: '열림', 칩: ['퍼포먼스마케팅', '그로스해킹', 'CRM마케팅'], 공고,
    지표: [{ 지표: '신규 공고', 최근: 1724, 직전: 1290 }, { 지표: '채용 기업', 최근: 872, 직전: 650 }, { 지표: '연차 판별 불가', 최근: 300, 직전: 320 }] },
  insight_letter: [{ title: '퍼포먼스 마케터가 대시보드보다 먼저 봐야 할 숫자', track: '마케팅·그로스', state: 'open', saved: false, reaction: null,
    body: Array.from({ length: 6 }, (_, i) => `${i + 1}번째 문단입니다. 숫자를 보기 전에 무엇을 결정하려는지부터 적어 두면, 같은 대시보드에서도 읽는 순서가 달라집니다. 전환율이 오른 주와 내린 주를 나란히 놓고, 그 사이 바뀐 것을 하나씩 지워 가는 식입니다.`).join('\n\n') }],
  insight_saved_recent: [1, 2, 3].map((k) => ({ insight_id: 1300 - k, title: `소장한 글 ${k} — 리텐션을 올린 팀들이 버린 지표`, track: '마케팅·그로스', sent_on: '2026-10-1' + k })),
};

const 폰 = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
// 망 두 가지 — 보통(LTE 쯤)은 무엇이든 실패로 센다. 느린 망(3G 쯤)은 글꼴만 456KB 라 3초 안에 못 받는 화면이 있다.
//   그때 steady.js 는 정한 상한까지 기다린 뒤 보여 준다(ccFontCap) — 그 뒤의 바뀜은 ⚠️ 로 따로 적는다.
//   막대가 서 있는 동안(글자는 투명) 조각이 하나씩 와 막대가 움직인 것도 느린 망에서는 ⚠️ 다. 보통 망에서는 둘 다 실패다.
const 보통망 = { latency: 40, down: 1500000 }, 느린망 = { latency: 150, down: 200000 };
const 기기 = {
  '휴대폰360·느린망': { ...폰, 망: 느린망 },
  '휴대폰360': { ...폰, 망: 보통망 },
  '안드로이드412': { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6, 망: 보통망 },
  'PC1280': { viewport: { width: 1280, height: 800 }, 망: 보통망 },
};

const { server, origin } = await 서버열기();
const browser = await 브라우저열기();
const { ok, 마무리 } = 검사기();

// 화면이 보인 시각(cc-wait 가 빠진 때) · 그 뒤의 밀림 · 그 뒤에 도착한 글꼴 조각을 적는다
const 관찰 = () => {
  const w = (window.__sa = { 보임: null, 다됨: null, 밀림: [], 늦은글꼴: [], 막대: [] });
  // 막대(스켈레톤)가 서 있던 구간 — 그 동안의 밀림은 투명한 글자 위 막대가 움직인 것이다(느린 망에서만 따로 적는다)
  new MutationObserver(() => { const h = document.documentElement, on = !!h && h.classList.contains('cc-sk'), 끝 = w.막대[w.막대.length - 1];
    if (on && !(끝 && 끝[1] == null)) w.막대.push([performance.now(), null]); else if (!on && 끝 && 끝[1] == null) 끝[1] = performance.now(); })
    .observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  // 이 스크립트는 <html> 이 생기기 전에 돈다 — documentElement 대신 문서 전체를 지켜본다(<html> 이 null 이라 관찰이 통째로 죽었다)
  let 기다림봄 = false;
  const 봄 = () => { const h = document.documentElement; if (!h || w.보임 != null) return;
    if (h.classList.contains('cc-wait')) 기다림봄 = true; else if (기다림봄 || document.readyState !== 'loading') { w.보임 = performance.now(); 미룸봄(); 다됨봄(); } };
  // 「다 됨」 — 스켈레톤 막대까지 걷힌 때. 막대 아래 글자는 투명이라 그 동안 온 글꼴 조각은 화면에서 안 바뀐다
  // 그 순간 이미 받아 둔 글꼴을 적어 둔다 — 「다 받고 나서 보여 줬다」와 「보여 준 뒤에 받았다」를 시각이 아니라 이것으로 가른다
  //   (받은 소식(loadingdone)이 보여 준 바로 다음에 와서 0ms 로 잘못 세던 것을 막는다)
  // 보인 순간 화면 아래 섹션을 미뤄 그리고 있었나(랜딩 「로딩 속도 장치」) — 섹션 수와 미룬 수
  const 미룸봄 = () => { const ss = [...document.querySelectorAll('section')]; w.섹션 = ss.length; w.미룸 = ss.filter((x) => getComputedStyle(x).contentVisibility === 'auto').length; };
  const 다됨봄 = () => { const h = document.documentElement; if (h && w.보임 != null && w.다됨 == null && !/\bcc-sk\b/.test(h.className)) {
    w.다됨 = performance.now(); w.받아둠 = new Set([...document.fonts].filter((f) => f.status === 'loaded')); } };
  new MutationObserver(다됨봄).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  new MutationObserver(봄).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('DOMContentLoaded', 봄);
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) w.밀림.push({ t: e.startTime, v: e.value,
    곳: (e.sources || []).map((s) => (s.node && (s.node.id || (s.node.className && String(s.node.className).split(' ')[0]) || s.node.nodeName)) + ` ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`).join(', ') }); })
    .observe({ type: 'layout-shift', buffered: true });
  // 늦게 온 조각이 지금 화면에 보이는 글자에 쓰이나 — 숨은 안내창 글자를 미리 받아 둔 조각(steady.js)은 화면을 안 바꾼다
  const 보이는글자 = (f) => {
    const 범위 = f.unicodeRange.split(',').map((x) => x.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16)));
    const 든다 = (c) => 범위.some(([a, b]) => c >= a && c <= (b ?? a));
    const tw = document.createTreeWalker(document.body, 4); let n;
    while ((n = tw.nextNode())) { const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(p.nodeName) || !p.getClientRects().length || getComputedStyle(p).visibility !== 'visible') continue;
      for (const ch of n.nodeValue) if (든다(ch.codePointAt(0))) return true; }
    for (const el of document.querySelectorAll('input[placeholder],textarea[placeholder]')) if (el.getClientRects().length) for (const ch of el.placeholder) if (든다(ch.codePointAt(0))) return true;
    return false;
  };
  const 글꼴봄 = () => document.fonts && document.fonts.addEventListener('loadingdone', (ev) => {
    다됨봄(); for (const f of ev.fontfaces) if (w.다됨 != null && !w.받아둠.has(f) && 보이는글자(f)) w.늦은글꼴.push(Math.round(performance.now() - w.다됨) + 'ms');
  });
  if (document.fonts) 글꼴봄(); else addEventListener('DOMContentLoaded', 글꼴봄);
};

async function 열기(ctx, 주소, 망) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 망.latency, downloadThroughput: 망.down, uploadThroughput: 100000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(origin + 주소, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  // 막대가 걷힐 때까지(느린 망은 steady.js SKEL_FONT_MAX 8초까지 기다린다) 보고, 그 뒤 늦게 오는 것을 1.5초 더 본다
  await page.waitForFunction(() => window.__sa && window.__sa.다됨 != null, null, { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const w = window.__sa || { 보임: null, 다됨: null, 밀림: [], 늦은글꼴: [], 막대: [] };
    const 뒤 = w.밀림.filter((e) => w.보임 != null && e.t >= w.보임 - 1);
    const 막대중 = (e) => w.막대.some(([a, b]) => e.t >= a && (b == null || e.t < b));
    return { 상한: !!window.ccFontCap, 막대합: 뒤.filter(막대중).reduce((s, e) => s + e.v, 0), 주소: location.pathname, 보임: w.보임, 다됨: w.다됨, 섹션: w.섹션, 미룸: w.미룸, 전체밀림: w.밀림.length, 합: 뒤.reduce((s, e) => s + e.v, 0), 곳: 뒤.filter((e) => e.v > 0.001).map((e) => e.곳).join(' / '), 늦은글꼴: w.늦은글꼴 };
  });
  await page.close();
  return r;
}

const 기기거름 = process.argv[3] || '';
for (const [이름, 설정] of Object.entries(기기).filter(([n]) => (기기거름 in 기기 ? n === 기기거름 : n.includes(기기거름)))) {
  const { 망, ...창 } = 설정;
  for (const 주소 of 화면) {
    const ctx = await browser.newContext(창);
    await ctx.addInitScript(관찰);
    // 나중에 건 길이 먼저 잡힌다(playwright) — 막는 길을 맨 먼저 걸어야 아래 가짜 값이 산다(거꾸로 걸어 오류 화면을 잰 적이 있다)
    await ctx.route(/kakao|facebook|google|doubleclick|supabase\.co/, (r) => r.abort());
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'text/javascript', body: STUB }));
    await ctx.route(/supabase\.co\/rest\/v1\/rpc\/(\w+)/, async (r) => {
      const fn = r.request().url().match(/rpc\/(\w+)/)[1];
      await new Promise((ok_) => setTimeout(ok_, 300));
      return RPC[fn] ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(RPC[fn]) }) : r.fulfill({ contentType: 'application/json', body: 'null' });
    });
    // 로그인한 회원 · 온보딩을 마친 상태 (화면 전환 검사와 같다). 페이지를 미리 열어 심으면 그 사이 글꼴이 캐시에 들어가
    // 「첫 방문」이 첫 방문이 아니게 된다 — 그래서 문서가 돌기 전에 심는다.
    await ctx.addInitScript((v) => {
      localStorage.setItem('sb-sxooygwggxeplzkfdbth-auth-token', JSON.stringify({ user: { id: 'u1' } }));
      localStorage.setItem('cc_onboarding', v);
    }, 진행);
    for (const 방문 of ['첫 방문', '재방문']) {
      const r = await 열기(ctx, 주소, 망);
      const 줄 = `${이름} ${방문} ${주소}`;
      // 다른 화면으로 떠났으면(로그인·결제 상태에 따른 이동) 이 화면은 보이지 않는 것이 맞다 — 도착한 화면은 따로 잰다
      if (r.보임 == null && r.주소 !== new URL(origin + 주소).pathname) { console.log(`↪ ${줄} — ${r.주소} 로 이동해 이 화면은 안 보인다(그 화면은 따로 잰다)`); continue; }
      ok(`${줄} 보인 시각을 잼`, r.보임 != null, r.보임 != null ? `${Math.round(r.보임)}ms` : '못 잼 — 아래 판정들이 헛통과가 된다');
      // 랜딩은 첫 화면을 띄울 때 셋째 섹션부터 미뤄 그린다 — 디자인이 바뀌어도 늘 켜져 있어야 한다(2026-10-15 사용자 지시).
      //   바로가기(#…)로 들어온 경우만 일부러 끈다. CLAUDE.md 「로딩 속도 장치는 항상 유지한다」
      if (주소 === '/') ok(`${줄} 아래 섹션 미룸`, r.섹션 >= 3 && r.미룸 >= r.섹션 - 2, `섹션 ${r.섹션}개 중 ${r.미룸}개를 미뤄 그림`);
      // 막대가 끝내 안 걷히면 아래 글씨체 판정이 셀 시점이 없어 헛통과한다 — 다 그려졌는지부터 묻는다(2026-10-15 검사관 ②)
      ok(`${줄} 막대가 걷힘`, r.다됨 != null, r.다됨 != null ? `${Math.round(r.다됨)}ms` : '9초 넘게 스켈레톤이 서 있다');
      const 밀림말 = `${r.합.toFixed(4)}${r.곳 ? ' · ' + r.곳 : ''}`;
      // 상한까지 기다린 뒤 기본 글꼴로 보여 준 화면은 글꼴이 오며 줄바꿈이 달라질 수 있다 — 느린 망에서만 일어나는 일이라 ⚠️
      if (r.합 > 0.01 && 망 === 느린망 && (r.상한 || r.합 - r.막대합 <= 0.01)) console.log(`⚠️ ${줄} 밀림 — ${밀림말} · ${r.상한 ? '글꼴 상한 뒤였다' : '막대가 서 있는 동안 글꼴 조각이 하나씩 오며 막대가 움직였다'}`);
      else ok(`${줄} 밀림`, r.합 <= 0.01, 밀림말);
      const 글꼴말 = r.늦은글꼴.length ? `보인 뒤 글꼴 ${r.늦은글꼴.length}조각 (${r.늦은글꼴.slice(0, 4).join(', ')})` : '';
      // 글꼴이 상한(steady.js FONT_MAX, 3초)까지 안 오면 기본 글꼴로라도 보여 준다 — 그 뒤의 바뀜은 정한 값이다(빈 화면을 더 길게 두지 않는다).
      // 실패로 세지 않고 따로 적는다. 상한 전에 보여 줘 놓고 바뀌는 것만 실패다.
      if (r.늦은글꼴.length && r.상한 && 망 === 느린망) console.log(`⚠️ ${줄} 글씨체 — ${글꼴말} · 3초 상한까지 기다린 뒤였다(이 망에서는 정한 동작)`);
      else ok(`${줄} 글씨체`, !r.늦은글꼴.length, 글꼴말);
    }
    await ctx.close();
  }
}
await browser.close();
server.close();
마무리();
