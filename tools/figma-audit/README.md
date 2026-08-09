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
| **시각 스타일** | **색·보더·반경·그림자가 피그마와 같은가** (`getComputedStyle` 실측) | 🎨 스타일 |
| **여백·간격** | **패딩·마진·gap 이 피그마와 같은가** (`getComputedStyle` 실측) | 🎨 스타일 |
| **반응형 폭** | **모바일/데스크톱에서 실제로 몇 px 로 그려지나** (뷰포트별 실측) | 🎨 스타일 |
| **반응형 연속성** | **폭을 1px 씩 늘릴 때 튀는 지점이 있는가** (`flow-audit.mjs`) | 📐 반응형 |

`❌`/`🔒`/`🅰️`/`🎨`가 하나라도 있으면 종료코드 1.

### 여백은 왜 `lockedStyles` 가 아니라 `figma-style.json` 인가

`lockedStyles` 는 **소스 문자열을 정규식으로** 본다. 그래서 뒤에 붙은 규칙이 값을 덮어도 통과한다.
2026-08-02 에 `.chips` 의 `padding:50px 0` 뒤에 다른 세션의 `padding-top:4px;…margin-top:-4px` 가
남아 있었는데, 소스에는 `padding:50px 0` 이 그대로 있으니 검수는 "차이 없음" 이었다. 실제 계산값은 4px.

`figma-style.json` 항목은 헤드리스 크로미움의 **`getComputedStyle`** 을 본다. 무엇이 덮든 최종 결과가 잡힌다.
**여백·크기를 잠글 때는 반드시 이쪽에 넣는다.** 상쇄용 음수 마진까지 막으려면 `margin-top`/`margin-bottom` 도
같이 `0px` 로 잠근다 (`spacing-chips-50` 이 그렇게 돼 있다).

현재 잠긴 여백 항목:

| id | 선택자 | 잠근 값 | 피그마 근거 |
|---|---|---|---|
| `spacing-chips-50` | `.chips` | padding 위아래 50px, margin 위아래 0 | `6:248` 높이 257.8 (= 칩 157.8 + 50·2) |
| `spacing-chips-rows-16` | `.chips` | row-gap 16px | `6:249` itemSpacing 16 |
| `spacing-section-100` | `section` | padding 100/24, row-gap 20px | `6:168` pad [100,24,100,24] · gap 20 |

네 방향 모두 확인됨: ① 웹 값이 덮이면 잡힘 ② 웹 값이 틀리면 잡힘 ③ 피그마가 바뀌면 "스냅샷 낡음" 으로 잡힘 ④ 일치하면 통과.

### 뷰포트별 폭 잠금 (2026-08-02)

항목에 `"viewport": 1280` 을 주면 그 항목만 해당 폭으로 잰다(기본 390 = 모바일).
**데스크톱 전용 `@media` 규칙은 390px 에서 적용조차 안 되므로, 폭 항목에는 반드시 `viewport` 를 준다.**
`"width"` 키는 `getComputedStyle` 이 아니라 `getBoundingClientRect().width` — `max-width` 선언이 아니라
"결과적으로 몇 px 로 그려졌나" 를 본다.

| id | 뷰포트 | 잠근 값 |
|---|---|---|
| `width-desk-card-512` | 1280 | `.page` 512px |
| `width-desk-content-464` | 1280 | `section > .head-group` 464px |
| `width-desk-chips-512` | 1280 | `.chips` 512px |
| `width-mobile-content-352` | 430 | `section > .head-group` 352px (모바일 회귀 방지) |
| `width-mobile-card-full` | 430 | `.page` 430px = 기기 폭 (좌우 회색 노출 방지) |

이 값들에는 **피그마 근거 노드가 없다.** 피그마 프레임은 360px 고정이고 데스크톱 폭은 웹 전용 반응형 결정이기 때문이다.

세 방향 확인됨: ① 데스크톱 폭을 400 으로 되돌림 → 잡힘 ② 모바일까지 딸려 넓어짐 → 잡힘
③ **데스크톱 `@media` 블록을 기본 규칙보다 위에 둬서 조용히 무시되는 상황 → 잡힘** (작업 중 실제로 겪은 실수다).

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

**항상 CLAUDE.md 의 최신 스크립트를 쓴다** (2026-08-01부터 세그먼트 단위 버전). 요지:

