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
import { execFileSync } from 'node:child_process';
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

/* ---------- 매핑 정본은 page-figma-map.json 이다 (2026-08-08 신설) ----------
 * 프레임 id 를 이 스냅샷과 page-figma-map.json 이 **따로** 들고 있어서, 한쪽만 고치면
 * 조용히 어긋난다. 실제로 onboarding/2 가 "선택됨"(275:2422)을 가리킨 채 몇 달 막혀 있었고,
 * 고칠 때도 두 파일을 각각 고쳐야 했다. 등록부가 정본이니 다르면 여기서 막는다. */
const mapPath = join(HERE, 'page-figma-map.json');
const pageMap = existsSync(mapPath)
  ? (JSON.parse(readFileSync(mapPath, 'utf8')).pages || {})
  : null;

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

if (pageMap) {
  for (const page of snap.pages) {
    const reg = pageMap[page.html];
    if (!reg) {
      findings.push({ level: 'DIFF', page: page.html, kind: '등록부 누락',
        detail: `${page.html} 이 page-figma-map.json 에 없습니다 — 등록부가 정본입니다` });
    } else if (reg.node !== page.figmaNode) {
      findings.push({ level: 'DIFF', page: page.html, kind: '매핑 불일치',
        detail: `등록부 ${reg.node} (${reg.name}) ↔ 스냅샷 ${page.figmaNode} (${page.name}) — ` +
                '등록부가 정본입니다. 스냅샷을 그 프레임에서 다시 뽑아 두 값을 맞추세요' });
    }
  }
} else {
  findings.push({ level: 'DIFF', page: '-', kind: '등록부 없음',
    detail: 'page-figma-map.json 을 찾지 못해 매핑 대조를 못 했습니다' });
}

/* ---------- 스냅샷 신선도 (2026-08-10 신설) ----------
 * 이 검수는 "커밋된 스냅샷 ↔ 웹" 만 본다. 그래서 피그마만 바뀌면 스냅샷도 웹도 그대로라
 * 조용히 통과한다 — STEP1 의 desc 가 실제로 그렇게 어긋난 채 있었고, 그날 웹을 고친
 * 푸시가 이 검수를 통과했다.
 * CI 가 피그마를 직접 읽을 길은 없다 — 저장소·워크플로 어디에도 Figma 토큰이 없고
 * 덤프는 에이전트가 만들어 넣는다. 그래서 강제할 수 있는 것은 이것 하나다:
 * **html 을 고쳤으면 그 페이지를 다시 뽑아라.** 다시 뽑는 순간 피그마와의 차이는
 * 아래 문구 대조에 걸린다.
 *
 * 못 보는 것 두 가지 — 알고 감수한다:
 *   · 피그마만 바뀌고 웹은 아무도 안 건드리는 구간. (토큰이 없어 CI 가 피그마를 못 읽는다)
 *   · 같은 날 뽑고 같은 날 또 고치는 것. 비교 단위가 '날' 이라 edited == dumpedAt 이면 통과한다.
 *     시각까지 보려면 dumpedAt 이 타임스탬프여야 하는데, 그 값은 사람이 손으로 적는 값이라
 *     시각을 요구하면 더 부정확해진다. */
