// 랜딩 버전 보관 — 새 버전(지문)이 배포되면 그 화면을 남긴다 (2026-10-15 사용자 확정, 어드민 「랜딩 섹션 도달률」).
//
// 남기는 것 (landing-versions 가지의 <지문>/ 아래)
//   s01.jpg …   섹션마다 360px 폰으로 찍은 그림 — 어드민 줄 왼쪽 썸네일
//   index.html  그 판의 화면을 바깥 요청 없이 그대로 서는 한 장 — 어드민 「화면 보기」 폰 목업 안에 뜬다
//               (스타일·글꼴·스크립트를 안에 넣었다. 방문 기록 모듈은 빼고, 이동은 막고, 마우스로 끌어 스크롤된다)
//   versions.json 에 한 줄 — 지문 · 커밋 · 걸린 시각 · 섹션 이름과 제목 · 시안 값
//
// 「걸린 시각」은 이 작업이 도는 시각이다(main 에 밀린 직후 돈다). 어드민의 6시간 규칙이 이 값으로 잰다.
// 이미 있는 지문이면 아무것도 안 한다 — 글자 하나 안 바뀐 배포가 새 버전을 만들지 않는다.
//
//   node tools/landing-version/capture.mjs <landing-versions 가지를 펼친 폴더>
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 랜딩구성, 지문, 적힌지문 } from './fp.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const 보관 = resolve(process.argv[2] || '');
if (!process.argv[2] || !existsSync(보관)) throw new Error('landing-versions 가지를 펼친 폴더를 넘겨라');
const A = (p) => readFileSync(join(ROOT, p.replace(/^\//, '')), 'utf8');

const 원문 = A('index.html');
const 구성 = 랜딩구성(원문), fp = 지문(구성);
if (적힌지문(원문) !== fp) throw new Error(`index.html 의 cc-lv(${적힌지문(원문)})가 지금 원문(${fp})과 다르다 — fp.mjs --write`);
const 목록파일 = join(보관, 'versions.json');
const 목록 = existsSync(목록파일) ? JSON.parse(readFileSync(목록파일, 'utf8')) : { versions: [] };
if (목록.versions.some((v) => v.fp === fp)) { console.log(`이미 있는 버전 ${fp} — 할 일 없음`); process.exit(0); }

// ── 1) 바깥 요청 없이 서는 한 장 ─────────────────────────────────────────────
function 한장() {
  let s = 원문;
  const a = s.indexOf('<script type="module">'); const b = s.indexOf('</script>', a) + 9;
  if (a < 0) throw new Error('랜딩 모듈 스크립트를 못 찾았다');
  s = s.slice(0, a) + s.slice(b);                                    // 방문 기록·로그인 모듈 — 보관본은 기록을 안 남긴다
  s = s.replace(/<link rel="(?:modulepreload|preconnect|canonical|icon)"[^>]*>/g, '');

  // 글꼴은 화면 글자가 걸리는 조각만 넣는다(전부 넣으면 3MB 다).
  const 글자 = new Set([...(s + A('/assets/landing.js'))].map((c) => c.codePointAt(0)));
  const 글꼴css = '/assets/fonts/pretendard/pretendardvariable-dynamic-subset.css';
  const 범위 = (r) => r.split(',').map((x) => x.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16)));
  const 글꼴 = A(글꼴css).replace(/@font-face\s*\{[^}]*\}/g, (blk) => {
    const rr = blk.match(/unicode-range:\s*([^;]+);/);
    if (rr && !범위(rr[1]).some(([lo, hi = lo]) => [...글자].some((c) => c >= lo && c <= hi))) return '';
    const u = blk.match(/url\(([^)]+)\)/)[1].replace(/['"]/g, '');
    const 자료 = readFileSync(join(ROOT, dirname(글꼴css), u)).toString('base64');
    return blk.replace(/url\([^)]+\)/, `url(data:font/woff2;base64,${자료})`);
  });
  s = s.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>${href === 글꼴css ? 글꼴 : A(href)}</style>`);

  // 스크립트를 안에 넣는다. landing.js 가 부르는 두 파일은 쓰는 것만 같은 코드로 옮겨 온다.
  const md = A('/assets/mypage-data.js');
  const 휴일 = md.slice(md.indexOf('const HOLIDAYS'), md.indexOf('\n', md.indexOf(']);', md.indexOf('const HOLIDAYS'))));
  const 첫날 = md.slice(md.indexOf('export function firstSendDay'), md.indexOf('\n}\n', md.indexOf('export function firstSendDay')) + 2).replace('export ', '');
  s = s.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
    let js = A(src);
    if (src === '/assets/landing.js') {
      const 덧 = 'document.body.appendChild(document.createElement("script")).src = "/assets/overscroll-top.js";';
      const 부름 = 'import("/assets/mypage-data.js")';
      if (!js.includes(덧) || !js.includes(부름)) throw new Error('landing.js 의 외부 파일 부르는 자리가 바뀌었다 — 이 도구를 같이 고쳐라');
      js = js.replace(덧, `(function(){var t=document.createElement("script");t.text=${JSON.stringify(A('/assets/overscroll-top.js'))};document.body.appendChild(t)})();`)
        .replace(부름, `(function(){${휴일};${첫날}return Promise.resolve({firstSendDay:firstSendDay});})()`);
    }
    return `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
  });

  // 보관본 전용 — 이동·전송을 막고, 어드민이 고른 섹션에서 시작하고, 마우스로 끌어 스크롤(손가락처럼)한다.
  const 보관본 = `<style>html{scrollbar-width:none;cursor:grab}html::-webkit-scrollbar{display:none}html.cc-drag,html.cc-drag *{cursor:grabbing!important;user-select:none!important}</style>
<script>(function(){
var 섹=function(i){return document.querySelectorAll('#scr > section')[i]};
var 가기=function(i,부드럽게){var t=섹(i);if(t)scrollTo({top:i?t.getBoundingClientRect().top+scrollY:0,behavior:부드럽게?'smooth':'instant'})};
addEventListener('message',function(e){var d=e.data;if(d&&d.go!=null)가기(+d.go,true)});
var 시작=+window.__start||0;   /* 어드민이 <head> 에 window.__start 를 넣어 연다 */
if(시작){가기(시작);addEventListener('load',function(){가기(시작)});setTimeout(function(){가기(시작)},150)}
document.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(a&&a.getAttribute('href').charAt(0)!=='#')e.preventDefault()},true);
document.addEventListener('submit',function(e){e.preventDefault()},true);
var 누름=null,축=null,대상=null,기록=[],관성=0,막기=false;
function 세로(d){scrollTo({top:scrollY+d,behavior:'instant'})}function 가로(d){대상.scrollTo({left:대상.scrollLeft+d,behavior:'instant'})}
function 가로칸(el){for(;el&&el!==document.body;el=el.parentElement){var c=getComputedStyle(el);if(/(auto|scroll)/.test(c.overflowX)&&el.scrollWidth>el.clientWidth+2)return el}return null}
addEventListener('mousedown',function(e){if(e.button!==0)return;cancelAnimationFrame(관성);누름={x:e.clientX,y:e.clientY,t:e.target};축=null;대상=null;기록=[{t:performance.now(),x:e.clientX,y:e.clientY}];막기=false;e.preventDefault()},true);
addEventListener('mousemove',function(e){if(!누름)return;var dx=e.clientX-누름.x,dy=e.clientY-누름.y;
 if(!축){if(Math.abs(dx)<5&&Math.abs(dy)<5)return;축=Math.abs(dx)>Math.abs(dy)?'x':'y';if(축==='x'){대상=가로칸(누름.t);if(!대상)축='y'}document.documentElement.classList.add('cc-drag');막기=true}
 var 앞=기록[기록.length-1];if(축==='y')세로(앞.y-e.clientY);else 가로(앞.x-e.clientX);
 기록.push({t:performance.now(),x:e.clientX,y:e.clientY});if(기록.length>6)기록.shift()},true);
addEventListener('mouseup',function(){if(!누름)return;document.documentElement.classList.remove('cc-drag');
 if(축){var a=기록[0],b=기록[기록.length-1],dt=Math.max(16,b.t-a.t),v=축==='y'?(a.y-b.y)/dt:(a.x-b.x)/dt;
  if(performance.now()-b.t<80){var 끝=performance.now();(function 흐름(){var 지금=performance.now(),d=지금-끝;끝=지금;v*=Math.pow(.995,d);if(Math.abs(v)<.02)return;
   if(축==='y')세로(v*d);else 가로(v*d);관성=requestAnimationFrame(흐름)})()}}
 누름=null},true);
addEventListener('click',function(e){if(막기){e.preventDefault();e.stopPropagation();막기=false}},true);
addEventListener('dragstart',function(e){e.preventDefault()},true);})();</script>`;
  s = s.replace('</body>', 보관본 + '</body>');
  const 남은 = [...s.replace(/<script>[\s\S]*?<\/script>/g, '').matchAll(/<(?:script|link)\b[^>]*(?:src|href)="\/[^"]*"/g)].map((m) => m[0]);
  if (남은.length) throw new Error(`보관본에 바깥 파일을 부르는 자리가 남았다: ${남은.join(' · ')}`);
  return s;
}

