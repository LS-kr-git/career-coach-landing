# 이 저장소에서 작업할 때 (모든 세션 공통)

커리어코치 랜딩페이지. **피그마가 단일 기준(Source of Truth), 웹은 파생물**이다.

## 0. 클론 직후 한 줄 — 푸시 훅 켜기
```
git config core.hooksPath tools/hooks
```
훅은 **세 겹**이다.

| 겹 | 무엇 | 언제 도나 | 본다 |
|---|---|---|---|
| 0 | 배포 쿨다운 | **모든 푸시** | 직전 푸시로부터 15분이 지났는가 |
| 1 | `tools/figma-audit/page-audit.mjs` | **모든 푸시** | 저장소의 모든 `*.html` + `CNAME` + `assets` |
| 2a | `tools/figma-audit/docs-audit.mjs` | `terms`/`privacy.html`·스냅샷이 바뀐 푸시 | 약관·개인정보 (피그마 섹션 327:2474 대조, 라이브 덤프 불필요) |
| 2b | `tools/figma-audit/audit.mjs` | `index.html`/`assets` 가 바뀐 푸시 | 랜딩 (피그마 프레임 6:148 대조) |

**0겹 — 배포 쿨다운 (2026-08-02 신설)**
GitHub Pages 는 [푸시 → 빌드 → 배포] 3단계이고, 같은 브랜치에 새 푸시가 들어오면 진행 중이던 실행을
`Canceling since a higher priority waiting request ... exists` 로 **취소**한다. 2026-08-02 에 30분 동안
다섯 번 푸시했더니 앞의 네 개가 전부 취소돼, 이미 고친 버그가 라이브에 한 시간 넘게 안 올라갔다.

훅은 `origin/main` 최신 커밋 시각을 "직전 푸시 시각"으로 삼아, 15분이 안 지났으면 **막고 남은 시간을 알려 준다.**
세션이 달라도 원격을 기준으로 하므로 새 대화창에서도 그대로 동작한다.

```
CC_PUSH_COOLDOWN=<초> git push origin main   # 조절 (기본 900 = 15분)
CC_PUSH_COOLDOWN=0    git push origin main   # 쿨다운만 끄기 — 검수 1·2겹은 그대로 돈다
```

**막혔을 때 하는 일: 기다리면서 커밋을 더 쌓는다.** 커밋은 얼마든지 해도 되고, 푸시만 모아서 한 번
하면 된다. 그게 실제로 가장 빨리 라이브에 닿는 길이다. 그 사이 확인이 급하면 `node tools/make-preview.mjs`.

1겹은 준비물이 없어 어떤 세션에서든 무조건 돈다. 페이지를 새로 추가해도 설정을 고칠 필요 없이 자동으로 대상에 들어온다.
보는 것: 깨진 링크·경로 대소문자·`DOCTYPE`/`lang`/`charset`/`viewport`/`title` 누락·자리표시자(`YOUR_*`, Lorem, example.com)·`http://` 리소스·`github.io` 하드코딩·블록 태그 불균형·CNAME 형식. `❌ 막힘` 이 있으면 푸시가 멈추고, `⚠️ 경고` 는 알려만 준다.

2겹은 피그마 덤프 2개가 있어야 하고, 없으면 푸시를 막는다(확인 안 한 걸 통과로 착각하지 않기 위해).

급할 때만 `git push --no-verify`.

혼자 돌려볼 때: `node tools/figma-audit/page-audit.mjs`

## 프로젝트 문서는 어디에 있나
사업기획·브랜드 가이드·검증 데이터·작업 원칙 등 **모든 프로젝트 문서의 정본은 비공개 저장소
`LS-kr-git/career-coach` 의 `docs/` 에 있다.** (2026-08-01 이관)

```
git clone https://github.com/LS-kr-git/career-coach.git   # 비공개 — PAT 필요
```
- 색인·작업 규칙: `docs/README.md`
- 이 저장소와 직접 관련된 것: `docs/검증/랜딩페이지-메모.md`, `docs/기획/피그마-웹-동기화.md`, `docs/기획/저장소-상태.md`, `docs/마케팅/브랜드-가이드.md`
- **claude.ai 프로젝트 쪽 문서는 포인터일 뿐이다. 거기서 고치지 말 것** — 충돌 감지가 없어 마지막 저장이 앞 내용을 조용히 덮는다. 저장소에서 고치면 git 이 막아 준다.

