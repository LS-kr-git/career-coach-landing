/* 스켈레톤 막대 마크업 — 모양은 assets/skeleton.css. 화면마다 막대를 손으로 짜지 않게 한 곳에 둔다. */
export function 막대(w, h, r) {
  return `<span class="cc-bar" aria-hidden="true" style="width:${w};height:${h}px${r ? ';border-radius:' + r : ''}"></span>`;
}

/** el 의 내용을 막대 하나로 바꾼다(글자 자리). 실패 표시(.fail)는 뗀다 — 실패는 하단 안내가 말한다. */
export function 막대로(el, w, h) {
  if (!el) return;
  el.classList.remove('fail');
  el.innerHTML = 막대(w, h);
}
