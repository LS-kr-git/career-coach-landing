# figma-audit — 피그마↔웹 자동 검수

피그마를 **단일 기준(Source of Truth)** 으로 두고, `index.html`이 거기서 어긋났는지 기계로 대조한다.
2026-07-31에 눈으로 2시간 걸려 찾은 11건이 이 스크립트로는 1분 안에 나온다.

## 무엇을 검사하나

| 항목 | 내용 | 등급 |
|---|---|---|
| 문구 | 기준 섹션의 모든 text 노드가 웹에 있는가 (공백 무시 비교) | ❌ 차이 |
| 문장부호 | 글자는 같고 따옴표·말줄임표만 다른가 | ⚠️ 부호 |
| 역방향 | 웹에만 있는 문구가 있는가 | ℹ️ 웹전용 |
| 부분 일치 | 포함은 되는데 정확히 같은 줄이 없는가 (웹에 마침표 등이 더 붙은 경우) | 🔎 부분일치 |
| 확정값 | `map.json`의 `lockedStyles` 결정이 유지되는가 | 🔒 확정값 |
| 이미지 | `assets/*.png` sha256이 기준값과 같은가 | ❌ 차이 |
| **타이포** | **글자 크기·굵기·행간·자간이 피그마와 같은가** | 🅰️ 타이포 |

`❌`/`🔒`/`🅰️`가 하나라도 있으면 종료코드 1.

## 쓰는 법 (Cowork 세션 안에서)

1. **피그마 메타데이터 받기** — Figma MCP 호출:
   `get_metadata(fileKey="LnT8TgFVBxky0bVyaF6Tob", nodeId="0:1")`
   결과가 크면 툴이 파일로 떨궈 주므로, 그 파일의 `text` 필드를 이어붙여 `figma_meta.xml`로 저장한다.
2. **검수 실행**
   ```
   node tools/figma-audit/audit.mjs figma_meta.xml
   node tools/figma-audit/audit.mjs figma_meta.xml --json   # 기계 판독용
   ```
3. 나온 차이를 **피그마 쪽으로 맞춰** 고친다. 웹이 맞다고 판단되면 **피그마도 같은 세션에서 고친다.**

`audit.mjs` 가 타이포 검수(`type-audit.mjs`)를 자동으로 함께 돌린다. 따로 실행하려면:
```
node tools/figma-audit/type-audit.mjs
```

## 타이포 검수 (2026-08-01 추가)

`get_metadata` XML 에는 **글자 크기 정보가 없다.** 그래서 타이포는 다른 방식으로 검사한다:

- 피그마 값은 `figma-type.json` 에 **스냅샷으로 커밋**해 둔다 (그룹별 size/weight/line-height/letter-spacing + 그 값이 나온 피그마 노드 id).
- 웹 값은 **headless Chromium 으로 `index.html` 을 열어 `getComputedStyle` 로 실측**한다. CSS 를 정적 파싱하지 않으므로 상속·미디어쿼리·인라인 스타일까지 반영된 "실제 적용값" 을 본다.
- `playwright` 가 없거나 `figma-type.json` 이 없으면 **조용히 건너뛴다**(종료코드 0). 검수 헤더에 건너뛴 사유가 찍힌다.

폰트 파일은 필요 없다 — 크기·굵기·행간·자간은 폰트 로딩과 무관하게 계산된다.
(줄바꿈 폭까지 보려면 Pretendard 설치가 필요하지만 그건 이 스크립트 범위 밖이다.)

### 타이포 스냅샷 갱신 (피그마에서 글자 값이 바뀌었을 때)

Figma MCP `use_figma` 로 아래를 실행하고, 결과를 `figma-type.json` 의 `groups` 에 반영한다:

```js
const frame = await figma.getNodeByIdAsync('6:148');
return frame.findAllWithCriteria({ types: ['TEXT'] })
  .filter(n => typeof n.fontSize === 'number')
  .map(n => ({ id: n.id, t: n.characters.replace(/\s+/g,' ').slice(0,24),
    size: n.fontSize, weight: n.fontName && n.fontName.style,
    lh: n.lineHeight && n.lineHeight.value, ls: n.letterSpacing && n.letterSpacing.value }));
```

같은 (size, weight, lh, ls) 조합끼리 묶어 그룹 하나로 만들고, 웹에서 그 스타일이 적용된 대표 요소의 CSS 선택자를 `sel` 에 적는다. `generatedAt` 도 갱신할 것.