## 기준
- 피그마 파일 `LnT8TgFVBxky0bVyaF6Tob`, 프레임 **`6:148` "랜딩페이지_커리어코치"** (가로 360px)
- PROD 섹션(`6:147`)에는 다른 프로젝트 레퍼런스 프레임이 섞여 있다. **섹션이 아니라 프레임 6:148 만** 기준이다.

## 새 페이지는 폴더 주소로 만든다 (2026-08-02 확정)

파일 하나를 루트에 두지 말고 **`<경로>/index.html`** 로 만든다. GitHub Pages 는 디렉터리를 요청받으면
그 안의 `index.html` 을 주므로 `/onboarding/1/` 로 열리고, 슬래시 없이 들어와도 슬래시 붙은 주소로 301 된다.

```
onboarding/1/index.html   → https://careercoach.my/onboarding/1/
onboarding/2/index.html   → /onboarding/2/
onboarding/3/index.html   → /onboarding/3/
```

- **한글 파일명을 쓰지 않는다.** `step1-직군.html` 은 주소에서 `step1-%EC%A7%81%EA%B5%B0.html` 가 된다
  (한글 1자 = 3바이트 = 9글자). 공유 링크·광고 랜딩 URL·심사 제출 URL·GA 리포트가 전부 지저분해진다.
- **`.html` 을 주소에 노출하지 않는다.** 나중에 서버 렌더링으로 옮겨도 주소가 그대로라 광고 링크·북마크가 안 깨진다.
- 하위 폴더 페이지에서 **자산은 루트 절대경로(`/assets/…`)로 참조한다.** `./assets/…` 는 한 단계 깊어져 깨진다.
- 화면 간 이동은 절대경로(`/onboarding/2/`)로 쓴다. `page-audit` 이 폴더 주소와 상대경로를 모두 검사한다.
- 앞으로 만들 페이지도 같은 규칙: `/onboarding/done/`, `/checkout/`, `/welcome/`, `/me/`, `/letter/<날짜>/`.

## 피그마에 글자를 쓸 때 — Pretendard 규칙 (2026-08-02 확정)

**플러그인 실행 환경(`use_figma`)에는 Pretendard 가 없다.** `listAvailableFontsAsync()` 가 1,938개 패밀리를
돌려주는데 Pretendard 는 0개다. OS 로컬 폰트가 아예 안 보이는 환경이라 **사용자 컴퓨터에 Pretendard 를
설치해도 이 문제는 안 풀린다** — 설치는 사용자가 피그마를 직접 편집할 때만 효과가 있다.
`loadFontAsync({family:'Pretendard Variable'})` 는 항상 실패한다.

### 1. 이미 있는 텍스트에 Pretendard 를 입힐 때
`setTextStyleIdAsync()` 는 **폰트 로드 없이** 파일의 텍스트 스타일(=Pretendard Variable)을 적용한다.
이게 이 환경에서 Pretendard 를 붙이는 유일한 정식 경로다.
```js
const styles = await figma.getLocalTextStylesAsync();
await node.setTextStyleIdAsync(styles.find(s => s.name === 'text/caption').id);
```
스타일 이름이 아니라 id 로 참조할 거면 실제 id 를 먼저 확인한다 — `text/caption` 이
`S:de6f27cf…`, `text/caption-strong` 이 `S:8cbb5cff…` 다. 이름과 굵기를 짐작하지 말 것.

### 2. 새 텍스트를 만들 때 — 폭·행간은 만들 때 고정된다
폰트가 없으면 피그마가 **다시 측정하지 않는다.** 스타일을 나중에 입혀도 노드의 폭·높이는
만들 때 값 그대로 남는다. 그래서 **측정 가능한 한글 폰트로 크기·행간을 먼저 잡고 글자를 넣은 뒤**
스타일을 입힌다. 측정이 Pretendard 와 가장 가까운 건 **Gothic A1 Regular** 다(순한글 라벨은 오차 0px,
`·`·괄호·영문이 섞이면 최대 4px).
```js
const G = { family: 'Gothic A1', style: 'Regular' };
await figma.loadFontAsync(G);
const t = figma.createText();
t.fontName = G;
t.fontSize = 13;
t.lineHeight = { unit: 'PIXELS', value: 20 };   // ← 화면에 이미 있는 같은 역할 노드의 높이를 그대로
t.characters = '퍼포먼스';
await t.setTextStyleIdAsync(CAPTION_STYLE_ID);   // 여기서 Pretendard 로 바뀌고, 폭은 위 측정값이 남는다
```
행간은 스타일 값(18)이 아니라 **화면에 이미 있는 같은 역할 노드의 높이**(칩 20, 아코디언 21, CTA 22,
단계표기 18)를 쓴다. 파일 전체가 그렇게 만들어져 있어서, 스타일 값을 쓰면 그 노드만 2px 작아진다.

