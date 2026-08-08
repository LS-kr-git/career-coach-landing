#!/usr/bin/env node
/**
 * 피그마 트리 점검 — "섹션 밖으로 튀어나간 고아 노드" 를 잡는 유일한 검사다.
 *
 *   node tools/figma-audit/tree-audit.mjs [figma_tree_dump.json] [--json]
 *
 * 다른 검수는 전부 방향이 반대이거나 프레임 안쪽만 본다.
 *   page-audit  : 웹 HTML → 피그마 짝이 있나       (피그마 안의 배치는 안 본다)
 *   docs-audit  : 프레임 안의 문구 ↔ 웹            (프레임이 어디 있는지는 안 본다)
 *   audit       : 6:148 안의 문구·타이포·스타일    (같음)
 * 그래서 2026-08-08 에 프레임 626:2657 이 섹션 625:2657 밖으로 나가 캔버스에 떠 있었는데
 * 여섯 검수가 전부 통과했다. 이 검사는 피그마 페이지의 직속 자식을 기준으로 본다.
 *
 * 두 가지 모드
 *   (1) 덤프 없이  — 준비물이 없다. 커밋된 figma-tree.json 과 page-figma-map.json 이
 *                    서로 맞는지만 본다. 두 파일이 어긋나는 것 자체가 사각지대다.
 *                    라이브 대조는 못 하므로 "미확인" 을 찍는다 (건너뜀은 통과가 아니다).
 *   (2) 덤프 있음  — README "피그마 트리 덤프" 스니펫의 출력을 인자로 준다.
 *                    페이지 직속 자식 중 섹션이 아닌 것 = 고아 → 막힘.
 *
 * 종료코드: BLOCK 0건이면 0, 아니면 1. (WARN 은 출력만 하고 통과)
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const asJson = process.argv.includes('--json');
const dumpPath = process.argv.slice(2).find((a) => !a.startsWith('--'));

const findings = [];
const add = (level, kind, where, detail, note) => findings.push({ level, kind, where, detail, note });

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const snap = read(join(HERE, 'figma-tree.json'));
const map = read(join(HERE, 'page-figma-map.json'));

const sections = snap.sections || {};
const frames = snap.frames || {};
const allowed = snap.pageLevelAllowed || {};
const registered = Object.entries(map.pages || {}); // [html, {node,name,...}]

/* ---------- (1) 준비물 없는 정합성 — 항상 돈다 ---------- */

if (!Object.keys(sections).length) {
  add('BLOCK', '트리 스냅샷', 'figma-tree.json', 'sections 가 비어 있습니다',
      '덤프 스니펫으로 다시 뽑으세요. 비어 있으면 고아 판정 기준이 없어 검사가 무력화됩니다.');
}

for (const [id, reason] of Object.entries(allowed)) {
  if (!String(reason || '').trim()) {
    add('BLOCK', '트리 스냅샷', 'figma-tree.json',
        `pageLevelAllowed 의 ${id} 에 사유가 없습니다`,
        '섹션 밖에 두는 이유를 적으세요. 사유 없는 면제는 검사를 조용히 끕니다.');
  }
}

// 등록부 ↔ 트리 스냅샷 — 한쪽에만 있으면 막는다.
for (const [html, e] of registered) {
  if (!frames[e.node]) {
    add('BLOCK', '트리 스냅샷', 'tools/figma-audit/figma-tree.json',
        `${html} 의 기준 프레임 ${e.node} 가 frames 에 없습니다`,
        '등록부에 프레임을 추가했으면 트리 스냅샷도 다시 뽑아 커밋하세요.');
  } else if (!sections[frames[e.node]] && frames[e.node] !== null) {
    // 중첩 섹션(6:147·319:2477)은 페이지 직속이 아니므로 sections 에 없는 것이 정상이다.
    // 여기서는 값이 비어 있는 경우만 잡는다.
    if (!String(frames[e.node]).trim()) {
      add('BLOCK', '트리 스냅샷', 'tools/figma-audit/figma-tree.json',
          `${e.node} 의 섹션 값이 비어 있습니다`, '어느 섹션 안에 있어야 하는지 적으세요.');
    }
  }
}
const regIds = new Set(registered.map(([, e]) => e.node));
for (const id of Object.keys(frames)) {
  if (!regIds.has(id)) {
    add('BLOCK', '트리 스냅샷', 'tools/figma-audit/figma-tree.json',
        `frames 의 ${id} 가 page-figma-map.json 에 없습니다`,
        '낡은 항목입니다. 등록부에서 뺐으면 여기서도 빼세요 — 남아 있으면 "검사 중" 으로 착각합니다.');
  }
}

/* ---------- (2) 라이브 덤프 대조 ---------- */

