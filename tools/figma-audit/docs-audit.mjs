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
/* 한 페이지가 보는 프레임 목록. node 는 기준 프레임이고 stateFrames 는 같은 화면의
 * 다른 상태(미선택·선택됨)다.
 *
 * 상태 프레임을 등록해서 실제로 잡히는 것과 안 잡히는 것을 갈라 적는다 — 안 그러면
 * "등록했으니 덮인다" 로 읽힌다.
 *   잡힌다: 공통 문구(제목·설명·칩 라벨)를 한쪽 프레임에서만 바꾸면 그 프레임이 웹과
 *           어긋나 피그마→웹 대조에 걸린다. 프레임별 신선도(dumpedAt)도 본다.
 *   못 잡는다: **칩 잠김 같은 색·상태는 문구가 아니라 이 검수의 원리상 못 본다.**
 *           CTA 의 선택 수도 런타임 숫자라 웹에 맞댈 문구가 없다 — 그래서 그것만은
 *           아래 '목업이 상한을 넘음' 이 웹 JS 의 상한 상수와 직접 맞대 본다.
 *
 * texts 에 `|| []` 를 두지 않는다. 키를 빠뜨리거나 오타 내면 빈 프레임이 되어 조용히
 * 통과하기 때문이다. 없으면 아래에서 막는다. */
