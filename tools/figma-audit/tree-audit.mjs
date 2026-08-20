#!/usr/bin/env node
/**
 * 피그마 트리 점검 — "섹션 밖으로 튀어나간 고아 노드" 를 잡는 유일한 검사다.
 *
 *   node tools/figma-audit/tree-audit.mjs [figma_tree_dump.json] [--update] [--json] [--strict]
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
 * `--update` 한 줄로 맞춘다. 예약 점검이 전체 모드로 도는 날 이 한 줄을 대신 돌린다(최대 3주).
 * 기준 프레임이 어느 섹션에 있는지도 저장하지 않는다 — 덤프에서 그때그때 읽으면 된다.
 * **손으로 유지하는 것은 `pageLevelAllowed`(면제 목록) 와 `page`(검수 대상 페이지) 둘이다.**
 * `page` 는 `--update` 가 못 고친다 — 관문이 덤프와 동치일 때만 갱신을 허용하므로 값이 굳는다.
 * 운영 페이지를 옮기거나 나눴으면 사람이 먼저 이 값을 고쳐야 한다.
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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maxAgeMinutes, dumpAge } from './dump-age.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const doUpdate = argv.includes('--update');
/* --strict: 미실행(🚫)도 실패로 센다. 평소 푸시 훅은 이 플래그 없이 돌아야 한다 —
   덤프는 세션마다 뽑는 물건이라 없다고 막으면 일상 작업이 통째로 선다.
   반면 **예약 점검은 덤프를 반드시 뽑고 들어오므로** 거기서는 미실행이 곧 고장이다.
   같은 스크립트에 도피로를 만드는 것이 아니라, 부르는 쪽이 자기 계약을 선언하는 것이다. */
const strict = argv.includes('--strict');

/* 🔴 오타 난 플래그를 조용히 무시하지 않는다. `--strikt` 로 부르면 출력이 비-strict 실행과
   한 글자도 다르지 않아, "돌렸는데 깨끗한 것" 과 "관문이 꺼진 것" 이 구분되지 않는다.
   유일한 호출자가 저장소 밖(예약 점검 프롬프트)이라 grep 으로도 확인이 안 된다. */
const KNOWN = new Set(['--json', '--update', '--strict']);
const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN.has(a));
if (unknown.length) {
  console.error(`모르는 인자입니다: ${unknown.join(' ')}`);
  console.error(`쓸 수 있는 것: ${[...KNOWN].join(' ')}`);
  process.exit(2);
}
const dumpPath = argv.find((a) => !a.startsWith('--'));

const findings = [];
const add = (level, kind, where, detail, note) => findings.push({ level, kind, where, detail, note });

const SNAP_PATH = join(HERE, 'figma-tree.json');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const snap = read(SNAP_PATH);
const map = read(join(HERE, 'page-figma-map.json'));

/* 나이 한도는 audit.mjs 와 **같은 모듈**에서 읽는다. 앞 판은 45 를 여기 따로 박아 두어
   CC_META_MAX_AGE 가 audit 만 움직였고, 두 검수가 다른 한도로 판정했다. */
const { minutes: MAX_AGE_MIN, source: maxAgeSource, problems: maxAgeProblems } = maxAgeMinutes();
for (const pr of maxAgeProblems) add('BLOCK', pr.kind, 'CC_META_MAX_AGE', pr.detail, pr.note);

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

/* page 는 --update 가 못 고치는 손유지 값이다. 비면 아래 관문이 undefined === undefined 로
   조용히 참이 되어, 페이지 고정도 --update 차단도 한 줄의 경고 없이 통째로 꺼진다.
   준비물 없이 도는 이 자리에서 먼저 막는다. */
