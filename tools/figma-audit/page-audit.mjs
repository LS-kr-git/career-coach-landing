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
 *   1) 링크   — 로컬 href/src 가 실제 파일로 존재하는가 (대소문자 포함)
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
const collectPages = (dir, prefix = '') => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const rel = prefix ? posix.join(prefix, entry) : entry;
    if (statSync(full).isDirectory()) out.push(...collectPages(full, rel));
    else if (entry.endsWith('.html')) out.push(rel);
  }
  return out;
};
const pages = collectPages(ROOT).sort();
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

for (const page of pages) {
  const raw = readFileSync(join(ROOT, page), 'utf8');

  // 주석 제거본(자리표시자·태그 균형 판정용) — 주석 안의 픽셀 코드까지 잡으면 오탐
  const live = raw.replace(/<!--[\s\S]*?-->/g, '');

  /* 1) 머리 */
  if (!/^﻿?\s*<!DOCTYPE html>/i.test(raw)) add('BLOCK', '머리 누락', page, '<!DOCTYPE html> 이 없습니다');
  if (!/<html[^>]*\blang="ko"/i.test(raw)) add('BLOCK', '머리 누락', page, 'html lang="ko" 가 없습니다');
  if (!/<meta[^>]*charset=/i.test(raw)) add('BLOCK', '머리 누락', page, '<meta charset> 이 없습니다');
  if (!/<meta[^>]*name="viewport"/i.test(raw)) add('BLOCK', '머리 누락', page, '<meta name="viewport"> 가 없습니다');
  // 브라우저 자동 다크 테마 차단 — 'light' 만으로는 안 막힌다. 'only light' 여야 한다. (2026-08-03)
  const cs = raw.match(/<meta[^>]*name="color-scheme"[^>]*content="([^"]*)"/i);
  if (!cs) {
    add('BLOCK', '머리 누락', page, '<meta name="color-scheme" content="only light"> 가 없습니다',
        '없으면 안드로이드 크롬 자동 다크 테마가 페이지 색을 임의로 바꿉니다');
  } else if (!/\bonly\s+light\b/i.test(cs[1])) {
    add('BLOCK', 'color-scheme 값', page, `content="${cs[1]}"`,
        "'light' 만으로는 자동 다크가 그대로 적용됩니다 — 'only light' 로 쓰세요");
  }
  const title = raw.match(/<title>([\s\S]*?)<\/title>/i);
  if (!title || !title[1].trim()) add('BLOCK', '머리 누락', page, '<title> 이 비었습니다');
  else if (!title[1].includes('커리어코치')) add('WARN', '제목', page, `"${title[1].trim()}" — 서비스명이 없습니다`);

  /* 2) 링크 */
  for (const m of live.matchAll(/(?:href|src)="([^"]*)"/gi)) {
    const url = m[1].trim();
    if (!url || url.startsWith('#') || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:')) continue;

    if (/^http:\/\//i.test(url)) {
      add('BLOCK', '비보안 리소스', page, url, 'https 로 바꾸세요 — https 페이지에서 차단됩니다');
      continue;
    }
    if (/^https?:\/\//i.test(url)) {
      if (domain) {
        const host = url.replace(/^https?:\/\//i, '').split('/')[0];
        if (/github\.io$/i.test(host)) {
          add('BLOCK', '도메인 불일치', page, url, `커스텀 도메인 ${domain} 을 쓰세요`);
        }
      }
      continue;
    }
    // 로컬 경로
    // "/onboarding/1/" 처럼 슬래시로 시작하면 저장소 루트 기준, 아니면 그 페이지가 있는 폴더 기준이다.
    // 폴더로 끝나는 주소는 GitHub Pages 가 그 안의 index.html 을 준다 — 그걸로 판정한다. (2026-08-02)
    const bare = url.split(/[?#]/)[0];
    if (!bare) continue;
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
      continue;
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
      continue;
    }
    if (statSync(target).isDirectory() && !existsSync(join(target, 'index.html'))) {
      add('BLOCK', '폴더 주소에 index 없음', page, url, '폴더 주소는 그 안의 index.html 로 열립니다 — 파일을 만드세요');
      continue;
    }
    if (clean.startsWith('assets/')) referenced.add(clean.slice('assets/'.length));
  }

  /* 2-a-2) ES 모듈 import 도 자산 참조다.
     href/src 만 훑으면 `import { x } from '/assets/track.js'` 를 못 본다.
     2026-08-03 에 track.js 를 추가하고 실제로 '안 쓰는 자산' 오탐이 났다.
     경로가 틀렸을 때 잡아 주는 쪽이 더 중요하므로 존재 여부도 함께 본다. */
  for (const m of live.matchAll(/(?:from|import)\s*\(?\s*['"](\/assets\/[^'"]+)['"]/g)) {
    const rel = m[1].replace(/^\//, '');
    if (!existsSync(join(ROOT, rel))) {
      add('BLOCK', '깨진 모듈 import', page, m[1], '그 경로에 파일이 없습니다');
    } else {
      referenced.add(rel.slice('assets/'.length));
    }
  }

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
const PRICE_RE = /[0-9][0-9,]*\s*원/g;

for (const page of pages) {
  if (PRICE_OK.has(page)) continue;
  const html = readFileSync(join(ROOT, page), 'utf8');
  const live = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const hits = [...new Set(live.match(PRICE_RE) || [])];
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
  const html = readFileSync(join(ROOT, page), 'utf8');
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
