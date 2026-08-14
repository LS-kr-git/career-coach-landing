#!/usr/bin/env bash
# 이 환경이 무엇을 할 수 있는지 한 번에 말한다.
#
# 왜 있는가 (2026-08-13)
#   같은 커밋인데 환경마다 판정이 달랐다 — PC 3대(node 유무·python 스텁·Postgres 없음),
#   클라우드 샌드박스, 예약작업 세션, CI. 그리고 그것을 확인하는 방법이 환경마다 달랐다.
#   `tools/run.ps1` 의 지문은 윈도우에서 .sh 를 돌릴 때만 찍히고 클라우드·CI 에는 없었다.
#   그래서 매번 다시 발견했다. 여기가 그 하나의 화면이다.
#
#   두 가지를 본다.
#     · 런타임  — node·python·git·Postgres·크로미움이 **실제로 도는가** (있는 척하는 것 거름)
#     · 이 클론 — hooksPath·원격 URL 자격증명·autocrlf·훅 줄바꿈·origin/main 과의 거리
#       조용한 사고는 대부분 이 다섯에서 났다.
#
# 쓰는 법
#   보고서:  bash tools/doctor.sh
#   훅에서:  . tools/doctor.sh  →  dr_probe  로 판정만 받는다 (출력 없음)
#   윈도우:  chcp 65001 을 먼저 하거나, career-coach 클론이면
#            powershell -ExecutionPolicy Bypass -File .\tools\run.ps1 .\tools\doctor.sh
#            (run.ps1 은 cc 저장소에만 있다. 안 하면 한글이 CP949 로 깨진다)
#
# 🔴 이 파일은 두 저장소에 **같은 내용으로** 있다. 한쪽을 고치면 다른 쪽도 고친다.
#    (저장소가 둘이라 공유할 방법이 없다. 서브모듈은 이 규모에 과하다.)
#    저장소 구분은 파일 존재로 스스로 판단한다 — 사본을 손보지 않아도 되게.
#
# 종료코드는 언제나 0 이다. 이건 게이트가 아니라 보고서다.

# ── 런타임 판정 ────────────────────────────────────────────────
# `command -v` 만으로는 모자라다. 윈도우의 Microsoft Store 별칭 스텁은 **있는데 안 돈다**.
# 그래서 후보를 차례로 실제로 돌려 보고 고른다.
dr_pick() {                       # dr_pick <검증인자> <후보...> → 도는 첫 경로를 찍는다
  local probe="$1"; shift
  local c p
  for c in "$@"; do
    p="$(command -v "$c" 2>/dev/null)" || continue
    [ -n "$p" ] || continue
    "$p" $probe >/dev/null 2>&1 || continue
    printf '%s' "$p"; return 0
  done
  return 1
}