### 3. 기존 텍스트의 글자를 바꿀 때
현재 폰트가 없으면 `characters` 쓰기가 막힌다(`Cannot write to node with unloaded font`).
**Gothic A1 로 갈아탄 뒤 쓰고, 다시 스타일을 입힌다.**
```js
t.fontName = G;            // 현재 폰트가 없어도 이 대입은 된다
t.characters = '새 문구';
await t.setTextStyleIdAsync(styleId);
```

### 4. 하지 말 것 — 인스턴스 텍스트 오버라이드
컴포넌트 인스턴스의 텍스트를 바꾸는 것(`setProperties` 든 직접 대입이든)은 **이 환경에서 못 쓴다.**
2026-08-02 실측: 오버라이드한 인스턴스가 렌더에서 **글자가 아예 빈칸**으로 나오거나 **컴포넌트 기본값**으로
돌아갔고, 스타일을 다시 입히는 순간 폭이 메인 컴포넌트 값으로 리셋됐다(칩 104px → 62px).
그래서 **라벨이 화면마다 다른 요소(칩·아코디언 행·CTA 버튼)는 인스턴스로 만들지 않는다.**
글자가 고정이거나 아예 없는 요소(진행바·단계 표기·상단바)만 인스턴스로 쓴다.
Pretendard 가 실제로 보이는 환경에서 작업한다면 이 제약은 사라진다.

## 랜딩을 건드렸다면 — 푸시 전에 반드시

### 1. 피그마에서 두 가지를 뽑는다 (Figma MCP)

**(a) 구조·문구 메타데이터**
```
get_metadata(fileKey="LnT8TgFVBxky0bVyaF6Tob", nodeId="0:1")
```
결과가 크면 툴이 파일로 떨궈 준다. 그 파일의 `text` 필드를 이어붙여 `figma_meta.xml` 로 저장.

**(b) 타이포 원본 덤프** — `use_figma` 로 아래를 그대로 실행하고 결과를 `figma_type.json` 으로 저장:
```js
// 세그먼트 단위 덤프 — 한 텍스트 노드 안에 서식이 섞여 있어도(예: 6:365 의
// "이용약관|개인정보처리방침") 스타일 조합별로 모두 기록된다. 읽기 전용이라 폰트 로드 불필요.
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
> **세그먼트 단위인 이유** (2026-08-01): 이전 스크립트는 노드당 첫 세그먼트만 기록해서, 혼합 서식 노드의
> 나머지 구간(예: 6:365 의 SemiBold "개인정보처리방침")이 검수 사각지대였다 — 실제로 굵기 드리프트가
> 이 구멍으로 통과했다. 지금은 서식이 섞인 노드가 `6:365#0`, `6:365#1` 처럼 스타일 조합별로 쪼개져
> 나오고, 어느 구간이 바뀌어도 build-type-snapshot 이 "새 조합" 으로 잡아낸다.

