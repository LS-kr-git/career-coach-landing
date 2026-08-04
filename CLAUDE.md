# 이 저장소에서 작업할 때 (모든 세션 공통)

커리어코치 랜딩페이지. **피그마가 단일 기준(Source of Truth), 웹은 파생물**이다.

## 손이 닿는 일은 직접 한다 (2026-08-03 사용자 상시 허가)

**브라우저(Claude in Chrome)나 MCP 로 직접 할 수 있는 일은 사용자에게 절차를 설명하지 말고 직접 한다.**
설정 변경·폼 입력·버튼 클릭 포함이며, 건마다 다시 물을 필요 없다. 이 허가는 모든 세션에 적용된다.

**특히 플러그인(`use_figma`)이 못 하는 피그마 작업도 브라우저 피그마(figma.com)에선 된다** — Pretendard 굵기 변경·텍스트 스타일 생성 등 `loadFontAsync` 가 막는 것들. 이런 건 절차 설명하지 말고 **Claude in Chrome 으로 직접** 한다. (2026-08-03 사용자 재확인: "브라우저 피그마로 우리가 못 하던 걸 할 수 있게 되면 무조건 직접 — 새로 생기는 세션 포함 모든 세션에서.")

절차 안내는 **직접 할 수 없다는 것을 확인한 뒤**의 차선책이다. "이렇게 하세요" 를 먼저 쓰지 말 것.

**시작 전에 로그인 상태부터 확인한다.** 우리가 조종하는 크롬은 사용자가 평소 쓰는 프로필과
**다를 수 있다** — 2026-08-03 에 Supabase 대시보드가 사인인 화면으로 되돌아갔다.
접속해서 화면을 먼저 보고, 로그인이 안 돼 있으면 그 사실을 알리고 넘긴다(로그인은 우리가 하지 않는다).

**그래도 우리가 하지 않는 것** — 여기 닿으면 그 **한 단계만** 사용자에게 넘기고 나머지는 다 해 둔다:
- 계정 생성, 로그인(비밀번호 입력)
- 비밀번호·API 시크릿·카드번호 등 **자격증명을 입력하는 일**
  (예: 카카오 Client Secret 을 Supabase 에 붙여넣기 — 발급 버튼까지는 우리가 누르고, 값 이동만 넘긴다)
- 결제·구매, 약관 동의, 되돌릴 수 없는 삭제, CAPTCHA

**⛔ 외부에 나가는 신청·심사는 내용을 합의하기 전에 제출하지 않는다 (2026-08-03 사고).**
"직접 한다" 는 **어떻게** 할지에 대한 허가지, **무엇을 신청할지**를 정하라는 허가가 아니다.
2026-08-03 에 카카오 개인정보 동의항목 재심사를 합의 없이 이름·전화번호 2개만으로 제출했고,
사용자가 계획하던 생일·연령대가 통째로 빠졌다. **심사 중에는 콘솔에서 철회가 안 된다.**
제3자(카카오·PG사·정부기관)에게 나가는 신청서는 **제출 직전에서 멈추고 내용 전체를 보여준 뒤 동의를 받는다.**
과거 문서의 "재신청 시 넣을 값" 같은 표는 **초안이지 승인이 아니다.**

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

## 피그마 화면 프레임 맨 위에는 상태바를 넣는다 (2026-08-03 확정)

프리뷰를 실제 폰처럼 보이게 하려고, **모든 화면 프레임의 첫 자식은 `공용/상태바 (iPhone)` 인스턴스**다
(컴포넌트 `393:2498`, 360×45, 시계 9:41 · 신호 · 와이파이 · 배터리). 랜딩 `6:148` 은 예전부터 자체 상태바
(`6:149`)를 갖고 있어 그대로 둔다.

```js
const sb = await figma.getNodeByIdAsync('393:2498');   // 공용/상태바
const inst = sb.createInstance();
frame.insertChild(0, inst);
inst.name = '상태바';
inst.layoutSizingHorizontal = 'FILL';
```

