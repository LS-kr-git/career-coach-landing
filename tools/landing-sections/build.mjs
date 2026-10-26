#!/usr/bin/env node
/**
 * 랜딩 섹션을 다른 화면에 옮겨 싣는다 (2026-10-26 사용자 지시 · 랜딩 v12 「결제페이지에 유료이유(5줄요약) 추가」).
 *
 *   node tools/landing-sections/build.mjs          # 사본을 다시 만든다
 *   node tools/landing-sections/build.mjs --check  # 쓰지 않고, 랜딩과 어긋났으면 종료코드 1 (훅·CI)
 *
 * 만드는 것 둘:
 *  ① assets/landing-sections.css — 랜딩 스타일(landing-1·2·3.css + index.html 머리의 인라인 <style>)을
 *     `.lp` 상자 안에만 걸리게 고친 사본. 랜딩 스타일은 `section`·`h2`·`p`·`.top`·`.chip` 처럼 넓게 걸려 있어
 *     그대로 붙이면 받는 화면의 요금 카드·제목·구역 여백을 덮어쓴다(2026-10-26 목업에서 실제로 깨졌다).
 *     `:root`·`html`·`body` 는 `.lp` 로, `.screen`·`#scr` 는 받는 상자(`.lp`·`#lpsec`)로 바꾸고, 나머지 선택자는 앞에 `.lp ` 를 붙인다.
 *     받는 화면의 스타일도 이 상자 안으로 새지 않게 쓴다(결제 화면은 머리줄을 `.page>.hd`, 요금 카드를 `.plans .pc` 로 건다).
 *  ② 받는 화면 안의 표시 사이 — `<!--landing:sections 섹션이름|섹션이름-->` 과 `<!--/landing:sections-->` 사이를
 *     index.html 의 같은 data-sec 섹션 원문으로 채운다. 아이콘 정의(#ccmark)와 시안 스위치(<i … data-v hidden>)도
 *     같이 싣는다 — 랜딩 CSS 가 `:has(#스위치[data-v])` 로 변형을 고르고, 카톡 미리보기가 #ccmark 를 쓴다.
 *
 * 🔴 사본을 손으로 고치지 마라. 랜딩 섹션·스타일을 고치면 이 도구를 돌려 같이 커밋한다 — 안 그러면 훅(1.9겹)·CI 가 막는다.
 * 섹션을 움직이는 코드는 assets/landing.js 를 그대로 같이 부른다(랜딩에만 있는 요소가 없으면 그 부분은 건너뛴다).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = process.argv.includes('--check');
const 받는화면 = ['checkout/index.html'];
const CSS_OUT = 'assets/landing-sections.css';
const 읽기 = (f) => readFileSync(join(ROOT, f), 'utf8');
const 있으면읽기 = (f) => { try { return 읽기(f); } catch { return null; } };

/* ── ① 스타일 ── */
// 선택자 한 줄을 .lp 안으로. 따옴표·괄호 안의 쉼표는 나누지 않는다.
function 나누기(sel) {
  const out = []; let 깊이 = 0, 따옴 = '', 시작 = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (따옴) { if (c === 따옴) 따옴 = ''; continue; }
    if (c === '"' || c === "'") 따옴 = c;
    else if (c === '(' || c === '[') 깊이++;
    else if (c === ')' || c === ']') 깊이--;
    else if (c === ',' && 깊이 === 0) { out.push(sel.slice(시작, i)); 시작 = i + 1; }
  }
  out.push(sel.slice(시작));
  return out.map((s) => s.trim()).filter(Boolean);
}
function 가두기(s) {
  if (/^(:root|html|body)$/.test(s)) return '.lp';
  if (s === '*') return '.lp,.lp *';
  s = s.replace(/^(html|body)(?=[.\s:[>])/, '').trim();
  // 상자(.screen·#scr)를 가리키는 규칙은 그 자리를 받는 상자로 바꾸되 **무게를 지킨다** — 나머지 규칙이 `.lp ` 로
  // 클래스 하나만큼 무거워지므로 여기도 클래스 하나를 더한다. #scr 를 .lp 로 바꿔 id 하나를 잃으면
  // `#scr #pvsec .pm-hero .hd{display:flex!important}` 가 뒤의 숨김 규칙에 져 카톡 미리보기 머리줄이 사라졌다(2026-10-26 실측).
  if (/(^|[^\w-])(\.screen|#scr)(?![\w-])/.test(s)) {
    let 더함 = false;
    return s.replace(/#scr\.screen|\.screen#scr|\.screen|#scr/g, (m) => {
      const 바꿈 = (m.includes('#scr') ? '#lpsec' : '') + (m.includes('.screen') ? '.lp' : '') + (더함 ? '' : '.lp');
      더함 = true; return 바꿈;
    });
  }
  return `.lp ${s}`;
}
// 블록 단위로 훑는다. @keyframes·@font-face 안은 그대로, @media·@supports 안은 다시 훑는다.
function 스타일가두기(css) {
  let out = '', i = 0;
  const 다음 = (from, ch) => {
    for (let j = from, 따옴 = ''; j < css.length; j++) {
      const c = css[j];
      if (따옴) { if (c === '\\') j++; else if (c === 따옴) 따옴 = ''; continue; }
      if (c === '"' || c === "'") 따옴 = c;
      else if (css.startsWith('/*', j)) j = css.indexOf('*/', j + 2) + 1;
      else if (ch.includes(c)) return j;
    }
    return -1;
  };
  const 짝 = (열림) => {   // 여는 { 의 짝 }
    let 깊이 = 0;
    for (let j = 열림; j < css.length; j = 다음(j + 1, '{}')) {
      if (j < 0) break;
      깊이 += css[j] === '{' ? 1 : -1;
      if (깊이 === 0) return j;
    }
    throw new Error('스타일의 괄호 짝이 안 맞는다');
  };
  function 훑기(끝) {
    let s = '';
    while (i < 끝) {
      const 열림 = 다음(i, '{}');
      if (열림 < 0 || 열림 >= 끝 || css[열림] === '}') { s += css.slice(i, 끝); i = 끝; break; }
      const 머리 = css.slice(i, 열림).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const 닫힘 = 짝(열림);
      if (/^@(media|supports)/.test(머리)) {
        i = 열림 + 1; s += `${머리}{${훑기(닫힘)}}\n`; i = 닫힘 + 1;
      } else if (머리.startsWith('@')) {
        s += `${머리}${css.slice(열림, 닫힘 + 1)}\n`; i = 닫힘 + 1;
      } else {
        s += `${나누기(머리).map(가두기).join(',')}${css.slice(열림, 닫힘 + 1)}\n`; i = 닫힘 + 1;
      }
    }
    return s;
  }
  out = 훑기(css.length);
  return out;
}
const 랜딩 = 읽기('index.html');
const 머리 = 랜딩.slice(0, 랜딩.indexOf('</head>'));
const 인라인 = [...머리.slice(머리.indexOf('landing-3.css')).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const 원본 = ['assets/landing-1.css', 'assets/landing-2.css', 'assets/landing-3.css'].map(읽기).join('\n') + '\n' + 인라인;
const 새CSS = `/* 생성물 — 손으로 고치지 마라. node tools/landing-sections/build.mjs (원본: assets/landing-1·2·3.css + index.html 머리 인라인 스타일) */\n`
  + 스타일가두기(원본)
  // 페이지 카드였던 .screen 의 높이·바탕·그림자는 받는 화면의 상자에는 필요 없다. 줄 간격은 받는 화면 body 의 것을 물려받지 않게 랜딩(브라우저 기본)과 같게.
  + '.lp{min-height:0!important;max-width:none!important;background:#fff!important;box-shadow:none!important;line-height:normal}\n';

/* ── ② 마크업 ── */
const 본문 = 랜딩.slice(랜딩.indexOf('<body'));
const 아이콘 = (본문.match(/<svg width="0" height="0" style="position:absolute">[\s\S]*?<\/svg>/) || [])[0];
const 상자 = 본문.match(/<div class="screen" id="scr"([^>]*)>((?:<i [^>]*\bhidden><\/i>)*)/) || [];
// #scr 자신의 시안 값(data-v)도 옮긴다 — 랜딩 CSS 가 `.screen[data-v="1"] .chip.on` 처럼 상자의 값으로 고른다.
const [, 상자속성 = '', 스위치] = 상자;
if (!아이콘 || 스위치 === undefined) throw new Error('index.html 에서 아이콘 정의나 #scr 시안 스위치를 못 찾았다 — 이 도구를 같이 고쳐라');
const 섹션 = (이름) => {
  const m = 랜딩.match(new RegExp(`<section data-sec="${이름.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?</section>`));
  if (!m) throw new Error(`index.html 에 「${이름}」 섹션이 없다 — 받는 화면의 표시를 같이 고쳐라`);
  return m[0];
};
const 표시 = /(<!--landing:sections ([^>]*?)-->)[\s\S]*?(<!--\/landing:sections-->)/;

let 어긋남 = [];
const 쓰기 = (f, 새) => { if (있으면읽기(f) === 새) return; if (CHECK) 어긋남.push(f); else writeFileSync(join(ROOT, f), 새); };
쓰기(CSS_OUT, 새CSS);
for (const f of 받는화면) {
  const html = 읽기(f);
  if (!표시.test(html)) throw new Error(`${f} 에 <!--landing:sections …--> 표시가 없다`);
  쓰기(f, html.replace(표시, (_, 열기, 이름들, 닫기) => `${열기}\n${아이콘}\n<div class="lp" id="lpsec"${상자속성}>${스위치}\n`
    + 이름들.split('|').map((n) => 섹션(n.trim())).join('\n') + `\n</div>\n${닫기}`));
}
if (어긋남.length) {
  console.error(`❌ 랜딩 섹션 사본이 랜딩과 어긋났다: ${어긋남.join(', ')}\n   node tools/landing-sections/build.mjs 를 돌려 같이 커밋하세요.`);
  process.exit(1);
}
console.log(CHECK ? '✅ 랜딩 섹션 사본이 랜딩과 같다' : '랜딩 섹션 사본을 다시 만들었다');