**(c) 스타일 원본 덤프** — `use_figma` 로 아래를 실행하고 결과를 `figma_style.json` 으로 저장:
```js
const IDS = require_ids; // ← tools/figma-audit/figma-style.json 의 items[].node 값들을 배열로 넣는다
const hex = c => c ? '#'+[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('') : null;
const solid = n => (n && 'fills' in n && n.fills !== figma.mixed && n.fills[0] && n.fills[0].type === 'SOLID') ? hex(n.fills[0].color) : null;
const out = [];
for (const id of IDS) {
  const n = await figma.getNodeByIdAsync(id);
  if (!n) { out.push({ id, missing: true }); continue; }
  const o = { id };
  if (n.type === 'TEXT') o.textFill = solid(n);
  else {
    const f = solid(n); if (f) o.fill = f;
    const t = ('findAllWithCriteria' in n) ? n.findAllWithCriteria({ types: ['TEXT'] })[0] : null;
    if (t) o.textFill = solid(t);
  }
  if ('strokes' in n && n.strokes.length && n.strokes[0].type === 'SOLID') { o.stroke = hex(n.strokes[0].color); o.sw = n.strokeWeight; }
  if ('cornerRadius' in n && n.cornerRadius !== figma.mixed) o.radius = n.cornerRadius;
  if ('effects' in n) o.shadow = n.effects.some(e => e.type === 'DROP_SHADOW' && e.visible !== false);
  if ('paddingTop' in n && n.layoutMode && n.layoutMode !== 'NONE') {
    o.pad = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].map(v => Math.round(v * 10) / 10);
    o.gap = Math.round(n.itemSpacing * 10) / 10;   // 섹션 내부 간격 — 여백 잠금이 이 값을 쓴다
  }
  o.h = Math.round(n.height * 10) / 10;
  out.push(o);
}
return out;
```
> **왜 필요한가**: `get_metadata` XML 에는 **색·보더·반경·패딩·그림자가 아예 없다.** 2026-08-01 검수에서 이 구멍 때문에 12건(말풍선 들여쓰기, 구분선 누락, 프로필명 색, 카드 그림자, 배지 보더 …)이 "차이 없음" 을 통과한 채 눈으로만 달라 보였다.

### 2. 검수를 돌린다 — **인자 두 개를 모두 준다**
```
node tools/figma-audit/audit.mjs figma_meta.xml figma_type.json figma_style.json
```
- 두 번째/세 번째 인자를 빼면 "🅰️ / 🎨 신선도 미확인" 이 조치 필요 항목으로 뜬다. **확인 안 한 걸 통과로 착각하지 않기 위한 장치**이니 `--skip-type-freshness` 로 덮지 말 것.
- "차이 없음" 이 나와야 푸시한다.
- **덤프를 재사용하지 않는다. 세션마다 다시 뽑는다.** 2026-08-02 에 08:24 덤프로 검수해 "차이 없음" 이
  나왔는데, 그 사이 피그마 푸터(6:364)에 문의·전화번호가 들어가 있었다. **옛 피그마 vs 새 웹**을
  비교한 것이라 통과한 것이지 실제로 같아서가 아니었다. 지금은 `🕰️ 덤프 낡음` 이 이걸 막는다 —
  **덤프 나이 45분 초과면 차단, 15분 초과면 경고** (`CC_META_MAX_AGE=<분>` 으로 조절).
  **세 덤프(meta·type·style) 모두**에 적용된다 — 같은 날 meta 만 갱신하고 `figma_type.json` 을
  90분짜리로 두는 바람에, 그 사이 바뀐 파랑 칩(254:2405) 타이포가 옛 값으로 남아 병렬 세션의
  올바른 스냅샷과 충돌해서야 드러났다. `figma_style.json` 은 237분짜리였고 노드 3개가 빠져 있었다.
  순서(덤프 vs `index.html` 수정시각)로는 판별할 수 없다. 정상 작업 순서가 [덤프 → 웹 수정 → 검수]
  라서 덤프는 **항상** `index.html` 보다 오래되기 때문이다 — 처음엔 이렇게 만들었다가 되돌렸다.
  덤프가 진짜 최신인지 싸게 확인하려면 노드별 해시를 비교한다(전문을 다시 받을 필요가 없다):
  ```js
  // use_figma (읽기 전용) — 결과를 기존 덤프에서 뽑은 해시와 대조
  const frame = await figma.getNodeByIdAsync('6:148');
  const h = s => { let x = 5381; for (const c of s) x = ((x*33) ^ c.codePointAt(0)) >>> 0; return x.toString(36); };
  const out = {}; for (const n of frame.findAllWithCriteria({ types: ['TEXT'] })) out[n.id] = h(n.characters.replace(/\s+/g,''));
  return out;
  ```