if (!dumpPath) {
  add('WARN', '라이브 대조', '-', '피그마 트리 덤프를 주지 않아 고아 노드는 확인하지 못했습니다',
      'README "피그마 트리 덤프" 스니펫으로 뽑아 인자로 주세요: node tools/figma-audit/tree-audit.mjs figma_tree.json');
} else if (!existsSync(dumpPath)) {
  add('BLOCK', '라이브 대조', dumpPath, '덤프 파일을 찾지 못했습니다');
} else {
  const dump = read(dumpPath);
  const ageMin = (Date.now() - statSync(dumpPath).mtimeMs) / 60000;
  if (ageMin > 45) {
    add('WARN', '라이브 대조', dumpPath, `덤프가 ${Math.round(ageMin)}분 전 것입니다`,
        '그 사이 피그마가 바뀌었을 수 있습니다. 45분이 넘으면 다시 뽑는 편이 안전합니다.');
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

  // 섹션 증감 — 스냅샷이 낡으면 고아 판정 자체가 흔들린다.
  const liveSec = new Set(children.filter((c) => c.type === 'SECTION').map((c) => c.id));
  for (const id of Object.keys(sections)) {
    if (liveSec.has(id)) continue;
    const used = Object.values(frames).includes(id);
    add(used ? 'BLOCK' : 'WARN', '섹션 사라짐', `${id} ${sections[id]}`,
        '스냅샷에 있는 섹션이 피그마에 없습니다',
        used ? '이 섹션에 기준 프레임이 들어 있어야 합니다. 지운 것이면 등록부부터 정리하세요.'
             : '이름을 바꿨거나 지운 것이면 트리 스냅샷을 다시 뽑아 커밋하세요.');
  }
  for (const id of liveSec) {
    if (!sections[id]) {
      const c = children.find((x) => x.id === id);
      add('WARN', '새 섹션', `${id} ${c ? c.name : ''}`, '스냅샷에 없는 섹션이 피그마에 있습니다',
          '정상적인 작업이면 트리 스냅샷을 다시 뽑아 커밋하세요.');
    }
  }

  // 기준 프레임이 실제로 섹션 안에 있는가 — 626:2657 과 같은 형태를 여기서 잡는다.
  const dreg = dump.registered || {};
  for (const [html, e] of registered) {
    const r = dreg[e.node];
    if (!r) {
      add('WARN', '기준 프레임', `${e.node} (${html})`, '덤프에 이 프레임이 들어 있지 않습니다',
          '덤프 스니펫의 대상 목록은 page-figma-map.json 에서 만드세요 — 손으로 관리하면 낡습니다.');
      continue;
    }
    if (r.found === false) {
      add('BLOCK', '기준 프레임', `${e.node} (${html})`, '피그마에 그 노드가 없습니다',
          '프레임을 지웠거나 id 가 바뀌었습니다. 등록부와 스냅샷을 새 id 로 고치세요.');
      continue;
    }
    if (!r.section) {
      add('BLOCK', '기준 프레임', `${e.node} (${html})`, '이 프레임이 어느 섹션에도 들어 있지 않습니다',
          `부모가 ${r.parentType || '?'}(${r.parent || '?'}) 입니다. 섹션 안으로 되돌리세요.`);
    } else if (frames[e.node] && r.section !== frames[e.node]) {
      add('WARN', '기준 프레임', `${e.node} (${html})`,
          `섹션이 바뀌었습니다: 스냅샷 ${frames[e.node]} → 피그마 ${r.section}`,
          '의도한 이동이면 트리 스냅샷을 다시 뽑아 커밋하세요.');
    }
  }
}

/* ---------- 출력 ---------- */

const blocks = findings.filter((f) => f.level === 'BLOCK');

if (asJson) {
  console.log(JSON.stringify({ findings, dump: dumpPath || null }, null, 2));
} else {
  console.log(`\n피그마 트리 점검 — 섹션 ${Object.keys(sections).length}개 · 기준 프레임 ${registered.length}개` +
              `${dumpPath ? ` · 덤프 ${dumpPath}` : ' · 덤프 없음(라이브 미확인)'}\n`);
  if (!findings.length) {
    console.log('✅ 고아 노드 없음 — 기준 프레임이 전부 섹션 안에 있습니다\n');
  } else {
    findings.sort((a, b) => (a.level === b.level ? 0 : a.level === 'BLOCK' ? -1 : 1));
    for (const f of findings) {
      console.log(`${f.level === 'BLOCK' ? '❌ 막힘' : '⚠️ 경고'}  ${f.kind} [${f.where}]`);
      if (f.detail) console.log(`   상세  : ${f.detail}`);
      if (f.note) console.log(`   비고  : ${f.note}`);
      console.log('');
    }
    console.log(`총 ${findings.length}건 (조치 필요 ${blocks.length}건)\n`);
  }
}

process.exit(blocks.length ? 1 : 0);