```js
// 노드당 1줄이 아니라 "스타일 조합당 1줄" — 혼합 서식 노드는 6:365#0, 6:365#1 처럼 쪼개진다.
const frame = await figma.getNodeByIdAsync('6:148');
const out = [];
for (const n of frame.findAllWithCriteria({ types: ['TEXT'] })) {
  const segs = n.getStyledTextSegments(['fontSize','fontName','lineHeight','letterSpacing']) || [];
  const keyOf = s => `${s.fontSize}/${s.fontName && s.fontName.style}/${s.lineHeight && s.lineHeight.unit === 'PIXELS' ? s.lineHeight.value : null}/${s.letterSpacing && typeof s.letterSpacing.value === 'number' ? s.letterSpacing.value : 0}`;
  const uniq = [];
  for (const s of segs) {
    const k = keyOf(s);
    const hit = uniq.find(u => u.k === k);
    if (hit) hit.chars += ' ' + s.characters; else uniq.push({ k, s, chars: s.characters });
  }
  uniq.forEach((u, i) => out.push({
    id: uniq.length > 1 ? `${n.id}#${i}` : n.id,
    t: u.chars.replace(/\s+/g, ' ').trim().slice(0, 20),
    size: u.s.fontSize,
    weight: u.s.fontName && u.s.fontName.style,
    lh: u.s.lineHeight && u.s.lineHeight.unit === 'PIXELS' ? u.s.lineHeight.value : null,
    ls: u.s.letterSpacing && typeof u.s.letterSpacing.value === 'number' ? u.s.letterSpacing.value : 0,
  }));
}
return out;
```

세그먼트 단위인 이유: 이전 버전(첫 세그먼트만 기록)은 혼합 서식 노드의 나머지 구간이 검수 사각지대였고,
실제로 6:365 의 SemiBold 구간 굵기 드리프트가 이 구멍으로 통과했다 (2026-08-01). 지금은 어느 구간이
바뀌어도 새 스타일 조합으로 감지된다.

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

---

## page-audit.mjs — 결과물 공통 점검 (모든 페이지)

`audit.mjs` 는 피그마 기준 프레임이 있는 `index.html` 만 본다.
기준 프레임이 없는 나머지 결과물(`letter/signup/terms/privacy.html`, `CNAME`, `assets`)은 이쪽이 본다.

```
node tools/figma-audit/page-audit.mjs
node tools/figma-audit/page-audit.mjs --json
```

| 항목 | 내용 | 등급 |
|---|---|---|
| 링크 | 로컬 `href`/`src` 가 실제 파일로 존재하는가 | ❌ 막힘 |
| JS 이동 | `location.href='…'` · `location.replace('…')` 대상이 실제 파일인가 | ❌ 막힘 |
| 절대 URL | `og:image`·`canonical` 등 우리 도메인 URL 이 실제 파일인가 | ❌ 막힘 |
| 대소문자 | 경로 대소문자가 정확한가 (GitHub Pages 는 구분한다) | ❌ 막힘 |
| 머리 | `DOCTYPE` · `lang="ko"` · `charset` · `viewport` · 빈 `<title>` | ❌ 막힘 |
| 자리표시자 | `YOUR_*` · Lorem ipsum · `@example.com` · "여기에 입력" | ❌ 막힘 |
| 비보안 | `http://` 외부 리소스 | ❌ 막힘 |
| 도메인 | `github.io` 를 하드코딩했는가 (CNAME 과 불일치) | ❌ 막힘 |
| 태그 | `div/section/header/footer/main/ul/ol/table/...` 여닫음 수 | ❌ 막힘 |
| CNAME | 호스트명 한 줄인가 | ❌ 막힘 |
| 제목·폰트·빈 링크·안 쓰는 자산 | | ⚠️ 경고 |

- 대상은 저장소 루트의 `*.html` 을 **읽어서** 정한다. 페이지를 추가해도 설정을 고칠 필요가 없다.

### 🚫 못 돈 검수는 통과가 아니다 — 2026-08-08 신설

타이포(`type-audit.mjs`) · 시각 스타일(`style-audit.mjs`) · 반응형(`flow-audit.mjs`) 은
브라우저 실측이라 **playwright 가 없으면 스스로 건너뛴다.** 예전에는 건너뛴 사실이
`findings` 에 안 올라가서, 화면에는 "건너뜀" 이라고 찍히면서도 집계는 `조치 필요 0건`,
종료코드는 0이었다. **pre-push 가 그대로 통과시켰다.**