### 2-2. 검수가 보는 것 (2026-08-01 확장)
| 검사 | 무엇을 보나 | 근거 파일 |
|---|---|---|
| 문구 | 텍스트 노드 vs 웹 블록 | `figma_meta.xml` |
| 확정값 | `lockedStyles` 정규식 | `map.json` |
| 이미지 | `assets/*.png` sha256 | `map.json` |
| 타이포 | 크기·굵기·행간·자간 실측 | `figma-type.json` |
| **시각 스타일** | **색·보더·반경·패딩·그림자·태그명 실측** | **`figma-style.json`** |
| **반응형 연속성** | **320~700px 를 1px 씩 훑어 레이아웃 점프·가로스크롤·이미지 비율** | (기준 파일 없음 — 렌더만 본다) |

**여백·크기를 바꿨으면 `lockedStyles`(정규식)가 아니라 `figma-style.json` 에 넣는다.**
`lockedStyles` 는 소스 문자열만 보므로 뒤에 붙은 규칙이 값을 덮어도 통과한다 — 2026-08-02 에 `.chips` 의
`padding:50px 0` 이 나중 줄의 4px 보정에 덮여 계산값이 4px 이었는데 검수는 "차이 없음" 이었다.
`figma-style.json` 쪽은 브라우저 `getComputedStyle` 을 보므로 무엇이 덮든 실제 결과가 잡힌다.
현재 잠긴 여백: `spacing-chips-50` · `spacing-chips-rows-16` · `spacing-section-100`.
상쇄용 음수 마진을 막으려면 `margin-top`/`margin-bottom` 도 함께 `0px` 로 잠근다.

시각 요소(색/보더/간격/구조)를 바꿨다면 **`figma-style.json` 에 항목이 있는지 먼저 확인**하고, 없으면 추가한다.
항목 하나는 `{ id, label, sel, node, figma:{피그마 원본값}, css:{기대 computed style} }` 형태다.
`css` 의 특수 키:
- `"shadow": "있음"|"없음"` — box-shadow 유무
- `"tag": "SPAN"` — 링크가 아니어야 하는 요소를 잠근다
- `"width": "540px"` — 선언이 아니라 `getBoundingClientRect().width` 실측
- `"aspect": "정상"` — 선택자에 걸리는 이미지 **전부**의 렌더 비율이 원본 비율과 같은지
- 항목별 `"viewport": 1280` — 그 항목만 해당 폭으로 잰다(기본 390). **데스크톱 전용 `@media` 는 390 에서 적용조차 안 되므로 폭·패딩 항목엔 반드시 준다.**

### 2-3. 반응형만 따로 볼 때
```
node tools/figma-audit/flow-audit.mjs                      # 320~700px, 1px 간격
node tools/figma-audit/flow-audit.mjs --from 320 --to 1400 --step 4
```
`📐 반응형 레이아웃 점프` 가 나오면 그 폭에 브레이크포인트가 있다는 뜻이다. `clamp()`/`min()` 으로 바꾼다.

### 3. 피그마 타이포가 바뀌었다는 결과가 나오면
```
node tools/figma-audit/build-type-snapshot.mjs figma_type.json          # 미리보기
node tools/figma-audit/build-type-snapshot.mjs figma_type.json --write  # 반영
```
스냅샷은 **자동 생성**된다. 사람이 손댈 것은 새로 생긴 타이포 조합의 `sels`(웹 선택자)뿐이고, 스크립트가 어떤 조합에 선택자가 비었는지 알려 준다.
그다음 **웹 CSS도 새 피그마 값으로 고친다** — 스냅샷만 갱신하고 끝내면 안 된다.

## 약관·개인정보 화면 — 피그마↔웹 동기화 (2026-08-02 신설)

이용약관·개인정보처리방침도 랜딩처럼 **피그마가 기준**이다. 웹은 파생물.
- 피그마: 파일 `LnT8TgFVBxky0bVyaF6Tob` / 섹션 **`327:2474` "이용약관 / 개인정보처리방침"**
  - 프레임 `339:2474` = 이용약관 ↔ 웹 `terms.html`
  - 프레임 `340:2478` = 개인정보처리방침 ↔ 웹 `privacy.html`
- 두 화면은 랜딩과 **같은 디자인 시스템**으로 만들었다: 헤더는 랜딩 헤더(`6:162`) 클론,
  타이포는 텍스트 스타일(`text/display`·`text/h2`·`text/body`·`text/body-s`·`text/label`·`text/caption`·`text/button`),
  색은 원시 fill(navy-900/gray-600/gray-400/amber-600), 표는 auto-layout + 셀 보더(gray-200)·헤더 gray-100.
