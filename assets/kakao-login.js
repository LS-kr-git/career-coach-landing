/**
 * 휴대폰에서는 카카오 웹 로그인 화면을 건너뛰고 **카카오톡 앱으로 바로** 넘긴다 (2026-10-14 사용자 지시).
 *
 * 지금까지: 버튼 → Supabase → 카카오 **웹** 로그인 화면(아이디·비밀번호 또는 「카카오톡으로 로그인」 한 번 더)
 *          → 동의 → 우리 콜백.
 * 이제:     버튼 → 카카오톡 앱(로그인·동의) → 브라우저로 돌아오면 이 페이지가 스스로 우리 콜백으로 넘어간다.
 *
 * 동작은 카카오 JS SDK 의 `Kakao.Auth.authorize`(간편로그인)다. SDK 가 카카오톡을 열고, 이 페이지는
 * 1초마다 카카오에 「끝났나」를 물어 끝나면 인가 코드를 들고 **Supabase 콜백**으로 간다 — 코드 교환·세션
 * 발급은 지금처럼 Supabase 가 하고, /auth/callback/ 은 그대로다.
 * SDK 에 줄 `state` 는 Supabase 가 만든 것이어야 해서 엣지 함수(career-coach `kakao-start-3bc341t0`)가
 * 대신 받아 준다. 정본 문서는 career-coach `docs/기획/카카오-앱-간편로그인.md`.
 *
 * 🔴 앱 전환은 **누른 그 순간에 동기로** 해야 한다 — 기다렸다 넘기면 iOS 가 사용자 동작으로 안 보고
 *    앱을 안 연다. 그래서 SDK 와 state 를 미리 받아 두고, 준비가 안 됐으면 웹 로그인 주소(a.href)로 그냥 간다.
 *    이 파일의 어느 단계가 죽어도 가입은 지금까지의 웹 로그인으로 이어진다.
 */
import { KAKAO_LOGIN } from '/assets/supabase-config.js';

const JS_KEY = 'b2a5af1cfa45793727755867f2dd53db';   // 공개 값 — 카카오 콘솔 「JavaScript SDK 도메인」에 careercoach.my 만 열려 있다
const START = 'https://sxooygwggxeplzkfdbth.supabase.co/functions/v1/kakao-start-3bc341t0';
const SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
const SDK_SRI = 'sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy';
const FRESH = 4 * 60 * 1000;   // state 를 이만큼 지나면 새로 받는다 — Supabase 쪽 유효 시간보다 넉넉히 짧게

const ua = navigator.userAgent;
// 카톡 안 브라우저는 이미 카카오 로그인 상태라 웹 화면이 한 번에 지나간다. PC 는 앱 전환이 없다.
export const 앱전환 = /Android|iPhone|iPad|iPod/i.test(ua) && !/KAKAOTALK/i.test(ua);

let 재료 = null;   // { state, scope, redirect_uri, at }
let 다시받기 = () => {};

function sdk() {
  if (window.Kakao) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    Object.assign(s, { src: SDK, integrity: SDK_SRI, crossOrigin: 'anonymous', async: true, onload: ok, onerror: no });
    document.head.appendChild(s);
  });
}

async function 받기() {
  const scopes = new URL(KAKAO_LOGIN).searchParams.get('scopes');
  const r = await fetch(START + '?' + new URLSearchParams({ scopes }), { cache: 'no-store' });
  if (!r.ok) throw new Error('kakao_start:http' + r.status);
  재료 = { ...(await r.json()), at: Date.now() };
}

/** 미리 준비한다(앱전환일 때만 부른다 — 랜딩을 열 때, 또는 로그인 여부를 기다리며 누른 때). 실패는 호출자에게 던진다 — 기록은 호출자가 한다. */
// 랜딩은 두 길에서 부른다(처음부터 로그인 전 · 세션이 죽은 걸 늦게 안 때) — 한 번만 준비한다. 실패하면 다음에 다시.
let 준비중 = null;
export function 준비(기록) {
  준비중 ??= (async () => {
    await Promise.all([sdk(), 받기()]);
    if (!window.Kakao.isInitialized()) window.Kakao.init(JS_KEY);
    // 열어 둔 채 오래 있다 누르는 사람을 위해 — 보이는 동안만 다시 받는다.
    setInterval(() => { if (document.visibilityState === 'visible') 받기().catch(기록); }, FRESH);
    다시받기 = () => 받기().catch(기록);
  })().catch((e) => { 준비중 = null; throw e; });
  return 준비중;
}

/** 버튼을 누른 그 자리에서 부른다. 앱으로 넘겼으면 true — 아니면 호출자가 웹 로그인으로 간다. */
export function 앱으로() {
  if (!재료 || Date.now() - 재료.at > FRESH + 60_000 || !window.Kakao?.isInitialized()) return false;
  const { state, scope, redirect_uri } = 재료;
  재료 = null;   // 같은 state 를 두 번 쓰지 않는다 — 다시 누르면 웹 로그인으로 가고, 그 사이 새로 받는다
  // 새로 받는 것은 **돌아왔을 때** 한다. 누른 자리에서 받으면 곧바로 페이지가 카카오로 넘어가며 요청이
  // 끊겨, 앱 전환이 성공할 때마다 「kakao_app:Load failed」 오류가 한 건씩 쌓였다(2026-10-14 실측).
  // 카톡에서 돌아오면 visibilitychange, 카카오 웹 화면에서 「뒤로」면 pageshow(bfcache) — 먼저 오는 하나만.
  // 앱 열기 확인창을 취소하면 화면이 안 바뀌어 둘 다 안 온다 — 3초 뒤에도 보이고 있으면 그때 받는다.
  const 끝 = new AbortController();
  const 돌아옴 = () => {
    if (끝.signal.aborted || document.visibilityState !== 'visible') return;
    끝.abort();
    다시받기();
  };
  document.addEventListener('visibilitychange', 돌아옴, { signal: 끝.signal });
  addEventListener('pageshow', 돌아옴, { signal: 끝.signal });
  setTimeout(돌아옴, 3000);
  window.Kakao.Auth.authorize({ redirectUri: redirect_uri, state, scope, throughTalk: true });
  return true;
}
