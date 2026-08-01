#!/usr/bin/env node
/**
 * 시각 스타일 검수 — 피그마 스타일 스냅샷(figma-style.json) vs 웹 실측(getComputedStyle)
 *
 *   node tools/figma-audit/style-audit.mjs [--json]
 *
 * 왜 별도 스크립트인가:
 *   audit.mjs 가 읽는 get_metadata XML 에는 색·보더·반경·패딩·그림자가 아예 없다.
 *   2026-08-01 검수에서 이 구멍 때문에 12건(말풍선 들여쓰기, 구분선 누락, 프로필명 색,
 *   카드 그림자, 배지 보더 …)이 "차이 없음" 을 통과한 채 눈으로만 달라 보였다.
 *   그래서 스타일은 ① 피그마에서 뽑아 커밋해 둔 스냅샷과 ② 실제 브라우저 computed style 을 대조한다.
 *
 * 특수 키:
 *   "shadow": "있음" | "없음"  → box-shadow 유무만 본다 (피그마 blur 와 CSS blur 는 값 체계가 달라 수치 비교는 무의미)
 *   "tag":    "SPAN" 등        → 요소의 태그명. 목업 CTA 처럼 "링크가 아니어야 한다" 를 잠근다
 *   그 밖의 키는 CSS 속성명 그대로 getComputedStyle 값과 비교한다. 색은 #hex / rgb() 아무 표기나 된다.
 *
 * playwright 가 없으면 조용히 건너뛴다(종료코드 0, skipped=true).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const asJson = process.argv.includes('--json');

const map = JSON.parse(readFileSync(join(HERE, 'map.json'), 'utf8'));
const specPath = join(HERE, 'figma-style.json');

const bail = (reason) => {
  const payload = { skipped: true, reason, findings: [] };
  if (asJson) console.log(JSON.stringify(payload));
  else console.log(`\n스타일 검수 건너뜀 — ${reason}\n`);
  process.exit(0);
};

if (!existsSync(specPath)) bail('figma-style.json 이 없습니다');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  bail('playwright 미설치 (npm i playwright 후 다시 실행)');
}

const CHROME_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
].filter(Boolean);
const exe = CHROME_CANDIDATES.find((p) => existsSync(p));

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const htmlPath = join(ROOT, map.web.html);

/* ---------- 색 정규화 ---------- */
const norm = (v) => {
  if (v == null) return v;
  const s = String(v).trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return `#${h}`;
  }
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
  if (m) {
    const hex = [1, 2, 3].map((i) => Math.round(parseFloat(m[i])).toString(16).padStart(2, '0')).join('');
    return `#${hex}`;
  }
  // 999px 같은 큰 반경은 브라우저가 실제 픽셀로 줄여 보고할 수 있으므로 라운드 처리
  m = /^([\d.]+)px$/.exec(s);
  if (m) return `${Math.round(parseFloat(m[1]) * 10) / 10}px`;
  return s;
};
/* border-radius 999px 는 요소 크기에 따라 브라우저가 다른 값을 돌려주지 않지만,
   혹시 모를 클램프에 대비해 "충분히 큰 값" 은 같은 것으로 본다. */
const bigRadius = (v) => /^\d+px$/.test(v) && parseFloat(v) >= 100;

let browser;
try {
  browser = await chromium.launch(exe ? { executablePath: exe } : {});
} catch (e) {
  bail(`크로미움 실행 실패 (${e.message.split('\n')[0]})`);
}

const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });

const measured = await page.evaluate((items) =>
  items.map((it) => {
    const el = document.querySelector(it.sel);
    if (!el) return { id: it.id, missing: true };
    const cs = getComputedStyle(el);
    const got = {};
    for (const prop of Object.keys(it.css)) {
      if (prop === 'shadow') got.shadow = cs.boxShadow && cs.boxShadow !== 'none' ? '있음' : '없음';
      else if (prop === 'tag') got.tag = el.tagName;
      else got[prop] = cs.getPropertyValue(prop);
    }
    return { id: it.id, got };
  }), spec.items);

await browser.close();

const findings = [];
let checked = 0;
for (let i = 0; i < spec.items.length; i++) {
  const it = spec.items[i];
  const m = measured[i];
  if (m.missing) {
    findings.push({ level: 'STYLE', id: it.id, label: it.label, node: it.node,
      detail: `웹에서 요소를 못 찾음 (선택자: ${it.sel})` });
    continue;
  }
  const diff = [];
  for (const [prop, want] of Object.entries(it.css)) {
    checked++;
    const a = norm(want);
    const b = norm(m.got[prop]);
    if (a === b) continue;
    if (prop.endsWith('radius') && bigRadius(a) && bigRadius(b)) continue;
    diff.push(`${prop} ${want} → ${m.got[prop]}`);
  }
  if (diff.length) {
    findings.push({ level: 'STYLE', id: it.id, label: it.label, node: it.node,
      sel: it.sel, detail: diff.join(' · ') });
  }
}

if (asJson) {
  console.log(JSON.stringify({ skipped: false, checked, items: spec.items.length, findings }));
} else {
  console.log(`\n스타일 검수 — 피그마 스냅샷 ${spec.generatedAt} (노드 ${spec.figmaNode}) / 항목 ${spec.items.length}개, 속성 ${checked}개`);
  if (!findings.length) console.log('✅ 스타일 차이 없음\n');
  else {
    for (const f of findings) {
      console.log(`\n🎨 스타일  ${f.label} [${f.id}]  피그마 노드 ${f.node}`);
      console.log(`   차이  : ${f.detail}`);
    }
    console.log(`\n총 ${findings.length}건\n`);
  }
}
process.exit(findings.length ? 1 : 0);
