#!/usr/bin/env node
/**
 * 타이포 스냅샷 생성기 — 피그마 원본 덤프 → figma-type.json
 *
 *   node tools/figma-audit/build-type-snapshot.mjs <figma_type.json> [--write]
 *
 * <figma_type.json> 은 Figma MCP `use_figma` 로 뽑은 원본 배열.
 * 만드는 코드는 CLAUDE.md / README "타이포 원본 덤프" 절에 그대로 있다. 형태:
 *   [{ id, t, size, weight, lh, ls }, ...]
 * 2026-08-01부터 덤프는 "세그먼트 단위" — 서식이 섞인 텍스트 노드는 스타일 조합별로
 * "6:365#0", "6:365#1" 처럼 여러 항목으로 나뉘어 들어온다. 이 스크립트는 항목을 조합별로
 * 묶기만 하므로 별도 처리 없이 그대로 동작하고, 혼합 노드의 어느 구간이 바뀌어도
 * "새 조합" 으로 감지된다. (이전 첫-세그먼트 방식의 사각지대 보완)
 *
 * 하는 일
 *   1) 같은 (size, weight, lh, ls) 조합끼리 자동으로 묶는다
 *   2) 기존 figma-type.json 의 `sel`(웹 선택자)·id·label 을 조합 키로 이어받는다
 *   3) 새로 생긴 조합은 sel 이 비어 있으니 "선택자 미지정" 으로 보고한다
 *   --write 를 주면 figma-type.json 을 덮어쓴다 (기본은 미리보기만)
 *
 * 손으로 JSON 을 고칠 필요가 없도록 하는 것이 목적. 사람이 채울 건 새 조합의 `sel` 뿐이다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const write = args.includes('--write');
const dumpPath = args.find((a) => !a.startsWith('--'));
if (!dumpPath) {
  console.error('사용법: node tools/figma-audit/build-type-snapshot.mjs <figma_type.json> [--write]');
  process.exit(2);
}

const WEIGHT = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500,
  SemiBold: 600, Semibold: 600, Bold: 700, ExtraBold: 800, Black: 900 };

const raw = JSON.parse(readFileSync(resolve(dumpPath), 'utf8'));
const snapPath = join(HERE, 'figma-type.json');
const prev = existsSync(snapPath) ? JSON.parse(readFileSync(snapPath, 'utf8')) : { groups: [] };
const ignore = new Set((prev.ignoreNodes || []).map((x) => x.node));
const nodes = (Array.isArray(raw) ? raw : raw.nodes || [])
  .filter((n) => typeof n.size === 'number' && n.weight && !ignore.has(n.id));
// 같은 타이포 조합에 여러 웹 선택자가 붙을 수 있다(예: 13/600/18 = 칩·배지·프로필명·푸터).
// 조합 키 하나에 이전 그룹들을 모두 모아 sels 를 합친다.
const prevByKey = new Map();
for (const g of prev.groups || []) {
  const k = `${g.size}/${g.weight}/${g.lh}/${g.ls}`;
  const sels = g.sels || (g.sel ? [{ sel: g.sel, label: g.label }] : []);
  if (!prevByKey.has(k)) prevByKey.set(k, { ...g, sels: [] });
  prevByKey.get(k).sels.push(...sels);
}

const byKey = new Map();
for (const n of nodes) {
  const weight = WEIGHT[n.weight] ?? Number(n.weight) ?? null;
  const lh = typeof n.lh === 'number' ? n.lh : null;
  const ls = typeof n.ls === 'number' ? n.ls : 0;
  const key = `${n.size}/${weight}/${lh}/${ls}`;
  if (!byKey.has(key)) byKey.set(key, { size: n.size, weight, lh, ls, figmaNodes: [], samples: [] });
  const g = byKey.get(key);
  g.figmaNodes.push(n.id);
  if (g.samples.length < 2) g.samples.push(n.t);
}

const groups = [];
const unmapped = [];
// 이번 덤프에 안 나온 조합(예: 서식이 섞인 텍스트 노드)은 버리지 않고 그대로 이어받는다.
const carried = [];
for (const [key, g] of prevByKey) {
  if (byKey.has(key)) continue;
  carried.push({ key, id: g.id });
  groups.push({ ...g, _carriedOver: true });
}
for (const [key, g] of byKey) {
  const old = prevByKey.get(key);
  const sels = old?.sels || [];
  const out = {
    id: old?.id || `type-${key.replace(/\//g, '-')}`,
    label: sels.length ? sels.map((x) => x.label).join(' / ') : `(${g.samples[0] || key})`,
    sels,
    size: g.size, weight: g.weight, lh: g.lh, ls: g.ls,
    figmaNodes: g.figmaNodes,
  };
  if (old?.note) out.note = old.note;
  if (!sels.length) unmapped.push({ key, samples: g.samples, nodes: g.figmaNodes.slice(0, 3) });
  groups.push(out);
}
// 사람이 읽기 좋게: 큰 글자부터
groups.sort((a, b) => b.size - a.size || b.weight - a.weight);

const next = {
  _설명: prev._설명 || '피그마 기준 프레임의 타이포 스냅샷. type-audit.mjs 가 이 값을 웹 실측값과 대조한다.',
  _갱신방법: 'build-type-snapshot.mjs 로 자동 생성. 손으로 고칠 것은 새 그룹의 sel(웹 선택자)뿐.',
  figmaNode: prev.figmaNode || '6:148',
  generatedAt: new Date().toISOString().slice(0, 10),
  _필드: 'size=px, weight=CSS font-weight, lh=line-height px, ls=letter-spacing %(피그마 표기). sel=웹에서 이 스타일이 적용된 대표 요소',
  groups,
};
if (prev.ignoreNodes) { next._제외설명 = prev._제외설명; next.ignoreNodes = prev.ignoreNodes; }

// 이전 스냅샷과 무엇이 달라졌는지
const prevKeys = new Set(prevByKey.keys());
const nowKeys = new Set(byKey.keys());
const added = [...nowKeys].filter((k) => !prevKeys.has(k));

console.log(`\n피그마 텍스트 노드 ${nodes.length}개 → 타이포 조합 ${groups.length}개`);
if (added.length) console.log(`\n새로 생긴 조합 (size/weight/lh/ls):\n  ${added.join('\n  ')}`);
if (carried.length) console.log(`\n덤프에 없어 이전 값을 그대로 유지한 그룹 (서식 혼합 노드 등):\n  ${carried.map((c) => `${c.id} (${c.key})`).join('\n  ')}`);
if (!added.length && !carried.length) console.log('이전 스냅샷과 조합 구성 동일');

if (unmapped.length) {
  console.log(`\n⚠️ 웹 선택자(sel)가 비어 있는 그룹 ${unmapped.length}개 — 채워야 검수 대상이 됩니다:`);
  for (const u of unmapped) console.log(`  ${u.key}  예: "${u.samples[0] || ''}"  (노드 ${u.nodes.join(', ')})`);
}

if (write) {
  writeFileSync(snapPath, JSON.stringify(next, null, 2) + '\n');
  console.log(`\n✅ ${snapPath} 갱신 완료\n`);
} else {
  console.log('\n(미리보기입니다. 실제로 쓰려면 --write 를 붙이세요)\n');
}
process.exit(unmapped.length ? 1 : 0);