- **웹에는 이 요소가 없다.** 브라우저가 그리는 영역이라 HTML 로 옮기지 않는다. 피그마 프레임이 웹보다
  45px 높은 것은 **정상**이며, 높이를 웹과 맞추려고 지우지 말 것.
- **문구 스냅샷을 다시 뽑을 때 상태바 텍스트를 제외한다.** 안 그러면 `9:41` 이 스냅샷에 들어가
  `docs-audit` 이 "웹에서 못 찾음" 으로 푸시를 막는다 (2026-08-03 실제 발생). 덤프 스니펫의
  `underStatusBar` 필터가 이 역할을 한다 — 아래 "스냅샷을 다시 뽑아 커밋한다" 참고.
- 프레임에 **절대배치 요소(플로팅 CTA 등)가 있으면 상태바를 넣은 뒤 y 를 다시 잡는다** — `y = 프레임높이 − 80`.
- 적용 완료: 온보딩 7개 상태 화면 · 브리핑 상세 · 이용약관 · 개인정보처리방침. **새 화면을 만들면 첫 자식으로 넣는다.**

## 헤더와 뒤로가기 — 표준값 (2026-08-03 사용자 확정 · 뒤로가기가 있는 모든 페이지)

| 항목 | 값 | 왜 |
|---|---|---|
| 헤더 높이 | **48** | iOS 내비게이션 바 44 와 안드로이드 앱 바 56 사이. **더 줄이지 않는다** — 48 이 하한선 |
| 탭 영역 | **48×48** | 안드로이드 접근성 최소 터치 48dp. 헤더를 44 로 내리면 이 기준을 못 지킨다 |
| 꺽쇠 글리프 | **7.5×15** | 24×24 아이콘 박스 안에서 가운데 |
| 선 굵기 | **1.6** · 끝·모서리 둥글게 | |
| 색 | **gray/600 `#475569`** | 흰 배경 대비 7.58:1. gray/500(4.76:1)까지가 허용선, gray/400(2.56:1)은 아이콘 최소 3:1 미달 |
| 구분선 | **없음** | |
| 헤더 안 글씨 | **없다** (2026-08-03 사용자 확정) | 아래 참고 |
| 눌림 표시 | **36×36 · radius 10 · gray/100** | 탭 영역(48)과 분리한다 — 같으면 헤더 위아래에 딱 붙어 잘려 보인다 |

**헤더에는 글씨를 넣지 않는다.** 스크롤하면 본문 제목이 헤더에 축약되어 나타나는 처리(G2)를 2026-08-02 에
넣었다가 **2026-08-03 에 사용자 요청으로 걷어냈다.** 뒤로가기 하나만 둔다. 새 화면에도 넣지 말 것.
(온보딩 3화면 모두에 걸려 있었지만 2·3단계는 스크롤이 짧아 실제로는 1단계에서만 보였다.)

**탭 영역과 눌림 표시를 분리한다.** 손가락이 닿는 범위는 48×48 그대로 두고, 눈에 보이는 회색 박스만
36×36 으로 줄인다(위아래 6px 여백). iOS·머티리얼 모두 터치 타깃은 손가락 기준, 눌림 표시는 아이콘 기준이다.

```html
<a class="back" href="…" aria-label="뒤로"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
<path d="M15.75 4.5L8.25 12l7.5 7.5" stroke="#475569" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
```
```css
.hd{position:sticky;top:0;z-index:20;display:flex;align-items:center;
  height:calc(48px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 12px 0;background:#fff}
.back{width:48px;height:48px;display:flex;align-items:center;justify-content:center;position:relative}
.back svg{position:relative;z-index:1}
.back::before{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:36px;height:36px;border-radius:10px;background:transparent;transition:background .12s}
.back:active::before{background:var(--gray-100)}
```

피그마 쪽 정본은 컴포넌트 세트 **`376:2507` "온보딩/상단바"**(360×48, 변형 6개 = 단계 1·2·3 × 상태 기본·눌림)다. 값을 바꾸려면 컴포넌트를
고치고 웹을 따라 맞춘다. 헤더 높이를 바꾸면 **세로 오토레이아웃 프레임의 높이가 같이 변하므로 플로팅 CTA
의 `y = 프레임높이 − 80` 을 다시 잡는다.**