dr_probe() {
  DR_HOST="$(hostname 2>/dev/null || echo '?')"
  DR_OS="$(uname -s 2>/dev/null || echo '?')"
  DR_CI="${CI:+yes}"

  DR_NODE="$(dr_pick --version node || true)"
  DR_NODE_V="${DR_NODE:+$("$DR_NODE" --version 2>/dev/null)}"
  DR_PY="$(dr_pick '-c ""' python3 python || true)"
  DR_PY_V="${DR_PY:+$("$DR_PY" --version 2>&1)}"
  DR_GIT_V="$(git --version 2>/dev/null)"

  # 임시 Postgres 를 띄울 수 있나 (통합 테스트·마이그레이션 검증이 여기 달렸다)
  if command -v initdb >/dev/null 2>&1 || command -v pg_ctl >/dev/null 2>&1 || [ -n "${PGBIN:-}" ]; then
    DR_PG=1; else DR_PG=""; fi

  # ── 이 클론의 상태 ──────────────────────────────────────────
  DR_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"
  DR_HOOKS="$(git config core.hooksPath 2>/dev/null || echo '')"
  DR_AUTOCRLF="$(git config core.autocrlf 2>/dev/null || echo '(미설정)')"
  DR_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"

  # 원격 URL 에 자격증명이 박혀 있나. **값은 절대 찍지 않는다** — 유무만.
  # 박혀 있으면 git 이 자격증명 관리자를 아예 안 부르므로, 토큰이 재발급되면 그 PC 만
  # 조용히 죽는다. 2026-08-08→08-10 에 한 대가 이틀 죽어 있었던 원인이 이것이다.
  # `git@github.com:…` (SSH) 는 자격증명이 박힌 것이 아니다. `https://<사용자>:<토큰>@…`
  # 형태만 본다 — `://` 와 `@` 가 둘 다 있는 경우다.
  case "$(git config --get remote.origin.url 2>/dev/null)" in
    *://*@*) DR_URL_CRED=1 ;;
    *)       DR_URL_CRED=""  ;;
  esac

  # 훅이 CRLF 면 리눅스에서 `#!/usr/bin/env bash\r` 로 읽혀 **아예 안 돈다**.
  # .gitattributes 를 나중에 추가한 저장소는 이미 받아 둔 작업 트리가 안 고쳐진다.
  DR_CRLF=""
  [ -f "$DR_ROOT/tools/hooks/pre-push" ] && \
    head -c 200 "$DR_ROOT/tools/hooks/pre-push" 2>/dev/null | grep -q $'\r' && DR_CRLF=1
  [ -f "$DR_ROOT/.gitattributes" ] && DR_GITATTR=1 || DR_GITATTR=""

  # origin/main 과의 거리. **fetch 하지 않는다** — 자격증명이 필요한 PC 에서 여기가
  # 보이지 않는 로그인 창을 띄우고 무한정 매달린다(2026-08-10 에 11.9시간 매달렸다).
  # 그래서 로컬에 남은 ref 기준이고, 보고서에 그렇게 적는다.
  if git rev-parse --verify -q origin/main >/dev/null 2>&1; then
    DR_BEHIND="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
    DR_AHEAD="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"
  else
    DR_BEHIND=""; DR_AHEAD=""
  fi
  DR_DIRTY="$(git status --porcelain 2>/dev/null | grep -c . || true)"

  # 어느 저장소인가 — 사본을 손보지 않아도 되게 스스로 판단한다
  if [ -d "$DR_ROOT/supabase" ]; then DR_REPO=cc
  elif [ -f "$DR_ROOT/ops/index.html" ]; then DR_REPO=landing
  else DR_REPO='?'; fi

  # 크로미움 — 랜딩만 쓴다. 경로를 못 찾아도 **없다고 단정하지 않는다**:
  # tools/ops-audit/harness.mjs 는 셋 다 없으면 `chromium.launch({})` 로 playwright 의
  # 기본 브라우저에 맡긴다. 여기서 "없음" 이라고 말하면 멀쩡히 도는 PC 를 못 돈다고 하는 것이다.
  # (`/opt/pw-browsers/chromium-1194` 는 이 클라우드 샌드박스의 버전 고정 경로다.)
  DR_CHROME=""
  if [ "$DR_REPO" = landing ]; then
    local p
    for p in "${CHROMIUM_PATH:-}" /opt/pw-browsers/chromium-1194/chrome-linux/chrome \
             /opt/pw-browsers/chromium/chrome-linux/chrome; do
      [ -n "$p" ] && [ -f "$p" ] && { DR_CHROME="$p"; break; }
    done
    if [ -z "$DR_CHROME" ] && [ -n "$DR_NODE" ] && \
       "$DR_NODE" -e "import('playwright')" >/dev/null 2>&1; then
      DR_CHROME="(playwright 기본 브라우저)"
    fi
  fi
}

dr_yn() { [ -n "$1" ] && printf '있음' || printf '없음'; }

