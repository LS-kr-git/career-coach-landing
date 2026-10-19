#!/usr/bin/env node
/**
 * 구독자 화면 <head> 의 「미리받기」 묶음을 만든다 (2026-10-15 · 로딩 속도).
 *
 *   node tools/preload/build.mjs          # 모든 페이지의 묶음을 다시 쓴다
 *   node tools/preload/build.mjs --check  # 쓰지 않고, 낡았으면 종료코드 1 (CI 용)
 *
 * 왜 — 화면은 steady.js 가 「글꼴이 다 오고 + DOMContentLoaded」 뒤에야 보여 준다. 그런데 둘 다
 * 늦게 출발했다(2026-10-15 실측, 360px · 4G 흉내).
 *   ① 글꼴 조각(woff2)은 글꼴 CSS 를 받고 → 레이아웃을 돌린 뒤에야 요청됐다. 작은 화면은 이것이
 *      화면이 뜨는 시각 그 자체였다.
 *   ② 모듈은 한 겹씩 받았다(페이지 → mypage-data → onboarding-store → track → supabase-config).
 *      모듈을 다 받고 돌려야 DOMContentLoaded 가 난다.
 *   ③ supabase-js(jsdelivr 9개 파일)도 세 겹으로 이어 받았다 — 로그인 화면 값 조회가 그 뒤다.
 * 그래서 처음부터 한꺼번에 받으라고 알려 둔다. **화면은 하나도 안 바뀐다** — 받는 순서만 당긴다.
 *
 * 묶음에 드는 것
 *   - preconnect  : 페이지가 Supabase 를 부르면 그 주소, 시작부터 supabase-js 를 쓰면 jsdelivr 도
 *   - modulepreload : 페이지 모듈이 import 하는 /assets/*.js 전부(겹 없이 펼친다) + 필요한 화면은 supabase-js 9개
 *   - preload font : 마크업에 적힌 글자(숨김[hidden]·스크립트·스타일 밖)가 쓰는 Pretendard 조각
 *     JS 가 나중에 그리는 글자의 조각은 여기 못 든다 — 그건 지금처럼 그때 받는다.
 *
 * supabase-js 의 파일 목록은 판(SUPABASE_JS)에 묶여 있어 cdn.json 에 적어 둔다. 판을 올리면
 * `--cdn` 으로 다시 뽑는다(네트워크 필요). 판과 cdn.json 이 어긋나면 --check 가 막는다.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CHECK = process.argv.includes('--check');
const FONT_CSS = '/assets/fonts/pretendard/pretendardvariable-dynamic-subset.css';
const CDN_JSON = join(HERE, 'cdn.json');
const BEGIN = '<!-- 미리받기 (tools/preload/build.mjs 가 만든다 — 손으로 고치지 마라) -->';
const END = '<!-- /미리받기 -->';
const SKIP_DIRS = new Set(['.git', 'tools', 'ops', 'node_modules']);
/** 시작하자마자 로그인 확인·값 조회로 supabase-js 를 부르는 화면의 신호 — 이것이 페이지 모듈에 있으면 jsdelivr 를 미리 받는다.
 *  랜딩은 여기 없다 — 랜딩은 다 그린 뒤 일부러 늦게 받는다(index.html 「미리 받아 둔다」). */
/** 글꼴을 미리 받지 않는 화면. 랜딩은 landing.js 가 스크립트를 돌리는 순간의 글꼴로 줄 폭을 재서(fitLine·숫자 폭)
 *  글자 크기를 정한다. 지금 그 순간은 대개 Pretendard 가 오기 전이라 대체 글꼴 폭으로 재는데, 미리 받으면 Pretendard 로
 *  재게 되어 퀴즈 Q2 줄이 줄어들지 않고 카드 끝에 닿았다(2026-10-15 화면 대조). 화면이 바뀌므로 넣지 않는다. */
