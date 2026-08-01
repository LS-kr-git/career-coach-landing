# 이 저장소에서 작업할 때 (모든 세션 공통)

커리어코치 랜딩페이지. **피그마가 단일 기준(Source of Truth), 웹은 파생물**이다.

## 0. 클론 직후 한 줄 — 푸시 훅 켜기
```
git config core.hooksPath tools/hooks
```
랜딩 결과물(`index.html`/`assets`)이 바뀐 푸시는 **검수를 통과해야만** 나간다.
문서·도구만 바꾼 푸시는 그냥 통과한다. 급할 때만 `git push --no-verify`.

## 기준
- 피그마 파일 `LnT8TgFVBxky0bVyaF6Tob`, 프레임 **`6:148` "랜딩페이지_커리어코치"** (가로 360px)
- PROD 섹션(`6:147`)에는 다른 프로젝트 레퍼런스 프레임이 섞여 있다. **섹션이 아니라 프레임 6:148 만** 기준이다.

## 랜딩을 건드렸다면 — 푸시 전에 반드시

### 1. 피그마에서 두 가지를 뽑는다 (Figma MCP)

**(a) 구조·문구 메타데이터**
```
get_metadata(fileKey="LnT8TgFVBxky0bVyaF6Tob", nodeId="0:1")
```
결과가 크면 툴이 파일로 떨궈 준다. 그 파일의 `text` 필드를 이어붙여 `figma_meta.xml` 로 저장.

**(b) 타이포 원본 덤프** — `use_figma` 로 아래를 그대로 실행하고 결과를 `figma_type.json` 으로 저장:
```js
const frame = await figma.getNodeByIdAsync('6:148');
return frame.findAllWithCriteria({ types: ['TEXT'] }).map(n => {
  const s = (n.getStyledTextSegments(['fontSize','fontName','lineHeight','letterSpacing']) || [])[0] || {};
  const size = typeof n.fontSize === 'number' ? n.fontSize : s.fontSize;
  const fn = n.fontName !== figma.mixed ? n.fontName : s.fontName;
  const lh = n.lineHeight !== figma.mixed ? n.lineHeight : s.lineHeight;
  const ls = n.letterSpacing !== figma.mixed ? n.letterSpacing : s.letterSpacing;
  return { id: n.id, t: n.characters.replace(/\s+/g,' ').trim().slice(0,20),
    size, weight: fn && fn.style,
    lh: lh && lh.unit === 'PIXELS' ? lh.value : null,
    ls: ls && typeof ls.value === 'number' ? ls.value : 0 };
});
```
> `getStyledTextSegments` 를 쓰는 이유: 굵기가 섞인 문단(예: 6:189)은 `n.fontName` 이 `figma.mixed` 라 그냥 읽으면 빠진다.

### 2. 검수를 돌린다 — **인자 두 개를 모두 준다**
```
node tools/figma-audit/audit.mjs figma_meta.xml figma_type.json
```
- 두 번째 인자를 빼면 "🅰️ 신선도 미확인" 이 조치 필요 항목으로 뜬다. **확인 안 한 걸 통과로 착각하지 않기 위한 장치**이니 `--skip-type-freshness` 로 덮지 말 것.
- "차이 없음" 이 나와야 푸시한다.

### 3. 피그마 타이포가 바뀌었다는 결과가 나오면
```
node tools/figma-audit/build-type-snapshot.mjs figma_type.json          # 미리보기
node tools/figma-audit/build-type-snapshot.mjs figma_type.json --write  # 반영
```
스냅샷은 **자동 생성**된다. 사람이 손댈 것은 새로 생긴 타이포 조합의 `sels`(웹 선택자)뿐이고, 스크립트가 어떤 조합에 선택자가 비었는지 알려 준다.
그다음 **웹 CSS도 새 피그마 값으로 고친다** — 스냅샷만 갱신하고 끝내면 안 된다.

## 하지 말 것
- **글자 크기를 줄여서 줄바꿈을 맞추지 않는다.** 문구가 안 들어가면 UXW(문구)를 줄인다. (2026-08-01 사용자 결정)
  단, 웹이 피그마보다 큰 값을 쓰고 있어서 생긴 문제라면 그건 보정이 아니라 **정정**이니 피그마 값으로 되돌린다.
- `map.json` 의 `lockedStyles` 를 통과시키려고 값을 바꾸지 않는다. **결정이 실제로 바뀌었으면 피그마·웹·잠금값을 함께** 고친다.
- 데스크톱 카드 폭 400px 을 피그마 프레임 360px 에 "맞추지" 않는다. 다른 것이 의도된 상태다.

## 로컬 검수 환경
- 줄바꿈·폭을 재려면 Pretendard 가 필요하다: `npm i pretendard` → `PretendardVariable.ttf` 를 `~/.fonts` 에 복사 → `fc-cache -f`.
  **폰트 없이 재면 줄바꿈 판정이 틀린다.** (타이포 검수 자체는 폰트 없이도 정확하다)
- 샌드박스에서 `figma.com` 과 jsdelivr 는 차단돼 있다. 이미지는 사용자가 피그마에서 Export → 채팅 첨부가 표준 경로.

## 푸시
공개 저장소라 토큰 없이 clone 된다. 푸시는:
1. Write 툴로 `/home/claude/.git-credentials` 에 `https://x-access-token:<PAT>@github.com` 한 줄 (PAT는 프로젝트 문서 `기획/github-토큰.md`)
2. `git -c credential.helper='store --file=/home/claude/.git-credentials' push origin main`

셸 명령에 토큰을 직접 쓰거나 `git config --global` 을 건드리면 차단된다.
