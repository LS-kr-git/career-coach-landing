// 섹션 도달 · 머문 시간 · 인터렉션 기록 — 랜딩(index.html)과 결제 화면(checkout/index.html)이 같이 쓴다.
// 2026-10-26 결제 화면에 랜딩 섹션을 실으면서(랜딩 v12) 랜딩 index.html 안에 있던 것을 여기로 옮겼다 — 두 화면이 같은 규칙으로 잰다.
// 무엇을 어떻게 보낼지(이벤트 이름·지문)는 부르는 쪽이 정한다: 보냄.도달(s) · 보냄.머묾(d, x).
//
// 닿았다 = 섹션의 절반이 보였거나 섹션이 화면의 절반을 채웠다. 첫 섹션은 방문 자체가 도달이라 안 보낸다.
// 1.5초 모아 보내고(빠르게 훑으면 한 번), 화면을 떠날 때 남은 것을 보낸다.
// 머문 시간 = 위 「닿았다」와 같은 규칙으로 보이는 동안의 초. 탭이 숨은 동안은 안 세고, 섹션당 180초에서 자른다.
// 인터렉션 = 손으로 해서 새로 본 것만. 처음부터 보이던 것·저절로 넘어가며 보인 것(후기 자동 흐름)은 안 센다.
// 화면을 떠날 때(숨김·pagehide) 누적값을 한 건으로 보낸다. DB 는 한 방문(vid)의 가장 큰 값을 쓴다.
// 🔴 기록 열쇠는 마크업의 data-ix 에서만 읽는다(2026-10-20 — 첫 화면 인터렉션이 이틀 동안 안 재졌다).
//   랜딩 섹션 안의 조작 부품이 data-ix·data-ix-none 칸 밖에 있으면 page-audit 이 푸시를 막고,
//   그 열쇠를 어드민이 모르면 career-coach tests/test_admin_pages.py 의 test_랜딩_인터렉션_열쇠를_어드민이_다_안다 가 막는다.
export function 섹션기록(섹션들, 보냄) {
  let 깊이 = 1, 보낸 = 1, 모음 = 0;
  const 보내기 = () => { clearTimeout(모음); if (깊이 > 보낸) { 보낸 = 깊이; 보냄.도달(깊이); } };
  const 머묾 = 섹션들.map(() => 0), 보임 = new Set(), 조작 = {};
  // 켜짐 — 「지금까지」 화면이 보이고 있었나. 숨김 알림이 올 때는 상태가 이미 hidden 이라 그 값으로 재면 마지막 구간이 통째로 빠진다.
  let 앞시각 = performance.now(), 보낸값 = '', 켜짐 = document.visibilityState === 'visible';
  const 쌓기 = () => {
    const 지금 = performance.now(), 초 = (지금 - 앞시각) / 1000; 앞시각 = 지금;
    if (켜짐) 보임.forEach((i) => { 머묾[i] = Math.min(180, 머묾[i] + 초); });
  };
  const 섹션번호 = (el) => 섹션들.findIndex((x) => x.contains(el)) + 1;
  const 지켜봄 = new IntersectionObserver((줄) => {
    쌓기();
    for (const e of 줄) {
      const i = 섹션들.indexOf(e.target);
      if (!e.isIntersecting || e.intersectionRect.height < Math.min(e.boundingClientRect.height, innerHeight) / 2) { 보임.delete(i); continue; }
      보임.add(i);
      if (i + 1 > 깊이) { 깊이 = i + 1; clearTimeout(모음); 모음 = setTimeout(보내기, 1500); }
    }
  }, { threshold: Array.from({ length: 21 }, (_, k) => k / 20) });
  섹션들.forEach((x) => 지켜봄.observe(x));
  const 머묾보내기 = () => {
    쌓기();
    const d = 머묾.map((x) => Math.round(x * 10) / 10);
    while (d.length && !d[d.length - 1]) d.pop();
    const 값 = JSON.stringify([d, 조작]);
    if (!d.length || 값 === 보낸값) return;
    보낸값 = 값;
    보냄.머묾(d, 조작);
  };
  const 떠남 = () => { 보내기(); 머묾보내기(); 켜짐 = false; };
  addEventListener('pagehide', 떠남);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') 떠남(); else { 앞시각 = performance.now(); 켜짐 = true; }
  });

  // 옆으로 넘기는 묶음(후기) — 세로로 같은 줄에 선 카드를 한 칸(열)으로 센다. 열의 절반이 들어오면 「봤다」.
  // 손을 대기 전까지 보인 가장 먼 열이 기준이고, 손을 댄 뒤 그보다 먼 열을 보면 [섹션, 본 가장 먼 열, 열 수] 를 남긴다.
  const 넘김 = (종류, 통) => {
    const 겉 = 통 && 통.closest('.arw');
    if (!겉) return;
    let 손 = false, 기준 = 0, 최대 = 0;
    const 열들 = () => [...new Set([...통.children].map((k) => Math.round(k.offsetLeft)))].sort((a, b) => a - b);
    const 재기 = () => {
      const 판 = 통.getBoundingClientRect();
      if (!판.width) return;
      const 왼 = 열들();
      let 먼 = 0;
      for (const k of 통.children) {
        const b = k.getBoundingClientRect(), 가운데 = b.left + b.width / 2;
        if (b.width && 가운데 >= 판.left && 가운데 <= 판.right) 먼 = Math.max(먼, 왼.indexOf(Math.round(k.offsetLeft)) + 1);
      }
      if (!손) { 기준 = Math.max(기준, 먼); return; }
      최대 = Math.max(최대, 먼);
      if (최대 > 기준) 조작[종류] = [섹션번호(통), 최대, 왼.length];
    };
    const 손댐 = () => { if (!손) { 재기(); 손 = true; } };
    겉.addEventListener('click', (e) => { if (e.isTrusted && e.target.closest('.cpv,.cnx')) 손댐(); });
    통.addEventListener('pointerdown', (e) => { if (e.isTrusted && e.pointerType === 'mouse') 손댐(); });
    통.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) 손댐(); }, { passive: true });
    let tx = 0, ty = 0;
    통.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    통.addEventListener('touchmove', (e) => {
      const dx = Math.abs(e.touches[0].clientX - tx), dy = Math.abs(e.touches[0].clientY - ty);
      if (dx > 8 && dx > dy) 손댐();
    }, { passive: true });
    통.addEventListener('scroll', 재기, { passive: true });
    // 화면 밖으로 나가면 손을 뗀 것으로 본다 — 돌아오면 후기 자동 흐름이 다시 도는데, 그때 넘어간 묶음은 손으로 본 것이 아니다.
    new IntersectionObserver((줄) => {
      if (줄.some((e) => e.isIntersecting)) { 재기(); return; }
      기준 = Math.max(기준, 최대); 손 = false;
    }).observe(통);
  };
  // 기록 칸은 넘겨받은 섹션 안에서만 찾는다 — 화면에 그 섹션이 없으면 그 기록도 없다.
  const 안 = (sel) => 섹션들.map((x) => x.querySelector(sel)).find(Boolean) ?? null;
  const 칸 = (id) => { const el = 안(`#${id}`); return el?.dataset.ix ? el : null; };
  const 후기 = 칸('rvw');
  if (후기) 넘김(후기.dataset.ix, 후기.querySelector('.rvp'));

  // 알림톡 미리보기(첫 화면 · 「이런 카카오톡이 쌓이면」) · 전문가 직군 칩 (2026-10-20 사용자 지시 — 첫 화면 인터렉션이 안 재지고 있었다).
  // 한 방문의 x 는 종류마다 한 값이라 자리마다 열쇠가 다르다 — 미리보기 상자의 data-ix 는 「직군 · 넘기기 · 더 보기」 순서다.
  // 직군 고르기 = 처음 골라져 있던 것 말고 손으로 고른 다른 직군 수. 칩 줄을 끌다 놓은 것은 landing.js 가 클릭을 막아 안 센다.
  const 직군 = (열쇠, 칩줄) => {
    if (!칩줄) return;
    const 처음 = 칩줄.querySelector('.chip.on')?.dataset.k, 고른 = new Set();
    칩줄.addEventListener('click', (e) => {
      const k = e.isTrusted && e.target.closest('.chip')?.dataset.k;
      if (!k || k === 처음) return;
      고른.add(k);
      조작[열쇠] = [섹션번호(칩줄), 고른.size, 칩줄.querySelectorAll('.chip').length - 1];
    });
  };
  // 카톡 넘기기 = 손을 댄 뒤 들어온 가장 먼 장(처음 보이던 1장은 안 셈). 카톡 안 더 보기 = 카톡 안을 아래로 내려 본 장 수(직군·장이 다르면 다른 장).
  // 자동 넘김은 꺼져 있지만(2026-10-19) 다시 켜도 저절로 넘어간 장이 안 섞이게 손을 댄 뒤만 센다.
  const 미리보기 = (상자) => {
    const 판 = 상자.querySelector('.swipe'), [잡, 카, 더] = 상자.dataset.ix.split(/\s+/);
    if (!판) return;
    let 손 = false, 먼 = 1;
    const 내림 = new Set(), 손댐 = (e) => { if (e.isTrusted) 손 = true; };
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach((t) => 상자.addEventListener(t, 손댐, { passive: true }));
    판.addEventListener('scroll', () => {
      const 장 = 판.children, 폭 = 장[1] ? 장[1].offsetLeft - 장[0].offsetLeft : 판.clientWidth, i = Math.round(판.scrollLeft / 폭) + 1;
      if (!손 || i <= 먼) return;
      먼 = i;
      조작[카] = [섹션번호(상자), 먼, 장.length];
    }, { passive: true });
    상자.addEventListener('scroll', (e) => {
      const 안쪽 = e.target;
      if (!손 || !안쪽.classList?.contains('ab') || 안쪽.scrollTop < 4) return;
      내림.add(`${상자.querySelector('.pvchips .chip.on')?.dataset.k}:${[...판.children].indexOf(안쪽.closest('.slide'))}`);
      조작[더] = [섹션번호(상자), 내림.size, 0];
    }, { capture: true, passive: true });
    직군(잡, 상자.querySelector('.pvchips'));
  };
  섹션들.forEach((x) => x.querySelectorAll('[data-pv][data-ix]').forEach(미리보기));
  const 전문가 = 칸('chw9');
  if (전문가) 직군(전문가.dataset.ix, 전문가.querySelector('.chips'));
  // 면접 질문 퀴즈 직군 칩 (2026-10-25 되살림)
  const 퀴즈 = 칸('chw2');
  if (퀴즈) 직군(퀴즈.dataset.ix, 퀴즈.querySelector('.chips'));

  // 연봉 바꿔 보기 — 손을 멈추고 0.8초 지난 값만 한 번으로 센다(밀대를 끄는 동안의 값은 안 센다). 자동 시연은 isTrusted 로 빠진다.
  const 연봉 = 칸('sal');
  if (연봉) {
    let 마지막 = 연봉.querySelector('.sv')?.value, 번 = 0, 멈춤 = 0;
    const 정함 = () => {
      const v = 연봉.querySelector('.sv')?.value;
      if (v && v !== 마지막) { 마지막 = v; 번++; 조작[연봉.dataset.ix] = [섹션번호(연봉), 번, 0]; }
    };
    const 바꿈 = (e) => { if (e.isTrusted) { clearTimeout(멈춤); 멈춤 = setTimeout(정함, 800); } };
    연봉.addEventListener('input', 바꿈);
    연봉.addEventListener('click', (e) => { if (e.target.closest('button')) 바꿈(e); });
  }

  // 자주 묻는 질문 — 펼쳐 본 질문 수(같은 질문을 다시 펼쳐도 한 번).
  const 질문칸 = 섹션들.find((x) => x.matches('section.faq[data-ix]'));
  const 질문들 = 질문칸 ? [...질문칸.querySelectorAll('details')] : [], 편질문 = new Set();
  질문들.forEach((q, i) => q.addEventListener('toggle', () => {
    if (!q.open) return;
    편질문.add(i);
    조작[질문칸.dataset.ix] = [섹션번호(q), 편질문.size, 질문들.length];
  }));
  return { 깊이: () => 깊이 };
}