// ── 2) 섹션 그림 ─────────────────────────────────────────────────────────────
async function 그림들(폴더) {
  const { chromium } = await import('playwright');
  const 종류 = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
  const 서버 = createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(ROOT, p);
    if (!f.startsWith(ROOT) || !existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': 종류[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f));
  }).listen(0);
  const 주소 = `http://127.0.0.1:${서버.address().port}/`;
  const 브라우저 = await chromium.launch();
  try {
    const 쪽 = await 브라우저.newPage({ viewport: { width: 360, height: 740 } });
    await 쪽.route((u) => !u.href.startsWith(주소), (r) => r.abort());   // 바깥(Supabase·픽셀)은 안 부른다
    await 쪽.goto(주소, { waitUntil: 'networkidle' });
    await 쪽.waitForTimeout(1200);
    const 높이 = await 쪽.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < 높이; y += 300) { await 쪽.evaluate((t) => scrollTo(0, t), y); await 쪽.waitForTimeout(120); }   // 움직임을 끝까지 돌린다
    await 쪽.addStyleTag({ content: '.sticky{display:none!important}' });
    await 쪽.evaluate(() => scrollTo(0, 0)); await 쪽.waitForTimeout(400);
    const 섹션 = await 쪽.$$('#scr > section');
    if (섹션.length !== 구성.섹션.length) throw new Error(`화면의 섹션 ${섹션.length}개 ≠ 원문 ${구성.섹션.length}개`);
    for (const [i, el] of 섹션.entries()) {
      await el.scrollIntoViewIfNeeded(); await 쪽.waitForTimeout(450);
      await el.screenshot({ path: join(폴더, `s${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 62 });
    }
  } finally { await 브라우저.close(); 서버.close(); }
}

const 폴더 = join(보관, fp);
mkdirSync(폴더, { recursive: true });
writeFileSync(join(폴더, 'index.html'), 한장());
await 그림들(폴더);
목록.versions.push({
  fp, commit: process.env.GITHUB_SHA || '', at: new Date().toISOString(),
  sections: 구성.섹션.map((x) => ({ n: x.이름, t: x.제목 })), sw: 구성.스위치,
});
목록.versions.sort((x, y) => (x.at < y.at ? -1 : 1));
writeFileSync(목록파일, JSON.stringify(목록, null, 1) + '\n');
console.log(`새 버전 ${fp} 보관 — 섹션 ${구성.섹션.length}개`);
