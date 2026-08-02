#!/usr/bin/env node
/**
 * 약관·개인정보 화면 — 피그마 ↔ 웹 문구 동기화 검수
 *
 *   node tools/figma-audit/docs-audit.mjs [--json]
 *
 * audit.mjs 는 랜딩(index.html ↔ 프레임 6:148)만 본다. 이 스크립트는 그 밖의
 * "피그마 화면이 기준인" 문서 페이지 — 이용약관·개인정보처리방침 — 을 본다.
 *
 * 기준: 피그마 파일 LnT8TgFVBxky0bVyaF6Tob, 섹션 327:2474 "이용약관 / 개인정보처리방침"
 *   - terms.html   ↔ 프레임 339:2474 (이용약관)
 *   - privacy.html ↔ 프레임 340:2478 (개인정보처리방침)
 *
 * 피그마 텍스트는 커밋된 스냅샷 figma-docs-text.json 에 담겨 있다(마커 '•'·'1.' 제외).
 * 웹 텍스트는 각 html 을 태그 제거해 뽑는다. 둘을 공백 무시로 대조한다.
 *   · 피그마에 있는 문구가 웹에 없다  → ❌ 차이 (푸시 차단)
 *   · 웹에 있는 문구가 피그마에 없다  → ℹ️ 웹 전용 (푸시 차단 — 한쪽만 고친 것)
 *   · 글자는 같고 따옴표·말줄임표만 다름 → ⚠️ 부호 (알림만)
 *
 * 이렇게 해서 "한쪽(웹이든 피그마든)만 문구를 고치면 반드시 걸린다" 를 보장한다.
 * 피그마 화면을 고쳤으면 스냅샷을 다시 뽑아 커밋한다 — 절차는 CLAUDE.md
 * "약관·개인정보 화면 — 피그마↔웹 동기화" 참고.
 *
 * 종료코드: 차이(❌)·웹전용(ℹ️) 0건이면 0, 아니면 1. (부호 ⚠️ 는 통과)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const asJson = process.argv.includes('--json');

const snapPath = join(HERE, 'figma-docs-text.json');
if (!existsSync(snapPath)) {
  console.error('figma-docs-text.json 이 없습니다. CLAUDE.md "약관·개인정보 화면 — 피그마↔웹 동기화" 절차로 스냅샷을 뽑으세요.');
  process.exit(2);
}
const snap = JSON.parse(readFileSync(snapPath, 'utf8'));

/* ---------- 공통 유틸 (audit.mjs 와 동일 규칙) ---------- */
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m) => ENTITIES[m]);
}
const key = (s) => s.replace(/\s+/g, '');
const softKey = (s) => key(s)
  .replace(/[‘’‚‛']/g, "'").replace(/[“”„‟"]/g, '"')
  .replace(/[…]/g, '...').replace(/[–—]/g, '-');

const BLOCK = /<\/?(p|h1|h2|h3|h4|div|section|main|li|td|th|footer|header|a|span|br|strong|em)\b[^>]*>/gi;
function webBlocks(html) {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<head[\s\S]*?<\/head>/i, ' ');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  s = s.replace(BLOCK, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  return decodeEntities(s).split(' ').map((x) => x.replace(/[ \t]+/g, ' ').trim()).filter((x) => x.length > 0);
}

/* ---------- 실행 ---------- */
const findings = [];
let figmaCount = 0, webCount = 0;

for (const page of snap.pages) {
  const htmlPath = join(ROOT, page.html);
  if (!existsSync(htmlPath)) {
    findings.push({ level: 'DIFF', page: page.html, kind: '페이지 없음', detail: `${page.html} 파일이 저장소에 없습니다` });
    continue;
  }
  const html = readFileSync(htmlPath, 'utf8');
  const blocks = webBlocks(html);
  const lines = [];
  for (const b of blocks) for (const l of b.split('\n')) lines.push(l);

  const webAll = key(blocks.join(''));
  const webAllSoft = softKey(blocks.join(''));
  const webLineKeys = new Set(lines.map(key).concat(blocks.map(key)));

  const figma = page.texts.filter((t) => t && t.trim().length > 0);
  const figmaAll = key(figma.join(''));
  const figmaAllSoft = softKey(figma.join(''));
  const ignoreWeb = new Set((page.ignoreWebText || []).concat(snap.ignoreWebText || []).map(key));
  figmaCount += figma.length; webCount += blocks.length;

  // 1) 피그마 → 웹 : 피그마 문구가 웹에 있어야 한다
  for (const t of figma) {
    const k = key(t);
    if (webLineKeys.has(k) || webAll.includes(k)) continue;
    if (webAllSoft.includes(softKey(t))) {
      findings.push({ level: 'PUNCT', page: page.html, kind: '문장부호', figma: t, note: '글자·구성은 같고 따옴표/말줄임표만 다름' });
      continue;
    }
    const head = k.slice(0, 12);
    const near = blocks.find((b) => key(b).includes(head)) || null;
    findings.push({ level: 'DIFF', page: page.html, kind: '문구', figma: t, web: near, note: near ? '웹 문구가 피그마와 다름' : '웹에서 못 찾음 — 피그마를 바꿨으면 웹도 맞추세요' });
  }

  // 2) 웹 → 피그마 : 웹 문구가 피그마에 있어야 한다
  for (const line of lines) {
    const k = key(line);
    if (k.length < 4) continue;
    if (ignoreWeb.has(k)) continue;
    if (figmaAll.includes(k)) continue;
    if (figmaAllSoft.includes(softKey(line))) continue;
    findings.push({ level: 'EXTRA', page: page.html, kind: '웹 전용', web: line, note: '피그마에 없는 문구 — 웹만 고쳤거나, 피그마 스냅샷을 다시 뽑아야 합니다' });
  }
}

/* ---------- 출력 ---------- */
const hard = findings.filter((f) => f.level === 'DIFF' || f.level === 'EXTRA').length;

if (asJson) {
  console.log(JSON.stringify({ findings, counts: { figmaTexts: figmaCount, webBlocks: webCount }, pages: snap.pages.map((p) => p.html) }, null, 2));
} else {
  console.log(`\n기준: 피그마 ${snap.fileKey} / 섹션 ${snap.section} (스냅샷 ${snap.dumpedAt})`);
  console.log(`대상: ${snap.pages.map((p) => `${p.html} ↔ ${p.figmaNode}`).join(', ')}`);
  console.log(`피그마 문구 ${figmaCount}개 ↔ 웹 블록 ${webCount}개 대조\n`);
  if (findings.length === 0) {
    console.log('✅ 차이 없음 — 약관·개인정보 화면이 피그마와 웹에서 일치합니다.\n');
  } else {
    const order = { DIFF: 0, EXTRA: 1, PUNCT: 2 };
    findings.sort((a, b) => order[a.level] - order[b.level]);
    for (const f of findings) {
      const tag = { DIFF: '❌ 차이', EXTRA: 'ℹ️ 웹전용', PUNCT: '⚠️ 부호' }[f.level];
      console.log(`${tag}  ${f.kind} [${f.page}]`);
      if (f.figma) console.log(`   피그마: ${f.figma}`);
      if (f.web) console.log(`   웹    : ${f.web}`);
      if (f.detail) console.log(`   상세  : ${f.detail}`);
      if (f.note) console.log(`   비고  : ${f.note}`);
      console.log('');
    }
    console.log(`총 ${findings.length}건 (조치 필요 ${hard}건)\n`);
  }
}

process.exit(hard ? 1 : 0);
