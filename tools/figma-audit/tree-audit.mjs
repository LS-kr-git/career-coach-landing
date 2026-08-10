#!/usr/bin/env node
/**
 * 피그마 트리 점검 — "섹션 밖으로 튀어나간 고아 노드" 를 잡는 유일한 검사다.
 *
 *   node tools/figma-audit/tree-audit.mjs [figma_tree_dump.json] [--update] [--json]
 *
 * 다른 검수는 전부 방향이 반대이거나 프레임 안쪽만 본다.
 *   page-audit  : 웹 HTML → 피그마 짝이 있나       (피그마 안의 배치는 안 본다)
 *   docs-audit  : 프레임 안의 문구 ↔ 웹            (프레임이 어디 있는지는 안 본다)
 *   audit       : 6:148 안의 문구·타이포·스타일    (같음)
 * 그래서 2026-08-08 에 프레임 626:2657 이 섹션 625:2657 밖으로 나가 캔버스에 떠 있었는데
 * 여섯 검수가 전부 통과했다. 이 검사는 피그마 페이지의 직속 자식을 기준으로 본다.
 *
 * ── 스냅샷은 손으로 관리하지 않는다 (2026-08-08 개정) ──────────────────
 * figma-tree.json 의 `sections` 는 **이 스크립트가 덤프에서 만든다.** 사람이 피그마에
 * 섹션을 하나 만들면 스냅샷은 즉시 낡는데, 그걸 사람 손에 맡기면 경고가 상주하다가
 * 결국 무시된다. 그래서 낡음은 **막힘이 아니라 ↺(자동 갱신 대상)** 으로 분류하고,
 * `--update` 한 줄로 맞춘다. 예약 점검이 매일 이 한 줄을 대신 돌린다.
 * 기준 프레임이 어느 섹션에 있는지도 저장하지 않는다 — 덤프에서 그때그때 읽으면 된다.
 * **손으로 유지하는 것은 `pageLevelAllowed`(면제 목록) 하나뿐이다.**
 *
 * 두 가지 모드
 *   (1) 덤프 없이  — 준비물이 없다. 스냅샷 자체 정합성만 본다. 이 검사의 본체(고아 노드)는
 *                    돌지 않으므로 `🚫 검수 미실행` 로 찍는다.
 *   (2) 덤프 있음  — README "피그마 트리 덤프" 스니펫의 출력을 인자로 준다.
 *                    페이지 직속 자식 중 섹션이 아닌 것 = 고아 → 막힘.
 *
 * 종료코드: BLOCK 0건이면 0, 아니면 1. (SKIP·WARN·SYNC 는 출력만 하고 통과)
 *
 * ⚠️ SKIP 이 종료코드 0 인 것은 audit.mjs 와 다르다. 이 검수는 **모든 푸시**에서 도는데
 * 덤프는 세션마다 뽑는 물건이라, 없다고 막으면 평소 작업이 통째로 선다. 대신 결과를
 * "통과" 로 읽을 수 없게 만든다 — 미실행 건수를 따로 세고, 라이브 대조를 안 한 실행은
 * ✅ 를 찍지 않고 "확인한 것이 아니다" 를 명시한다. 진짜 방어는 훅 118줄이 한다
 * (등록부·트리 스냅샷을 건드린 푸시에는 덤프를 요구한다).
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const doUpdate = argv.includes('--update');
const dumpPath = argv.find((a) => !a.startsWith('--'));

const findings = [];
const add = (level, kind, where, detail, note) => findings.push({ level, kind, where, detail, note });

const SNAP_PATH = join(HERE, 'figma-tree.json');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const snap = read(SNAP_PATH);
const map = read(join(HERE, 'page-figma-map.json'));

const sections = snap.sections || {};
const allowed = snap.pageLevelAllowed || {};
// node: null = 피그마 프레임을 아직 안 만든 페이지(page-audit 이 사유를 요구하고 매 푸시 경고한다).
// 여기서 안 빼면 "덤프에 이 프레임이 들어 있지 않습니다" 로 뜨는데, 그건 덤프가 낡았다는 뜻이라
// 원인을 엉뚱한 곳에서 찾게 된다. 없는 프레임은 트리 검사의 대상이 아니다.
const registered = Object.entries(map.pages || {}).filter(([, e]) => e.node !== null); // [html, {node,name,...}]

/* ---------- (1) 준비물 없는 정합성 — 항상 돈다 ---------- */

if (!Object.keys(sections).length && !doUpdate) {
  add('SYNC', '트리 스냅샷', 'figma-tree.json', 'sections 가 비어 있습니다',
      '한 번도 생성하지 않았습니다. 덤프를 뽑아 --update 로 만드세요.');
}

for (const [id, reason] of Object.entries(allowed)) {
  if (!String(reason || '').trim()) {
    add('BLOCK', '트리 스냅샷', 'figma-tree.json',
        `pageLevelAllowed 의 ${id} 에 사유가 없습니다`,
        '섹션 밖에 두는 이유를 적으세요. 사유 없는 면제는 검사를 조용히 끕니다. (이 목록만 손으로 관리합니다)');
  }
}