if (!String(snap.page || '').trim()) {
  add('BLOCK', '트리 스냅샷', 'figma-tree.json', 'page (검수 대상 페이지) 가 비어 있습니다',
      '이 값이 없으면 덤프가 어느 페이지를 찍었는지 판정할 수 없어 고아 검사가 통째로 꺼집니다. 운영 페이지 id 를 적으세요.');
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
let pageOk = false;   // 덤프가 검수 대상 페이지를 찍었나. 아래 (3) 자동 갱신도 이 값을 본다
if (!dumpPath) {
  add('SKIP', '라이브 대조', '-', '피그마 트리 덤프를 주지 않아 고아 노드는 확인하지 못했습니다',
      'README "피그마 트리 덤프" 스니펫으로 뽑아 인자로 주세요: node tools/figma-audit/tree-audit.mjs figma_tree.json');
  if (doUpdate) add('BLOCK', '트리 스냅샷', '-', '--update 에는 덤프가 필요합니다', '갱신할 원본이 없습니다.');
} else if (!existsSync(dumpPath)) {
  add('BLOCK', '라이브 대조', dumpPath, '덤프 파일을 찾지 못했습니다');
} else {
  dump = read(dumpPath);
  const { ageMin, selfDated } = dumpAge(dumpPath, dump);
  if (!selfDated) {
    add('SKIP', '덤프 자기신고 시각', dumpPath, 'dumpedAt 이 없거나 읽을 수 없어 파일 mtime 만 봤습니다',
        'mtime 은 checkout·cp·touch 로 새로 찍히므로 낡은 덤프가 신선해 보일 수 있습니다. README "피그마 트리 덤프" 의 스니펫으로 다시 뽑으세요.');
  }
  if (ageMin > MAX_AGE_MIN) {
    // 그 사이 피그마가 바뀌었을 수 있으므로 아래 대조 결과를 "지금 상태를 확인했다" 로 셀 수 없다.
    add('SKIP', '라이브 대조', dumpPath, `덤프가 ${Math.round(ageMin)}분 전 것입니다 — 한도 ${maxAgeSource}`,
        '이 실행은 현재 피그마를 확인한 것이 아닙니다. README "피그마 트리 덤프" 로 다시 뽑으세요.');
  }

  /* 덤프가 어느 페이지를 찍었는가. 파일에 페이지가 둘 이상이면 덤프 스니펫이 "지금 열려 있는
     페이지" 를 찍어 갈 수 있고, 그러면 아래 고아 검사는 운영 페이지를 한 번도 안 보고 ✅ 를 찍는다.
     덤프 안에 pageId 가 들어 있는데도 그 값을 아무도 안 보던 자리다.
     (2026-08-20: 파일이 '운영 페이지들(SSOT)' 과 '레퍼런스, 기타 자료들' 로 나뉘었다.) */
  pageOk = Boolean(snap.page) && dump.pageId === snap.page;
  if (!pageOk) {
    add('SKIP', '덤프 페이지', dumpPath,
        dump.pageId
          ? `운영 페이지(${snap.page})가 아니라 ${dump.pageId} 를 찍은 덤프입니다`
          : `pageId 가 없어 어느 페이지를 찍었는지 알 수 없습니다 (기준 ${snap.page})`,
        '고아 노드와 섹션 증감은 이 실행에서 확인하지 않았습니다. README "피그마 트리 덤프" 스니펫은 운영 페이지를 열고 뽑습니다.');
    if (doUpdate) {
      add('BLOCK', '트리 스냅샷', dumpPath, '--update 를 다른 페이지의 덤프로 돌릴 수 없습니다',
          'sections 가 운영 페이지의 것이 아닌 값으로 덮이면, 그 뒤로는 어긋난 것을 아무도 못 봅니다.');
    }
  }

  const children = dump.children || [];
  if (!children.length) {
    add('BLOCK', '라이브 대조', dumpPath, 'children 이 비어 있습니다', '덤프가 잘못 뽑혔습니다.');
  }

  // ★ 고아 노드 — 이 검사의 본체. 다른 페이지 덤프면 위에서 SKIP 을 찍고 여기서 돌지 않는다.
  for (const c of pageOk ? children : []) {
    if (c.type === 'SECTION') continue;
    if (allowed[c.id]) continue;
    add('BLOCK', '고아 노드', `${c.id} ${c.name}`,
        `페이지(${dump.pageId}) 직속에 섹션이 아닌 ${c.type} 가 있습니다`,
        '섹션 안으로 옮기세요. 섹션의 자식은 x/y 가 섹션 기준 상대좌표입니다 — 좌표만 맞추고 부모를 확인하지 않으면 캔버스 저편에 떠 있게 됩니다. 의도한 것이면 figma-tree.json 의 pageLevelAllowed 에 사유와 함께 적으세요.');
  }

  // 기준 프레임이 실제로 섹션 안에 있는가 — 626:2657 과 같은 형태를 여기서 잡는다.
  // 어느 섹션에 있어야 하는지는 저장하지 않는다. "어딘가 섹션 안" 이면 된다.
  const dreg = dump.registered || {};
  /* 옛 스니펫으로 뽑은 덤프에는 프레임별 page 가 없다. 없는 것을 통과로 세지 않는다 —
     그러면 필드 하나를 빠뜨리는 것만으로 아래 소속 검사가 흔적 없이 꺼진다. */
  const 소속미상 = Object.values(dreg).filter((r) => r && r.found !== false && !r.page).length;
  // pageOk 로 묶지 않는다 — 다른 페이지 덤프이면서 옛 스니펫이면, 「덤프 페이지」 한 줄만 뜨고
  // 그 비고는 고아·섹션만 못 봤다고 말해 소속 검사가 아무 판정도 못 낸 사실이 화면에서 사라진다.
  if (소속미상) {
    add('SKIP', '프레임 소속 페이지', dumpPath,
        `${소속미상}개 프레임에 page 가 없어 검수 대상 페이지에 있는지 확인하지 못했습니다`,
        'README "피그마 트리 덤프" 의 최신 스니펫으로 다시 뽑으세요 — registered 항목에 page 를 넣습니다.');
  }
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
      continue;
    }
    /* "어딘가 섹션 안" 만 보면 파일이 여러 페이지가 된 뒤로는 부족하다. 등록된 프레임을
       레퍼런스 페이지로 끌어다 놓아도 섹션 안이라 여기까지 전부 초록이고, 위 고아 검사는
       운영 페이지만 훑으므로 그 프레임을 아예 보지 않는다. id 가 바뀌지 않는 이동
       (같은 파일 안에서 페이지 사이로 끌기)은 어느 검사에도 안 걸리던 자리다. */
    if (snap.page && r.page && r.page !== snap.page) {
      add('BLOCK', 무엇, `${e.node} (${html})`,
          `검수 대상이 아닌 페이지(${r.page})의 섹션에 들어 있습니다`,
          `운영 페이지는 ${snap.page} 입니다. 라이브에 살아 있는 화면이면 되돌리고, 정말 죽은 화면이면 page-figma-map.json 에서 먼저 내리세요.`);
    }
  }

  // 섹션 증감 — 사람이 피그마를 정리하면 반드시 생긴다. 막지 않고 ↺ 로 분류한다.
  // 다른 페이지 덤프로 이것을 돌리면 운영 페이지의 섹션이 통째로 "사라짐" 으로 뜬다 — 돌리지 않는다.
  if (pageOk) {
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
}

