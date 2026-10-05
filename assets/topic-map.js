/* 직군 → 인사이트 주제. 표(`#cc-topic-map`)는 tools/roles/build.mjs 가 tracks.json 에서 페이지에 심는다.
 * 정본의 정본은 career-coach insights/sources.py 의 TAXONOMY_MAP 이다.
 * 쓰는 곳: mypage/topics (2026-10-05). onboarding/done 은 같은 함수를 아직 안에 따로 갖고 있다 —
 * PG 심사 뒤 온보딩 4단계 분리 배포 때 이 파일로 옮긴다(프로젝트 문서 「결정-2026-10-05-온보딩-4단계-분리-정본」). */

/** 페이지에 심어 둔 표를 읽는다. 표가 빠지면 build.mjs --check 가 먼저 멈춘다. */
export function readTopicMap() {
  return JSON.parse(document.getElementById('cc-topic-map').textContent);
}

/** 저장된 직군에서 주제를 푼다. **발송 경로와 같은 규칙이다** —
 *  career-coach `ops/send.py` 의 `트랙과_직군` 이 `v_send_target.job_group_codes`
 *  (= 고른 중분류의 **대분류**)를 정렬해 트랙이 잡히는 첫 번째를 쓴다. 여기도 같다.
 *  정렬 기준이 갈리면 화면이 보여준 주제와 실제로 받는 주제가 달라지고, 그 갈림은 어디에서도 안 터진다.
 *  예외 하나 — 대분류가 트랙 둘로 갈리는 자리(「디자인」 → 「UI·UX 디자인」)는 그 대분류 안에서
 *  고른 중분류 중 따로 가는 것(`MAP.jobs[c][2]`)을 이름순 첫 번째로 본다. `track_for_job` 과 같다. */
export function trackFromJobs(MAP, jobs) {
  const 대분류 = [...new Set(jobs.map((c) => (MAP.jobs[c] || [])[1]).filter((i) => i != null))]
    .sort((a, b) => (MAP.groups[a][0] < MAP.groups[b][0] ? -1 : MAP.groups[a][0] > MAP.groups[b][0] ? 1 : 0));
  for (const gi of 대분류) {
    const t = MAP.groups[gi][1];
    if (t < 0) continue;
    const 따로 = jobs.filter((c) => MAP.jobs[c] && MAP.jobs[c][1] === gi && MAP.jobs[c][2] >= 0).sort();
    return MAP.tracks[따로.length ? MAP.jobs[따로[0]][2] : t];
  }
  return null;   // 아직 트랙이 없는 직군만 고른 사람 — 직접 고르게 한다
}
