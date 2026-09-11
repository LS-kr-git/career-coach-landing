/**
 * 마이페이지 데이터 층 — 여섯 화면(01~06)이 **이 파일 하나**에서 자료를 받는다.
 *
 * 왜 있나 (2026-09-11)
 *   여섯 화면이 같은 사람·같은 아티클 목록을 보여주는데, 값이 화면마다 따로 박혀 있었다.
 *   배선(실제 서버 연결)할 때 여섯 곳을 따로 고치면 한 곳이 빠진 채로 나간다.
 *   그래서 자료가 나오는 자리를 하나로 모으고, 화면은 여기서 받은 값만 그린다.
 *
 * 모양
 *   읽기 함수는 전부 async 다 — 지금은 목(mock)을 바로 돌려주지만, 서버 응답으로 바꾸는 날
 *   호출하는 쪽을 한 줄도 안 고치려면 처음부터 기다리는 모양이어야 한다.
 *   배선할 때 응답이 실패하면 마크업의 목값(「김서연 님」·128)이 실제 값처럼 남는다 —
 *   그때는 실패를 화면에 드러내야 한다. 지금은 목이라 실패 갈래가 없다.
 *   선택값 저장(주제·일요일 열람)은 localStorage 에 둔다. 서버(RPC)로 보내는 배선은 그 함수
 *   속만 바꾼다. **직군은 여기 없다** — 온보딩과 같은 값이라 assets/onboarding-store.js 가 정본이다.
 *
 * ⚠️ 정적 HTML 에도 같은 값이 한 벌 있다 (피그마 기준 프레임 상태 — docs-audit 대조용).
 *   두 벌이 어긋나면 tools/mypage-data-check.mjs 가 푸시를 막는다. 직군 목록은 build.mjs 가 만든다.
 */

const KEY = 'cc_mypage';

const PROFILE = {
  name: '김서연', initial: '서', provider: '카카오 계정', email: 'seoyeon@kakao.com', insightCount: 128,
};

export const COMMON_TOPIC = '일하는 사람 공통';

/* 04 화면 칩 순서 그대로 — 「일하는 사람 공통」이 항상 첫 번째다. */
const TOPICS = [
  COMMON_TOPIC,
  '디자인',
  '개발·AI',
  '마케팅·그로스',
  '프로덕트·전략',
  '세일즈·GTM',
  '제조·R&D',
  '재무·회계',
  '조직·피플',
  '커머스·리테일',
  '금융·마켓',
  '물류·공급망',
  '법률·규제',
  '미디어·콘텐츠',
  '고객경험·CX',
  '의료·헬스케어',
  '건설·공간',
  '게임',
];

/* 소장 아티클 26편 (2025-10 ~ 2026-08). month 는 05 화면의 월 칩과 같은 표기다. */
const ARCHIVE = [
  ['2026년 8월', '08. 07', '디자인', '디자인 시스템을 팀에 정착시키는 6개월'],
  ['2026년 8월', '08. 06', '커리어·이직', '이직 오퍼를 비교하는 세 가지 기준'],
  ['2026년 8월', '08. 04', 'AI로 일하기', 'AI로 리서치를 정리하는 워크플로'],
  ['2026년 8월', '08. 03', '디자인', '리서치 없이 만든 화면이 실패하는 이유'],
  ['2026년 7월', '07. 31', '커리어·이직', '연봉 협상에서 먼저 말하지 않기'],
  ['2026년 7월', '07. 29', '디자인', '토큰 네이밍, 어디까지 정해야 할까'],
  ['2026년 7월', '07. 24', 'AI로 일하기', '프롬프트보다 중요한 건 맥락 정리다'],
  ['2026년 7월', '07. 22', '디자인', '핸드오프를 없애는 팀의 일하는 방식'],
  ['2026년 7월', '07. 17', '커리어·이직', '경력기술서는 성과가 아니라 판단을 쓴다'],
  ['2026년 6월', '06. 30', '디자인', '접근성을 기본값으로 만드는 컴포넌트 설계'],
  ['2026년 6월', '06. 26', 'AI로 일하기', '회의록을 자동화했더니 생긴 부작용'],
  ['2026년 6월', '06. 19', '디자인', '좋은 empty state가 리텐션을 바꾼다'],
  ['2026년 5월', '05. 28', '커리어·이직', '레퍼런스 체크는 이미 시작됐다'],
  ['2026년 5월', '05. 21', '디자인', '디자인 부채를 갚는 스프린트 만들기'],
  ['2026년 4월', '04. 30', 'AI로 일하기', '자동화하면 안 되는 일 구분하기'],
  ['2026년 4월', '04. 15', '디자인', '컴포넌트는 언제 쪼개야 하는가'],
  ['2026년 3월', '03. 27', '커리어·이직', '연차보다 오래 남는 커리어 서사'],
  ['2026년 3월', '03. 12', '디자인', '모션은 장식이 아니라 안내다'],
  ['2026년 2월', '02. 26', '디자인', '첫 주에 만든 디자인 원칙 세 줄'],
  ['2026년 1월', '01. 15', '커리어·이직', '연초 목표를 분기로 쪼개는 법'],
  ['2025년 12월', '12. 18', 'AI로 일하기', '프롬프트보다 중요한 건 데이터 정리'],
  ['2025년 12월', '12. 04', '디자인', '한 해 디자인 회고를 쓰는 다섯 질문'],
  ['2025년 11월', '11. 20', '커리어·이직', '이력서에서 성과를 숫자로 만드는 법'],
  ['2025년 11월', '11. 06', '디자인', '접근성은 마지막에 붙이는 게 아니다'],
  ['2025년 10월', '10. 23', 'AI로 일하기', '반복 업무를 워크플로로 바꾸기'],
  ['2025년 10월', '10. 09', '디자인', '리뷰에서 방어하지 않고 설명하기'],
].map(([month, date, topic, title]) => ({ month, date, topic, title }));