# 훅이 부르는 한 줄 요약 — 못 본 것이 있으면 그것만 말한다.
# 🔴 **저장소마다 쓰는 런타임도, CI 가 메워 주는 범위도 다르다.** 한 문장으로 뭉뜽그리면
#    거짓 안심이 된다 — 랜딩에는 python 을 쓰는 검사가 아예 없는데 "python 이 없어 CI 가
#    대신 봅니다" 라고 말하고 있었고, 피그마 대조 둘은 CI 도 못 보는데 같은 줄이
#    "CI 가 대신 봅니다" 라고 했다(검사관 지적).
dr_line() {
  local miss=""
  case "$DR_REPO" in
    cc)
      [ -z "$DR_NODE" ] && miss="$miss node"
      [ -z "$DR_PY" ]   && miss="$miss python"
      [ -z "$DR_PG" ]   && miss="$miss postgres"
      [ -n "$miss" ] && echo "⚪ 이 환경에 없는 것:$miss — 그 검사는 건너뛰고 **CI(tests.yml)가 전부 대신 봅니다.** (자세히: bash tools/doctor.sh)"
      ;;
    landing)
      # 랜딩 검수 5종은 전부 node 다. python·Postgres 는 쓰는 검사가 없으므로 세지 않는다.
      [ -z "$DR_NODE" ] && echo "⚪ 돌아가는 node 가 없어 검수 5종을 못 돌렸습니다 — 셋(결과물 공통·직군 목록·문구 대조)은 CI(landing-audit.yml)가 보고, **피그마 대조 둘(2겹b·1.2겹)은 아무도 못 봅니다.** (자세히: bash tools/doctor.sh)"
      ;;
    *)
      [ -z "$DR_NODE" ] && miss="$miss node"
      [ -z "$DR_PY" ]   && miss="$miss python"
      [ -n "$miss" ] && echo "⚪ 이 환경에 없는 것:$miss"
      ;;
  esac
  [ -n "$DR_CRLF" ] && echo "🔴 tools/hooks/pre-push 가 CRLF 입니다 — 리눅스·CI 에서 안 돕니다. 고치기: git add --renormalize . && git checkout -- ."
  # 절대경로나 `./tools/hooks` 로 걸어도 정상이다. 리터럴 하나와만 비교하면 그런 클론에서
  # 매 푸시 🔴 가 떠서, 진짜일 때 안 읽히게 된다.
  case "$DR_HOOKS" in
    tools/hooks|./tools/hooks|*/tools/hooks) ;;
    *) echo "🔴 core.hooksPath 가 '${DR_HOOKS:-미설정}' 입니다 — 이 훅은 우연히 돌고 있을 뿐입니다. 걸기: git config core.hooksPath tools/hooks" ;;
  esac
  # 🔴 는 **윈도우에서만** 띄운다. 클라우드 샌드박스 클론은 토큰 URL 이 정상이고
  #    거기서도 경고하면 매번 뜨는 무해한 경보가 되어, 진짜일 때 안 읽히게 된다.
  case "$DR_OS" in
    MINGW*|MSYS*|CYGWIN*)
      [ -n "$DR_URL_CRED" ] && echo "🔴 원격 URL 에 자격증명이 박혀 있습니다 — 토큰이 재발급되면 이 클론만 조용히 죽습니다. 고치기: career-coach 클론에서 powershell -NoProfile -ExecutionPolicy Bypass -File .\\tools\\fix-remote-url.ps1 (그 스크립트는 cc 저장소에만 있습니다. 랜딩 클론은 git remote set-url 로 평문 URL 로 되돌리세요)" ;;
  esac
  return 0
}

dr_report() {
  echo ""
  echo "==== 실행환경 ===="
  printf '  호스트     : %s (%s)%s\n' "$DR_HOST" "$DR_OS" "${DR_CI:+  · CI}"
  printf '  node       : %s\n' "${DR_NODE_V:-없음}"
  printf '  python     : %s\n' "${DR_PY_V:-없음}"
  printf '  git        : %s\n' "${DR_GIT_V:-없음}"
  printf '  임시 PG    : %s\n' "$(dr_yn "$DR_PG")"
  printf '  크로미움   : %s\n' "${DR_CHROME:-없음}"
  echo ""
  echo "==== 이 클론 ($DR_REPO) ===="
  printf '  브랜치     : %s%s\n' "$DR_BRANCH" \
    "$([ "${DR_DIRTY:-0}" -gt 0 ] 2>/dev/null && printf '  · 안 커밋한 변경 %s건' "$DR_DIRTY")"
  if [ -n "$DR_BEHIND" ]; then
    printf '  origin/main: %s커밋 뒤 · %s커밋 앞  (로컬 ref 기준 — fetch 안 했다)\n' "$DR_BEHIND" "$DR_AHEAD"
  else
    printf '  origin/main: 참조 없음 — 거리 모름\n'
  fi
  printf '  hooksPath  : %s\n' "${DR_HOOKS:-(미설정)}"
  printf '  원격 자격증명 박힘: %s\n' "$(dr_yn "$DR_URL_CRED")"
  printf '  autocrlf   : %s  · .gitattributes %s  · 훅 줄바꿈 %s\n' \
    "$DR_AUTOCRLF" "$(dr_yn "$DR_GITATTR")" "$([ -n "$DR_CRLF" ] && echo CRLF || echo LF)"
  echo ""
  echo "==== 이 환경에서 푸시하면 ===="
  dr_line | sed 's/^/  /'
  echo "  (막는 것이 아니라 못 본 것을 말합니다. 판정의 정본은 CI 입니다.)"
  echo ""
}

# 직접 실행했으면 보고서, source 했으면 함수만 정의한다
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0
  dr_probe
  dr_report
fi