const git = (args) => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }); }
  catch { return null; }
};
const dirty = git(['status', '--porcelain']);
// %cs 는 **커밋에 박제된 오프셋**(우리 커밋은 +0900)으로 찍히고 검수를 도는 기계의 TZ 를
// 따라가지 않는다. 그래서 아직 커밋 안 된 수정에 쓸 '오늘' 을 기계 로컬로만 잡으면,
// UTC 컨테이너에서 KST 00~09시에 돌 때 하루 이르게 계산돼 낡은 스냅샷이 통과한다.
// 로컬·UTC 중 **늦은 쪽**을 택한다 — 틀려도 "다시 뽑아라" 쪽으로 틀린다.
const now = new Date();
const localDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const today = [localDay, now.toISOString().slice(0, 10)].sort().pop();
for (const page of snap.pages) {
  if (!page.dumpedAt) {
    findings.push({ level: 'STALE', page: page.html, kind: '뽑은 날 없음',
      detail: 'dumpedAt 이 없어 신선도를 판정할 수 없습니다' });
    continue;
  }
  const last = git(['log', '-1', '--format=%cs', '--', page.html]);
  if (last === null || dirty === null) {
    findings.push({ level: 'STALE', page: page.html, kind: '판정 불가',
      detail: 'git 을 부르지 못해 신선도를 판정하지 못했습니다 — 못 돈 검수를 통과로 세지 않습니다' });
    continue;
  }
  const edited = dirty.split('\n').some((l) => l.slice(3).startsWith(page.html)) ? today : last.trim();
  // git 이 그 경로를 모르면(새로 만들고 아직 커밋 안 한 페이지 — 추적 안 되는 디렉터리는
  // porcelain 에도 'onboarding/9/' 처럼 디렉터리로만 나와 위 대조에 안 걸린다) last 가 빈
  // 문자열로 온다. 빈 값을 '안 고쳤다' 로 읽으면 새 페이지가 조용히 통과한다.
  if (!edited) {
    findings.push({ level: 'STALE', page: page.html, kind: '판정 불가',
      detail: `${page.html} 이 git 이력에 없어 신선도를 판정하지 못했습니다 — 커밋한 뒤 다시 검사하세요` });
    continue;
  }
  if (edited > page.dumpedAt) {
    findings.push({ level: 'STALE', page: page.html, kind: '스냅샷이 낡음',
      detail: `${page.html} 을 ${edited} 에 고쳤는데 스냅샷은 ${page.dumpedAt} 판입니다 — ` +
              `피그마 ${page.figmaNode} 에서 다시 뽑고 dumpedAt 을 올리세요` });
  }
}

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
  //
  // 예외 — jsRenderedText: 웹이 JS 로 그리는 문구는 정적 HTML 에 없다 (2026-08-07).
  //   온보딩 CTA 가 그렇다. 마크업에는 '다음' 만 있고, 선택 수에 따라 스크립트가
  //   '직무를 1개 이상 골라주세요' / '다음 · N개 선택됨' 으로 바꿔 쓴다.
  //   피그마 프레임은 그 결과 상태를 그린 것이므로 **드리프트가 아니라 검수 방식의 한계**다.
  //   이걸 DIFF 로 두면 진짜 차이가 소음에 묻힌다. 대신 스냅샷에 그 문구를 명시하게 해서
  //   "왜 빠지는지" 가 파일에 남게 한다 — 조용히 사라지지 않는다.
  const jsRendered = new Set((page.jsRenderedText || []).map(key));
  for (const t of figma) {
    const k = key(t);
    if (jsRendered.has(k)) continue;
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
const hard = findings.filter((f) => f.level === 'DIFF' || f.level === 'EXTRA' || f.level === 'STALE').length;

if (asJson) {
  console.log(JSON.stringify({ findings, counts: { figmaTexts: figmaCount, webBlocks: webCount }, pages: snap.pages.map((p) => p.html) }, null, 2));
} else {
  const oldest = snap.pages.map((p) => p.dumpedAt).filter(Boolean).sort()[0];
  console.log(`\n기준: 피그마 ${snap.fileKey} / 섹션 ${snap.section} (가장 오래된 스냅샷 ${oldest})`);
  console.log(`대상: ${snap.pages.map((p) => `${p.html} ↔ ${p.figmaNode}`).join(', ')}`);
  console.log(`피그마 문구 ${figmaCount}개 ↔ 웹 블록 ${webCount}개 대조\n`);
  if (findings.length === 0) {
    console.log('✅ 차이 없음 — 약관·개인정보 화면이 피그마와 웹에서 일치합니다.\n');
  } else {
    const order = { STALE: 0, DIFF: 1, EXTRA: 2, PUNCT: 3 };
    findings.sort((a, b) => order[a.level] - order[b.level]);
    for (const f of findings) {
      const tag = { STALE: '🕗 낡음', DIFF: '❌ 차이', EXTRA: 'ℹ️ 웹전용', PUNCT: '⚠️ 부호' }[f.level];
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
