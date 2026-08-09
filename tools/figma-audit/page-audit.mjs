#!/usr/bin/env node
/**
 * 결과물 공통 점검 — 저장소의 모든 페이지에 적용된다.
 *
 *   node tools/figma-audit/page-audit.mjs [--json]
 *
 * audit.mjs 는 피그마 기준이 있는 index.html 만 본다.
 * 이 스크립트는 기준 프레임이 없는 나머지 결과물(letter/signup/terms/privacy, CNAME, assets)까지
 * "이건 어느 페이지든 틀리면 안 된다" 수준의 것만 본다.
 *
 * 검사 항목
 *   1) 링크   — 로컬 href/src 와 JS 이동 경로(location.href/replace/assign)가 실제 파일로 존재하는가 (대소문자 포함)
 *   2) 머리   — DOCTYPE / lang / charset / viewport / title 이 있는가
 *   3) 자리표시 — YOUR_*, TODO, Lorem, example.com 이 살아있는 마크업에 남아 있는가
 *   4) 도메인 — 우리 도메인 절대 URL 이 CNAME 과 일치하는가, http:// 외부 리소스가 없는가
 *   5) 태그   — 블록 태그 여닫음 수가 맞는가
 *   6) CNAME  — 호스트명 한 줄인가
 *   7) 고아 자산 — assets/ 에 아무 페이지도 안 쓰는 파일이 있는가 (경고)
 *
 * 종료코드: BLOCK 0건이면 0, 아니면 1. (WARN 은 출력만 하고 통과)
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const asJson = process.argv.includes('--json');

const findings = [];
const add = (level, kind, file, detail, note) => findings.push({ level, kind, file, detail, note });

/* ---------- 대상 수집 ---------- */

// 루트뿐 아니라 하위 폴더까지 훑는다 — 온보딩처럼 /onboarding/1/index.html 로
// 폴더 주소를 쓰는 페이지가 검수 사각지대에 남지 않도록. (2026-08-02)
const SKIP_DIRS = new Set(['node_modules', '.git', 'tools', '.github']);
const collectFiles = (dir, prefix = '') => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const rel = prefix ? posix.join(prefix, entry) : entry;
    if (statSync(full).isDirectory()) out.push(...collectFiles(full, rel));
    else if (entry.endsWith('.html') || entry.endsWith('.js')) out.push(rel);
  }
  return out;
};
const files = collectFiles(ROOT).sort();
// 페이지 단위 검사(머리·색인·피그마 대응)는 .html 만 받는다.
const pages = files.filter((f) => f.endsWith('.html'));
// JS 이동·모듈 import 는 .html 안에만 있지 않다 — assets/onboarding-store.js 의
// location.href='/signup/' 는 .html 만 모으던 수집기의 시야 밖이라 영영 안 보였다. (2026-08-09)
const scripts = files.filter((f) => f.endsWith('.js'));
const cnamePath = join(ROOT, 'CNAME');
const domain = existsSync(cnamePath) ? readFileSync(cnamePath, 'utf8').trim() : null;

/* ---------- CNAME ---------- */

if (existsSync(cnamePath)) {
  const raw = readFileSync(cnamePath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim() !== '');
  if (lines.length !== 1) {
    add('BLOCK', 'CNAME 형식', 'CNAME', `줄이 ${lines.length}개입니다`, 'GitHub Pages 는 호스트명 한 줄만 받습니다');
  } else if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(lines[0].trim())) {
    add('BLOCK', 'CNAME 형식', 'CNAME', `"${lines[0].trim()}"`, 'http:// 나 끝 슬래시 없이 호스트명만 적습니다');
  }
}

/* ---------- 페이지별 ---------- */

