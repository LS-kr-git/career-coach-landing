// 서비스 종료 표식 (2026-11-03 사용자 확정 — 커리어코치 서비스 종료).
// ops/·terms.html·privacy.html 을 뺀 모든 페이지가 같은 종료 안내 한 장이 됐다. 그 페이지에는
// <meta name="cc-closed"> 가 있고, 랜딩·결제·온보딩·마이페이지의 마크업을 전제로 하는 검사는
// 이 표식을 보고 건너뛴다(없어진 화면을 「틀렸다」고 막지 않게). 표식을 지우면 검사가 다시 돈다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const 닫힘 = (html) => /<meta\s+name="cc-closed"/i.test(html);
export const 닫힌파일 = (root, rel) => { try { return 닫힘(readFileSync(join(root, rel), 'utf8')); } catch { return false; } };