const NO_FONT_PRELOAD = new Set(['index.html']);
const NEEDS_SDK = /\b(requireLogin|requireOnboarded|getSubscription)\(|import\(\s*SUPABASE_JS\s*\)|\bloadSupabase\(/;   // loadSupabase — jsdelivr 가 안 되면 다른 곳에서 받는 입구(supabase-config)

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ── supabase-js 판과 파일 목록 ── */
const CONFIG = read('assets/supabase-config.js');   // 접속 정보의 정본 — 여기서 읽는다(주소를 이 파일에 다시 박지 않는다)
const SUPABASE_JS = CONFIG.match(/SUPABASE_JS\s*=\s*'([^']+)'/)[1];
const SUPABASE = CONFIG.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
if (process.argv.includes('--cdn')) {
  const seen = []; const q = [SUPABASE_JS];
  while (q.length) {
    const u = q.shift(); if (seen.includes(u)) continue; seen.push(u);
    const src = await (await fetch(u)).text();
    for (const m of src.matchAll(/(?:from|import)\s*["'](\/npm\/[^"']+)["']/g)) q.push('https://cdn.jsdelivr.net' + m[1]);
  }
  writeFileSync(CDN_JSON, JSON.stringify({ entry: SUPABASE_JS, files: seen }, null, 2) + '\n');
  console.log(`cdn.json — ${seen.length}개 파일`);
}
const CDN = JSON.parse(readFileSync(CDN_JSON, 'utf8'));
if (CDN.entry !== SUPABASE_JS) {
  console.error(`❌ supabase-js 판이 바뀌었다 (${SUPABASE_JS}) — node tools/preload/build.mjs --cdn 으로 cdn.json 을 다시 뽑아라`);
  process.exit(1);
}

/* ── 글꼴 조각: 글자 → 조각 번호 ── */
const ranges = [];   // [from, to, file]
for (const m of read(FONT_CSS.slice(1)).matchAll(/src:\s*url\(\.\/([^)]+)\)[^;]*;\s*unicode-range:\s*([^;]+);/g)) {
  const file = '/assets/fonts/pretendard/' + m[1];
  for (const r of m[2].split(',')) {
    const [a, b] = r.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16));
    ranges.push([a, b ?? a, file]);
  }
}
const fontOf = (cp) => { for (const [a, b, f] of ranges) if (cp >= a && cp <= b) return f; return null; };
const fontNum = (f) => +f.match(/subset\.(\d+)\./)[1];

/** 마크업에 보이는 글자. 스크립트·스타일·주석·<head>·[hidden] 묶음은 뺀다. */
function visibleText(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<body[^>]*>/i, '')
    .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, '');
  const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
  let out = '', skip = 0;
  const stack = [];
  for (const m of body.matchAll(/<(\/)?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g)) {
    if (m[4] !== undefined) { if (!skip) out += m[4]; continue; }
    const [, close, tag, attrs] = m;
    if (!close) {
      // 입력칸 안내 글자는 그려진다
      const ph = attrs.match(/\bplaceholder="([^"]*)"/); if (ph && !skip) out += ph[1];
      if (VOID.test(tag) || /\/\s*$/.test(attrs)) continue;
      const hid = /(^|\s)hidden(\s|=|$)/.test(attrs);
      stack.push([tag.toLowerCase(), hid]); if (hid) skip++;
    } else {
      // 닫는 태그 — 같은 이름이 나올 때까지 거슬러 닫는다(</p>·</li> 처럼 생략된 닫기 태그에 너그럽게)
      const name = tag.toLowerCase();
      if (!stack.some(([t]) => t === name)) continue;   // 짝 없는 닫기 태그는 무시
      for (;;) { const [t, h] = stack.pop(); if (h) skip--; if (t === name) break; }
    }
  }
  return out.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/* ── 모듈 그래프 ── */