/* ---------- (3) 자동 갱신 ---------- */

const syncs = findings.filter((f) => f.level === 'SYNC');
let updated = null;

// 위 관문과 **같은 값**을 쓴다. 비교식을 여기 한 번 더 적으면 한쪽만 고쳐질 때 갈린다 —
// 실제로 snap.page 가 빈 경우 이 자리만 undefined === undefined 로 참이 되어 파일을 덮어썼다.
if (doUpdate && dump && pageOk && (dump.children || []).length) {
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
  // 모드와 한도는 --json 쪽에도 실어야 한다. 없으면 `--json` 과 `--strict --json` 의 본문이
  // 바이트 단위로 같아져, "돌렸는데 깨끗한 것" 과 "관문이 꺼진 것" 이 구분되지 않는다.
  console.log(JSON.stringify({ findings, updated, dump: dumpPath || null, strict, ageLimit: maxAgeSource }, null, 2));
} else {
  const 상태프레임수 = registered.reduce((n, [, e]) => n + ((e.stateNodes || []).length), 0);
  console.log(`\n피그마 트리 점검 — 섹션 ${Object.keys(sections).length}개 · 기준 프레임 ${registered.length}개(+상태 ${상태프레임수}개)` +
              `${dumpPath ? ` · 덤프 ${dumpPath}` : ' · 덤프 없음(라이브 미확인)'} · 나이 한도 ${maxAgeSource}` +
              ` · 모드 ${strict ? 'strict(미실행도 실패)' : '기본(미실행은 통과)'}\n`);
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
      console.log(`   (예약 점검이 전체 모드로 도는 날 이 한 줄을 대신 돌립니다 — 최대 3주. 그때까지 푸시를 막지 않습니다.)\n`);
    }
    // 미실행을 조치 필요와 같은 줄에서 따로 센다 — "조치 필요 0건" 만 보고
    // 고아 노드가 없다고 읽는 것이 이 검수가 무력해지는 방식이다.
    console.log(`총 ${findings.length}건 (조치 필요 ${blocks.length}건${skips.length ? ` · 미실행 ${skips.length}건` : ''})\n`);
  }
  if (skips.length && strict) {
    console.log(`🚫 --strict 모드라 미실행 ${skips.length}건을 실패로 셉니다 (예약 점검처럼 덤프를 반드시 뽑는 호출용).\n`);
  }
  if (skips.length && !blocks.length) {
    console.log('🚫 라이브 대조를 하지 않았습니다 — 이 실행은 "고아 노드 없음" 을 확인한 것이 아닙니다.');
    console.log('   피그마 안에서만 프레임이 섹션 밖으로 나간 날은 저장소 파일이 하나도 안 바뀌므로,');
    console.log('   덤프 없이 통과한 푸시는 2026-08-08 과 같은 상태를 그대로 지나칩니다.\n');
  }
}

process.exit(blocks.length || (strict && skips.length) ? 1 : 0);
