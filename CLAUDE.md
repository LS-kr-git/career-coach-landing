# 이 저장소에서 작업할 때 (모든 세션 공통)

커리어코치 랜딩페이지. **피그마가 단일 기준(Source of Truth), 웹은 파생물**이다.

## 0. 클론 직후 한 줄 — 푸시 훅 켜기
```
git config core.hooksPath tools/hooks
```
훅은 **두 겹**이다.

| 겹 | 스크립트 | 언제 도나 | 대상 |
|---|---|---|---|
| 1 | `tools/figma-audit/page-audit.mjs` | **모든 푸시** | 저장소의 모든 `*.html` + `CNAME` + `assets` |
| 2 | `tools/figma-audit/audit.mjs` | `index.html`/`assets` 가 바뀐 푸시 | 랜딩 (피그마 프레임 6:148 대조) |

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

### 2-2. 검수가 보는 것 (2026-08-01 확장)
| 검사 | 무엇을 보나 | 근거 파일 |
|---|---|---|
| 문구 | 텍스트 노드 vs 웹 블록 | `figma_meta.xml` |
| 확정값 | `lockedStyles` 정규식 | `map.json` |
| 이미지 | `assets/*.png` sha256 | `map.json` |
| 타이포 | 크기·굵기·행간·자간 실측 | `figma-type.json` |
| **시각 스타일** | **색·보더·반경·패딩·그림자·태그명 실측** | **`figma-style.json`** |

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
- **데스크톱 카드 540px / 좌우 36 / 콘텐츠 468px 을 피그마 360px·24 에 "맞추지" 않는다.** (2026-08-02 사용자 확정)
  피그마 프레임은 360px 고정, 모바일 좌우 24 도 피그마 6:168 값 그대로다. **데스크톱 폭·패딩만 웹 전용 반응형 값**이다.
  근거: 레퍼런스 실측 — 피클플러스 카드 540·글 508 / 주선왕 카드 512·글 512. 피클플러스 폭을 택했다.
- **데스크톱 오버라이드(`@media (min-width:520px)`)는 파일 맨 아래 한 블록에 모아 둔다.**
  기본 규칙보다 위에 두면 같은 특이도에 밀려 `section > *` 같은 오버라이드가 **조용히 무시된다.**
  `desk-override-order` 잠금값과 `width-desk-content-468` 이 둘 다 이걸 지킨다.
- **`width:100%` 로 늘어나는 `<img>` 에는 `height:auto` 를 반드시 같이 준다.**
  마크업의 `height="224"` 속성이 살아 있으면 폭만 늘어나 **가로로 눌린다.** 352px 시절엔 원본 344 와
  비슷해 티가 안 났고, 데스크톱 확장에서 처음 드러났다 (2026-08-02).
  `figma-style.json` 의 `illust-aspect-desk`/`illust-aspect-mobile` 이 렌더 비율 vs 원본 비율로 잡는다.
- 모바일(520px 미만) 렌더는 데스크톱을 넓힐 때 **같이 넓어지면 안 된다.**
  `width-mobile-content-352` · `width-mobile-card-full` 이 430px 뷰포트에서 회귀를 잡는다.

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

## 푸시
공개 저장소라 토큰 없이 clone 된다. 푸시는:
1. Write 툴로 `/home/claude/.git-credentials` 에 `https://x-access-token:<PAT>@github.com` 한 줄 (PAT는 프로젝트 문서 `기획/github-토큰.md`)
2. `git -c credential.helper='store --file=/home/claude/.git-credentials' push origin main`

셸 명령에 토큰을 직접 쓰거나 `git config --global` 을 건드리면 차단된다.
