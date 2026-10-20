// 랜딩 버전 지문 — index.html 원문에서 섹션 구성·섹션 제목·시안 값을 뽑아 짧은 해시로 만든다 (2026-10-15 사용자 확정).
//
// 왜 원문에서 뽑나: 브라우저에서 화면을 읽어 만들면 스크립트가 바꾼 글자(예: 「8.5배」→「8배」)가 섞여
// 같은 판이 방문마다 다른 지문이 된다. 그래서 지문은 여기서 한 번 만들어 <meta name="cc-lv"> 에 적고,
// 랜딩은 그 값을 읽어 보내기만 한다. 어드민 「랜딩 섹션 도달률」이 이 값으로 버전을 가른다.
// 맞는지는 page-audit(훅·CI)이 매번 다시 재서 본다 — 섹션을 고치고 이걸 안 돌리면 푸시가 막힌다.
//
//   node tools/landing-version/fp.mjs           # 지금 원문의 지문과 섹션 목록
//   node tools/landing-version/fp.mjs --write   # index.html 의 <meta name="cc-lv"> 를 새 값으로
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 주석 안의 <section>·data-v·meta 는 화면에 없으므로 세지 않는다 — 주석으로 막아 둔 섹션이 지문을 바꾸면 안 된다.
const 주석빼기 = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
// 제목 속 장식(「TALK」 배지 · 각주 숫자)은 화면에서 글자로 읽히지 않으므로 뺀다.
const 장식빼기 = (h) => h.replace(/<sup\b[\s\S]*?<\/sup>/gi, '').replace(/<em class="ti">[\s\S]*?<\/em>/gi, '');
const 글자만 = (h, 태그자리 = '') => 장식빼기(h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, 태그자리)
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

/** 랜딩 본문(#scr)의 섹션들과 시안 스위치. 섹션 이름은 data-sec, 제목은 첫 h1/h2(없으면 첫 문단). */
export function 랜딩구성(html) {
  html = 주석빼기(html);
  const 시작 = html.indexOf('id="scr"');
  if (시작 < 0) throw new Error('index.html 에 #scr 가 없다');
  const 본문 = html.slice(시작);
  const 섹션 = [...본문.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map(([, 속성, 안]) => {
    const 이름 = (속성.match(/\bdata-sec="([^"]*)"/) || [])[1] ?? '';
    const 제목 = 안.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/) || 안.match(/<p\b[^>]*>([\s\S]*?)<\/p>/);
    // 제목도 문단도 없는 띠(구독자 수 띠)는 마지막 줄의 글자를 쓴다 — 칸 사이가 붙지 않게 태그 자리를 띄운다.
    const 끝줄 = () => 글자만(안.trim().split('\n').filter((l) => 글자만(l)).pop() ?? '', ' ');
    return { 이름, 제목: 제목 ? 글자만(제목[1]) : 끝줄() };
  });
  const 스위치 = {};
  for (const [태그] of 본문.matchAll(/<[a-z][^>]*\bdata-v="[^"]*"[^>]*>/g)) {
    const id = (태그.match(/\bid="([^"]+)"/) || [])[1];
    if (id) 스위치[id] = 태그.match(/\bdata-v="([^"]*)"/)[1];
  }
  return { 섹션, 스위치 };
}

/** 인터렉션 기록의 빈자리 (2026-10-20 사용자 지시 — 첫 화면 인터렉션이 안 재지고 있었고, 「앞으로 재발하지 않게」).
 *  #scr 섹션 안에서 손으로 조작하는 부품(버튼·입력·접는 질문·옆으로 넘기는 줄)은 기록 열쇠를 적은 칸(data-ix="열쇠 …")
 *  안에 있거나, 안 재는 이유를 적은 칸(data-ix-none="이유") 안에 있어야 한다. 랜딩 기록 코드는 열쇠를 이 속성에서만 읽고,
 *  어드민(career-coach tests/test_admin_pages.py 의 test_랜딩_인터렉션_열쇠를_어드민이_다_안다)이 같은 열쇠를 아는지 맞댄다. 섹션 자신에 붙여도 된다.
 *  스크립트가 나중에 채우는 칩·카드는 원문에 없으므로 그것을 담는 줄(chips·swipe·hs·rvp)을 부품으로 센다. */
const 조작태그 = /^(button|input|select|textarea|details)$/, 조작줄 = /(^|\s)(chips|swipe|hs|rvp)(\s|$)/;
const 빈태그 = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const 표시 = (t, 속) => {
  const 열쇠 = (속.match(/\bdata-ix="([^"]*)"/) || [])[1];
  return { t, 열쇠, 덮음: 열쇠 !== undefined || /\bdata-ix-none="[^"]+"/.test(속), cls: (속.match(/\bclass="([^"]*)"/) || [])[1] ?? '' };
};
export function 기록대조(html) {
  html = 주석빼기(html);
  const 본문 = html.slice(html.indexOf('id="scr"')), 빈자리 = [], 열쇠 = [];
  for (const [, 속성, 안] of 본문.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)) {
    const 이름 = (속성.match(/\bdata-sec="([^"]*)"/) || [])[1] ?? '';
    const 쌓임 = [표시('section', 속성)];
    if (쌓임[0].열쇠) 열쇠.push(...쌓임[0].열쇠.split(/\s+/));
    for (const [통, 닫, 태그, 속] of 안.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
      const t = 태그.toLowerCase();
      if (닫) { const i = 쌓임.map((x) => x.t).lastIndexOf(t); if (i > 0) 쌓임.length = i; continue; }
      const 나 = 표시(t, 속);
      if (나.열쇠) 열쇠.push(...나.열쇠.split(/\s+/));
      if (!나.덮음 && !쌓임.some((x) => x.덮음) && (조작태그.test(t) || 조작줄.test(나.cls))) 빈자리.push({ 섹션: 이름, 태그: 통.slice(0, 90) });
      if (!빈태그.has(t) && !통.endsWith('/>')) 쌓임.push(나);
    }
  }
  return { 빈자리, 열쇠 };
}

export const 지문 = (구성) => createHash('sha256').update(JSON.stringify(구성)).digest('hex').slice(0, 10);
export const 적힌지문 = (html) => (주석빼기(html).match(/<meta name="cc-lv" content="([^"]*)">/) || [])[1] ?? null;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const 파일 = new URL('../../index.html', import.meta.url);
  const html = readFileSync(파일, 'utf8');
  const 구성 = 랜딩구성(html), 값 = 지문(구성), 적힌 = 적힌지문(html);
  if (process.argv.includes('--write')) {
    if (적힌 === null) throw new Error('index.html 에 <meta name="cc-lv" content="…"> 줄이 없다 — <head> 에 한 줄 넣고 다시');
    writeFileSync(파일, html.replace(`<meta name="cc-lv" content="${적힌}">`, `<meta name="cc-lv" content="${값}">`));
    console.log(적힌 === 값 ? `그대로 ${값}` : `${적힌} → ${값}`);
  } else {
    console.log(`지문 ${값} (적힌 값 ${적힌 ?? '없음'})`);
    구성.섹션.forEach((s, i) => console.log(`${String(i + 1).padStart(2)}. ${s.이름 || '(이름 없음)'} — ${s.제목}`));
  }
}