즉 새 컨테이너에서 `npm i playwright` 를 잊으면 **4겹 중 문구 1겹만 돌고도 "일치" 로 보고**됐다.
`signup/index.html` 사각지대와 같은 구조다 — 목록에 없으면 검사가 없고, 검사가 없으니 통과.

지금은 세 검수 중 하나라도 못 돌면 `🚫 검수 미실행` 이 **막힘**으로 올라간다.
신선도 미확인과 같은 원칙이다: **확인 안 한 것은 통과가 아니다.**
`--skip-*` 같은 도피로는 만들지 않았다 — 준비물이 없으면 준비물을 갖춘다.

| 상황 | 등급 |
|---|---|
| playwright 미설치로 세 검수가 건너뛰어짐 | ❌ 막힘 (건별로 1건씩) |
| 하위 검수가 크래시하거나 JSON 파싱 실패 | ❌ 막힘 (같은 경로로 잡힌다) |

### 🔴 피그마 대응 (완전성) — 2026-08-07 신설

**"웹에는 있는데 피그마에는 없는 페이지" 를 잡는 유일한 검사다.**

`page-audit.mjs` 가 저장소의 모든 `*.html` 을 훑어, 각각이
`tools/figma-audit/page-figma-map.json` 의 `pages` 에 등록돼 있는지 본다.
등록도 `exempt` 사유도 없으면 **푸시가 막힌다.**

**왜 필요했나.** `signup/index.html` 과 `auth/callback/index.html` 이 피그마에 대응 화면 없이
몇 달간 라이브에 있었다. 나머지 검수가 전부 **"피그마에 있는 것" 을 목록으로 들고 웹과 대조**하는
구조였기 때문이다 — `audit.mjs` 는 프레임 `6:148` 하나, `docs-audit.mjs` 는 스냅샷의 `pages[]` 세 개.
**목록에 없으면 검사가 없고, 검사가 없으니 통과였다.** 사각지대가 조용했던 게 아니라, 사각지대가
"이상 없음" 으로 보고되고 있었다.

이 검사는 방향을 뒤집는다. 기준은 **저장소에 실재하는 HTML** 이고, 각각에 피그마 짝이 있는지를 묻는다.

| 상황 | 등급 |
|---|---|
| 페이지가 등록부에도 exempt 에도 없다 | ❌ 막힘 |
| exempt 에 있는데 사유가 비어 있다 | ❌ 막힘 |
| `node` 가 `<숫자>:<숫자>` 형식이 아니다 | ❌ 막힘 |
| 등록부에 있는 페이지가 저장소에 없다 (낡은 항목) | ❌ 막힘 |
| `textAudit: "docs-audit"` 인데 `figma-docs-text.json` 스냅샷에 없다 | ❌ 막힘 |
| `textAudit: "pending"` (프레임은 있는데 문구 동기화 미적용) | ⚠️ 경고 + `pendingSync` 사유 출력 |

네 방향 확인됨(2026-08-07): ① 새 페이지 추가 → 막힘 ② 등록부에만 남은 항목 → 막힘
③ 등록부·스냅샷 불일치 → 막힘 ④ 정상 → 통과.

**`pending` 은 도피로가 아니다.** 사유(`pendingSync`)를 반드시 적어야 하고, 푸시할 때마다
그 사유가 화면에 그대로 찍힌다. 조용해지지 않는 것이 요점이다.
- 준비물이 없다(피그마 덤프·브라우저·폰트 불필요). 그래서 pre-push 훅에서 **항상** 돈다.
- `❌ 막힘` 이 있으면 종료코드 1, `⚠️ 경고` 만 있으면 0.
- `TODO`/`FIXME` 는 경고다 — 개발 메모까지 배포를 막을 일은 아니라고 봤다.


---

## tree-audit.mjs — 피그마 트리 점검 (고아 노드) · 2026-08-08 신설

**"피그마 안에서 노드가 섹션 밖으로 튀어나간 것" 을 잡는 유일한 검사다.**

`page-audit` 의 반대 방향이다. 저 검사는 *웹 HTML → 피그마 짝이 있나* 를 묻고,
이 검사는 *피그마 페이지의 직속 자식이 전부 섹션인가* 를 묻는다.