/* ---------- (2) 라이브 덤프 대조 ---------- */

let dump = null;
if (!dumpPath) {
  add('SKIP', '라이브 대조', '-', '피그마 트리 덤프를 주지 않아 고아 노드는 확인하지 못했습니다',
      'README "피그마 트리 덤프" 스니펫으로 뽑아 인자로 주세요: node tools/figma-audit/tree-audit.mjs figma_tree.json');
  if (doUpdate) add('BLOCK', '트리 스냅샷', '-', '--update 에는 덤프가 필요합니다', '갱신할 원본이 없습니다.');
} else if (!existsSync(dumpPath)) {
  add('BLOCK', '라이브 대조', dumpPath, '덤프 파일을 찾지 못했습니다');
} else {
  dump = read(dumpPath);
  const ageMin = (Date.now() - statSync(dumpPath).mtimeMs) / 60000;
  if (ageMin > 45) {
    // 45분은 audit.mjs 의 덤프 한도와 같은 값이다. 그 사이 피그마가 바뀌었을 수 있으므로
    // 아래 대조 결과를 "지금 상태를 확인했다" 로 셀 수 없다.
    add('SKIP', '라이브 대조', dumpPath, `덤프가 ${Math.round(ageMin)}분 전 것입니다 — 한도 45분`,
        '이 실행은 현재 피그마를 확인한 것이 아닙니다. README "피그마 트리 덤프" 로 다시 뽑으세요.');
  }

  const children = dump.children || [];
  if (!children.length) {
    add('BLOCK', '라이브 대조', dumpPath, 'children 이 비어 있습니다', '덤프가 잘못 뽑혔습니다.');
  }

  // ★ 고아 노드 — 이 검사의 본체.
  for (const c of children) {
    if (c.type === 'SECTION') continue;
    if (allowed[c.id]) continue;
    add('BLOCK', '고아 노드', `${c.id} ${c.name}`,
        `페이지(${dump.pageId || '0:1'}) 직속에 섹션이 아닌 ${c.type} 가 있습니다`,
        '섹션 안으로 옮기세요. 섹션의 자식은 x/y 가 섹션 기준 상대좌표입니다 — 좌표만 맞추고 부모를 확인하지 않으면 캔버스 저편에 떠 있게 됩니다. 의도한 것이면 figma-tree.json 의 pageLevelAllowed 에 사유와 함께 적으세요.');
  }

  // 기준 프레임이 실제로 섹션 안에 있는가 — 626:2657 과 같은 형태를 여기서 잡는다.
  // 어느 섹션에 있어야 하는지는 저장하지 않는다. "어딘가 섹션 안" 이면 된다.
  const dreg = dump.registered || {};
  // 상태 프레임(stateNodes)도 같은 검사를 받는다 — 기준 프레임만 보면 상태 프레임이
  // 지워지거나 섹션 밖으로 나가도 아무도 모른다.
  for (const [html, e] of registered.flatMap(([html, e]) =>
      [[html, e]].concat((e.stateNodes || []).map((s) => [html, { ...e, node: s.id, 상태: true }])))) {
    const 무엇 = e.상태 ? '상태 프레임' : '기준 프레임';
    const r = dreg[e.node];
    if (!r) {
      add('SKIP', 무엇, `${e.node} (${html})`, '덤프에 이 프레임이 들어 있지 않아 확인하지 못했습니다',
          '덤프 스니펫의 대상 목록은 page-figma-map.json 에서 만드세요 — 손으로 관리하면 낡습니다.');
      continue;
    }
    if (r.found === false) {
      add('BLOCK', 무엇, `${e.node} (${html})`, '피그마에 그 노드가 없습니다',
          '프레임을 지웠거나 id 가 바뀌었습니다. page-figma-map.json 을 새 id 로 고치세요.');
      continue;
    }
    if (!r.section) {
      add('BLOCK', 무엇, `${e.node} (${html})`, '이 프레임이 어느 섹션에도 들어 있지 않습니다',
          `부모가 ${r.parentType || '?'}(${r.parent || '?'}) 입니다. 섹션 안으로 되돌리세요.`);
    }
  }

  // 섹션 증감 — 사람이 피그마를 정리하면 반드시 생긴다. 막지 않고 ↺ 로 분류한다.
  const liveSec = new Map(children.filter((c) => c.type === 'SECTION').map((c) => [c.id, c.name]));
  const holding = new Set(Object.values(dreg).map((r) => r && r.section).filter(Boolean));
  for (const [id, name] of Object.entries(sections)) {
    if (liveSec.has(id)) {
      if (liveSec.get(id) !== name) {
        add('SYNC', '섹션 이름 바뀜', `${id}`, `"${name}" → "${liveSec.get(id)}"`);
      }
      continue;
    }
    add(holding.has(id) ? 'BLOCK' : 'SYNC', '섹션 사라짐', `${id} ${name}`,
        '스냅샷에 있는 섹션이 피그마에 없습니다',
        holding.has(id) ? '이 섹션에 기준 프레임이 들어 있어야 합니다. 지운 것이면 page-figma-map.json 부터 정리하세요.' : undefined);
  }
  for (const [id, name] of liveSec) {
    if (!sections[id]) add('SYNC', '새 섹션', `${id} ${name}`, '스냅샷에 없는 섹션이 피그마에 있습니다');
  }
}