## 피그마 프리뷰에서 상태바·헤더·하단 CTA 는 고정한다 (2026-08-03 확정 · 새 화면도 동일)

프로토타입(▶ Present)에서 스크롤해도 따라오게 하려면 플러그인 API 의 **`numberOfFixedChildren`** 를 쓴다.
`scrollBehavior` 속성은 이 실행 환경에 **없다**(`no such property` — 2026-08-03 확인).

**고정 대상은 `children` 배열의 "맨 뒤 N개"다.** (파일 안 레퍼런스 프레임들로 실측 확인:
`115:9899` 는 n=2 이고 마지막 두 자식이 Status Bar·App bar 다.) 배열 뒤쪽 = 위에 그려지는 레이어다.

```js
const pin = (n, x, y) => { n.layoutPositioning = 'ABSOLUTE'; n.x = x; n.y = y;
  n.constraints = { horizontal: 'STRETCH', vertical: 'MIN' }; };
pin(상태바, 0, 0); pin(header, 0, 45);
f.appendChild(cta); f.appendChild(상태바); f.appendChild(header);  // 고정 대상을 맨 뒤로
f.paddingTop = 93;              // 45+48 — 흐름에서 빠진 만큼 되돌려 높이를 유지한다
f.numberOfFixedChildren = 3;
f.overflowDirection = 'VERTICAL';
cta.y = Math.round(f.height - 80);
```

- 세로 오토레이아웃 프레임에서 자식을 `ABSOLUTE` 로 빼면 **그만큼 프레임이 줄어든다.** 반드시
  `paddingTop` 으로 되돌려야 높이가 그대로 유지되고 웹과의 대조가 깨지지 않는다.
- 고정 요소의 **배경은 불투명해야 한다.** 내용이 뒤로 지나가므로 투명하면 글자가 겹쳐 보인다
  (상태바·헤더 모두 `#ffffff`).
- 현재 적용: 온보딩 7개(상태바·헤더·CTA, n=3) · 랜딩 `6:148`(상태바·Link, n=2) ·
  이용약관·개인정보·브리핑(상태바만, n=1 — 이 세 화면은 웹에서도 헤더가 sticky 가 아니다).
- **새 화면을 만들면 같은 처리를 한다.** 하단 CTA 가 플로팅인 화면은 CTA 를 반드시 고정 대상에 넣는다.

## 모든 페이지에 `color-scheme: only light` 를 넣는다 (2026-08-03 확정 · 검수가 강제)

`<head>` 의 viewport 바로 아래에 **반드시** 이 한 줄이 들어간다.

```html
<meta name="color-scheme" content="only light">
```

- **`light` 만 쓰면 소용이 없다.** 안드로이드 크롬의 자동 다크 테마(Chrome 96+)는 `only light` 일 때만 비켜간다.
  `light` 는 "이 사이트는 밝은 배색입니다" 라고 알릴 뿐이라 자동 다크가 그대로 적용된다.
- 없으면 사용자가 OS 다크 모드를 켰을 때 **브라우저가 우리 색을 임의로 뒤집는다.** 흰 배경이 어두워지고
  앰버·블루 섹션이 탁해지며, 우리가 피그마와 맞춰 놓은 색이 전부 틀어진다.
- 폼 컨트롤·스크롤바·기본 배경 같은 **브라우저 기본 UI 색도 밝은 쪽으로 고정**된다.
- **이건 iOS 의 Night Shift · True Tone 과는 무관하다.** 그건 렌더링이 끝난 화면에 OS 가 씌우는 필터라
  웹에서 막을 방법이 없다. 화면이 누렇게 보인다는 제보가 오면 그쪽부터 확인할 것.
- `page-audit.mjs` 가 **모든 페이지에서 이 태그의 유무와 값(`only light`)을 검사**하고, 없거나 `light` 뿐이면
  푸시를 막는다. 새 페이지를 만들 때 잊어도 훅이 잡아 준다.

