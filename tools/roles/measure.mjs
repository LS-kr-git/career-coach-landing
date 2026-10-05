#!/usr/bin/env node
/**
 * 직무별 공고 볼륨 실측 → tools/roles/volume.json
 *
 *   node tools/roles/measure.mjs [--days 30] [--out tools/roles/volume.json]
 *
 * 왜 필요한가
 *   온보딩·마이페이지 직무 목록의 **순서**를 감으로 정하지 않기 위해서다(2026-10-05 부터 숨김은 없다).
 *   판단 지표는 재고(open)가 아니라 **유입(new30)** 이다. 구독자가 체감하는 건
 *   "이번 주에 새로 뜬 게 있나" 지 "지금 몇 개가 열려 있나" 가 아니다.
 *
 * ⚠️ 컨테이너에서는 못 돈다 — api.zighang.com 을 프록시가 403 으로 막는다.
 *    브라우저(Claude in Chrome)의 javascript_tool 이나 로컬 노드에서 돌린다.
 *
 * ⚠️ 출처를 '민간 플랫폼' 으로 좁힌다.
 *    (2026-08-04 실측) 직행 전체 112,870건 중 81,265건(72%)이 고용24였다. 2026-10-05 에는 전체 434,925건 중 고용24 98,249건. 지역 중소 생산·의료·서비스직이
 *    대부분이라 우리 브리핑 대상이 아니고, 포함하면 순위가 완전히 뒤집힌다
 *    (전체 기준 1·2위가 생산·기능 24,535 / 의료·보건 21,701 이 된다).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const API = 'https://api.zighang.com/api/recruitments/v3';

/** 셀 출처 — 2026-10-05 사용자 확정(안 A): 08-07 정의와 **이름이 같은 것만**.
 *  직행이 2026-10 에 출처 값을 바꿨다. V1·리크루터_V1·리크루터_V2·그리팅·나인하이어 는 이제 오류(GLOBAL-301, HTTP 는 200)를 내고
 *  '직행' 하나로 묶였다. 새로 생긴 출처(잡코리아·인크루트·리멤버 …)와 공공 출처는 세지 않는다.
 *  ⚠️ 값을 화면 필터 라벨로 짐작하지 말 것 — 하나라도 틀리면 API 가 HTTP 200 에 data:null 을 준다(아래 total 이 던진다).
 *  근거: career-coach `docs/claude/아카이브/실측/실측-2026-10-05-직군-볼륨-*.md` */
const PRIVATE = [
  '직행', '원티드', '그룹바이', '랠릿', '로켓펀치', '아이브릭', '유엔리쿠르터',
  '아이원잡', '대한상공회의소', '금융투자협회', '여신금융협회', '한국관세사회',
  '한국공인회계사회', '한국보험계리사회', '한국상담학회', '한국벤처캐피탈협회',
];
const PRIV_Q = PRIVATE.map((v) => 'affiliates=' + encodeURIComponent(v)).join('&');

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const DAYS = Number(arg('--days', 30));
const OUT = join(ROOT, arg('--out', 'tools/roles/volume.json'));

const now = new Date();
const since = new Date(now.getTime() - DAYS * 864e5).toISOString().slice(0, 10) + 'T00:00:00';

const total = async (q) => {
  const r = await fetch(`${API}?page=0&size=1&${q}`);
  if (!r.ok) throw new Error(`${r.status} ${q}`);
  const n = (await r.json())?.data?.totalElements;
  // -1 로 적어 두면 build.mjs 가 그 직군을 「0건」처럼 맨 뒤로 보낸다 — 조용히 넘기지 않는다.
  if (typeof n !== 'number') throw new Error(`totalElements 없음 ${q}`);
  return n;
};
/** 동시 8개 — 더 올리면 직행 쪽에 부담이 된다 */
const mapLimit = async (items, fn, limit = 8) => {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
};

const tax = JSON.parse(readFileSync(join(HERE, 'taxonomy.json'), 'utf8'));
const d1 = tax.groups.map((g) => g.code);
// children 은 객체다. 예전엔 ["코드","표기"] 배열이라 [c] 로 코드를 꺼냈는데,
// label/sourceLabel 을 분리하면서 객체로 바뀔 때 build.mjs 만 따라가고 여기가 남았다.
const d2 = tax.groups.flatMap((g) => g.children.map((c) => [g.code, c.code]));

const measure = (param) => async (code) => ({
  open: await total(`${PRIV_Q}&${param}=${encodeURIComponent(code)}`),
  new30: await total(`${PRIV_Q}&${param}=${encodeURIComponent(code)}&startDate=${since}`),
});

const d1res = await mapLimit(d1, measure('depthOnes'));
const d2res = await mapLimit(d2.map(([, c]) => c), measure('depthTwos'));

const depthTwo = {};
d2.forEach(([g, c], i) => { (depthTwo[g] ||= {})[c] = d2res[i]; });

writeFileSync(OUT, JSON.stringify({
  _설명: '직무별 공고 볼륨 실측. 온보딩에서 무엇을 보여줄지 정하는 근거다.',
  _측정일: now.toISOString().slice(0, 10),
  _대상: `08-07 정의와 이름이 같은 출처만 (2026-10-05 안 A) — ${PRIVATE.join(' · ')}`,
  _지표: { open: '현재 열려 있는 공고 수 (재고)', new30: `최근 ${DAYS}일 신규 공고 수 (유입). 주당 = new30 / ${(DAYS / 7).toFixed(1)}` },
  depthOne: Object.fromEntries(d1.map((c, i) => [c, d1res[i]])),
  depthTwo,
}, null, 2) + '\n');

const flat = Object.values(depthTwo).flatMap((o) => Object.values(o));
console.log(`✅ ${OUT}\n   대분류 ${d1.length} · 중분류 ${flat.length} · 신규 0건 ${flat.filter((v) => v.new30 === 0).length}개`);
