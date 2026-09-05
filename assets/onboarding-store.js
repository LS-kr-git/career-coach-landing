/**
 * 온보딩 선택값 보관·저장 — 세 화면(1·2·3)이 **이 파일 하나**를 같이 쓴다.
 *
 * 왜 있나 (2026-08-08)
 *   개인정보처리방침 1항은 "희망 직군, 경력 연차, 근무지 범위 · 필수 · 직군·연차·근무지
 *   기반 맞춤 브리핑 제공" 을 수집 항목으로 적어 두고 있는데, 온보딩 1·2·3 단계는
 *   고른 값을 **한 글자도 저장하지 않고** location.href 로 다음 화면에 넘어가기만 했다.
 *   그래서 user_preference · user_preference_job · user_preference_region 이 비어 있었고,
 *   그 셋을 읽는 daily_digest() 때문에 레터가 구조적으로 0건이었다.
 *   방침을 고치는 게 아니라 뒷단을 방침에 맞춘다.
 *
 * 어떻게 하나
 *   1·2 단계는 화면을 넘어가도 값이 남게 localStorage 한 곳(cc_onboarding)에 모으고,
 *   **3단계 완료 버튼에서 한 번만** RPC 로 보낸다. 단계마다 보내면 중간 이탈한 사람의
 *   반쪽짜리 취향이 DB 에 남고, 그걸 daily_digest 가 그대로 읽는다.
 *
 * 실패했을 때 (조용히 버리지 않는다)
 *   track.js 는 실패를 삼킨다 — 추적은 그래도 된다. 이건 다르다. 이 값이 없으면
 *   그 사람에게 나갈 레터가 영원히 0건이다. 그래서 실패하면 pending 표시를 남기고,
 *   **다음에 온보딩 아무 화면에나 다시 들어올 때** retryPending() 이 자동으로 다시 보낸다.
 *   사용자를 막지는 않는다 — 새 에러 화면도, 새 문구도 만들지 않는다.
 *
 * supabase-js 를 언제 부르나
 *   보낼 것이 실제로 있을 때만 동적 import 한다. 1·2 단계는 CDN 을 아예 건드리지 않아
 *   화면이 그만큼 빨리 뜬다. (signup/index.html 이 쓰는 방식과 같은 CDN·같은 설정 파일)
 */
import { track } from '/assets/track.js';

const KEY = 'cc_onboarding';

/** 선택 상한. 화면(onboarding/1·3)과 뒷단(save_onboarding — 0020·0024)이 같은 값을 쓴다. */
const MAX_JOBS = 7;
const MAX_REGIONS = 3;

/** 상태 모양 — jobs: taxonomy code(중분류) · years: 정수 · regions: 지역 코드 ·
 *  topic: 완료 화면에서 **직접 바꾼** 인사이트 주제. 안 바꿨으면 null 이고,
 *  그때 주제는 고른 직군에서 푼다(대응표는 tools/roles/tracks.json). */
const EMPTY = { jobs: [], years: null, yearsMax: null, regions: [], topic: null, pending: false };

const strings = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s) : []);
const intOrNull = (v) => (Number.isInteger(v) ? v : null);

/** 저장된 선택값. 깨져 있거나 없으면 빈 상태를 준다 — 읽기 때문에 화면이 깨지면 안 된다. */
export function readState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const s = JSON.parse(raw) || {};
    return {
      jobs: strings(s.jobs),
      years: intOrNull(s.years),
      // 2026-08-09 부터 위끝도 **서버에 저장된다** (career-coach 0022_career_range.sql).
      // 그 전에는 user_preference 가 정수 하나였고 이 값이 브라우저에만 있었다 —
      // 기기를 바꾸면 사라지고 발송 필터는 아래끝 하나로만 돌았다.
      yearsMax: intOrNull(s.yearsMax),
      regions: strings(s.regions),
      topic: typeof s.topic === 'string' && s.topic ? s.topic : null,
      pending: s.pending === true,
    };
  } catch {
    return { ...EMPTY };   // 사파리 프라이빗 모드 등
  }
}