const framesOf = (page) => [{
  node: page.figmaNode, name: page.name, dumpedAt: page.dumpedAt,
  texts: page.texts, jsRenderedText: page.jsRenderedText || [],
}].concat((page.stateFrames || []).map((f) => ({
  node: f.figmaNode, name: f.name, dumpedAt: f.dumpedAt,
  texts: f.texts, jsRenderedText: f.jsRenderedText || [],
})));

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
    } else {
      // 상태 프레임도 같은 이유로 두 파일이 따로 들고 있으면 조용히 어긋난다
      const regState = (reg.stateNodes || []).map((s) => s.id).join(',');
      const snapState = (page.stateFrames || []).map((f) => f.figmaNode).join(',');
      if (regState !== snapState) {
        findings.push({ level: 'DIFF', page: page.html, kind: '상태 프레임 불일치',
          detail: `등록부 stateNodes [${regState || '없음'}] ↔ 스냅샷 stateFrames [${snapState || '없음'}] — ` +
                  '두 파일에 같은 id 를 같은 순서로 적으세요' });
      }
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
// 날짜 비교에 들어가는 두 값(커밋 날짜·오늘)을 **KST 하나로** 정규화한다.
// 커밋 날짜는 커밋한 기계의 오프셋으로 박제되고(PC 는 +0900, CI 봇은 +0000), '오늘' 은
// 검수를 도는 기계의 TZ 를 따른다. 둘을 그대로 비교하면 양방향으로 하루씩 어긋난다:
//   · 커밋 +0900 · 검수 UTC → 커밋이 하루 늦게 보여 멀쩡한 스냅샷이 '낡음' 으로 막힌다
//   · 커밋 +0000 늦은 밤   → 커밋이 하루 이르게 보여 낡은 스냅샷이 조용히 통과한다
// 2026-08-11 에 앞의 것이 실제로 났고, dumpedAt 을 하루 올려 막는 바람에 뒤의 구멍이
// 이틀 열렸다. 그래서 한쪽만 맞추지 않고 둘 다 KST 로 읽는다 — 이 저장소의 다른 날짜
// 판정과 같은 기준이다(career-coach `docs/기획/전문-열람-규칙.md` 2절: KST 고정).
//
// 환산은 **산술로** 한다. KST 는 서머타임이 없어 언제나 +09:00 이므로 이걸로 충분하고,
// 아래 둘에 기대면 조용히 꺼진다 — 실패해도 초록불이라 안 보인다:
//   · `TZ=Asia/Seoul` 을 git 에 넘기기 — Git for Windows 는 IANA 이름을 무시할 수 있다
//   · `Intl` 로 날짜 문자열 만들기 — small-ICU 노드는 en-CA 를 en-US 로 폴백해
//     '08/11/2026' 을 주고, 그러면 dumpedAt 과의 문자열 비교가 늘 false 가 된다
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstDay = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
const git = (args) => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }); }
  catch { return null; }
};
const dirty = git(['status', '--porcelain']);
// 얕은 클론에서는 `git log -1 -- <경로>` 가 **모든 경로에 대해 tip 커밋**을 준다. 그러면
// 아래 신선도 판정이 "전부 오늘 고쳤다" 로 읽어 멀쩡한 스냅샷을 전부 '낡음' 으로 막는다.
// 원인을 모르면 스냅샷을 다시 뽑으러 가게 되므로(헛수고) 그 사실을 이름으로 말한다.
const shallow = (git(['rev-parse', '--is-shallow-repository']) || '').trim() === 'true';
const today = kstDay(Date.now());
for (const page of snap.pages) {
  const frames = framesOf(page);
  const noDate = frames.filter((f) => !f.dumpedAt);
  if (noDate.length) {
    findings.push({ level: 'STALE', page: page.html, kind: '뽑은 날 없음',
      detail: `dumpedAt 이 없어 신선도를 판정할 수 없습니다 (프레임 ${noDate.map((f) => f.node).join(', ')})` });
    continue;
  }
  // %cs(날짜만) 가 아니라 %cI(오프셋까지) 를 받아 위 kstDay 로 환산한다.
  const last = git(['log', '-1', '--format=%cI', '--', page.html]);
  if (last === null || dirty === null) {
    findings.push({ level: 'STALE', page: page.html, kind: '판정 불가',
      detail: 'git 을 부르지 못해 신선도를 판정하지 못했습니다 — 못 돈 검수를 통과로 세지 않습니다' });
    continue;
  }
  if (shallow) {
    findings.push({ level: 'STALE', page: page.html, kind: '판정 불가 (얕은 클론)',
      detail: '얕은 클론이라 파일별 커밋 날짜를 못 읽습니다 — 모든 경로가 tip 커밋으로 나옵니다. '
            + 'CI 라면 actions/checkout 에 fetch-depth: 0 을, 로컬이면 git fetch --unshallow 를 하세요' });
    continue;
  }
  const lastMs = Date.parse(last.trim());
  const edited = dirty.split('\n').some((l) => l.slice(3).startsWith(page.html))
    ? today : (Number.isNaN(lastMs) ? '' : kstDay(lastMs));
  // git 이 그 경로를 모르면(새로 만들고 아직 커밋 안 한 페이지 — 추적 안 되는 디렉터리는
  // porcelain 에도 'onboarding/9/' 처럼 디렉터리로만 나와 위 대조에 안 걸린다) last 가 빈
  // 문자열로 온다. 빈 값을 '안 고쳤다' 로 읽으면 새 페이지가 조용히 통과한다.
  if (!edited) {
    findings.push({ level: 'STALE', page: page.html, kind: '판정 불가',
      detail: `${page.html} 이 git 이력에 없거나 커밋 날짜를 읽지 못해 신선도를 판정하지 못했습니다 — 커밋한 뒤 다시 검사하세요` });
    continue;
  }
  for (const f of frames.filter((x) => edited > x.dumpedAt)) {
    findings.push({ level: 'STALE', page: page.html, kind: '스냅샷이 낡음',
      detail: `${page.html} 을 ${edited} 에 고쳤는데 프레임 ${f.node} (${f.name}) 스냅샷은 ` +
              `${f.dumpedAt} 판입니다 — 다시 뽑고 dumpedAt 을 올리세요` });
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

  const frames = framesOf(page);
  const noTexts = frames.filter((f) => !Array.isArray(f.texts));
  if (noTexts.length) {
    findings.push({ level: 'DIFF', page: page.html, kind: 'texts 없음',
      detail: `프레임 ${noTexts.map((f) => f.node).join(', ')} 에 texts 배열이 없습니다 — ` +
              '키 이름을 확인하세요. 빈 프레임으로 넘기지 않습니다' });
    continue;
  }

  /* 목업의 선택 수가 화면 상한을 넘는가.
   * 이 한 가지만은 웹과 문구를 맞대 볼 수 없다 — CTA 의 숫자는 런타임에 그려져 정적 HTML 에
   * 없다. 대신 같은 수를 적어 둔 두 곳을 맞댄다: 피그마 목업의 'N개' 와 웹 JS 의 상한 상수.
   * 근거: 2026-08-10 에 STEP1 CTA 가 '다음 · 13개 선택됨' 인 채로 상한 10 과 모순이었고
   * 어느 검수도 못 봤다.
   *
   * 어느 상수인지는 **스냅샷의 selectionCap 에 이름을 적어 선언한다.** JS 에서 `const MAX` 를
   * 냄새로 찾지 않는다 — 그러면 두 가지로 틀린다. 이름을 바꾸는 순간 검사가 조용히 꺼지고
   * (같은 수가 onboarding-store 에도 있어 상수를 합칠 이유가 실제로 있다), onboarding/2 의
   * `const MAX=15` 처럼 **선택 상한이 아닌 값**(연차 슬라이더 눈금)에 붙어 의미 없이 통과한다.
   * 선언한 상수를 못 찾으면 통과가 아니라 막는다. 선언이 없는 화면은 넘을 상한 자체가 없다
   * (letter.html 의 '15개 사이트' 처럼 숫자가 든 산문은 상한이 아니다). */
  /* 선언 자체를 빠뜨리는 경로도 막는다. 상한이 있는 화면은 예외 없이 "상한이 차면 안 고른 칩을
   * 잠그는" 코드를 갖는다 — 그 잠금이 곧 상한의 존재 증거다. 잠금이 있는데 selectionCap 이
   * 없으면 위 검사가 통째로 안 도는 상태이므로 통과로 세지 않는다.
   * 문구에 든 숫자로는 이 판정을 못 한다 — letter.html 의 '15개 사이트' 는 상한이 아니라 산문이다. */
  if (/classList\.toggle\('lock'/.test(html) && !page.selectionCap) {
    findings.push({ level: 'DIFF', page: page.html, kind: '상한 선언 없음',
      detail: `${page.html} 에 칩 잠금(상한)이 있는데 스냅샷에 selectionCap 이 없습니다 — ` +
              '상한 상수 이름을 selectionCap.const 에 적으세요. 목업이 상한을 넘는지 아무도 못 봅니다' });
  }
  if (page.selectionCap) {
    const name = page.selectionCap.const;
    const capM = html.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`));
    if (!capM) {
      findings.push({ level: 'DIFF', page: page.html, kind: '상한 상수 없음',
        detail: `스냅샷이 selectionCap.const = "${name}" 이라고 선언했는데 ${page.html} 에서 찾지 못했습니다 — ` +
                '상수 이름을 바꿨으면 스냅샷도 바꾸세요. 못 돈 검사를 통과로 세지 않습니다' });
    } else {
      const cap = Number(capM[1]);
      for (const f of frames) {
        for (const t of new Set(f.texts.concat(f.jsRenderedText || []))) {
          const m = String(t).match(/(\d+)\s*개/);
          if (m && Number(m[1]) > cap) {
            findings.push({ level: 'DIFF', page: page.html, frame: f.node, kind: '목업이 상한을 넘음', figma: t,
              note: `웹의 const ${name}=${cap} 인데 목업은 ${m[1]}개입니다 — 프레임을 상한 안으로 고치세요` });
          }
        }
      }
    }
  }

  // 웹 → 피그마 방향은 **모든 프레임을 합쳐서** 본다. 웹 문구가 상태 프레임에만 있을 수 있다.
  const allFigma = frames.flatMap((f) => f.texts).filter((t) => t && t.trim().length > 0);
  const figmaAll = key(allFigma.join(''));
  const figmaAllSoft = softKey(allFigma.join(''));
  const ignoreWeb = new Set((page.ignoreWebText || []).concat(snap.ignoreWebText || []).map(key));
  figmaCount += allFigma.length; webCount += blocks.length;

  // 1) 피그마 → 웹 : 피그마 문구가 웹에 있어야 한다
  //
  // 예외 — jsRenderedText: 웹이 JS 로 그리는 문구는 정적 HTML 에 없다 (2026-08-07).
  //   온보딩 CTA 가 그렇다. 마크업에는 '다음' 만 있고, 선택 수에 따라 스크립트가
  //   '직무를 1개 이상 골라주세요' / '다음 · N개 선택됨' 으로 바꿔 쓴다.
  //   피그마 프레임은 그 결과 상태를 그린 것이므로 **드리프트가 아니라 검수 방식의 한계**다.
  //   이걸 DIFF 로 두면 진짜 차이가 소음에 묻힌다. 대신 스냅샷에 그 문구를 명시하게 해서
  //   "왜 빠지는지" 가 파일에 남게 한다 — 조용히 사라지지 않는다.
  // 프레임마다 따로 본다 — 어느 프레임이 어긋났는지 나와야 고칠 수 있고, 공통 문구를
  // 한쪽 프레임에서만 바꾼 경우가 여기서 걸린다.
  for (const f of frames) {
    const jsRendered = new Set((f.jsRenderedText || []).map(key));
    for (const t of f.texts.filter((x) => x && x.trim().length > 0)) {
      const k = key(t);
      if (jsRendered.has(k)) continue;
      if (webLineKeys.has(k) || webAll.includes(k)) continue;
      if (webAllSoft.includes(softKey(t))) {
        findings.push({ level: 'PUNCT', page: page.html, frame: f.node, kind: '문장부호', figma: t, note: '글자·구성은 같고 따옴표/말줄임표만 다름' });
        continue;
      }
      const head = k.slice(0, 12);
      const near = blocks.find((b) => key(b).includes(head)) || null;
      findings.push({ level: 'DIFF', page: page.html, frame: f.node, kind: '문구', figma: t, web: near, note: near ? '웹 문구가 피그마와 다름' : '웹에서 못 찾음 — 피그마를 바꿨으면 웹도 맞추세요' });
    }
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
  const oldest = snap.pages.flatMap((p) => framesOf(p).map((f) => f.dumpedAt)).filter(Boolean).sort()[0];
  console.log(`\n기준: 피그마 ${snap.fileKey} / 섹션 ${snap.section} (가장 오래된 스냅샷 ${oldest})`);
  console.log(`대상: ${snap.pages.map((p) => `${p.html} ↔ ${framesOf(p).map((f) => f.node).join('+')}`).join(', ')}`);
  console.log(`피그마 문구 ${figmaCount}개 ↔ 웹 블록 ${webCount}개 대조\n`);
  if (findings.length === 0) {
    console.log('✅ 차이 없음 — 약관·개인정보 화면이 피그마와 웹에서 일치합니다.\n');
  } else {
    const order = { STALE: 0, DIFF: 1, EXTRA: 2, PUNCT: 3 };
    findings.sort((a, b) => order[a.level] - order[b.level]);
    for (const f of findings) {
      const tag = { STALE: '🕗 낡음', DIFF: '❌ 차이', EXTRA: 'ℹ️ 웹전용', PUNCT: '⚠️ 부호' }[f.level];
      console.log(`${tag}  ${f.kind} [${f.page}${f.frame ? ` · ${f.frame}` : ''}]`);
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