### 왜 필요했나

2026-08-08. 섹션 `625:2657` "카카오 알림톡" 이 **비어 보였다.** 프레임 `626:2657` 은
지워진 게 아니라 **부모가 섹션이 아니라 페이지(`0:1`)** 였다.

피그마에서 **섹션의 자식은 x/y 가 섹션 기준 상대좌표**다
(`339:2474` x=266 → 절대 11835 = 섹션 11569 + 266). 그런데 이 프레임은 좌표가
`(206, 126)` 인 채로 부모가 페이지라, 섹션 기준 오프셋으로 잡힌 숫자가 그대로
**캔버스 절대좌표**가 되어 섹션에서 x 약 18,000px · y 약 10,100px 떨어진 자리에 떨어졌다.
하필 그 자리가 REF 섹션의 시각적 범위 안이라, 다른 레퍼런스 위에 겹쳐서 떠 있었다.

**그때 검수 여섯 종이 전부 통과했다.** 나머지는 방향이 "웹 → 피그마" 이거나
(`page-audit`), 프레임 **안쪽 문구·타이포·스타일**만 보기 때문이다(`audit`·`docs-audit`·
`type`·`style`·`flow`). **프레임이 어디에 있는지를 보는 검사가 하나도 없었다.**

### 무엇을 보나

| 상황 | 등급 |
|---|---|
| 페이지 직속에 섹션이 아닌 노드가 있다 (= 고아) | ❌ 막힘 |
| `page-figma-map.json` 의 기준 프레임이 **어느 섹션에도** 안 들어 있다 | ❌ 막힘 |
| 기준 프레임이 피그마에서 사라졌다 (`found:false`) | ❌ 막힘 |
| 기준 프레임이 든 섹션이 피그마에 없다 | ❌ 막힘 |
| `pageLevelAllowed` 항목에 사유가 비어 있다 | ❌ 막힘 |
| 새 섹션 / 섹션 이름 바뀜 / 안 쓰는 섹션 사라짐 | ↺ 스냅샷 낡음 (막지 않음) |
| 덤프를 안 줘서 라이브 대조를 못 했다 | 🚫 검수 미실행 (막지 않음) |
| 덤프가 45분보다 낡았다 | 🚫 검수 미실행 (막지 않음) |

`🚫` 는 종료코드 0 이다 — 이 검수는 모든 푸시에서 도는데 덤프는 세션마다 뽑는 물건이라,
없다고 막으면 평소 작업이 통째로 선다. 대신 **미실행 건수를 조치 필요와 따로 세고**,
라이브 대조를 안 한 실행은 `✅` 를 찍지 않는다. `조치 필요 0건` 을 "고아 노드 없음" 으로
읽는 것이 이 검수가 무력해지는 방식이라서다. 실제로 막는 것은 훅이다 —
등록부·트리 스냅샷을 건드린 푸시에는 덤프를 요구한다.

**의도적으로 섹션 밖에 두는 노드**는 `figma-tree.json` 의 `pageLevelAllowed` 에
**사유와 함께** 적는다. 사유가 비면 막힌다 — 사유 없는 면제는 검사를 조용히 끄는 것과 같다.

### 🔴 스냅샷은 손으로 관리하지 않는다

`figma-tree.json` 에서 **사람이 유지하는 것은 `pageLevelAllowed` 하나뿐이다.**
`sections` 는 `--update` 가 덤프에서 다시 쓴다.

사람이 피그마에 섹션을 하나 만들면 스냅샷은 **즉시** 낡는다. 그 갱신을 사람 손에 맡기면
경고가 상주하고, 상주하는 경고는 결국 안 읽힌다 — 이 저장소가 여러 번 겪은 실패 방식이다.
그래서 낡음은 **막힘이 아니라 `↺`** 로만 분류하고, 세 겹으로 자동화했다.

1. `↺` 는 **푸시를 막지 않는다.** 진짜 사고(고아 노드·기준 프레임 이탈)만 막는다.
2. 출력이 **맞추는 한 줄을 그대로 찍어 준다** — `… --update`.
3. **예약 점검(라이브↔피그마, 하루 1회)이 매일 그 한 줄을 대신 돌리고 커밋한다.**
   손대지 않아도 24시간 안에 스스로 맞는다.