/** 바뀐 부분만 얹어 저장한다. 세 화면이 각자 자기 몫만 갱신한다. */
export function writeState(patch) {
  const next = { ...readState(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  return next;
}

/**
 * 상한(직군 7 · 근무지 3)보다 많이 골라 둔 사람의 저장분을 한 번만 잘라 굳힌다.
 * 상한이 생기기 전에 고른 사람과, 상한이 10 이던 때 8~10개를 고른 사람이 여기 걸린다.
 *
 * 안 자르면: 그 사람이 해당 단계를 다시 안 밟고 다음 단계로 바로 들어오는 순간 RPC 가
 * 상한에 걸려 거부하고, pending 이 남아 진입할 때마다 같은 값을 영원히 다시 보낸다 —
 * 레터가 영구히 0건이다. 화면의 set() 자르기는 **그 화면을 실제로 밟아야** 걸리므로
 * 이 경로를 대신하지 못한다.
 *
 * 여기서(모듈 로드 시) 하는 이유: readState 안에서 자르면 화면이 켜지면서 부르는
 * writeState 가 그 결과를 먼저 굳혀 버려, 정작 저장할 때는 "잘랐다" 는 사실이 사라진다.
 * 자르는 곳과 알리는 곳이 같아야 한다.
 */
(function trimStoredOnce() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const s = JSON.parse(raw) || {};
    const jobs = strings(s.jobs), regions = strings(s.regions);
    const overJobs = jobs.length > MAX_JOBS, overRegions = regions.length > MAX_REGIONS;
    if (!overJobs && !overRegions) return;
    localStorage.setItem(KEY, JSON.stringify({
      ...s, jobs: jobs.slice(0, MAX_JOBS), regions: regions.slice(0, MAX_REGIONS),
    }));
    // 사용자는 해당 화면에 오면 잘린 상태를 보지만, 건너뛰고 온 사람은 못 본다.
    // 자른 값이 속한 단계로 나눠 남긴다 — 근무지 잘림을 step 1 로 적으면 3단계 칸이 0건이 된다.
    if (overJobs) track('onboarding_step', { step: 1, jobs: 'trimmed' });
    if (overRegions) track('onboarding_step', { step: 3, regions: 'trimmed' });
  } catch { /* localStorage 가 막힌 브라우저 — 저장된 것도 없다 */ }
})();

/** 보낼 값이 다 모였나. 3단계까지 정상으로 온 사람은 항상 참이다. */
function complete(s) {
  return s.jobs.length > 0 && s.years !== null && s.regions.length > 0;
}

let clientPromise = null;
function client() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const [{ createClient }, cfg] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'),
        // 접속 정보는 /assets/supabase-config.js 한 곳에만 둔다 (2026-08-06 복구 훈련 결과).
        import('/assets/supabase-config.js'),
      ]);
      return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    })();
  }
  return clientPromise;
}

// 완료 버튼과 자동 재시도가 겹쳐 같은 값을 두 번 보내지 않게 한다.
let inflight = false;

