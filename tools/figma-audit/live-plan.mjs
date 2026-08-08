#!/usr/bin/env node
/* 라이브 대조 계획 — 어떤 페이지를 무슨 문자열로 확인할지 커밋 범위에서 자동으로 뽑는다.
 *
 * 왜 만들었나 (2026-08-08 리허설 실측):
 *   문자열을 눈으로 고르다 privacy.html 에 없는 사업자번호를 골라 "없음" 을 받고
 *   사고로 오인할 뻔했다. 더 나쁜 건 반대 경우다 — PR #21 처럼 <script> 안 JS 만
 *   바뀐 커밋은 WebFetch 의 마크다운 변환이 스크립트를 통째로 버려서 무엇을 골라도
 *   확인이 안 되는데, 모르고 "본문 최신" 이라 적으면 확인 안 한 것을 통과로 센다.
 *   (실측: 라이브에서 account_email·supabase 전부 "없음" 이 나온다.)
 *
 * 사용법:  node tools/figma-audit/live-plan.mjs <기준sha> [대상sha]
 *   기준sha = 라이브에 반영된 것이 확인된 마지막 커밋 (보통 직전 점검의 main HEAD)
 */
import { execFileSync } from 'node:child_process';

const [base, head = 'HEAD'] = process.argv.slice(2);
if (!base) {
  console.error('사용법: node tools/figma-audit/live-plan.mjs <기준sha> [대상sha]');
  process.exit(2);
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64e6 });

// robots.txt 가 Disallow 하지 않는 것만 WebFetch 로 본문을 받을 수 있다.
// 나머지는 ROBOTS_DISALLOWED 가 정상이므로 배포 sha 로 간접 확인한다.
const ALLOW = new Set(['index.html', 'terms.html', 'privacy.html']);

const url = (p) => (p === 'index.html' ? '/' : p.endsWith('/index.html') ? '/' + p.slice(0, -10) : '/' + p);

const show = (sha, p) => { try { return git('show', `${sha}:${p}`); } catch { return null; } };

/* WebFetch 가 실제로 보는 것만 남긴다 — head·script·style·주석은 마크다운 변환에서 사라진다. */
const visible = (html) => {
  const out = new Set();
  if (html == null) return out;
  const body = html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\n');
  for (const raw of body.split('\n')) {
    const s = raw.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (s.length >= 6) out.add(s);
  }
  return out;
};

/* 대조 문자열은 짧으면 우연히 겹치고 길면 요약 모델이 흘린다 — 10~60자를 긴 것부터. */
const pick = (set, n = 2) => [...set].filter((s) => s.length >= 10 && s.length <= 60)
  .sort((a, b) => b.length - a.length).slice(0, n);

let files;
try {
  files = git('diff', '--name-only', `${base}..${head}`).split('\n').filter(Boolean);
} catch {
  console.error(`❌ ${base} 을 로컬에서 못 찾습니다 — git fetch --depth 30 origin main 후 다시 실행하세요.`);
  process.exit(2);
}

const pages = files.filter((f) => f.endsWith('.html') && !f.startsWith('assets/') && !f.startsWith('node_modules/'));

console.log(`\n범위: ${base.slice(0, 7)}..${git('rev-parse', '--short', head).trim()} · 변경 파일 ${files.length}개 · HTML ${pages.length}개\n`);

if (!pages.length) {
  console.log('HTML 변경 없음 → 본문 대조로는 배포 여부를 판정할 수 없다.');
  console.log('   Actions 실행 상태로만 판정한다 (아래 "배포 실행 상태" 참고).\n');
}

let checkable = 0, blind = 0;
for (const p of pages) {
  const a = visible(show(base, p));
  const b = visible(show(head, p));
  const added = pick(new Set([...b].filter((s) => !a.has(s))));
  const removed = pick(new Set([...a].filter((s) => !b.has(s))));

  if (!ALLOW.has(p)) {
    console.log(`🔒 ${p}  → robots.txt Disallow · 배포 sha 로 간접 확인 (정상)`);
    continue;
  }
  if (!added.length && !removed.length) {
    blind++;
    console.log(`⚠️  ${p}  → ${url(p)}`);
    console.log(`    확인 불가 — 가시 텍스트가 안 바뀌었다 (스크립트·메타·스타일만 변경).`);
    console.log(`    WebFetch 로는 판정할 수 없으니 보고에 "확인 불가" 로 적는다. 통과로 세지 마라.`);
    continue;
  }
  checkable++;
  console.log(`✅ ${p}  → ${url(p)}`);
  added.forEach((s) => console.log(`    있어야 함: "${s}"`));
  removed.forEach((s) => console.log(`    없어야 함: "${s}"`));
}

console.log(`\n본문 대조 가능 ${checkable}개 · 확인 불가 ${blind}개`);
console.log('배포 실행 상태: github.com/<owner>/<repo>/actions/workflows/pages/pages-build-deployment');
console.log('   → 최신 run id 를 받아 /actions/runs/<id> 를 열면 conclusion·sha·build/deploy 잡별 결과가 나온다.');
console.log('   (api.github.com 은 이 환경에서 403 이다. github.com 웹 페이지는 열린다.)\n');