- 웹도 같은 값을 쓴다: `:root` 는 `--pad-x:24`·`--card-max:450`·`--content-max:402` (index.html 과 동일),
  `.doc` 의 시맨틱 태그에 위 텍스트 스타일 값을 그대로 매핑했다.

### 문구 동기화는 어떻게 강제되나
커밋된 스냅샷 `tools/figma-audit/figma-docs-text.json`(피그마 텍스트, 마커 제외)을
웹에서 뽑은 문구와 `docs-audit.mjs` 가 공백 무시로 대조한다. **한쪽(웹이든 피그마든)만 문구를 고치면 푸시가 막힌다.**
```
node tools/figma-audit/docs-audit.mjs
```
pre-push 2겹(a)에서 `terms/privacy.html` 또는 스냅샷이 바뀐 푸시마다 자동으로 돈다.
랜딩과 달리 **라이브 피그마 덤프가 필요 없다** — 커밋된 스냅샷과 대조하기 때문(문구는 자주 안 바뀌므로).

### 피그마 화면을 고쳤으면 — 스냅샷을 다시 뽑아 커밋한다
1. 문구를 바꾼다. 새 텍스트를 만들거나 길게 고칠 땐 위 "피그마에 글자를 쓸 때" 규칙을 따른다 —
   **지오메트리·폭·행간을 측정용 Gothic A1 로 다 잡은 뒤, 맨 마지막에 텍스트 스타일을 입힌다.**
   (스타일을 먼저 입히면 Pretendard 미로드 상태가 되어 이후 `textAutoResize` 등 쓰기가 막힌다. 실측으로 겪음.)
2. `use_figma`(읽기)로 두 프레임의 텍스트를 다시 뽑는다 — **마커(`name==='marker'`)는 제외:**
   ```js
   const frames = { '339:2474':'terms.html', '340:2478':'privacy.html' };
   const pages = [];
   for (const [fid, html] of Object.entries(frames)) {
     const f = await figma.getNodeByIdAsync(fid);
     const texts = f.findAllWithCriteria({ types:['TEXT'] }).filter(t=>t.name!=='marker').map(t=>t.characters);
     pages.push({ html, figmaNode: fid, name: f.name, ignoreWebText: [], texts });
   }
   return { fileKey: figma.fileKey, section:'327:2474', pages };
   ```
3. 결과로 `figma-docs-text.json` 의 `pages` 를 갈아끼우고 `dumpedAt` 를 오늘로 바꾼다.
4. 웹(terms/privacy.html)도 같은 문구로 고치고 `docs-audit` 가 "차이 없음" 이면 커밋.

### 표기 규칙 (동기화가 안 깨지게)
- 리스트 마커(번호 `1.`·불릿 `•`)는 피그마에서 **노드 이름을 `marker` 로** 둔다 — 스냅샷·검수가 걸러낸다.
  웹은 `<ol>`/`<ul>` 로 자동 생성하므로 마커가 DOM 텍스트에 없다(양쪽 다 "문구"가 아니다).
- `date`·`back` 같은 내용 노드는 이름을 내용과 같게 둔다(autoRename). 검수는 텍스트 문자열만 본다.
- 웹 문단 안 `<strong>`·`<a>` 는 대조에 영향 없다(공백 제거 후 이어붙여 비교).

## 하지 말 것
- **글자 크기를 줄여서 줄바꿈을 맞추지 않는다.** 문구가 안 들어가면 UXW(문구)를 줄인다. (2026-08-01 사용자 결정)
  단, 웹이 피그마보다 큰 값을 쓰고 있어서 생긴 문제라면 그건 보정이 아니라 **정정**이니 피그마 값으로 되돌린다.
- `map.json` 의 `lockedStyles` 를 통과시키려고 값을 바꾸지 않는다. **결정이 실제로 바뀌었으면 피그마·웹·잠금값을 함께** 고친다.
- **폭·여백에 브레이크포인트를 쓰지 않는다.** `:root` 의 세 변수 한 곳에서만 관리한다:
  `--pad-x`(24 고정, 피그마 6:168 값) · `--card-max`(450) · `--content-max`(402).
  실제 콘텐츠 폭 = `min(화면폭 − 48, 402)` 이라 **처음부터 끝까지 연속**이다.