기준 프레임이 **어느** 섹션에 있어야 하는지는 아예 저장하지 않는다. "어딘가 섹션 안" 이면 되고,
그건 덤프에서 그때그때 읽으면 된다 — 저장하지 않으면 낡지도 않는다.

### 쓰는 법

```
node tools/figma-audit/tree-audit.mjs                            # 준비물 없음 — 스냅샷 정합성만
node tools/figma-audit/tree-audit.mjs figma_tree.json            # 라이브 덤프까지 대조 (고아 노드)
node tools/figma-audit/tree-audit.mjs figma_tree.json --update   # ↺ 를 자동으로 맞춘다 (sections 재작성)
```

`--update` 는 `sections` 와 `dumpedAt` 만 다시 쓴다. `pageLevelAllowed` 와 설명 문구는 건드리지 않는다.
`❌ 막힘` 은 `--update` 로 사라지지 않는다 — 갱신하고도 종료코드 1 이다.

pre-push 훅에서 **항상** 돈다(1.2겹). 덤프는 `FIGMA_TREE` → 저장소 루트 →
상위 디렉터리 → `$HOME` 순으로 찾는다. **`page-figma-map.json` 이나 `figma-tree.json` 을
건드린 푸시에는 덤프를 요구한다** — 그때가 어긋나기 가장 쉬운 순간이다.

### 피그마 트리 덤프

`use_figma` 로 아래를 돌려 출력을 `figma_tree.json` 에 저장한다. **읽기 전용이다.**
`REG` 목록은 손으로 관리하지 말고 `page-figma-map.json` 의 `pages[].node` 에서 만든다:

```
node -e "const m=require('./tools/figma-audit/page-figma-map.json');console.log(JSON.stringify(Object.values(m.pages).map(e=>e.node)))"
```

```js
const REG = [/* 위 명령의 출력 */];
const page = figma.currentPage;
const children = page.children.map(n => ({ id: n.id, name: n.name, type: n.type }));
const registered = {};
for (const id of REG) {
  const n = await figma.getNodeByIdAsync(id);
  if (!n) { registered[id] = { found: false }; continue; }
  const chain = [];
  let p = n.parent;
  while (p && p.type !== 'PAGE') { chain.push({ id: p.id, name: p.name, type: p.type }); p = p.parent; }
  const sec = chain.find(c => c.type === 'SECTION');
  registered[id] = { found: true, name: n.name, section: sec ? sec.id : null,
                     parent: n.parent.id, parentType: n.parent.type };
}
return { pageId: page.id, pageName: page.name, children, registered };
```

파일이 여러 페이지가 되면 `figma.currentPage` 대신 페이지별로 나눠 돌려야 한다
(`use_figma` 한 번에 `setCurrentPageAsync` 는 한 번만). 지금은 `Page 1` 하나뿐이다.

### 섹션을 새로 만들었으면 — 아무것도 안 해도 된다

`↺ 스냅샷 낡음` 이 찍히지만 **푸시는 그대로 나간다.** 예약 점검이 그날 안에 `--update` 를 돌려
`figma-tree.json` 을 커밋한다. 지금 당장 조용히 하고 싶으면 덤프를 뽑아 한 줄 돌리면 된다:

```
node tools/figma-audit/tree-audit.mjs figma_tree.json --update
```

**손으로 `sections` 를 편집하지 마라.** 다음 `--update` 가 덮어쓴다.

---

## docs-audit.mjs — 약관·개인정보 화면 문구 동기화 (2026-08-02)

`audit.mjs` 는 랜딩(index.html ↔ 프레임 6:148)만 본다. 이 스크립트는 **피그마 화면이 기준인 문서 페이지** —
이용약관·개인정보처리방침 — 을 본다.

```
node tools/figma-audit/docs-audit.mjs
node tools/figma-audit/docs-audit.mjs --json
```

- 기준: 피그마 섹션 `327:2474`·`356:3106` — `terms.html`↔`339:2474`, `privacy.html`↔`340:2478`, `letter.html`↔`362:2482`.
- 피그마 텍스트는 **커밋된 스냅샷** `figma-docs-text.json` 에 들어 있다(마커 `•`·`1.` 및 차트 `chart-viz` 하위 텍스트 제외).
- 웹 텍스트는 각 html 을 태그 제거해 뽑고, 둘을 공백 무시로 대조한다.

