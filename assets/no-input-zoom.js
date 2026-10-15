/* 입력칸(16px 미만 글자)을 누를 때 iOS 가 화면을 확대한다. maximum-scale=1 을 주면 그 확대만 멈추고,
   iOS 는 그래도 손가락 확대를 허용한다. 안드로이드는 입력칸 확대가 없고, 걸면 손가락 확대까지 막히므로 iOS 에만 건다. */
if (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  const m = document.querySelector('meta[name=viewport]');
  if (m && !/maximum-scale/.test(m.content)) m.content += ', maximum-scale=1.0';
}