## 화면 채우기 높이는 항상 `svh` 를 쓴다 (2026-08-02 사용자 확정 · 모든 세션 적용)

**`min-height:100vh` 를 새로 쓰지 않는다.** 페이지를 화면 높이만큼 채우는 용도라면 언제나:

```css
.page{ min-height:100vh; min-height:100svh; }   /* 앞줄은 구형 브라우저 폴백 */
```

- `100vh`(=`lvh`) 는 **주소창이 숨겨진 큰 화면** 기준이다. 내용이 화면보다 짧아도 주소창 높이(60~90px)만큼
  페이지가 길어져 **넘칠 이유가 없는데 스크롤이 생긴다.**
- `dvh` 는 지금 상태의 높이라 그 문제는 없지만, 주소창이 접히면 값이 **같이 변해** 레이아웃이 흔들릴 수 있다.
- `svh` 는 항상 "주소창이 보이는 가장 작은 높이" 라 **어떤 상태에서도 넘치지 않는다.** 그래서 이걸 기본으로 둔다.

**적용 범위는 "화면을 채우는 높이" 뿐이다.** `index.html` 의 오버스크롤 흰 판
(`body::before{height:100vh}` · `.page{padding-top:100vh;margin-top:-100vh}`)처럼 **문서 밖으로 덧대는 판**은
크게 잡을수록 안전하므로 `100vh` 를 그대로 둔다. 이건 화면 채우기가 아니다.

관련 규칙: **`overflow:hidden` 으로 스크롤을 막지 않는다.** 큰 글꼴 설정·가로 모드·작은 화면에서 내용이
잘려 CTA 를 못 누르게 된다. 짧은 화면은 "막는" 게 아니라 "넘치지 않게" 만든다.
내용이 화면보다 **64px 이하로 넘칠 때만 여백을 조여 흡수**하고, 그 이상이면 그냥 스크롤을 허용한다.

적용 완료: 온보딩 3개 · `signup` · `letter` · `privacy` · `terms` · `index.html`(2026-08-02, 피그마 대조 통과).

> 참고: `index.html` 의 `.page` 는 `box-sizing:border-box` 인데 `padding-top:100vh` 가 이미 border-box 높이를
> 100vh 이상으로 만들기 때문에, 거기서는 `min-height` 가 **실제로는 한 번도 걸리지 않는 잉여값**이다(실측 확인).
> 규칙 일관성과 나중에 오버스크롤 트릭을 걷어낼 때를 대비해 값만 맞춰 뒀다.

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

## 약관·개인정보·브리핑 화면 — 피그마↔웹 동기화 (2026-08-02 신설)

이용약관·개인정보처리방침·브리핑 상세페이지도 랜딩처럼 **피그마가 기준**이다. 웹은 파생물.
- 피그마 파일 `LnT8TgFVBxky0bVyaF6Tob`, 문서/브리핑 섹션 2개:
  - 섹션 **`327:2474` "이용약관 / 개인정보처리방침"** — 프레임 `339:2474`=이용약관↔`terms.html`, `340:2478`=개인정보처리방침↔`privacy.html`
  - 섹션 **`356:3106` "브리핑 상세페이지"** — 프레임 `362:2482` ↔ `letter.html`
- 세 화면 모두 랜딩과 **같은 디자인 시스템**으로 만들었다: 헤더는 랜딩 헤더(`6:162`) 클론,
  타이포는 텍스트 스타일(`text/display`·`h2`·`h3`·`body`·`body-s`·`label`·`caption`·`button`·`micro`),
  색은 원시 fill(navy-900/gray-*/amber-600), 표·카드는 auto-layout + 보더(gray-200)·헤더 gray-100.
  브리핑의 선 차트는 `createNodeFromSvg` 로 넣고 프레임 이름을 **`chart-viz`** 로 둔다(아래 표기 규칙 참고).
- 웹도 같은 값을 쓴다: `:root` 는 `--pad-x:24`·`--card-max:450`·`--content-max:402` (index.html 과 동일),
  시맨틱 태그·컴포넌트 클래스에 위 텍스트 스타일 값을 그대로 매핑했다.

