/* 덤프 나이 판정 — audit.mjs 와 tree-audit.mjs 가 **같은 값**을 쓰게 한다.
 *
 * 두 파일이 각자 구현하고 있었고, 그래서 판정이 갈렸다(2026-08-20 검사관 지적):
 *   · tree-audit 은 `Number.isFinite(self)`, audit 은 `self ? … : -Infinity` 였다
 *     → dumpedAt 이 0(1970-01-01)으로 파싱되면 audit 만 "자기신고 없음" 으로 샜다
 *   · 45분 한도가 양쪽에 따로 박혀 있어 CC_META_MAX_AGE 가 audit 만 움직였다
 * 관문이 두 벌이면 한쪽만 고쳐지고, 그 사실은 아무 데도 안 찍힌다.
 */
import { statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MAX_AGE_DEFAULT = 45;

/** 한도와 그 출처를 함께 돌려준다. 출처를 출력에 찍어야 관문이 조용히 완화되지 않는다.
 *  problems[] 에는 조치 필요로 올릴 사유가 들어온다(빈 배열이면 정상). */
export function maxAgeMinutes() {
  const env = process.env.CC_META_MAX_AGE;
  if (env === undefined || env === '') {
    return { minutes: MAX_AGE_DEFAULT, source: `기본값 ${MAX_AGE_DEFAULT}분`, problems: [] };
  }
  const v = Number(env);
  if (!Number.isFinite(v) || v <= 0) {
    // 숫자가 아니면 NaN 이라 `ageMin > NaN` 이 항상 거짓 — 관문이 흔적 없이 꺼진다.
    return {
      minutes: MAX_AGE_DEFAULT,
      source: `기본값 ${MAX_AGE_DEFAULT}분 (CC_META_MAX_AGE="${env}" 는 양수가 아니라 무시)`,
      problems: [{ kind: '덤프 한도 설정이 잘못됨', detail: `"${env}" 는 양수가 아닙니다`,
        note: '숫자가 아니면 나이 비교가 전부 거짓이 되어 신선도 관문이 통째로 꺼집니다. 변수를 지우거나 분 단위 양수를 주세요.' }],
    };
  }
  return {
    minutes: v,
    source: `CC_META_MAX_AGE=${v}분`,
    problems: v > MAX_AGE_DEFAULT
      ? [{ kind: '덤프 한도가 완화돼 있음', detail: `${v}분 — 기본값 ${MAX_AGE_DEFAULT}분보다 큽니다`,
          note: '그 사이 피그마가 바뀌어도 통과합니다. 변수를 지우고 덤프를 다시 뽑으세요.' }]
      : [],
  };
}

/** 파일 mtime 과 덤프가 스스로 신고한 dumpedAt 중 **더 낡은 쪽**을 나이로 쓴다.
 *  mtime 만 보면 checkout·cp·touch 가 내용은 그대로 둔 채 시각만 새로 찍는다.
 *  dumpedAt 만 보면 자기 신고값이라 손으로 고칠 수 있다. 둘 다 신선할 때만 신선하다.
 *
 *  🔴 **파일 이름으로 판정하지 않는다 — 내용으로 판정한다.** 이름으로 가르면 양방향으로 틀린다:
 *  훅이 `FIGMA_TREE`·`FIGMA_STYLE` 로 임의 경로를 받으므로, 덤프를 `.json` 이 아닌 이름으로 두면
 *  관문이 조용히 꺼지고, 반대로 메타 XML 을 `.txt` 로 두면 "dumpedAt 이 없다" 는 **사실과 다른**
 *  지적이 뜬다. 그래서 **JSON 으로 파싱되면 자기신고를 담을 수 있는 입력**이고, 안 되면 아니다.
 *  canSelfDate=false 는 그 형식에 시각을 담을 자리가 아예 없다는 뜻이다(메타 XML). */
export function dumpAge(path, parsed) {
  const mtimeMs = statSync(resolve(path)).mtimeMs;
  let j = parsed;
  if (j === undefined) {
    try { j = JSON.parse(readFileSync(resolve(path), 'utf8')); } catch { j = undefined; }
  }
  const canSelfDate = j !== undefined && j !== null && typeof j === 'object';
  let self = null;
  if (canSelfDate) {
    const t = Date.parse(j.dumpedAt);
    if (Number.isFinite(t)) self = t;
  }
  const ages = [(Date.now() - mtimeMs) / 60000];
  if (self !== null) ages.push((Date.now() - self) / 60000);
  return { ageMin: Math.max(...ages), mtimeMs, canSelfDate, selfDated: self !== null };
}
