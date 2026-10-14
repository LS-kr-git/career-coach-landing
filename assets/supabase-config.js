/**
 * Supabase 접속 정보 — **여기 한 곳에만 둔다.**
 *
 * 왜 파일을 따로 뺐나 (2026-08-06 복구 훈련 결과)
 *   백업을 새 프로젝트로 복원해 봤더니 **프로젝트 ref 가 바뀐다.**
 *   그러면 주소와 키를 쓰는 곳을 전부 갈아야 서비스가 다시 산다.
 *   훈련 전에는 그게 세 파일에 흩어져 있었다
 *   (`assets/track.js`, `auth/callback/index.html`, 그때의 가입 화면).
 *   사고 한가운데서 세 군데를 찾아 고치는 것과 **이 파일 한 줄을 고치는 것**은 다르다.
 *   자세한 것은 career-coach 저장소의 `docs/기획/복구-훈련.md`.
 *
 * 복구할 때 하는 일
 *   아래 두 값을 새 프로젝트 것으로 바꾼다. 그게 전부다.
 *   Supabase 대시보드 → Project Settings → Data API 에 둘 다 있다.
 *
 * ⚠️ 이 값들은 **공개 값이다.** 브라우저에 그대로 내려가고, 그래도 되는 것만 둔다.
 *   · publishable key 는 노출하라고 만든 공개 키다 (secret key 와 다르다)
 *   · 데이터 보호는 키가 아니라 **RLS** 가 한다
 *     — career-coach `supabase/migrations/0002_supabase_auth_rls.sql`
 *   · 그러므로 **service_role key 나 DB 비밀번호는 여기에 절대 넣지 않는다.**
 */

export const SUPABASE_URL = 'https://sxooygwggxeplzkfdbth.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_qKgzeXLu4fX9T_xfEjbNnQ_zPH_xPUu';

/** supabase-js — 판을 고정한다(올릴 때는 일부러 올린다). 랜딩이 이 주소를 미리 받아 두므로 로그인 처리 화면과
 *  온보딩이 **같은 주소**를 써야 미리 받은 것이 쓰인다 — 그래서 여기 한 곳에만 둔다. */
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';

/**
 * 카카오 로그인 입구 — 가입도 로그인도 여기 한 주소다 (2026-10-14 /signup/ 화면 삭제, 사용자 지시).
 * 이용약관·개인정보 동의는 카카오 동의 화면(간편가입 약관 두 개)이 받는다.
 * supabase-js 의 signInWithOAuth 가 만드는 주소와 같다(implicit) — CDN 없이 링크 하나로 넘어가게 직접 쓴다.
 * scopes 는 카카오 콘솔에서 `권한 없음` 이 아닌 것만 적는다 — 하나라도 권한 없는 것이 섞이면 로그인 자체가 실패한다.
 */
export const KAKAO_LOGIN = SUPABASE_URL + '/auth/v1/authorize?' + new URLSearchParams({
  provider: 'kakao',
  redirect_to: 'https://careercoach.my/auth/callback/',
  scopes: 'profile_nickname profile_image account_email name phone_number gender birthday birthyear',
});