### 문구 동기화는 어떻게 강제되나
커밋된 스냅샷 `tools/figma-audit/figma-docs-text.json`(피그마 텍스트, 마커 제외)을
웹에서 뽑은 문구와 `docs-audit.mjs` 가 공백 무시로 대조한다. **한쪽(웹이든 피그마든)만 문구를 고치면 푸시가 막힌다.**
```
node tools/figma-audit/docs-audit.mjs
```
pre-push 2겹(a)에서 `terms/privacy/letter.html` 또는 스냅샷이 바뀐 푸시마다 자동으로 돈다.
랜딩과 달리 **라이브 피그마 덤프가 필요 없다** — 커밋된 스냅샷과 대조하기 때문(문구는 자주 안 바뀌므로).

### 피그마 화면을 고쳤으면 — 스냅샷을 다시 뽑아 커밋한다
1. 문구를 바꾼다. 새 텍스트를 만들거나 길게 고칠 땐 위 "피그마에 글자를 쓸 때" 규칙을 따른다 —
   **지오메트리·폭·행간을 측정용 Gothic A1 로 다 잡은 뒤, 맨 마지막에 텍스트 스타일을 입힌다.**
   (스타일을 먼저 입히면 Pretendard 미로드 상태가 되어 이후 `textAutoResize` 등 쓰기가 막힌다. 실측으로 겪음.)
2. `use_figma`(읽기)로 세 프레임의 텍스트를 다시 뽑는다 — **마커·차트 텍스트는 제외:**
   ```js
   const frames = { '339:2474':'terms.html', '340:2478':'privacy.html', '362:2482':'letter.html' };
   const underChart = n => { let p=n.parent; while(p){ if(p.name==='chart-viz') return true; p=p.parent; } return false; };
   // 상태바(9:41·배터리 등)는 웹에 없는 목업 요소다. 안 빼면 검수가 '웹에서 못 찾음' 으로 막는다.
   const underStatusBar = n => { let p=n.parent; while(p){ if(p.name==='상태바') return true; p=p.parent; } return false; };
   const pages = [];
   for (const [fid, html] of Object.entries(frames)) {
     const f = await figma.getNodeByIdAsync(fid);
     const texts = f.findAllWithCriteria({ types:['TEXT'] })
       .filter(t=>t.name!=='marker' && !underChart(t) && !underStatusBar(t)).map(t=>t.characters);   // 마커·차트 눈금·상태바 제외
     pages.push({ html, figmaNode: fid, name: f.name, ignoreWebText: [], texts });
   }
   return { fileKey: figma.fileKey, pages };
   ```
3. 결과로 `figma-docs-text.json` 의 해당 `pages[]` 항목을 갈아끼우고 `dumpedAt` 를 오늘로 바꾼다.
4. 웹(terms/privacy/letter.html)도 같은 문구로 고치고 `docs-audit` 가 "차이 없음" 이면 커밋.

### 표기 규칙 (동기화가 안 깨지게)
- 리스트 마커(번호 `1.`·불릿 `•`)는 피그마에서 **노드 이름을 `marker` 로** 둔다 — 스냅샷·검수가 걸러낸다.
  웹은 `<ol>`/`<ul>` 로 자동 생성하므로 마커가 DOM 텍스트에 없다(양쪽 다 "문구"가 아니다).
- `date`·`back` 같은 내용 노드는 이름을 내용과 같게 둔다(autoRename). 검수는 텍스트 문자열만 본다.
- 웹 문단 안 `<strong>`·`<a>` 는 대조에 영향 없다(공백 제거 후 이어붙여 비교).
- 브리핑 선 차트는 `createNodeFromSvg` 프레임 이름을 **`chart-viz`** 로 둔다. 스냅샷 덤프가 그 하위 텍스트(눈금 `6건`·`30일 전` 등)를 제외하고, 웹도 `<svg>` 를 통째로 무시하므로 양쪽 다 "문구"에서 빠진다.

## CTA 규칙 — 일반 페이지 통일 + 랜딩 예외 (2026-08-03 확정)