- **텍스트 문단의 폭은 피그마 고정폭을 `max-width` 로 그대로 잠근다.** 명시 줄바꿈이 없는 문단은 폭이 곧 줄바꿈이다 — 웹 폭이 `--content-max` 를 따라 넓어지면 넓은 화면에서만 줄이 다르게 꺾이고, 360px 기준 검수로는 안 잡힌다. (2026-08-02 리드 '수백/개' 드리프트로 실제 발생) 문단 폭을 정하면 `figma-style.json` 에 `viewport: 1280` 항목으로도 잠근다. (현재: 리드 344 · 본문 330 · 스텝 312)
  `@media` 로 폭을 키우면 그 지점에서 한 번에 튄다 — 2026-08-02 에 520px 에서 콘텐츠가 **352→448(96px)**
  튀는 것을 사용자가 창을 늘리다 발견했다. `flow-audit.mjs` 가 1px 씩 훑어 이걸 잡는다.
  남은 `@media (min-width:520px)` 는 **회색 바탕 + 카드 그림자**(시각 표현)뿐이고 값이 튀지 않는다.
- 카드 540 / 콘텐츠 468 은 **피그마 360px 에 "맞추지" 않는다.** 피그마 프레임은 360px 고정,
  폰(≤430)의 좌우 24 도 피그마 6:168 값 그대로다. **넓은 화면 폭·여백만 웹 전용 반응형 값**이다.
  2026-08-02 하루에 400 → 512(주선왕) → 540(피클플러스) → **450** 으로 정착했고, 좌우 여백도 24 → 36 → **24** 로 되돌아왔다.
- **리드·긴 본문 문단을 섹션 패딩 안에 가두지 않는다.** 피그마 텍스트는 hug 라 패딩(24)을 넘어
  최대 344 까지 벌어진다(6:247=344, 6:189=330, 6:305=323). 웹이 312 로 가두면 명시 줄바꿈이
  깨져 `"쌓아드려 / 요."` 처럼 한 글자가 밀려 내려간다. `.lead` · `.para-wide` 가 좌우 16px 씩 흘러넘친다.
- **카드 폭에 연동되는 임계값을 숫자로 박지 않는다.** 회색 바탕 `@media` 와 오버스크롤 캔버스색
  스크립트는 둘 다 "카드가 화면을 다 못 채우는 순간"을 기준으로 한다. 2026-08-02 에 카드 상한을
  400 → 450 으로 올렸는데 이 둘이 520/519 에 묶여 있어 **451~519 구간에서 색 있는 섹션 양옆이 흰색**으로
  드러났다. 스크립트는 `--card-max` 를 읽고, `@media` 는 그 바로 위(451) 를 쓴다.
  `flow-audit.mjs` 의 "카드 양옆 바탕색" 검사가 1px 씩 훑어 잡는다.
- **`.phone-content` 좌우 패딩은 0 이다.** 4px 만 있어도 말풍선이 피그마 224 가 아니라 216 이 되어
  목업 본문이 한 줄씩 밀린다(`"인사이 / 트]"`). 둘 다 2026-08-02 에 실제로 발생했다.
- **`width:100%` 로 늘어나는 `<img>` 에는 `height:auto` 를 반드시 같이 준다.**
  마크업의 `height="224"` 속성이 살아 있으면 폭만 늘어나 **가로로 눌린다.** 352px 시절엔 원본 344 와
  비슷해 티가 안 났고, 데스크톱 확장에서 처음 드러났다 (2026-08-02).
  `figma-style.json` 의 `illust-aspect-desk`/`illust-aspect-mobile` 이 렌더 비율 vs 원본 비율로 잡는다.
- 모바일(520px 미만) 렌더는 데스크톱을 넓힐 때 **같이 넓어지면 안 된다.**
  `width-mobile-content-352` · `width-mobile-card-full` 이 430px 뷰포트에서 회귀를 잡는다.