async function commit(state, supabase, session, retry) {
  // 연차는 **구간**이다. 위끝이 없으면 아래끝과 같은 값으로 폭 0 구간을 보낸다 —
  // 서버 제약이 "한쪽만" 을 거부하므로 null 을 섞어 보내면 저장이 통째로 실패한다.
  const lo = Math.min(60, Math.max(0, state.years));
  const hi = Math.min(60, Math.max(lo, state.yearsMax ?? lo));
  const args = {
    p_jobs: state.jobs,                                          // string[] taxonomy code(중분류)
    p_years_min: lo,                                             // number 0..60
    p_years_max: hi,                                             // number lo..60
    p_regions: state.regions,                                    // string[] 지역 코드
  };
  // 주제를 **직접 바꾼 사람만** 실어 보낸다. 안 실으면 서버가 기본값(null)을 쓰고,
  // 그러면 발송 시점에 직군에서 푼다 — 화면이 보여준 것과 같은 규칙이다.
  // 인자를 늘 실으면 RPC 가 5인자 판으로 올라가기 전까지 온보딩 저장이 전원 실패한다.
  if (state.topic) args.p_topic = state.topic;
  const { error } = await supabase.rpc('save_onboarding', args);
  if (error) {
    writeState({ pending: true });
    // 이름은 analytics.event_name 허용 목록(visit·signup_view·signup_start·login·
    // onboarding_step·onboarding_done)에 있는 것만 통과한다. 실패 전용 이름이 없어
    // 단계 이벤트 + props 로 적는다. 목록은 다른 저장소(career-coach)에 있다.
    track('onboarding_step', { step: 3, save: 'failed' }, session.access_token);
    return { status: 'error' };
  }
  writeState({ pending: false });
  // 저장까지 끝난 것만 완료로 센다. 재시도로 늦게 성공한 건은 retry 로 구분한다.
  track('onboarding_done', retry ? { saved: true, retry: true } : { saved: true }, session.access_token);
  return { status: 'ok' };
}

/**
 * 3단계 완료 버튼이 부른다. 값 세 벌을 한 번에 보낸다.
 * 세션이 없으면 RPC 를 부르지 않고 /signup/ 으로 보낸다 (로그인 없이 들어온 경우).
 */
export async function saveOnboarding() {
  if (inflight) return { status: 'busy' };
  inflight = true;
  try {
    // 통신 전에 먼저 표시해 둔다. 여기서 브라우저가 닫혀도 다음 진입에서 다시 보낸다.
    const state = writeState({ pending: true });
    if (!complete(state)) {
      // 1·2 단계를 건너뛰고 주소로 바로 들어온 경우. 반쪽 값을 보내지 않고,
      // 재시도 대상으로도 삼지 않는다 (보낼 것이 없어 재시도해도 같은 결과다).
      //
      // 그런데 여기로 오는 길이 하나 더 있다: localStorage 가 막힌 브라우저는 1·2 단계를
      // 정상으로 통과해도 값이 한 글자도 안 남아 complete() 가 거짓이 된다. 바로 위
      // writeState({pending:true}) 조차 저장이 안 되므로 retryPending() 도 영영 안 돈다 —
      // 진짜 실패인데 아무 데도 안 남던 자리라, 그 경우만 골라 이벤트를 남긴다.
      if (readState().pending !== true) track('onboarding_step', { step: 3, save: 'no-store' });
      writeState({ pending: false });
      return { status: 'incomplete' };
    }
    const supabase = await client();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { location.href = '/signup/'; return { status: 'no-session' }; }
    return await commit(state, supabase, session, false);
  } catch {
    writeState({ pending: true });      // CDN 이 막혔거나 네트워크가 끊긴 경우
    return { status: 'error' };
  } finally {
    inflight = false;
  }
}

/**
 * 온보딩 세 화면이 진입할 때마다 부른다. 지난 저장이 실패해 남아 있으면 다시 보낸다.
 * 보낼 것이 없으면 supabase-js 를 부르지도 않는다 — 평상시 비용이 0 이다.
 */
export async function retryPending() {
  const state = readState();
  if (!state.pending || inflight) return { status: 'idle' };
  if (!complete(state)) { writeState({ pending: false }); return { status: 'incomplete' }; }
  inflight = true;
  try {
    const supabase = await client();
    const { data: { session } } = await supabase.auth.getSession();
    // 아직 로그인 전이면 표시를 그대로 둔다. 여기서 화면을 옮기지는 않는다 —
    // 1·2 단계는 로그인 없이도 볼 수 있는 화면이다.
    if (!session) return { status: 'no-session' };
    return await commit(state, supabase, session, true);
  } catch {
    return { status: 'error' };
  } finally {
    inflight = false;
  }
}
