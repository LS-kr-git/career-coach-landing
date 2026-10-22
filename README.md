# career-coach-landing

커리어코치 랜딩페이지 (GitHub Pages · https://careercoach.my)

---

## ⚠️ 이 저장소를 건드리기 전에 — 3줄 요약

1. **피그마가 기준이다** — 파일 `LnT8TgFVBxky0bVyaF6Tob`. 단 랜딩(`index.html`)은 2026-10-06 부터 피그마 대조에서 빠져 웹을 바로 고친다.
2. **검수는 훅이 돈다** — 아래 3번으로 훅을 켜 두면 푸시마다 자동이다.
3. **클론 직후 훅을 켠다:** `git config core.hooksPath tools/hooks`
   → 직전 푸시로부터 **15분**이 안 지났으면 막는다 (Pages 배포가 취소되는 걸 방지 — `CC_PUSH_COOLDOWN` 으로 조절),
   → **모든 푸시**가 결과물 공통 점검(모든 페이지·CNAME·assets)을 통과해야 하고,
   → html 이 바뀐 푸시는 피그마가 기준인 화면의 문구 대조까지 통과해야 나간다.

**전체 절차와 금지사항은 [`CLAUDE.md`](CLAUDE.md) 에 있다. 작업 시작 전에 반드시 읽을 것.**

세션은 `claude/<주제>` 가지 + PR 로 올리고, 「랜딩 검수」가 초록이면 자동으로 합쳐진다(규칙은 `CLAUDE.md` 「claude/ 가지 + PR 로 올린다」 절).

---

## 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 랜딩 본문 (CSS 인라인) |
| `signup/index.html` | 화면 없음 — 옛 주소를 카카오 로그인으로 넘긴다 (2026-10-14 가입 화면 삭제) |
| `auth/callback/index.html` | 카카오 로그인 콜백 착지 (`/auth/callback/`) |
| `terms.html` · `privacy.html` | 이용약관 · 개인정보처리방침 |
| `assets/` | 일러스트 6종(투명 PNG 2x) + 로고 SVG |
| `tools/figma-audit/docs-audit.mjs` | 피그마↔웹 문구 대조 ([README](tools/figma-audit/README.md)) |
| `tools/figma-audit/page-audit.mjs` | 결과물 공통 점검 (모든 페이지) |
| `tools/figma-audit/flow-audit.mjs` | 반응형 연속성 (1px 씩 훑어 튀는 지점 검출) |
| `tools/make-preview.mjs` | 배포 대기 없이 볼 수 있는 단일 HTML 미리보기 생성 |
| `tools/hooks/pre-push` | 배포 쿨다운 + 검수 미통과 푸시 차단 훅 |
| `CNAME` | 커스텀 도메인 |

## 검수가 보는 것

**모든 페이지 (`page-audit.mjs`)** — 깨진 링크 · 경로 대소문자 · head 필수 태그 · 자리표시자 · `http://` 리소스 · `github.io` 하드코딩 · 블록 태그 균형 · CNAME 형식

**피그마가 기준인 화면 (`docs-audit.mjs`)** — 커밋된 피그마 문구 스냅샷과 웹 문구 대조 · 스냅샷 신선도

자세한 내용은 [`tools/figma-audit/README.md`](tools/figma-audit/README.md).

## 로컬에서 보기

```
python3 -m http.server 8899   # → http://127.0.0.1:8899/index.html
```

줄바꿈·폭까지 정확히 재려면 Pretendard 설치가 필요하다:
```
npm i pretendard && cp node_modules/pretendard/dist/public/variable/PretendardVariable.ttf ~/.fonts/ && fc-cache -f
```
**폰트 없이 재면 줄바꿈 판정이 틀린다.** (타이포 검수 자체는 폰트 없이도 정확)