const referenced = new Set();
const PLACEHOLDERS = [
  ['BLOCK', /YOUR_[A-Z_]+/g, '발급 전 자리표시자'],
  ['BLOCK', /Lorem ipsum/gi, '더미 문구'],
  ['BLOCK', /[a-z0-9._-]+@example\.com/gi, '예시 이메일'],
  ['BLOCK', /여기에\s*(입력|넣|채우)/g, '자리표시 문구'],
  ['WARN', /\bTODO\b|\bFIXME\b/g, '미완료 표시'],   // 개발 메모는 배포를 막을 일은 아니다
];
const BLOCK_TAGS = ['html', 'head', 'body', 'div', 'section', 'header', 'footer', 'main', 'ul', 'ol', 'table', 'style', 'script'];

const checkLink = (page, url) => {
  if (!url || url.startsWith('#') || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:')) return;

  if (/^http:\/\//i.test(url)) {
    add('BLOCK', '비보안 리소스', page, url, 'https 로 바꾸세요 — https 페이지에서 차단됩니다');
    return;
  }
  if (/^https?:\/\//i.test(url)) {
    if (domain) {
      const host = url.replace(/^https?:\/\//i, '').split('/')[0];
      if (/github\.io$/i.test(host)) {
        add('BLOCK', '도메인 불일치', page, url, `커스텀 도메인 ${domain} 을 쓰세요`);
      }
    }
    return;
  }
  // 로컬 경로
  // "/onboarding/1/" 처럼 슬래시로 시작하면 저장소 루트 기준, 아니면 그 페이지가 있는 폴더 기준이다.
  // 폴더로 끝나는 주소는 GitHub Pages 가 그 안의 index.html 을 준다 — 그걸로 판정한다. (2026-08-02)
  const bare = url.split(/[?#]/)[0];
  if (!bare) return;
  const fromRoot = bare.startsWith('/');
  const pageDir = page.includes('/') ? posix.dirname(page) : '';
  const parts = (fromRoot ? bare : posix.join(pageDir, bare)).split('/').filter((p) => p && p !== '.');
  // ".." 정리
  const norm = [];
  for (const p of parts) { if (p === '..') norm.pop(); else norm.push(p); }
  const clean = norm.join('/');
  const target = clean ? join(ROOT, clean) : ROOT;

  if (!existsSync(target)) {
    add('BLOCK', '깨진 링크', page, url, '해당 파일이 저장소에 없습니다');
    return;
  }
  // 대소문자까지 일치하는지 (GitHub Pages 는 대소문자를 구분한다)
  let dir = ROOT;
  let ok = true;
  for (const part of norm) {
    if (!readdirSync(dir).includes(part)) { ok = false; break; }
    dir = join(dir, part);
  }
  if (!ok) {
    add('BLOCK', '대소문자 불일치', page, url, 'GitHub Pages 는 경로 대소문자를 구분합니다');
    return;
  }
  if (statSync(target).isDirectory() && !existsSync(join(target, 'index.html'))) {
    add('BLOCK', '폴더 주소에 index 없음', page, url, '폴더 주소는 그 안의 index.html 로 열립니다 — 파일을 만드세요');
    return;
  }
  if (clean.startsWith('assets/')) referenced.add(clean.slice('assets/'.length));
};

/* JS 로 이동하는 경로도 링크다.
   href/src 만 훑으면 온보딩 퍼널이 통째로 사각지대다 — STEP1→2→3 이동에 <a href> 는 한 곳도
   없고 전부 location.href/replace 다. 오타를 내도 '깨진 링크' 가 안 뜨고 404 만 라이브에 나간다. */
const ID = '[A-Za-z_$][\\w$]*';

const navTargets = (src) => {
  const out = [];
  // 직접 이동 — location.href='…' / location.replace('…') / location.assign('…')
  for (const m of src.matchAll(/\blocation(?:\.href)?\s*(?:=|\.(?:replace|assign)\s*\()\s*['"]([^'"]*)['"]/g)) {
    out.push(m[1]);
  }

  // 래퍼를 거치는 이동. auth/callback/index.html 은 이동이 전부 ccGo() 라 위 정규식이 0건이었다 —
  // 검사는 도는데 무는 것이 없는 상태였다. (2026-08-09)
  // location 에 **인자를 그대로** 넘기는 함수를 찾고, 그 함수를 부르는 자리의 문자열을 대상으로 본다.
  const names = new Set();
  for (const m of src.matchAll(new RegExp(`\\blocation(?:\\.href)?\\s*(?:=|\\.(?:replace|assign)\\s*\\()\\s*(${ID})\\s*[),;]`, 'g'))) {
    const def = [...src.slice(0, m.index).matchAll(
      new RegExp(`(?:function\\s+(${ID})\\s*\\(|(?:window\\.)?(${ID})\\s*=\\s*(?:async\\s+)?(?:function\\s*)?\\(?\\s*)${m[1]}\\b`, 'g'),
    )].pop();
    if (def) names.add(def[1] || def[2]);
  }
  // 다른 이름으로 받아 쓰는 경우 (const go = window.ccGo)
  for (const name of [...names]) {
    for (const m of src.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(${ID})\\s*=\\s*(?:window\\.)?${name}\\b`, 'g'))) names.add(m[1]);
  }
  for (const name of names) {
    for (const m of src.matchAll(new RegExp(`\\b(?:window\\.)?${name}\\s*\\(([^)]*)\\)`, 'g'))) {
      // 삼항으로 두 경로를 넘기는 곳이 있어 인자 안의 문자열을 전부 본다
      for (const s of m[1].matchAll(/['"]([^'"]*)['"]/g)) out.push(s[1]);
    }
  }
  return out;
};

/** JS 이동 + ES 모듈 import. .html 의 <script> 와 .js 파일에 똑같이 돌린다. */
const checkScriptRefs = (file, src) => {
  for (const t of navTargets(src)) checkLink(file, t.trim());

  /* ES 모듈 import 도 자산 참조다.
     href/src 만 훑으면 `import { x } from '/assets/track.js'` 를 못 본다.
     2026-08-03 에 track.js 를 추가하고 실제로 '안 쓰는 자산' 오탐이 났다.
     경로가 틀렸을 때 잡아 주는 쪽이 더 중요하므로 존재 여부도 함께 본다. */
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\/assets\/[^'"]+)['"]/g)) {
    const rel = m[1].replace(/^\//, '');
    if (!existsSync(join(ROOT, rel))) {
      add('BLOCK', '깨진 모듈 import', file, m[1], '그 경로에 파일이 없습니다');
    } else {
      referenced.add(rel.slice('assets/'.length));
    }
  }
};

for (const page of pages) {
  const raw = readFileSync(join(ROOT, page), 'utf8');

  // 주석 제거본(자리표시자·태그 균형 판정용) — 주석 안의 픽셀 코드까지 잡으면 오탐
  const live = raw.replace(/<!--[\s\S]*?-->/g, '');

  /* 1) 머리 — 주석 제거본으로 본다.
     브라우저는 주석 안의 태그를 읽지 않는다. raw 로 보면 <!-- <meta …> --> 로 죽여 놓은 태그가
     "있는 것" 으로 통과한다. 아래 색인 정책 검사도 같은 이유로 live 를 쓴다. */
  if (!/^﻿?\s*<!DOCTYPE html>/i.test(live)) add('BLOCK', '머리 누락', page, '<!DOCTYPE html> 이 없습니다');
  if (!/<html[^>]*\blang="ko"/i.test(live)) add('BLOCK', '머리 누락', page, 'html lang="ko" 가 없습니다');
  if (!/<meta[^>]*charset=/i.test(live)) add('BLOCK', '머리 누락', page, '<meta charset> 이 없습니다');
  if (!/<meta[^>]*name="viewport"/i.test(live)) add('BLOCK', '머리 누락', page, '<meta name="viewport"> 가 없습니다');
  // 브라우저 자동 다크 테마 차단 — 'light' 만으로는 안 막힌다. 'only light' 여야 한다. (2026-08-03)
  const cs = live.match(/<meta[^>]*name="color-scheme"[^>]*content="([^"]*)"/i);
  if (!cs) {
    add('BLOCK', '머리 누락', page, '<meta name="color-scheme" content="only light"> 가 없습니다',
        '없으면 안드로이드 크롬 자동 다크 테마가 페이지 색을 임의로 바꿉니다');
  } else if (!/\bonly\s+light\b/i.test(cs[1])) {
    add('BLOCK', 'color-scheme 값', page, `content="${cs[1]}"`,
        "'light' 만으로는 자동 다크가 그대로 적용됩니다 — 'only light' 로 쓰세요");
  }
  const title = live.match(/<title>([\s\S]*?)<\/title>/i);
  if (!title || !title[1].trim()) add('BLOCK', '머리 누락', page, '<title> 이 비었습니다');
  else if (!title[1].includes('커리어코치')) add('WARN', '제목', page, `"${title[1].trim()}" — 서비스명이 없습니다`);

  /* 2) 링크 */
  for (const m of live.matchAll(/(?:href|src)="([^"]*)"/gi)) checkLink(page, m[1].trim());

  /* 2-a) JS 이동·모듈 import — .js 파일에도 같은 검사를 돌린다 (아래 루프) */
  checkScriptRefs(page, live);

  /* 2-b) 우리 도메인 절대 URL (og:image, canonical 등) 도 실제 파일이어야 한다 */
  if (domain) {
    const own = new RegExp(`https://${domain.replace(/\./g, '\\.')}(/[^"'\\s]*)`, 'gi');
    for (const m of live.matchAll(own)) {
      const path = m[1].split(/[?#]/)[0];
      if (path === '/' || path === '') continue;
      const rel = path.replace(/^\//, '');
      if (!existsSync(join(ROOT, rel))) {
        add('BLOCK', '깨진 절대 URL', page, m[0], '우리 도메인을 가리키는데 저장소에 그 파일이 없습니다');
      } else if (rel.startsWith('assets/')) {
        referenced.add(rel.slice('assets/'.length));
      }
    }
  }

  /* 3) 자리표시자 */
  for (const [level, re, label] of PLACEHOLDERS) {
    const hits = [...live.matchAll(re)].map((h) => h[0]);
    if (hits.length) add(level, '자리표시자', page, `${label}: ${[...new Set(hits)].join(', ')}`, '실값으로 바꾸거나 주석 처리하세요');
  }

  /* 4) 태그 균형 */
  const stripped = live
    .replace(/<script[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style[\s\S]*?<\/style>/gi, '<style></style>');
  for (const tag of BLOCK_TAGS) {
    const open = (stripped.match(new RegExp(`<${tag}(?=[\\s>])`, 'gi')) || []).length;
    const close = (stripped.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length;
    if (open !== close) add('BLOCK', '태그 불균형', page, `<${tag}> ${open}개 / </${tag}> ${close}개`);
  }

  /* 5) 폰트 */
  if (!/Pretendard/i.test(raw)) add('WARN', '폰트', page, 'Pretendard 지정이 없습니다');

  /* 6) 빈 링크 */
  const deadHref = (live.match(/href="#"/g) || []).length;
  if (deadHref) add('WARN', '빈 링크', page, `href="#" ${deadHref}개`, '샘플이면 그대로 둬도 됩니다');
}

// 페이지가 부르는 .js 도 같은 눈으로 본다. 여기 있는 이동은 페이지 HTML 어디에도 안 적혀 있다.
for (const s of scripts) checkScriptRefs(s, readFileSync(join(ROOT, s), 'utf8'));

/* ---------- 가격 하드코딩 ----------
 * 페이지·약관 어디에도 **고정 금액을 쓰지 않는다.** (2026-08-03 사용자 결정)
 *
 * 프라이싱 테스트를 할 예정이라, 금액이 박혀 있으면 가격을 바꿀 때마다
 * 랜딩·약관·피그마·문서를 동시에 고쳐야 하고 하나라도 빠지면 표시가격과 계약조건이
 * 어긋난다. 약관 제5조에 있던 "월 990원(정가 2,000원)"이 정확히 그 상태였다.
 * 대신 "결제 화면에 표시된 내용을 따른다"로 두고, 실제 금액은 결제 화면 한 곳에서만 말한다.
 *
 * 결제 화면이 생기면 그 파일만 PRICE_OK 에 넣는다 — 금액을 말하는 곳이 하나뿐이어야
 * 이 규칙이 의미가 있다.
 */
const PRICE_OK = new Set([]);          // 결제 화면이 생기면 여기에 추가
// 한국어 금액은 '만/억' 단위가 기본이다. 숫자+원 만 보면 '월 1만원'·'연 5만 원'·'₩9,900' 이
// 전부 빠져나가, 정작 가장 흔한 표기가 검사 밖이었다.
const PRICE_RE = /₩\s*[0-9][0-9,]*|[0-9][0-9,]*\s*(?:[억만천]\s*)*원/g;

/** 금액처럼 보이지만 구독가가 아닌 문구 — 파일별로 사유와 함께 적는다.
 *  사유 없는 면제는 검사를 조용히 끄는 것과 같다 (figma-tree.json 의 pageLevelAllowed 와 같은 규칙). */
const PRICE_ALLOW = {
  'index.html': {
    '4,000만원': '히어로 일러스트 alt — 이직 전후 연봉 그래프 설명이지 우리 가격이 아니다',
    '5,000만원': '히어로 일러스트 alt — 이직 전후 연봉 그래프 설명이지 우리 가격이 아니다',
  },
};

for (const page of pages) {
  if (PRICE_OK.has(page)) continue;
  const html = readFileSync(join(ROOT, page), 'utf8');
  const live = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const allow = PRICE_ALLOW[page] || {};
  const hits = [...new Set(live.match(PRICE_RE) || [])].filter((h) => !allow[h.trim()]);
  if (hits.length) {
    add('BLOCK', '가격 하드코딩', page, hits.join(', '),
        '고정 금액을 페이지에 두지 않습니다. "결제 화면에 표시된 내용을 따릅니다" 로 쓰거나, ' +
        '결제 화면이라면 page-audit.mjs 의 PRICE_OK 에 이 파일을 추가하세요.');
  }
}

/* ---------- 색인 정책 ----------
 * 색인돼도 되는 페이지는 랜딩과 법적 문서뿐이다. 나머지는 전부 noindex 여야 한다.
 *
 * 왜 검사로 만드는가 (2026-08-03)
 *   letter.html 은 실제 발행물이 아니라 데모인데, 실존 인물 이름과 "표본 추적 예시"라고
 *   각주를 단 통계가 들어 있다. 검색 결과에 뜨면 예시가 실측치로 읽힌다.
 *   그런데 이걸 사람 기억에 맡기면 새 페이지를 만들 때마다 다시 빠뜨린다 —
 *   실제로 signup/auth 에는 있었고 letter/onboarding 에는 없었다.
 *   "새 HTML 을 만들었으면 색인 여부를 정해야 한다"를 파이프라인이 묻게 한다.
 */
const INDEXABLE = new Set(['index.html', 'terms.html', 'privacy.html']);

for (const page of pages) {
  if (INDEXABLE.has(page)) continue;
  // 주석 제거본으로 본다 — 주석으로 죽여 놓은 noindex 는 브라우저에 없는 것이다.
  const html = readFileSync(join(ROOT, page), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  if (!/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) {
    add('BLOCK', '색인 정책', page,
        'noindex 메타가 없습니다',
        `색인해야 할 페이지면 page-audit.mjs 의 INDEXABLE 에 추가하고, 아니면 <head> 에 ` +
        `<meta name="robots" content="noindex,nofollow"> 를 넣으세요. robots.txt 도 함께 보세요.`);
  }
}

// robots.txt / sitemap.xml 이 사라지면 위 검사만으로는 안 잡힌다 (noindex 는 페이지에만 있다).
for (const f of ['robots.txt', 'sitemap.xml']) {
  if (!existsSync(join(ROOT, f))) {
    add('WARN', '색인 정책', f, '파일이 없습니다', '검색엔진에 무엇을 보여줄지 명시하는 파일입니다');
  }
}

/* ---------- 피그마 대응 (완전성) ----------
 * 피그마가 단일 기준이면, 저장소의 모든 페이지에 피그마 짝이 있어야 한다.
 *
 * 왜 검사로 만드는가 (2026-08-07 사고)
 *   signup/index.html 과 auth/callback/index.html 이 피그마에 대응 화면 없이 라이브에 있었다.
 *   기존 검수는 전부 "피그마에 있는 것" 을 목록으로 들고 웹과 대조하는 구조다 —
 *   audit.mjs 는 프레임 6:148 하나, docs-audit.mjs 는 스냅샷 pages[] 세 개.
 *   그래서 웹에만 새로 생긴 페이지는 어느 검수의 시야에도 안 들어왔다.
 *   목록에 없으면 검사가 없고, 검사가 없으니 조용히 통과였다. 눈으로 찾을 때까지 몇 달이 걸렸다.
 *
 *   이 검사는 방향을 뒤집는다. 기준은 "저장소에 실재하는 HTML" 이고,
 *   그 각각에 대해 피그마 짝이 등록돼 있는지를 묻는다.
 *   등록도 면제도 없는 새 페이지는 푸시가 막힌다 — 색인 정책 검사와 같은 방식이다.
 */
const figmaMapPath = join(HERE, 'page-figma-map.json');
if (!existsSync(figmaMapPath)) {
  add('BLOCK', '피그마 대응', 'tools/figma-audit/page-figma-map.json',
      '페이지↔피그마 등록부가 없습니다',
      '이 파일이 있어야 "웹에는 있는데 피그마에는 없는 페이지" 를 잡을 수 있습니다.');
} else {
  const fmap = JSON.parse(readFileSync(figmaMapPath, 'utf8'));
  const mapped = fmap.pages || {};
  const exempt = fmap.exempt || {};

  for (const page of pages) {
    const entry = mapped[page];
    const reason = exempt[page];

    if (!entry && reason === undefined) {
      add('BLOCK', '피그마 대응', page,
          '피그마에 대응 화면이 등록돼 있지 않습니다',
          `피그마가 단일 기준입니다. 이 페이지의 화면을 피그마에 만들고 ` +
          `tools/figma-audit/page-figma-map.json 의 pages 에 {"node":"<프레임 id>","name":"<프레임 이름>","textAudit":"docs-audit"} 로 ` +
          `등록하세요. 피그마 화면이 필요 없는 페이지라면 같은 파일의 exempt 에 사유를 적으세요.`);
      continue;
    }
    if (!entry) {
      if (!String(reason).trim()) {
        add('BLOCK', '피그마 대응', page,
            'exempt 에 있지만 사유가 비어 있습니다',
            '왜 피그마 화면이 필요 없는지 한 문장으로 적으세요. 빈 사유는 "생각하지 않고 넘긴 것" 과 구별되지 않습니다.');
      }
      continue;
    }
    if (!/^\d+:\d+$/.test(String(entry.node || ''))) {
      add('BLOCK', '피그마 대응', page,
          `node 가 프레임 id 형식이 아닙니다: ${JSON.stringify(entry.node)}`,
          '"6:148" 처럼 <숫자>:<숫자> 형태여야 합니다.');
    }
    // 등록은 됐지만 문구 동기화 검수에 아직 안 들어간 페이지는 조용히 두지 않는다.
    if (entry.textAudit === 'pending') {
      add('WARN', '피그마 대응', page,
          `문구 동기화 미적용 (프레임 ${entry.node})`,
          entry.pendingSync || '사유가 적혀 있지 않습니다. page-figma-map.json 에 pendingSync 로 남기세요.');
    } else if (entry.textAudit !== 'docs-audit' && entry.textAudit !== 'audit') {
      add('BLOCK', '피그마 대응', page,
          `textAudit 값이 올바르지 않습니다: ${JSON.stringify(entry.textAudit)}`,
          '"audit"(랜딩 전용) · "docs-audit"(스냅샷 대조) · "pending"(사유 필수) 중 하나여야 합니다.');
    }
  }

  // 등록부가 낡는 것도 막는다 — 지운 페이지가 목록에 남아 있으면 "검사 중" 으로 착각한다.
  const live = new Set(pages);
  for (const p of [...Object.keys(mapped), ...Object.keys(exempt)]) {
    if (!live.has(p)) {
      add('BLOCK', '피그마 대응', 'tools/figma-audit/page-figma-map.json',
          `등록부에 있는 ${p} 가 저장소에 없습니다`,
          '페이지를 지웠다면 등록부에서도 지우세요. 낡은 항목은 "덮여 있다" 는 착각을 만듭니다.');
    }
  }

  // docs-audit 대상으로 등록해 놓고 스냅샷에는 안 넣은 경우 — 두 파일이 어긋나면 역시 사각지대다.
  const snapPath = join(HERE, 'figma-docs-text.json');
  if (existsSync(snapPath)) {
    const snapPages = new Set((JSON.parse(readFileSync(snapPath, 'utf8')).pages || []).map((p) => p.html));
    for (const [p, e] of Object.entries(mapped)) {
      if (e.textAudit === 'docs-audit' && !snapPages.has(p)) {
        add('BLOCK', '피그마 대응', p,
            'textAudit 이 docs-audit 인데 figma-docs-text.json 스냅샷에 없습니다',
            'CLAUDE.md "약관·개인정보·브리핑 화면 — 피그마↔웹 동기화" 의 덤프 스니펫으로 이 페이지를 스냅샷에 추가하세요.');
      }
    }
  }
}

/* ---------- 고아 자산 ---------- */

const assetsDir = join(ROOT, 'assets');
if (existsSync(assetsDir)) {
  for (const f of readdirSync(assetsDir)) {
    if (!statSync(join(assetsDir, f)).isFile()) continue;
    if (!referenced.has(f)) add('WARN', '안 쓰는 자산', `assets/${f}`, '어느 페이지에서도 참조하지 않습니다');
  }
}

/* ---------- 출력 ---------- */

const blocks = findings.filter((f) => f.level === 'BLOCK');

if (asJson) {
  console.log(JSON.stringify({ findings, pages, domain }, null, 2));
} else {
  console.log(`\n대상: ${pages.join(', ')}${domain ? ` · CNAME ${domain}` : ''}`);
  console.log(`페이지 ${pages.length}개 점검 (링크·머리·자리표시자·도메인·태그 균형)\n`);
  if (findings.length === 0) {
    console.log('✅ 결과물 공통 점검 통과\n');
  } else {
    findings.sort((a, b) => (a.level === b.level ? 0 : a.level === 'BLOCK' ? -1 : 1));
    for (const f of findings) {
      console.log(`${f.level === 'BLOCK' ? '❌ 막힘' : '⚠️ 경고'}  ${f.kind} [${f.file}]`);
      if (f.detail) console.log(`   상세  : ${f.detail}`);
      if (f.note) console.log(`   비고  : ${f.note}`);
      console.log('');
    }
    console.log(`총 ${findings.length}건 (조치 필요 ${blocks.length}건)\n`);
  }
}

process.exit(blocks.length ? 1 : 0);