| 방향 | 뜻 | 등급 |
|---|---|---|
| 피그마 → 웹 | 피그마 문구가 웹에 없다 | ❌ 차이 (푸시 차단) |
| 웹 → 피그마 | 웹 문구가 피그마에 없다 | ℹ️ 웹전용 (푸시 차단) |
| 양쪽 | 글자는 같고 따옴표·말줄임표만 | ⚠️ 부호 (알림만) |

한쪽만 문구를 고치면 반드시 걸린다. 랜딩과 달리 **라이브 피그마 덤프가 필요 없다**(커밋된 스냅샷과 대조).
피그마 화면을 고쳤으면 스냅샷을 다시 뽑아 커밋한다 — 절차는 저장소 루트 `CLAUDE.md`
"약관·개인정보 화면 — 피그마↔웹 동기화".

### 매핑 정본은 `page-figma-map.json` 이다 (2026-08-08 신설)

프레임 id 를 **스냅샷과 등록부가 따로** 들고 있어서 한쪽만 고치면 조용히 어긋난다.
그래서 이 검수는 시작할 때 두 값을 대조하고, 다르면 **`❌ 매핑 불일치`** 로 막는다.

```
❌ 차이  매핑 불일치 [onboarding/2/index.html]
   상세  : 등록부 275:2422 (…선택됨) ↔ 스냅샷 592:2623 (…미선택) — 등록부가 정본입니다.
```

**왜 넣었나 (2026-08-08 실측):** `onboarding/2` 가 "STEP 2 · 연차 — **선택됨**"(`275:2422`)을
가리키고 있었다. 그 프레임에는 슬라이더 값 `0 ~ 3년` 과 CTA `다음 · 0 ~ 3년` 이 있는데 웹 정적
HTML 은 off 상태(값 `—`, CTA `연차를 골라주세요`)를 그린다. 그래서 조치 필요 3건이 계속 떠 있었다.
같은 섹션의 **"미선택"(`592:2623`)** 이 웹과 글자 단위로 일치했고, 등록부·스냅샷을 그쪽으로
바꿔 해결했다 — 예외 선언(`jsRenderedText`)이 하나도 필요 없어졌다.

> **온보딩 프레임은 상태별로 여러 장이다.** 가리켜야 하는 것은 **웹 정적 HTML 이 그리는 상태**다.
> 한쪽에만 있는 문구가 상태 표시값·CTA 라벨이면, 드리프트로 단정하기 전에 다른 상태 프레임을 먼저 찾아본다.

---

## flow-audit.mjs — 반응형 연속성 (2026-08-02)

```
node tools/figma-audit/flow-audit.mjs
node tools/figma-audit/flow-audit.mjs --from 320 --to 1400 --step 4 --json
```

화면 폭을 **1px 씩** 늘리며 카드·콘텐츠·일러스트·칩·CTA·섹션 좌우 패딩의 렌더 폭을 재고,
1px 변화에 **2.5px 이상** 튀면 잡는다. 가로 스크롤과 이미지 비율도 같은 루프에서 본다.

**왜 필요했나.** 데스크톱 폭을 `@media (min-width:520px)` 로 키웠더니 519→520px 한 지점에서
콘텐츠가 **352 → 448 (96px)** 튀었다. 값 자체는 전부 맞아서 다른 검수는 전부 통과했고,
창을 늘려 보던 사용자가 눈으로 먼저 찾았다. 이런 종류는 "한 뷰포트에서 재는" 검수로는 원리상 안 잡힌다.

**고치는 법**: 브레이크포인트 대신 `clamp()` / `min()` 으로 연속 보간한다. 현재 구조는

```css
:root{
  --pad-x: clamp(24px, calc(24px + (100vw - 430px) * 12 / 110), 36px);
  --card-max: 540px;
  --content-max: 468px;
}
```

콘텐츠 폭 = `min(화면폭 − --pad-x·2, 468)`. 430px(실기기 폰 최대치)까지는 좌우 24 가 유지돼
피그마 6:168 값과 같고, 430~540 구간에서만 36 으로 벌어진다.

확인됨: 예전 브레이크포인트 방식을 되돌리면 `520px 에서 콘텐츠 352 → 448 로 96.0px 튑니다` 로 잡힌다.