### 왜 확정값(lockedStyles)과 중복되나

타이포 일부는 `lockedStyles` 로도 잠겨 있어 어긋나면 **두 번 보고된다**. 의도한 것이다 —
`lockedStyles` 는 CSS 텍스트를 정규식으로 보므로 playwright 가 없는 환경에서도 동작하는 **1차 방어선**이고,
타이포 검수는 실제 렌더값을 보므로 **선택자가 바뀌거나 다른 규칙이 덮어써도 잡아내는** 2차 방어선이다.

## 공백 무시 비교를 쓰는 이유

피그마는 좁은 프레임에서 단어 중간에 개행을 넣어 노드 이름이 `직무기 술서`, `코드 가 움직이는`처럼 저장된다.
웹은 `<br>`·`white-space:pre-line`으로 줄을 나눈다. 둘 다 실제 문구는 같으므로, **공백을 전부 제거한 문자열**로 비교해 이 잡음을 없앴다.
따옴표·말줄임표 차이는 지워버리지 않고 `⚠️ 부호` 등급으로 따로 보고한다.

## 기준 섹션이 바뀌면

`map.json`의 `figma.canonicalSectionId`를 새 섹션 id로 바꾼다. (2026-07-31 기준 `6:147` = `PROD`)
캔버스 섹션은 `PROD`(기준) / `v1_archive` / `v2_archive` / `REF - 피클플러스` / `디자인 시스템` 로 정리돼 있고, **검수 대상은 `PROD` 하나뿐**이다.
다음 개편 때도 새 버전을 만들면 옛 `PROD`를 `vN_archive`로 내리고 새 것을 `PROD`로 올린다 — 이름이 곧 기준이므로 헷갈릴 일이 없다.

## 이미지 기준 해시 세우기 (파일당 1회)

1. Figma MCP `download_assets(fileKey, nodeId)` → `rawImages[0].url`
2. 그 파일을 `assets/<이름>.png`로 저장하고 눈으로 확인
3. `sha256sum assets/<이름>.png` 값을 `map.json`의 해당 항목 `rawSha256`에 넣고 `shaVerified: true`

> ⚠️ 이 클라우드 샌드박스는 **figma.com 전 도메인이 차단**돼 있어 에셋 URL을 `curl`로 못 받는다.
> 우회: Claude in Chrome로 URL을 fetch → `<a download="파일명">`으로 다운로드 폴더에 저장 → `device_stage_files`로 컨테이너에 올림.
> 근본 해결은 데스크톱 앱에 작업 폴더를 상시 연결하거나 태스크를 "내 컴퓨터에서 실행"으로 시작하는 것.

## lockedStyles — 확정값 잠금

세션 간에 합의된 값(예: 하이라이트 v8.9 = Amber200 65% 스트립·첫 줄만)을 정규식으로 못 박아 둔다.
나중에 누가 되돌리면 즉시 🔒로 잡힌다. **결정이 실제로 바뀌면 `map.json`과 피그마를 함께 고칠 것.**

## 이미지 검사가 실제로 잡아내는 것

`rawSha256`은 **"이 날짜에 피그마와 눈으로 대조해 일치를 확인한 파일"** 의 지문이다.
따라서 이 검사는 *저장소 쪽 파일이 몰래 바뀐 것*을 잡는다. 피그마 쪽 그림이 바뀐 경우는 잡지 못하므로,
**디자인을 고쳤으면 해당 이미지를 다시 대조하고 `rawSha256`·`verifiedAt`을 갱신**해야 한다.
(피그마 export는 렌더링할 때마다 안티에일리어싱이 1px씩 달라져 바이트가 일치하지 않는다 —
그래서 자동 재-export 비교 대신 "확인한 날짜 + 지문" 방식을 쓴다.)

2026-07-31 기준 6개 이미지 전부 피그마와 대조 완료.

## 알려진 예외

- 피그마 노드 `6:325`만 곧은 따옴표 `'UI Designer'`, 웹과 피그마의 다른 노드는 둥근 따옴표 `‘UI Designer’`.
  피그마 텍스트 수정은 편집 환경에 `Pretendard Variable` 폰트가 없어 불가 → 웹(둥근 쪽)을 유지하고 `map.json`의 `acceptedPunctDiffs`에 예외로 기록했다.
  나중에 피그마에서 직접 고치면 예외 항목을 지우면 된다.
