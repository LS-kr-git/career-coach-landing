#!/usr/bin/env node
/**
 * 배포를 기다리지 않고 지금 보는 미리보기 만들기
 *
 *   node tools/make-preview.mjs [출력경로]
 *
 * index.html 의 assets 참조를 전부 data: URL 로 인라인해서 **파일 하나**로 만든다.
 * 그 파일을 SendUserFile 로 사용자에게 보내면 인터넷·서버 없이 바로 열린다.
 *
 * 왜 필요한가 (2026-08-02):
 *   GitHub Pages 는 푸시 → 빌드 큐 → 배포라 라이브 반영까지 10~15분이 걸린다.
 *   그 사이 "고쳤는데 안 바뀌었다" 로 시간을 버리지 않도록, 배포와 무관하게 확인할 길을 둔다.
 *
 * 다른 페이지 링크(signup/terms/privacy/letter)는 파일 하나에 담을 수 없어 비활성화된다.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const outPath = process.argv[2] || join(ROOT, '..', '미리보기-랜딩.html');

let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const mime = (f) => f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream';

let inlined = 0, bytes = 0, missing = [];
html = html.replace(/(src|href)="(assets\/[^"]+)"/g, (m, attr, path) => {
  try {
    const buf = readFileSync(join(ROOT, path));
    inlined++; bytes += buf.length;
    return `${attr}="data:${mime(path)};base64,${buf.toString('base64')}"`;
  } catch { missing.push(path); return m; }
});

html = html.replace(/href="(\.\/)?(signup|terms|privacy|letter)\.html"/g, 'href="#" data-preview-disabled="1"');

let commit = 'local';
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch {}

html = html.replace('</body>', `
<div id="__preview" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1E293B;color:#fff;
  font:600 12px/1.5 -apple-system,'Apple SD Gothic Neo',sans-serif;padding:7px 12px;text-align:center;letter-spacing:.01em">
  로컬 미리보기 · 커밋 ${commit} · 배포 전 파일 그대로 (다른 페이지 링크는 비활성)
  <span style="opacity:.65;font-weight:400"> — 창 너비를 줄였다 늘리며 반응형을 확인하세요</span>
</div>
<script>document.body.style.paddingTop='30px';</script>
</body>`);

writeFileSync(outPath, html);
if (missing.length) console.warn(`⚠️ 인라인 실패: ${missing.join(', ')}`);
console.log(`인라인 ${inlined}개 / 원본 ${(bytes / 1024).toFixed(0)}KB → ${outPath} (${(statSync(outPath).size / 1024).toFixed(0)}KB)`);
