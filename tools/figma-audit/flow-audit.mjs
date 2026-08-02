#!/usr/bin/env node
/**
 * 반응형 연속성 검수 — 화면 폭을 1px 씩 늘리며 "탁 튀는 지점" 을 찾는다.
 *
 *   node tools/figma-audit/flow-audit.mjs [--json] [--from 320] [--to 700] [--step 1]
 *
 * 왜 필요한가 (2026-08-02):
 *   브레이크포인트로 데스크톱 폭을 키우면, 그 한 지점에서 레이아웃이 한 번에 튄다.
 *   실제로 520px 에서 콘텐츠가 352 → 448 로 **96px** 점프했고, 창을 늘려 보던 사용자가 바로 알아챘다.
 *   눈으로만 잡히는 종류라 자동 검수에 넣는다. clamp()/min() 으로 연속화한 뒤에는 0건이어야 한다.
 *
 * 검사 항목
 *   1) 연속성 — 폭 1px 변화에 추적 요소가 JUMP_PX 이상 튀는가
 *   2) 가로 스크롤 — 어느 폭에서든 문서가 화면보다 넓어지는가
 *   3) 이미지 비율 — 모든 폭에서 .illust 렌더 비율이 원본 비율과 같은가
 *
 * playwright 가 없으면 조용히 건너뛴다(종료코드 0, skipped=true).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const argVal = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
};
const FROM = argVal('--from', 320);
const TO = argVal('--to', 700);
const STEP = argVal('--step', 1);

/** 1px 폭 변화에서 이만큼 이상 튀면 "점프" 로 본다.
 *  clamp() 로 연속 보간되는 값도 1px 당 최대 0.11px 정도라 여유가 크다. */
const JUMP_PX = 2.5;

/** 추적 대상 — 눈에 띄게 튀면 바로 보이는 것들 */
const TRACK = [
  { key: 'card', label: '카드', sel: '.page' },
  { key: 'content', label: '콘텐츠', sel: 'section > .head-group' },
  { key: 'illust', label: '일러스트', sel: '.illust' },
  { key: 'chips', label: '칩', sel: '.chips' },
  { key: 'cta', label: '플로팅 CTA', sel: '.floating-cta' },
  { key: 'padX', label: '섹션 좌우 패딩', sel: 'section', prop: 'paddingLeft' },
];

const map = JSON.parse(readFileSync(join(HERE, 'map.json'), 'utf8'));
const htmlPath = join(ROOT, map.web.html);

const bail = (reason) => {
  const payload = { skipped: true, reason, findings: [] };
  if (asJson) console.log(JSON.stringify(payload));
  else console.log(`\n반응형 연속성 검수 건너뜀 — ${reason}\n`);
  process.exit(0);
};

let chromium;
try { ({ chromium } = await import('playwright')); } catch { bail('playwright 미설치'); }

const exe = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].filter(Boolean).find((p) => existsSync(p));

let browser;
try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); }
catch (e) { bail(`크로미움 실행 실패 (${e.message.split('\n')[0]})`); }

const page = await browser.newPage({ viewport: { width: FROM, height: 700 } });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => Promise.all([...document.images].map((i) =>
  i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));

const findings = [];
let prev = null;
let steps = 0;

for (let w = FROM; w <= TO; w += STEP) {
  await page.setViewportSize({ width: w, height: 700 });
  const v = await page.evaluate((track) => {
    const de = document.documentElement;
    const out = { _scroll: de.scrollWidth > de.clientWidth + 1 };
    for (const t of track) {
      const el = document.querySelector(t.sel);
      if (!el) { out[t.key] = null; continue; }
      out[t.key] = t.prop
        ? parseFloat(getComputedStyle(el)[t.prop])
        : +el.getBoundingClientRect().width.toFixed(2);
    }
    const imgs = [...document.querySelectorAll('.illust')].filter((i) => i.naturalWidth);
    out._ratioBad = imgs.filter((i) => {
      const r = i.getBoundingClientRect();
      return Math.abs(r.width / r.height - i.naturalWidth / i.naturalHeight) > 0.02;
    }).length;
    return out;
  }, TRACK);
  steps++;

  if (v._scroll) findings.push({ level: 'FLOW', kind: '가로 스크롤', width: w,
    detail: `${w}px 에서 문서가 화면보다 넓어집니다` });
  if (v._ratioBad) findings.push({ level: 'FLOW', kind: '이미지 비율', width: w,
    detail: `${w}px 에서 일러스트 ${v._ratioBad}개의 비율이 원본과 다릅니다` });

  if (prev) {
    for (const t of TRACK) {
      const a = prev[t.key], b = v[t.key];
      if (a == null || b == null) continue;
      const d = Math.abs(b - a);
      if (d >= JUMP_PX) findings.push({ level: 'FLOW', kind: '레이아웃 점프', width: w,
        detail: `${w - STEP} → ${w}px 에서 ${t.label}이(가) ${a} → ${b} 로 ${d.toFixed(1)}px 튑니다`,
        note: '브레이크포인트 대신 clamp()/min() 으로 연속 보간하세요' });
    }
  }
  prev = v;
}

await browser.close();

// 같은 지점의 중복은 접어서 보여 준다
const dedup = [];
const seen = new Set();
for (const f of findings) {
  const k = `${f.kind}|${f.detail}`;
  if (seen.has(k)) continue;
  seen.add(k); dedup.push(f);
}

if (asJson) {
  console.log(JSON.stringify({ skipped: false, from: FROM, to: TO, steps, findings: dedup }));
} else {
  console.log(`\n반응형 연속성 검수 — ${FROM}~${TO}px 를 ${STEP}px 씩 ${steps}단계 (점프 기준 ${JUMP_PX}px)`);
  if (!dedup.length) console.log('✅ 튀는 지점 없음 — 처음부터 끝까지 연속입니다\n');
  else {
    for (const f of dedup.slice(0, 20)) {
      console.log(`\n📐 반응형  ${f.kind}  [${f.width}px]`);
      console.log(`   상세  : ${f.detail}`);
      if (f.note) console.log(`   비고  : ${f.note}`);
    }
    if (dedup.length > 20) console.log(`\n… 외 ${dedup.length - 20}건`);
    console.log(`\n총 ${dedup.length}건\n`);
  }
}
process.exit(dedup.length ? 1 : 0);