버튼(주요 CTA)의 세로 길이·라운드·글자가 페이지마다 달라(높이 52~60 · 라운드 12~14 · 글자 15~17) "제각각·길다"는 지적이 있었다. **일반 페이지는 아래 값으로 통일**하고, **랜딩(index.html)만 의도적으로 조금 큰 히어로 CTA로 남긴다**(사용자 확정 2026-08-03).

**토큰 — 각 페이지 `:root` 에 동일하게 넣는다:**
```
--cta-h:54px; --cta-radius:14px; --cta-fs:15px; --cta-fw:700;
```
- **높이 54 · 라운드 14 · 크기 15 · 두께 Bold(700) · 모바일 풀폭.** 라운드 14는 카드와 같은 값이라 시스템이 하나로 붙는다. 높이 60→54 로 "길다"를 없애고, **두께 700 으로 본문(400) 대비 위계를 살린다.**
- 근거(2025~26 관례): 최소 탭 44×44(HIG·Material·WCAG), 주요 CTA 48~56 편안 + 모바일 풀폭. 두께는 대부분 웹이 SemiBold(600)이지만 **주요·전환 CTA·한국 소비자앱(토스·당근·카카오 계열)은 Bold(700)** 가 흔하다 — 위계를 위해 700 을 쓴다(2026-08-03 사용자 확정, 600→700). 크기 15 는 `text/button` 값이다.
  - **피그마 CTA 두께 700 — 공유 스타일 `text/button-strong` 로 반영 완료** (플러그인 ❌ 생성 / figma.com 웹앱 ✅ 생성 · 플러그인 ✅ 적용). 플러그인(`use_figma`)은 Pretendard 를 `loadFontAsync` 못 해 **스타일 생성·굵기 변경은 브라우저(figma.com)** 에서 한다.
    - **`text/button-strong`(Pretendard 15/700 · LH20) 생성 완료** (id `S:8d73ed28…`, 2026-08-03). 만든 법: 레터 CTA 를 브라우저에서 Bold 로(스타일 Detach → Weight=Bold) → Typography 스타일 아이콘 → 팝오버 **+ (Create style)** → 이름 `text/button-strong`. 설명은 플러그인 `style.description` 로 넣었다(폰트 로드 불필요).
    - **비랜딩 CTA 는 이제 `text/button-strong` 을 쓴다** — 적용 완료(10개): 레터 `364:2502`, 온보딩 CTA버튼 컴포넌트 `299:2412`·`299:2414`, 온보딩 스텝 플로팅 CTA `277:2465`·`277:2468`·`277:2471`·`278:2518`·`278:2598`·`278:2692`·`278:2807`. **적용은 플러그인 `setTextStyleIdAsync`(폰트 로드 불필요) 로 한다** — 새 CTA 는 이 스타일만 붙이면 700 이 된다.
    - **안 붙인 것(의도)**: 뒤로가기 링크 `339:2604`·`340:2615`(CTA 아님·text/button 이지만 그대로 둠), 디자인시스템 견본 `25:199`·`25:201`(text/button 자체를 보여주는 샘플), 랜딩 `6:368`(17/600 예외). 웹(letter·onboarding·signup)은 이미 700 — 피그마·웹 두께 일치.
    - 브라우저 주의: 이 세션에서 Chrome 창이 228px↔풀사이즈로 튀었다. `navigate(노드 URL) → resize_window(1440×900) → 6s 대기` 순서로 뷰포트를 살린 뒤 작업. **zoom 액션은 Figma 캔버스를 얼려 렌더러 타임아웃**을 낸다 — 쓰지 말고 전체 screenshot 만. `Ctrl+B` 는 400↔스타일두께(600) 토글이라 700 이 안 되니 위 드롭다운 방법을 쓴다. 굵기 검증은 `use_figma` 읽기(`fontWeight`)가 정확하다(패널 표기·너비는 못 믿는다).