/* 이번 주 발행 5편 — read 가 true 면 발행 당일에 읽어 이미 소장한 것이다. */
const THIS_WEEK = [
  { date: '08. 08 금', topic: '디자인', title: '핸드오프 문서를 줄이는 다섯 가지 습관', read: false },
  { date: '08. 07 목', topic: '디자인', title: '디자인 시스템을 팀에 정착시키는 6개월', read: true },
  { date: '08. 06 수', topic: '커리어·이직', title: '이직 오퍼를 비교하는 세 가지 기준', read: true },
  { date: '08. 05 화', topic: 'AI로 일하기', title: '요약을 믿지 말고 근거를 남겨라', read: false },
  { date: '08. 04 월', topic: '디자인', title: '리서치 없이 만든 화면이 실패하는 이유', read: false },
];

export async function getProfile() { return PROFILE; }
export async function getTopics() { return TOPICS; }
export async function getArchive() { return ARCHIVE; }
export async function getThisWeek() { return THIS_WEEK; }

/* ── 선택값 (localStorage 목) ─────────────────────────────── */

/** topic: 주제명 · sunday: {date, title} 이번 주 일요일에 연 아티클 (title 은 서버가 받을 값이다) */
export function readPrefs() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    return {
      topic: typeof s.topic === 'string' ? s.topic : null,
      sunday: s.sunday && typeof s.sunday.date === 'string' ? s.sunday : null,
    };
  } catch {
    return { topic: null, sunday: null };   // 사파리 프라이빗 모드 등 — 읽기 실패로 화면이 깨지면 안 된다
  }
}

/* 저장 실패는 삼키지 않는다 — 여기서 던져야 호출한 화면이 「저장됐다」고 넘어가지 않는다.
   (조용히 넘어가면 06 에서 열람 기회를 쓴 사람의 01 배너가 다시 「열람 가능」으로 돌아간다) */
function writePrefs(patch) {
  const next = { ...readPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function saveTopic(name) { return writePrefs({ topic: name }); }

/* ── 일요일 추가 열람 ─────────────────────────────────────── */

/** 한국 시간 기준 오늘 — { date: 'YYYY-MM-DD', sunday: boolean }. 기기 시간대와 무관하게 서울 요일로 판정한다. */
export function kstToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, sunday: get('weekday') === 'Sun' };
}

/**
 * 01 배너 상태 — 'open'(일요일·아직 안 씀) | 'done'(일요일·이번 주 씀) | 'locked'(평일).
 * "이번 주에 썼다" 는 곧 "오늘(일요일)에 썼다" 다 — 열람은 일요일에만 열리므로 날짜 하나로 족하다.
 */
export function sundayState() {
  const today = kstToday();
  if (!today.sunday) return 'locked';
  const used = readPrefs().sunday;
  return used && used.date === today.date ? 'done' : 'open';
}

export async function markSundayUsed(title) {
  return writePrefs({ sunday: { date: kstToday().date, title } });
}