const importsOf = (src) => [...src.matchAll(/import\s+(?:[^'"()]*?\s+from\s+)?['"](\/assets\/[^'"]+\.js)['"]/g)].map((m) => m[1]);
function moduleGraph(html) {
  const mods = [...html.matchAll(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const all = new Set(); const q = mods.flatMap(importsOf);
  while (q.length) { const f = q.shift(); if (all.has(f)) continue; all.add(f); q.push(...importsOf(read(f.slice(1)))); }
  return { files: [...all].sort(), code: mods.join('\n') };
}

const fontsOf = (html) => { const s = new Set(); for (const ch of visibleText(html)) { const f = fontOf(ch.codePointAt(0)); if (f) s.add(f); } return s; };
/** 흔한 음절 조각 — 화면 80% 이상의 마크업이 쓰는 조각은 모든 화면에 넣는다. JS 가 그리는 글자(공고 목록·아티클 본문)도
 *  거의 늘 이 조각을 쓰는데, 마크업에 없으면 늦게 받아 그것이 화면이 뜨는 시각이 됐다(2026-10-15 실측 — 공고·인사이트). */
let CORE = new Set();

function block(html, page) {
  const { files, code } = moduleGraph(html);
  const usesApi = files.some((f) => /\/(track|supabase-config)\.js$/.test(f)) || /supabase-config\.js/.test(code);
  const sdk = NEEDS_SDK.test(code);
  const fonts = NO_FONT_PRELOAD.has(page) ? new Set() : new Set([...fontsOf(html), ...CORE]);
  const lines = [BEGIN];
  // 페이지가 손으로 이미 연결해 두었으면 또 넣지 않는다(auth/callback)
  const pre = (u) => { const l = `<link rel="preconnect" href="${u}" crossorigin>`; if (!html.includes(l)) lines.push(l); };
  if (usesApi) pre(SUPABASE);
  if (sdk) pre('https://cdn.jsdelivr.net');
  for (const f of [...fonts].sort((a, b) => fontNum(a) - fontNum(b)))
    lines.push(`<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`);
  for (const f of files) lines.push(`<link rel="modulepreload" href="${f}">`);
  if (sdk) for (const u of CDN.files) lines.push(`<link rel="modulepreload" href="${u}" crossorigin>`);
  lines.push(END);
  return lines.join('\n');
}

function pages(dir = ROOT) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(n)) out.push(...pages(p)); }
    else if (n === 'index.html') out.push(relative(ROOT, p));
  }
  return out.sort();
}

let stale = 0;
const FONT_LINK = `<link rel="stylesheet" href="${FONT_CSS}">`;
const OLD_BLOCK = new RegExp(`${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END}\\n`);
const all = pages().map((p) => [p, read(p)]);
// 글꼴 CSS 를 쓰는데 링크 모양이 달라 자리를 못 찾으면 조용히 빠지지 않게 멈춘다
const odd = all.filter(([, h]) => h.includes(FONT_CSS) && !h.includes(FONT_LINK)).map(([p]) => p);
if (odd.length) { console.error(`❌ 글꼴 링크 모양이 달라 묶음 자리를 못 찾았다: ${odd.join(', ')} — ${FONT_LINK} 로 맞춰라`); process.exit(1); }
const targets = all.filter(([, h]) => h.includes(FONT_LINK));   // Pretendard 를 안 쓰는 페이지는 대상이 아니다
const count = new Map();
for (const [, h] of targets) for (const f of fontsOf(h)) count.set(f, (count.get(f) || 0) + 1);
CORE = new Set([...count].filter(([, n]) => n >= targets.length * 0.8).map(([f]) => f));
for (const [p, html] of targets) {
  const old = html.match(OLD_BLOCK);
  const base = old ? html.replace(old[0], '') : html;
  const next = base.replace(FONT_LINK, block(base, p) + '\n' + FONT_LINK);
  if (next === html) continue;
  stale++;
  if (CHECK) console.error(`❌ ${p} — 미리받기 묶음이 낡았다`);
  else { writeFileSync(join(ROOT, p), next); console.log(`✏️  ${p}`); }
}
if (CHECK && stale) { console.error(`\n→ node tools/preload/build.mjs 로 다시 만들어 커밋하라 (${stale}곳)`); process.exit(1); }
if (CHECK) console.log('✅ 미리받기 묶음 — 전부 최신');
