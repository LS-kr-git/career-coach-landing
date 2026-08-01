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

**인자 두 개를 모두 주는 것이 정상 사용법이다:**
```
node tools/figma-audit/audit.mjs figma_meta.xml figma_type.json
```
두 번째 인자(`figma_type.json`)는 이번 세션에 피그마에서 새로 뽑은 **타이포 원본 덤프**다.
빼면 "🅰️ 신선도 미확인" 이 조치 필요 항목으로 뜬다 — 스냅샷이 낡았는지 확인도 안 하고 통과로 착각하는 걸 막기 위한 장치다. (정말 건너뛰려면 `--skip-type-freshness`)

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

### 타이포 스냅샷은 어떻게 최신으로 유지되나

`figma-type.json` 은 커밋된 값이라 피그마가 바뀌면 저절로 낡는다. 그래서 두 겹으로 막는다.

1. **낡았는지 자동 감지** — `audit.mjs` 에 이번 세션의 타이포 덤프(`figma_type.json`)를 주면, 스냅샷의 각 그룹을 피그마 실제 값과 대조해 *"피그마가 바뀌었는데 스냅샷이 안 따라옴"* 을 잡는다. 스냅샷에 없는 새 노드, 사라진 노드도 함께 보고한다.
2. **갱신은 자동 생성** — 손으로 JSON 을 고치지 않는다:
   ```
   node tools/figma-audit/build-type-snapshot.mjs figma_type.json          # 미리보기
   node tools/figma-audit/build-type-snapshot.mjs figma_type.json --write  # 반영
   ```
   같은 (크기/굵기/행간/자간) 조합끼리 자동으로 묶고, **기존 웹 선택자(`sels`)를 조합 키로 이어받는다.**
   사람이 채울 것은 **새로 생긴 조합의 선택자뿐**이며, 어떤 조합이 비었는지 스크립트가 알려 준다.
   덤프에 안 나온 그룹(서식이 섞인 문단 등)은 버리지 않고 이전 값을 유지한다.

한 타이포 조합에 웹 선택자가 여러 개 붙을 수 있다(예: 13/600/18 = 히어로 배지·칩·프로필명·목업 CTA·푸터 상호). `sels` 배열에 전부 넣으면 모두 검사한다.
`ignoreNodes` 에 적은 노드는 대조에서 빠진다(상태바 시계처럼 웹에 대응 요소가 없는 것).

### 타이포 원본 덤프 뽑는 코드

Figma MCP `use_figma` 로 아래를 실행하고 결과를 `figma_type.json` 으로 저장한다:

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

`getStyledTextSegments` 를 쓰는 이유: 굵기가 섞인 문단(예: `6:189`)은 `n.fontName` 이 `figma.mixed` 라 그냥 읽으면 빠진다.

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
