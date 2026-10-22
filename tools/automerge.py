# -*- coding: utf-8 -*-
"""`claude/` 가지 PR 을 CI 가 초록일 때 합친다 — `.github/workflows/auto-merge.yml` 이 부른다.

규칙의 정본은 저장소 `CLAUDE.md` 「claude/ 가지 + PR 로 올린다」 절이다. 여기는 판정만 한다.

    합친다   같은 저장소 · `claude/` 가지 · 초안 아님 · 제외 영역 없음 ·
             이 PR 의 바뀐 파일로 **돌아야 하는** PR 워크플로가 머리 커밋에서 전부 성공 ·
             그 커밋의 다른 검사도 전부 끝났고 실패 없음
    댓글만   제외 영역(`AUTOMERGE_EXCLUDE`)에 걸리면 「사람 병합 필요 — 이유」를 한 번 단다
    기다림   돌아야 할 워크플로가 아직 안 끝났다 → 그 워크플로가 끝나면 다시 불린다
    안 봄    초안(draft) PR — 컨펌을 기다리는 화면 변경은 초안으로 연다. 준비 완료로 바꾸면 그때 판정한다

🔴 「돌아야 하는 워크플로」는 실행 목록이 아니라 **워크플로 파일의 `pull_request` 경로 거르개**로
   정한다. 실행 목록으로 정하면 PR 이 열린 직후 CI 실행이 아직 안 생긴 몇 초 사이에 「검사 0개 =
   초록」으로 읽혀 합쳐진다. 문서만 바뀌어 CI 가 아예 안 도는 PR 은 돌 것이 없으므로 합친다.
🔴 합칠 때 머리 sha 를 같이 보낸다(`--match-head-commit` 과 같다). 판정 뒤 새 커밋이 오면 GitHub 이 거절한다.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.github.com"
표식 = "<!-- automerge:excluded -->"
통과_결론 = {"success", "skipped", "neutral"}


def 패턴_정규식(패턴: str) -> re.Pattern:
    """GitHub 워크플로 경로 거르개 문법(`*` 는 `/` 를 안 넘고 `**` 는 넘는다)."""
    i, 출력 = 0, ""
    while i < len(패턴):
        if 패턴.startswith("**/", i):
            출력 += "(?:.*/)?"; i += 3
        elif 패턴.startswith("**", i):
            출력 += ".*"; i += 2
        elif 패턴[i] == "*":
            출력 += "[^/]*"; i += 1
        elif 패턴[i] == "?":
            출력 += "[^/]"; i += 1
        else:
            출력 += re.escape(패턴[i]); i += 1
    return re.compile(출력 + r"\Z")


def 걸린다(경로: str, 패턴들: list[str]) -> bool:
    """`!` 부정을 포함해 마지막으로 맞은 패턴이 이긴다 (GitHub 규칙)."""
    결과 = False
    for p in 패턴들:
        부정 = p.startswith("!")
        if 패턴_정규식(p[1:] if 부정 else p).match(경로):
            결과 = not 부정
    return 결과


def PR_에서_도는가(설정, 바뀐: list[str], 기준가지: str) -> bool:
    """워크플로 `on:` 값 하나가 이 PR 로 `pull_request` 실행을 만드는가.

    `branches`·`paths` 만 읽는다. 그 밖의 거르개(`paths-ignore` 등)는 안 읽으므로 「돈다」로
    본다 — 틀려도 그 실행을 기다리다 안 합치는 쪽이지, CI 를 건너뛰고 합치는 쪽이 아니다.
    """
    if isinstance(설정, (str, list)):
        return "pull_request" in ([설정] if isinstance(설정, str) else 설정)
    if not isinstance(설정, dict) or "pull_request" not in 설정:
        return False
    pr = 설정["pull_request"] or {}
    if "branches" in pr and not 걸린다(기준가지, pr["branches"]):
        return False
    return "paths" not in pr or any(걸린다(f, pr["paths"]) for f in 바뀐)


def 돌아야_할_워크플로(폴더: Path, 바뀐: list[str], 기준가지: str, 자기: str) -> list[str]:
    import yaml
    이름들 = []
    for p in sorted(폴더.glob("*.y*ml")):
        d = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        이름 = d.get("name") or p.name
        on = d.get("on", d.get(True))          # PyYAML 은 `on:` 을 True 로 읽는다
        if 이름 != 자기 and PR_에서_도는가(on, 바뀐, 기준가지):
            이름들.append(이름)
    return 이름들


def 제외_사유(바뀐: list[str], 패턴들: list[str]) -> list[str]:
    return [f for f in 바뀐 if 걸린다(f, 패턴들)]


class GitHub:
    def __init__(self, 저장소: str, 토큰: str):
        self.저장소, self.토큰 = 저장소, 토큰

    def 부른다(self, 방법: str, 경로: str, 몸=None, 토큰: str | None = None):
        url = 경로 if 경로.startswith("http") else f"{API}/repos/{self.저장소}{경로}"
        req = urllib.request.Request(url, method=방법, data=None if 몸 is None else json.dumps(몸).encode())
        req.add_header("Authorization", f"Bearer {토큰 or self.토큰}")
        req.add_header("Accept", "application/vnd.github+json")
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"null")

    def 전부(self, 경로: str, 열쇠: str | None = None) -> list:
        결과, 쪽 = [], 1
        while True:
            사이 = "&" if "?" in 경로 else "?"
            받음 = self.부른다("GET", f"{경로}{사이}per_page=100&page={쪽}")
            묶음 = 받음[열쇠] if 열쇠 else 받음
            결과 += 묶음
            if len(묶음) < 100:
                return 결과
            쪽 += 1


def _실행_판정(실행: list, 돌아야: list[str]) -> tuple[str, str] | None:
    for 이름 in 돌아야:
        같은 = sorted((r for r in 실행 if r["name"] == 이름), key=lambda r: r["run_number"])
        if not 같은 or 같은[-1]["status"] != "completed":
            return "기다린다", f"「{이름}」 아직 안 끝남"
        if 같은[-1]["conclusion"] != "success":
            return "안 합친다", f"「{이름}」 결론 {같은[-1]['conclusion']}"
    return None


def _검사_판정(검사: list, 자기잡: str) -> tuple[str, str] | None:
    for c in 검사:
        if c["name"] == 자기잡:      # 이 판정 자신의 실행
            continue
        if c["status"] != "completed":
            return "기다린다", f"검사 「{c['name']}」 아직 안 끝남"
        if c["conclusion"] not in 통과_결론:
            return "안 합친다", f"검사 「{c['name']}」 결론 {c['conclusion']}"
    return None


def 판정(gh: GitHub, pr: dict, 돌아야: list[str], 자기잡: str) -> tuple[str, str]:
    """('합친다'|'기다린다'|'안 합친다', 이유)."""
    sha = pr["head"]["sha"]
    막힘 = (_실행_판정(gh.전부(f"/actions/runs?head_sha={sha}&event=pull_request", "workflow_runs"), 돌아야)
          or _검사_판정(gh.전부(f"/commits/{sha}/check-runs", "check_runs"), 자기잡))
    if 막힘:
        return 막힘
    상태 = gh.부른다("GET", f"/commits/{sha}/status")
    if 상태["total_count"] and 상태["state"] != "success":
        return ("기다린다" if 상태["state"] == "pending" else "안 합친다"), f"커밋 상태 {상태['state']}"
    return "합친다", f"돌아야 할 워크플로 {len(돌아야)}개 초록" if 돌아야 else "돌아야 할 CI 없음(문서 등)"


class 설정:
    """워크플로가 환경변수로 넘기는 값들."""
    def __init__(self, 환경: dict):
        줄들 = lambda k: [p.strip() for p in 환경.get(k, "").splitlines() if p.strip()]
        self.제외, self.듣는 = 줄들("AUTOMERGE_EXCLUDE"), 줄들("AUTOMERGE_LISTEN")
        self.자기 = 환경.get("AUTOMERGE_SELF", "")          # 이 워크플로의 name
        self.자기잡 = 환경.get("AUTOMERGE_SELF_JOB", "")    # 이 워크플로의 잡 이름(검사 이름으로 뜬다)
        self.합칠토큰 = 환경.get("AUTOMERGE_TOKEN", "")
        self.폴더 = Path(".github/workflows")


def 대상인가(pr: dict, 저장소: str) -> bool:
    머리 = pr["head"]
    return (pr["state"] == "open" and not pr["draft"] and 머리["ref"].startswith("claude/")
            and 머리["repo"] is not None and 머리["repo"]["full_name"] == 저장소)


def _사람_병합_댓글(gh: GitHub, 번호: int, 걸림: list[str]) -> None:
    if any(표식 in (c.get("body") or "") for c in gh.전부(f"/issues/{번호}/comments")):
        return
    줄 = "\n".join(f"- `{f}`" for f in 걸림[:20])
    gh.부른다("POST", f"/issues/{번호}/comments", {"body":
              f"{표식}\n**사람 병합 필요** — 자동 병합 제외 영역의 파일이 바뀌었습니다.\n\n{줄}"})


def _합친다(gh: GitHub, pr: dict, 머리: str, 토큰: str) -> None:
    try:
        gh.부른다("PUT", f"/pulls/{pr['number']}/merge",
                 {"merge_method": "squash", "sha": pr["head"]["sha"]}, 토큰=토큰)
        print(f"{머리}: 합쳤다")
    except urllib.error.HTTPError as e:
        print(f"::error::{머리}: 병합 거절 {e.code} {e.read()[:300]!r}")
        raise SystemExit(1)


def 한_PR(gh: GitHub, 번호: int, 설: 설정) -> None:
    pr = gh.부른다("GET", f"/pulls/{번호}")
    머리 = f"PR #{번호} ({pr['head']['ref']} @ {pr['head']['sha'][:8]})"
    if not 대상인가(pr, gh.저장소):
        print(f"{머리}: 대상 아님 — 넘어감")
        return
    파일 = gh.전부(f"/pulls/{번호}/files")
    바뀐 = [f["filename"] for f in 파일] + [f["previous_filename"] for f in 파일 if f.get("previous_filename")]
    걸림 = 제외_사유(바뀐, 설.제외)
    if 걸림:
        print(f"{머리}: 제외 영역 {len(걸림)}개 — 사람 병합")
        _사람_병합_댓글(gh, 번호, 걸림)
        return
    돌아야 = 돌아야_할_워크플로(설.폴더, 바뀐, pr["base"]["ref"], 설.자기)
    for 이름 in set(돌아야) - set(설.듣는):
        print(f"::warning::「{이름}」 이 auto-merge.yml 의 workflow_run 목록에 없다 — 끝나도 다시 불리지 않는다")
    결정, 이유 = 판정(gh, pr, 돌아야, 설.자기잡)
    print(f"{머리}: {결정} — {이유}")
    if 결정 == "합친다":
        _합친다(gh, pr, 머리, 설.합칠토큰)


def PR_번호들(gh: GitHub, 사건: dict, 사건이름: str) -> list[int]:
    if 사건이름 == "pull_request_target":
        return [사건["pull_request"]["number"]]
    run = 사건["workflow_run"]
    주인 = gh.저장소.split("/")[0]
    return [p["number"] for p in gh.전부(f"/pulls?state=open&head={주인}:{run['head_branch']}")
            if p["head"]["sha"] == run["head_sha"]]


def main() -> int:
    for 흐름 in (sys.stdout, sys.stderr):
        흐름.reconfigure(encoding="utf-8")
    설 = 설정(os.environ)
    if not 설.합칠토큰:
        print("::error::저장소 비밀값 AUTOMERGE_TOKEN 이 없다 — 자동 병합을 못 한다. CLAUDE.md 「claude/ 가지 + PR」 절 참조")
        return 1
    gh = GitHub(os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_TOKEN"])
    사건 = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    for 번호 in PR_번호들(gh, 사건, os.environ.get("GITHUB_EVENT_NAME", "")):
        한_PR(gh, 번호, 설)
    return 0


if __name__ == "__main__":
    sys.exit(main())
