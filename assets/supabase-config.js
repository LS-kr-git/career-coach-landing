/**
 * Supabase 접속 정보 — **여기 한 곳에만 둔다.**
 *
 * 왜 파일을 따로 뺐나 (2026-08-06 복구 훈련 결과)
 *   백업을 새 프로젝트로 복원해 봤더니 **프로젝트 ref 가 바뀐다.**
 *   그러면 주소와 키를 쓰는 곳을 전부 갈아야 서비스가 다시 산다.
 *   훈련 전에는 그게 세 파일에 흩어져 있었다
 *   (`assets/track.js`, `auth/callback/index.html`, `signup/index.html`).
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