/* ---------- (3) 자동 갱신 ---------- */

const syncs = findings.filter((f) => f.level === 'SYNC');
let updated = null;

if (doUpdate && dump && (dump.children || []).length) {
  const next = { ...snap };
  next.dumpedAt = new Date().toISOString().slice(0, 10);
  next.page = dump.pageId || snap.page;
  next.sections = Object.fromEntries(
    (dump.children || []).filter((c) => c.type === 'SECTION').map((c) => [c.id, c.name]),
  );
  const before = JSON.stringify(snap.sections || {});
  const after = JSON.stringify(next.sections);
  if (before !== after || snap.dumpedAt !== next.dumpedAt) {
    writeFileSync(SNAP_PATH, JSON.stringify(next, null, 2) + '\n');
    updated = { changed: before !== after, count: Object.keys(next.sections).length };
  } else {
    updated = { changed: false, count: Object.keys(next.sections).length };
  }
  // 갱신했으면 낡음 항목은 해소된 것이다.
  for (let i = findings.length - 1; i >= 0; i--) if (findings[i].level === 'SYNC') findings.splice(i, 1);
}

/* ---------- 출력 ---------- */

const blocks = findings.filter((f) => f.level === 'BLOCK');
const skips = findings.filter((f) => f.level === 'SKIP');
const label = (l) => ({ BLOCK: '❌ 막힘', SKIP: '🚫 검수 미실행', SYNC: '↺ 스냅샷 낡음' }[l] || '⚠️ 경고');

if (asJson) {
  console.log(JSON.stringify({ findings, updated, dump: dumpPath || null }, null, 2));
} else {
  const 상태프레임수 = registered.reduce((n, [, e]) => n + ((e.stateNodes || []).length), 0);
  console.log(`\n피그마 트리 점검 — 섹션 ${Object.keys(sections).length}개 · 기준 프레임 ${registered.length}개(+상태 ${상태프레임수}개)` +
              `${dumpPath ? ` · 덤프 ${dumpPath}` : ' · 덤프 없음(라이브 미확인)'}\n`);
  if (updated) {
    console.log(updated.changed
      ? `↺ figma-tree.json 의 sections 를 덤프 기준으로 다시 썼습니다 (섹션 ${updated.count}개). 커밋에 포함하세요.\n`
      : `· figma-tree.json 은 이미 최신입니다 (섹션 ${updated.count}개).\n`);
  }
  if (!findings.length) {
    console.log('✅ 고아 노드 없음 — 기준 프레임이 전부 섹션 안에 있습니다\n');
  } else {
    const order = { BLOCK: 0, SKIP: 1, WARN: 2, SYNC: 3 };
    findings.sort((a, b) => order[a.level] - order[b.level]);
    for (const f of findings) {
      console.log(`${label(f.level)}  ${f.kind} [${f.where}]`);
      if (f.detail) console.log(`   상세  : ${f.detail}`);
      if (f.note) console.log(`   비고  : ${f.note}`);
      console.log('');
    }
    if (syncs.length && !updated) {
      console.log(`↺ 스냅샷 낡음 ${syncs.length}건 — 사람이 피그마를 정리하면 생기는 정상적인 차이입니다.`);
      console.log(`   한 줄이면 맞춰집니다:  node tools/figma-audit/tree-audit.mjs ${dumpPath || '<덤프>'} --update`);
      console.log(`   (예약 점검이 매일 이 한 줄을 대신 돌립니다. 그때까지 푸시를 막지 않습니다.)\n`);
    }
    // 미실행을 조치 필요와 같은 줄에서 따로 센다 — "조치 필요 0건" 만 보고
    // 고아 노드가 없다고 읽는 것이 이 검수가 무력해지는 방식이다.
    console.log(`총 ${findings.length}건 (조치 필요 ${blocks.length}건${skips.length ? ` · 미실행 ${skips.length}건` : ''})\n`);
  }
  if (skips.length && !blocks.length) {
    console.log('🚫 라이브 대조를 하지 않았습니다 — 이 실행은 "고아 노드 없음" 을 확인한 것이 아닙니다.');
    console.log('   피그마 안에서만 프레임이 섹션 밖으로 나간 날은 저장소 파일이 하나도 안 바뀌므로,');
    console.log('   덤프 없이 통과한 푸시는 2026-08-08 과 같은 상태를 그대로 지나칩니다.\n');
  }
}

process.exit(blocks.length ? 1 : 0);