- **풀폭**: 플로팅은 `width:calc(100% - 40px); max-width:410px`, 폼/문서 하단은 `width:100%`(max 410 가운데). 색은 맥락 유지(랜딩=카카오 옐로, 나머지=앰버). **랜딩 CTA의 말풍선 아이콘은 없애지 않는다.**
- 적용됨: `signup/index.html`(카카오 버튼) · `letter.html` · `onboarding/1·2·3`. (랜딩 제외)
- **랜딩(index.html) CTA는 의도된 예외 — 손대지 않는다.** 히어로라서 일부러 조금 크게 둔다:
  **높이 60 · 라운드 14 · 글자 `text/h3`(17/600) · 카카오 옐로 · 말풍선 아이콘 유지.** (라운드 14는 공통과 같다. 높이·글자만 크다.)
  - **컴포넌트화됨: `랜딩/CTA (히어로)` (`440:2610`, 디자인시스템 섹션 `6:794`).** 랜딩 CTA(구 `6:366`/`6:368`)는 이 컴포넌트의 **인스턴스로 교체됨** — 인스턴스 `450:2608`, 텍스트 `I450:2608;440:2609` (2026-08-03). 위치·constraints·`numberOfFixedChildren`(2) 보존, 비주얼·웹 무변경.
    - 감사 스냅샷 갱신함: `figma-type.json`(floating-cta figmaNodes→`I450:2608;440:2609`), `figma-style.json`(floating-cta node→`450:2608`), `map.json`(ignoreWebText 에 CTA 문구 추가).
    - ⚠️ 인스턴스는 get_metadata 에서 **self-closing** 이라 내부 CTA 문구가 메타 XML 에 안 뜬다(그래서 ignoreWebText). 문구 검증은 컴포넌트+타이포 스냅샷이 대신한다. 랜딩 CTA 문구를 바꾸려면 컴포넌트 `440:2610` 을 고치고 웹도 맞춘다.
  - ⛔ **다른 작업(CTA 통일·리팩터·검수·디자인 시스템 정리 등) 중에 랜딩 CTA를 공통 규칙(54/15)으로 줄이거나 맞추지 말 것.** 이건 드리프트가 아니라 **확정된 예외**다(사용자 확정 2026-08-03). "일관성"을 이유로 건드리지 않는다.
  - 랜딩 CTA를 바꾸는 경우는 **오직 랜딩 히어로 자체를 다시 디자인하기로 한 때**뿐이다. 그때만 피그마 `6:148` 을 먼저 고치고(글자 노드 `6:368`) → 3종 덤프 재생성 → audit 통과 → 웹 반영(위 "랜딩을 건드렸다면" 절차)을 따른다.
- **미래 페이지**: 위 토큰을 `:root` 에 넣고 CTA 에 `height:var(--cta-h);border-radius:var(--cta-radius);font-size:var(--cta-fs);font-weight:var(--cta-fw)` 를 쓴다.

## 온보딩 1단계 직군 목록 — 생성물이다, 손으로 고치지 않는다 (2026-08-04 확정)

직군 목록은 우리가 지어낸 문구가 아니라 **직행(zighang) 의 depth 1 / depth 2** 다.
사용자가 고른 값이 그대로 공고 조회 파라미터(`depthOnes` / `depthTwos`)가 돼야 선택 → 저장 → 조회가 이어진다.

```
tools/roles/taxonomy.json   ← 분류 정본. 전량 25/296 을 항상 담는다
tools/roles/volume.json     ← 직무별 공고 볼륨 실측. "보여줄지" 판단 근거
tools/roles/measure.mjs     ← volume.json 을 다시 재는 스크립트
tools/roles/build.mjs       ← 위 둘로 onboarding/1/index.html 의 .scroll 을 만든다
node tools/roles/build.mjs           # 반영 (숨긴 항목을 전부 출력한다)
node tools/roles/build.mjs --check   # 훅이 부르는 드리프트 검사 (1.5겹)
```

**세 개의 이름이 있고, 셋을 헷갈리면 조용히 깨진다.**

| 필드 | 예 | 쓰는 곳 |
|---|---|---|
| `code` | `임베디드소프트웨어` | 직행에 보내는 값 · DB 저장값 · `data-d2` |
| `sourceLabel` | `임베디드소프트웨어` | 직행 원문. **대조 전용** |
| `label` | `임베디드SW` | 화면 표기. `data-d2` 아님 |

