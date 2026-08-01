# career-coach-landing

커리어코치 랜딩페이지 (GitHub Pages · https://careercoach.my)

---

## ⚠️ 이 저장소를 건드리기 전에 — 3줄 요약

1. **피그마가 기준이다.** 파일 `LnT8TgFVBxky0bVyaF6Tob` / 프레임 `6:148` "랜딩페이지_커리어코치"(360px). 웹은 파생물.
2. **푸시 전 검수는 필수다.** 피그마에서 덤프 2개를 뽑아 `node tools/figma-audit/audit.mjs figma_meta.xml figma_type.json` → "차이 없음" 이어야 한다.
3. **클론 직후 훅을 켠다:** `git config core.hooksPath tools/hooks`
   → 랜딩 결과물이 바뀐 푸시는 검수를 통과해야만 나간다.

**전체 절차와 금지사항은 [`CLAUDE.md`](CLAUDE.md) 에 있다. 작업 시작 전에 반드시 읽을 것.**

---

## 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 랜딩 본문 (CSS 인라인) |
| `letter.html` | 브리핑 레터 샘플 |
| `signup.html` | 회원가입(카카오 동의 항목) |
| `terms.html` · `privacy.html` | 이용약관 · 개인정보처리방침 |
| `assets/` | 일러스트 6종(투명 PNG 2x) + 로고 SVG |
| `tools/figma-audit/` | 피그마↔웹 자동 검수 ([README](tools/figma-audit/README.md)) |
| `tools/hooks/pre-push` | 검수 미통과 푸시 차단 훅 |
| `CNAME` | 커스텀 도메인 |

## 검수가 보는 것

문구 · 역방향(웹 전용 문구) · 부분 일치 · 확정값 21건 · 이미지 sha256 6종 · 타이포(12조합 / 18선택자) · 타이포 스냅샷 신선도

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
