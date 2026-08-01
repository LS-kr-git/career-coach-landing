#!/usr/bin/env node
/**
 * 타이포 검수 — 피그마 타이포 스냅파일(figma-type.json) vs 웹 실측(getComputedStyle)
 *
 *   node tools/figma-audit/type-audit.mjs [--json]
 *
 * 왜 별도 스크립트인가:
 *   audit.mjs 가 읽는 get_metadata XML 에는 글자 크기 정보가 없다. 그래서 타이포는
 *   ① 피그마에서 뽑아 커밋해 둔 스냅샷(figma-type.json)과
 *   ② 실제 브라우저에서 잰 computed style 을 대조하는 방식으로 검사한다.
 *   CSS를 정적으로 파싱하지 않고 실제 렌더 값을 재기 때문에, 상속·미디어쿼리·인라인 스타일까지
 *   포함한 "진짜 적용된 값"을 본다.
 *
 * 폰트 파일은 필요 없다 — 크기/굵기/행간/자간은 폰트 로딩과 무관하게 계산된다.
 * (줄바꿈 폭까지 보려면 Pretendard 설치가 필요하지만 그건 이 스크립트의 범위가 아니다)
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
const typePath = join(HERE, 'figma-type.json');

const bail = (reason) => {
  const payload = { skipped: true, reason, findings: [] };
  if (asJson) console.log(JSON.stringify(payload));
  else console.log(`\n타이포 검수 건너뜀 — ${reason}\n`);
  process.exit(0);
};

if (!existsSync(typePath)) bail('figma-type.json 이 없습니다');

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

const spec = JSON.parse(readFileSync(typePath, 'utf8'));
const htmlPath = join(ROOT, map.web.html);

let browser;
try {
  browser = await chromium.launch(exe ? { executablePath: exe } : {});
} catch (e) {
  bail(`크로미움 실행 실패 (${e.message.split('\n')[0]})`);
}

const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });

const rows = await page.evaluate((groups) =>
  groups.map((g) => {
    const sels = g.sels || (g.sel ? [{ sel: g.sel, label: g.label }] : []);
    return {
      id: g.id,
      measured: sels.map((x) => {
        const el = document.querySelector(x.sel);
        if (!el) return { sel: x.sel, label: x.label, missing: true };
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        const lh = cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight);
        const ls = cs.letterSpacing === 'normal' ? 0 : Math.round((parseFloat(cs.letterSpacing) / size) * 1000) / 10;
        return { sel: x.sel, label: x.label, size, lh, weight: Number(cs.fontWeight), ls };
      }),
    };
  }), spec.groups);

await browser.close();

const findings = [];
let checkedSelectors = 0;
for (let i = 0; i < spec.groups.length; i++) {
  const g = spec.groups[i];
  for (const w of rows[i].measured) {
    checkedSelectors++;
    if (w.missing) {
      findings.push({ level: 'TYPE', id: g.id, label: w.label || g.label,
        detail: `웹에서 요소를 못 찾음 (선택자: ${w.sel})`, figmaNodes: g.figmaNodes });
      continue;
    }
    const diff = [];
    if (w.size !== g.size) diff.push(`크기 ${g.size}→${w.size}`);
    if (g.lh != null && w.lh !== g.lh) diff.push(`행간 ${g.lh}→${w.lh}`);
    if (w.weight !== g.weight) diff.push(`굵기 ${g.weight}→${w.weight}`);
    if (Math.abs(w.ls - g.ls) > 0.15) diff.push(`자간 ${g.ls}%→${w.ls}%`);
    if (diff.length) {
      findings.push({ level: 'TYPE', id: g.id, label: w.label || g.label, detail: diff.join(', '),
        figma: `${g.size}/${g.lh}/${g.weight}/${g.ls}%`, web: `${w.size}/${w.lh}/${w.weight}/${w.ls}%`,
        figmaNodes: g.figmaNodes, sel: w.sel });
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ skipped: false, checked: checkedSelectors, groups: spec.groups.length, findings }));
} else {
  console.log(`\n타이포 검수 — 피그마 스냅샷 ${spec.generatedAt} (노드 ${spec.figmaNode}) / 그룹 ${spec.groups.length}개, 선택자 ${checkedSelectors}개`);
  if (!findings.length) {
    console.log('✅ 타이포 차이 없음\n');
  } else {
    for (const f of findings) {
      console.log(`\n🅰️ 타이포  ${f.label} [${f.id}]`);
      if (f.figma) console.log(`   피그마: ${f.figma}   웹: ${f.web}`);
      console.log(`   차이  : ${f.detail}`);
      console.log(`   피그마 노드: ${(f.figmaNodes || []).slice(0, 4).join(', ')}${(f.figmaNodes || []).length > 4 ? ' 외' : ''}`);
    }
    console.log(`\n총 ${findings.length}건\n`);
  }
}
process.exit(findings.length ? 1 : 0);