- **하드 규칙은 `code === sourceLabel.replace('·','_')`** 다. `build.mjs` 가 296개 전부에 걸고, 어긋나면 푸시를 막는다.
  `label` 은 자유롭게 다듬어도 되고, code 와의 관계는 `sourceLabel` 이 잡아 준다.
- **직행이 이름을 바꿨는지는 `sourceLabel` 만 보고 판단한다.** `label` 로 보면 "직행이 바꾼 것" 과
  "우리가 다듬은 것" 을 구별할 수 없다. 트리를 다시 뽑아 `sourceLabel` 과 diff 하면 된다.
- **다듬는 기준은 두 가지뿐이다**: (1) 그룹 안에서 자명한 `기타XXX` → `기타`, (2) 칩이 두 줄로 넘어갈 만큼 긴 것.
  **뜻이 달라지는 축약은 하지 않는다** (`해외·상사영업` → `해외영업` 같은 것).
- **`·` 로 조회하면 에러 없이 0건이 온다.** 직행은 구분자가 `_` 다.

### 무엇을 보여줄지는 볼륨 실측이 정한다

`taxonomy.json` 에서 **지우지 않는다.** 그 표는 들어오는 공고를 분류하는 데도 쓰여 항상 전량이어야 한다.
`build.mjs` 가 `volume.json` 을 보고 **화면에서만** 뺀다 — 다시 재면 자동으로 늘고 준다.

| 기준 | 값 | 왜 |
|---|---|---|
| 대분류 | 주당 신규 **10건 미만이면 숨김** | 주 10건이 "브리핑이 매주 새로 채워지는" 하한선 (2026-08-04 사용자 확정) |
| 중분류 | 30일 신규 **0건이면 숨김** | 한 달 내내 새 공고가 없었다 = 골라도 아무것도 안 온다 |

- **판단 지표는 재고(open)가 아니라 유입(new30)이다.** 재고만 많으면 매주 같은 공고를 다시 보낸다.
  실제로 어긋난다 — 게임은 재고 319건으로 15위인데 주당 신규는 7건으로 20위다.
- **볼륨은 '민간 플랫폼' 출처로만 잰다** (직행수집·원티드·그룹바이·랠릿·로켓펀치). 직행 전체 112,870건 중
  81,265건(72%)이 고용24라, 포함하면 생산·기능(24,535)과 의료·보건(21,701)이 1·2위가 돼 판단이 뒤집힌다.
- **아코디언 헤더에 `주 N건` 을 적는다.** 고르기 전에 기대치를 맞춰 준다. 값은 `volume.json` 실측이고
  피그마 `text/caption`(13/18)과 같은 값을 쓴다 — 이 파일에 12px 텍스트 스타일은 없다.
- **숨긴 것은 `build.mjs` 가 전부 출력한다.** 조용히 줄이면 "다 넣었다" 로 읽힌다.

### 목록을 다시 뽑을 때

**API 응답 집계가 아니라 `zighang.com/recruitment` 의 필터 > 직무 패널 트리를 읽는다.**
응답 집계는 "지금 공고가 있는 직무" 만 보여 준다 — 2026-08-04 에 그 방식으로 중분류 96개를 놓쳤다.
컨테이너에서 `api.zighang.com` 은 프록시가 403 으로 막으므로 브라우저(Claude in Chrome)에서 한다.

### 그 밖에

- **시작 상태는 전부 접힘 · 선택 0** 이다(피그마 `278:2693`). 2026-08-04 이전 웹은 13개가 미리 켜져 있었다 — 되돌리지 말 것.
- 피그마 대응 프레임: `278:2693`(시작) · `278:2404`(펼침·미선택) · `275:2404`(선택됨). 목록을 바꾸면 셋 다 고친다.
- `crawler/roles.py` 의 `DEPTH_ONE` 과 짝이다 (근거: `career-coach/docs/검증/직행-직무분류-전수.md`).

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
