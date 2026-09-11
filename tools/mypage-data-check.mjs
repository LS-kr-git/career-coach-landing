#!/usr/bin/env node
/**
 * 마이페이지 데이터 층 ↔ 정적 마크업 대조 (pre-push 1.6겹 · CI)
 *
 *   node tools/mypage-data-check.mjs     # 어긋나면 종료코드 1
 *
 * 왜 있나 (2026-09-11 검사관 ②)
 *   01·04·05·06 은 화면을 assets/mypage-data.js 의 값으로 다시 그리는데, 정적 HTML 에도
 *   같은 값이 한 벌 있다(피그마 기준 프레임 상태 — docs-audit 이 그 마크업을 피그마와 대조한다).
 *   docs-audit 은 <script> 를 떼고 보므로 데이터 층만 고치면 화면 문구가 피그마와 달라져도
 *   초록이다. 그 틈을 여기서 막는다 — 데이터 층의 값이 마크업에 **같은 순서로** 있어야 한다.
 *   (직군 목록은 tools/roles/build.mjs --check 가 같은 방식으로 본다.)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = await import(pathToFileURL(join(ROOT, 'assets', 'mypage-data.js')).href);

const key = (s) => s.replace(/\s+/g, '');
/* docs-audit 과 같은 눈으로 본다 — script·style·주석을 뗀 마크업 */
const staticHtml = (rel) => key(readFileSync(join(ROOT, rel), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));

const problems = [];
/* texts 가 html 에 이 순서대로 있는가 */
function expectInOrder(rel, html, texts) {
  let at = 0;
  for (const t of texts) {
    const i = html.indexOf(key(t), at);
    if (i < 0) { problems.push(`${rel}: 데이터 층의 「${t}」 가 마크업에 없거나 순서가 다릅니다`); return; }
    at = i + key(t).length;
  }
}

const profile = await data.getProfile();
expectInOrder('mypage/index.html', staticHtml('mypage/index.html'),
  [String(profile.insightCount), profile.initial, `${profile.name} 님`, `${profile.provider} · ${profile.email}`]);

expectInOrder('mypage/topics/index.html', staticHtml('mypage/topics/index.html'), await data.getTopics());

const week = await data.getThisWeek();
const row = (a) => [a.topic, a.date, a.title];
expectInOrder('mypage/sunday/index.html', staticHtml('mypage/sunday/index.html'),
  [...week.filter((a) => !a.read).flatMap(row), ...week.filter((a) => a.read).flatMap(row)]);

const archive = await data.getArchive();
const months = [...new Set(archive.map((a) => a.month))];
expectInOrder('mypage/archive/index.html', staticHtml('mypage/archive/index.html'), [
  ...months.map((m) => m.split('년 ')[1]),                   // 월 칩 ('8월' …)
  ...archive.filter((a) => a.month === months[0]).flatMap(row), // 첫 달 목록 (피그마 기준 상태)
]);

if (problems.length) {
  console.error('❌ 마이페이지 데이터 층 ↔ 마크업이 어긋납니다:\n' + problems.map((p) => '   · ' + p).join('\n'));
  process.exit(1);
}
console.log(`✅ 마이페이지 데이터 층 ↔ 마크업 일치 (주제 ${(await data.getTopics()).length} · 이번 주 ${week.length} · 아티클 ${archive.length})`);