- **OG 이미지를 같은 파일명으로 내용만 바꾸지 않는다.** 카카오·메타는 스크랩 정보(제목·설명)와
  썸네일 이미지를 **따로**, 그것도 이미지는 URL 기준으로 캐싱한다. 파일명이 그대로면 스크랩 캐시를
  지워도 옛 썸네일이 계속 나간다. 2026-08-01 에 `og-logo.png` 를 확정 로고로 교체했는데 파일명이
  같아 8/2 까지 옛 워드마크가 카톡에 떴다. **바꿀 때마다 `og-logo-YYYYMMDD.png` 로 파일명을 함께 바꾼다.**
  바꾼 뒤 순서도 중요하다 — ①배포 완료 확인 → ②[카카오 캐시 초기화](https://developers.kakao.com/tool/clear/og).
  거꾸로 하면 옛 이미지를 다시 캐싱한다. 초기화는 `https://careercoach.my/` · `https://careercoach.my` ·
  `http://…` · `www…` 가 **각각 별도 캐시**라 쓰는 형태를 전부 넣어야 한다(2026-08-02 에 5종 모두 1건씩 삭제됨).
  이미 보낸 카톡 메시지의 미리보기는 전송 시점 스냅샷이라 **무슨 짓을 해도 안 바뀐다** — 링크를 새로 보내야 한다.

## 배포를 기다리지 않고 확인하기

GitHub Pages 는 푸시 → 빌드 큐 → 배포라 라이브 반영까지 **10~15분**이 걸린다(2026-08-02 실측 14분 49초).
그 사이 "고쳤는데 안 바뀐다" 로 시간을 버리지 말 것. 순서는 이렇다.

1. **미리보기 파일을 만들어 사용자에게 보낸다** — 배포와 무관하게 즉시 확인 가능:
   ```
   node tools/make-preview.mjs          # assets 를 data: URL 로 인라인한 단일 HTML
   ```
   → `SendUserFile` 로 전달. 데스크톱이 연결돼 있으면 `create_artifact` 로
   `careercoach-landing-preview` 아티팩트를 **갱신**해 준다(같은 id 를 계속 update — 새로 만들지 말 것).
2. 라이브 반영 여부는 서버 응답으로 본다 (브라우저 캐시 말고):
   ```js
   const r = await fetch('/index.html', { cache: 'reload' }); r.headers.get('last-modified')
   ```
3. 아직이면 저장소 → Actions → `pages-build-deployment` 가 `Queued` 인지 본다. 맞으면 그냥 기다린다.

**연달아 푸시하면 앞 빌드가 취소되고 큐가 더 밀린다.** 커밋을 모아서 한 번에 푸시하는 게 결국 빠르다.
저장소 루트의 `.nojekyll` 은 Jekyll 빌드 단계를 건너뛰게 한다(큐 대기는 못 줄인다).

## 로컬 검수 환경
- 줄바꿈·폭을 재려면 Pretendard 가 필요하다: `npm i pretendard` → `PretendardVariable.ttf` 를 `~/.fonts` 에 복사 → `fc-cache -f`.
  **폰트 없이 재면 줄바꿈 판정이 틀린다.** (타이포 검수 자체는 폰트 없이도 정확하다)
- 샌드박스에서 `figma.com` 과 jsdelivr 는 차단돼 있다. 이미지는 사용자가 피그마에서 Export → 채팅 첨부가 표준 경로.
- **Figma MCP 실행 환경에 `Pretendard Variable` 이 설치돼 있지 않다** (`listAvailableFontsAsync` 8,927개 중 0개).
  텍스트 노드의 **문자열 수정은 불가능**하다 — 플러그인 API 는 편집 전 `loadFontAsync` 를 강제하는데
  그 폰트가 없어서 실패한다. 읽기(`characters`·`getStyledTextSegments`)와 폰트가 필요 없는 편집
  (크기·위치·색·프레임 폭)은 된다. **문구 변경은 사용자가 피그마에서 직접 해야 한다.** (2026-08-02 확인)

## 푸시
공개 저장소라 토큰 없이 clone 된다. 푸시는:
1. Write 툴로 `/home/claude/.git-credentials` 에 `https://x-access-token:<PAT>@github.com` 한 줄 (PAT는 프로젝트 문서 `기획/github-토큰.md`)
2. `git -c credential.helper='store --file=/home/claude/.git-credentials' push origin main`

셸 명령에 토큰을 직접 쓰거나 `git config --global` 을 건드리면 차단된다.
