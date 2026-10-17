const EXPERTS=[["개발", "김○○", "현 네이버 백엔드 개발자 · 12년차"], ["UI·UX 디자인", "박○○", "현 토스 프로덕트 디자이너 · 8년차"], ["디자인", "배○○", "현 제일기획 아트디렉터 · 11년차"], ["마케팅·그로스", "이○○", "현 우아한형제들 그로스 마케터 · 11년차"], ["프로덕트·전략", "윤○○", "현 쿠팡 프로덕트 매니저 · 10년차"], ["세일즈·GTM", "장○○", "현 세일즈포스 코리아 영업 리드 · 12년차"], ["제조·R&D", "오○○", "현 삼성전자 공정 엔지니어 · 14년차"], ["재무·회계", "서○○", "현 삼일PwC 회계사 · 11년차"], ["조직·피플", "최○○", "현 삼성전자 인사 담당 · 10년차"], ["커머스·리테일", "신○○", "현 무신사 MD · 9년차"], ["물류·공급망", "권○○", "현 CJ대한통운 SCM 매니저 · 13년차"], ["법률·규제", "황○○", "현 김앤장 변호사 · 10년차"], ["금융·마켓", "정○○", "현 미래에셋 애널리스트 · 6년차"], ["미디어·콘텐츠", "안○○", "현 CJ ENM PD · 11년차"], ["고객경험·CX", "송○○", "현 카카오 CX 리드 · 9년차"], ["의료·헬스케어", "류○○", "현 서울아산병원 의료정보팀 · 12년차"], ["건설", "전○○", "현 현대건설 현장 엔지니어 · 13년차"], ["공간", "노○○", "현 현대백화점 공간 디자이너 · 9년차"], ["게임", "한○○", "현 넥슨 사업 PM · 11년차"]];
const REVIEWS=[["김○근님", "마케터", 5, "출근길에 간단하게 한번 보면 되니까 마음이 편합니다"], ["이○현님", "개발자", 5, "뉴스레터는 잘 안 보게 됐었는데 카톡으로 오니까 자연스럽게 보게 돼요"], ["박○은님", "디자이너", 4, "내가 트렌드를 잘 따라가고 있나 불안했었는데 적어도 그런 불안은 확실히 줄어든듯"], ["정○우님", "인사담당", 5, "생각보다 좋은 글들이 많아서 직장에서 추천했습니다."], ["최○진님", "취업 준비", 4, "취준생 커뮤니티에서 보고 구독했는데 면접 준비에 생각보다 도움 많이 되네요"], ["윤○서님", "PM", 5, "채용공고 브리핑 매주 받으니까 채용사이트 뒤지는 부담 줄어들어서 좋아요"]];
const $=id=>document.getElementById(id);
// 금액은 가격 블록 마크업(#ps·#ppr)이 정본 — page-audit 요금 대조가 그 마크업을 서버 plan 과 맞댄다.
const won=id=>+$(id).textContent.replace(/\D/g,"");
// 시안은 폰 안 .screen 이 스크롤했다. 실제 페이지는 문서가 스크롤하므로 기준 사각형은 뷰포트다.
const VIEW=()=>({top:0,bottom:innerHeight,height:innerHeight});
function fitLine(el,min){el.style.fontSize="";const cs=getComputedStyle(el),room=el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),r=document.createRange(),need=()=>(r.selectNodeContents(el),r.getBoundingClientRect().width);let f=parseFloat(cs.fontSize);while(need()>room+0.5&&f>min){f-=0.5;el.style.fontSize=f+"px"}}   // 글자 폭을 안쪽 여백까지 빼고 잰다 — .t 가 넘친 글자를 잘라 scrollWidth 로는 안 보였다(2026-10-15)
const stars=n=>"★".repeat(n)+"<i>"+"★".repeat(5-n)+"</i>";
const expHTML=EXPERTS.map((e,i)=>`<div class="expert uni"><span class="tag">${e[0]}</span><div><div class="nm">${e[1]}</div><div class="cv">${e[2]}</div></div></div>`).join("");$("experts").innerHTML=expHTML;
const RVC=["#D89628", "#299BCE", "#3E6CD2", "#DD7832", "#697586", "#25A47A"];let rvi=0;const rvCard=r=>`<div class="rv"><div class="rh"><span class="rp"><i style="background:${RVC[(rvi++)%6]}"><svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="7" fill="#fff" fill-opacity=".92"/><path d="M6 38c1.5-8 7.2-12 14-12s12.5 4 14 12z" fill="#fff" fill-opacity=".92"/></svg></i>${r[0]} · ${r[1]}</span><span class="stars">${stars(r[2])}</span></div><p>${r[3]}</p></div>`;
const rvPages=[];for(let i=0;i<REVIEWS.length;i+=3)rvPages.push(REVIEWS.slice(i,i+3));
const rvSet=rvPages.map(pg=>`<div class="rpg">${pg.map(rvCard).join("")}</div>`).join("");$("reviews").innerHTML=rvSet;


document.querySelectorAll(".chips,.hs,#reviews").forEach(el=>{
 const vert=el.matches(".exp,#reviews,.chips");
 let target=null,raf=0;
 const step=()=>{const d=target-el.scrollLeft;if(Math.abs(d)<0.5){el.scrollLeft=target;target=null;raf=0;return}el.scrollLeft+=d*0.18;raf=requestAnimationFrame(step)};
 el.addEventListener("wheel",e=>{if(vert)return;const max=el.scrollWidth-el.clientWidth;if(max<=0||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;const base=target==null?el.scrollLeft:target;const nx=Math.max(0,Math.min(max,base+e.deltaY));if(nx===base&&(nx===0||nx===max))return;e.preventDefault();target=nx;if(!raf)raf=requestAnimationFrame(step)},{passive:false});
 let down=false,sx=0,sl=0,moved=false;
 el.addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse"||e.button!==0)return;down=true;moved=false;sx=e.clientX;sl=el.scrollLeft;target=null});
 window.addEventListener("pointermove",e=>{if(!down)return;const dx=e.clientX-sx;if(Math.abs(dx)>8){moved=true;el.classList.add("drag")}if(moved)el.scrollLeft=sl-dx});
 window.addEventListener("pointercancel",()=>{down=false;el.classList.remove("drag")});
 window.addEventListener("pointerup",()=>{if(down&&moved&&el.id==="reviews"){const w=el.children[1]?el.children[1].offsetLeft-el.children[0].offsetLeft:el.clientWidth,cur=Math.round(sl/w),dir=el.scrollLeft>sl+30?1:el.scrollLeft<sl-30?-1:0,ix=Math.max(0,Math.min(el.children.length-1,cur+dir));el.classList.remove("drag");el.scrollTo({left:ix*w,behavior:"smooth"})}down=false;el.classList.remove("drag")});
 el.addEventListener("click",e=>{if(moved){e.stopImmediatePropagation();e.preventDefault();moved=false}},true);
});
document.querySelectorAll(".fit").forEach(el=>{el.style.whiteSpace="nowrap";el.style.overflow="hidden";fitLine(el,11)});
// 슬롯머신: 화면에 들어올 때마다 자리마다 0~9 띠가 굴러가 멈춘다
document.querySelectorAll(".slot").forEach(sl=>{const txt=sl.dataset.n;
 sl.innerHTML=[...txt].map(ch=>/\d/.test(ch)?`<span class="d" aria-hidden="true"><i>${[...Array(30).keys()].map(n=>n%10).concat([+ch]).join("<br>")}</i></span>`:`<span aria-hidden="true">${ch}</span>`).join("");
 const ds=[...sl.querySelectorAll(".d i")];
 const roll=on=>ds.forEach((i,idx)=>{i.style.transitionDuration=on?(1.4+idx*0.22)+"s":"0s";i.style.transform=on?`translateY(-${30*1.25}em)`:"translateY(0)"});
 new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){roll(false);requestAnimationFrame(()=>requestAnimationFrame(()=>roll(true)))}}),{root:null,threshold:.6}).observe(sl)});
// 바닥 버튼: 늘 같은 자리(하단에서 띄운 채)에 고정. 마지막 섹션에서는 배경만 바뀐다(글자는 그대로)
(()=>{const st=$("sticky");
 new IntersectionObserver(es=>es.forEach(en=>st.classList.toggle("ride",en.isIntersecting)),{root:null,threshold:.35}).observe($("closing"));})();

let rxT=0,rxSeen=false,rxN=0;const rxRoll=t=>{const el=$("rx"),n=++rxN;el.innerHTML=[...t].map(ch=>/\d/.test(ch)?`<span class="d"><i>${[...Array(20).keys()].map(n=>n%10).concat([+ch]).map(n=>`<b>${n}</b>`).join("")}</i></span>`:`<span class="c">${ch}</span>`).join("");const is=[...el.querySelectorAll(".d i")];el.querySelectorAll(".d").forEach((d,k)=>{const m=document.createElement("span");m.className="c";m.style.visibility="hidden";m.style.position="absolute";m.textContent=[...t].filter(c=>/\d/.test(c))[k];el.appendChild(m);d.style.width=m.getBoundingClientRect().width+"px";m.remove()});requestAnimationFrame(()=>requestAnimationFrame(()=>is.forEach((x,k)=>{x.style.transitionDuration=(.9+k*.18)+"s";x.style.transform="translateY(-"+(2000/21)+"%)"})));setTimeout(()=>{if(n===rxN)el.textContent=t},(.9+(is.length-1)*.18)*1000+120)};
const rxSet=t=>{$("rx").dataset.t=t;clearTimeout(rxT);if(!rxSeen){$("rx").textContent=t;return}rxT=setTimeout(()=>rxRoll(t),220)};
new IntersectionObserver(es=>{if(es[0].isIntersecting){rxSeen=true}},{root:null,threshold:.8}).observe($("rx"));

(()=>{const SUB=won("ppr")/1e4,f=n=>(Math.round(n*10)/10).toLocaleString("ko-KR")+"만원";
 const set=v=>{v=Math.max(1000,Math.min(10000,+v||0));const p1=v*.03,p2=v*.04,mx=Math.max(p2,SUB);
  document.querySelectorAll("#sal .sv").forEach(i=>{if(document.activeElement!==i)i.value=v});
  document.querySelectorAll("#sal .pc button").forEach(b=>b.classList.toggle("on",+b.dataset.s===v));
  document.querySelector("#sal .sd").textContent=v.toLocaleString("ko-KR")+"만원";
  [[SUB,0],[p1,1],[p2,2]].forEach(([x,k])=>{$("h"+k).style.height=Math.max(3,x/mx*100)+"%";$("b"+k).textContent=(k?"+":"")+f(x)});
  const r=p1/SUB;rxSet((r>=10?Math.round(r):Math.round(r*10)/10)+"배+")};
 document.querySelectorAll("#sal .sv").forEach(i=>i.addEventListener("input",()=>{if(i.value!=="")set(i.value)}));
 document.querySelector("#sal .pc").addEventListener("click",e=>{const b=e.target.closest("button");if(b)set(b.dataset.s)});
 set(5000)})();
// 첫 카톡까지 — 결제 화면 시계와 같은 자(firstSendDay: 영업일·공휴일·서울 시각 08:00)로 센다. 기기 시간대·주말을 따로 세지 않는다(2026-10-15).
// 이 파일은 모듈이 아니라 동적 import 로 받는다. 못 받으면 마크업의 「--:--:--」 그대로 둔다 — 틀린 시각을 세지 않는다.
import("/assets/mypage-data.js").then(({firstSendDay})=>{const el=$("cdv");let last="";const tick=()=>{const n=new Date(),t=new Date(Date.parse(firstSendDay(n)+"T08:00:00+09:00"));const d=Math.floor((t-n)/1000),p=x=>String(x).padStart(2,"0");const v=$("ck").dataset.v,ms=(t-n)%1000,fr=v==="2"?`.${Math.floor(ms/100)}`:v==="3"||v==="4"?`.${String(Math.floor(ms/10)).padStart(2,"0")}`:v==="5"?`.${String(ms).padStart(3,"0")}`:"";const h=`<span>${p(Math.floor(d/3600))}</span>:<span>${p(Math.floor(d%3600/60))}</span>:<span>${p(d%60)}</span>`+(fr?`<i class="cfr${v==="4"?" big":""}">${fr}</i>`:"");if(h!==last){el.innerHTML=h;last=h}};const loop=()=>{tick();requestAnimationFrame(loop)};loop()});   // 실패는 삼키지 않는다 — track.js 의 오류 보고가 받는다 · 글자가 바뀔 때만 쓴다(매 프레임 innerHTML 을 갈면 프레임마다 스타일 재계산이 돈다 — 2026-10-15 실측)
(()=>{const sal=$("sal"),rg=sal.querySelector('input[type=range]');let demo=0;
 const fill=()=>rg.style.setProperty("--fill",((rg.value-rg.min)/(rg.max-rg.min)*100)+"%");rg.addEventListener("input",fill);fill();
 const run=()=>{if(sal.dataset.v!=="7")return;let t=0;clearInterval(demo);demo=setInterval(()=>{t+=1;const v=Math.round(4000+3000*Math.sin(t/12*Math.PI));rg.value=v;rg.dispatchEvent(new Event("input"));if(t>=24){clearInterval(demo);rg.value=4000;rg.dispatchEvent(new Event("input"))}},70)};
 rg.addEventListener("pointerdown",()=>clearInterval(demo));
 new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting)run()}),{root:null,threshold:.6}).observe(rg)})();

document.querySelectorAll(".arw").forEach(w=>{const c=w.querySelector(".chips,.hs,.rvp");
 const upd=()=>{const max=c.scrollWidth-c.clientWidth;w.classList.toggle("atS",c.scrollLeft<=2);w.classList.toggle("atE",c.scrollLeft>=max-2);w.classList.toggle("end",c.scrollLeft>=max-2)};c.addEventListener("scroll",upd,{passive:true});upd();
 const st=+(w.dataset.step||.85),go=d=>c.scrollTo({left:Math.max(0,Math.min(c.scrollWidth-c.clientWidth,c.scrollLeft+d*c.clientWidth*st)),behavior:"smooth"});
 w.querySelector(".cnx").addEventListener("click",()=>go(1));w.querySelector(".cpv").addEventListener("click",()=>go(-1));
 c.addEventListener("click",e=>{if(e.target.closest(".chip"))w.classList.add("used")})});


(()=>{const top=document.querySelector(".top");let last=0;
 window.addEventListener("scroll",()=>{const y=scrollY,d=y-last;if(y<60)top.classList.remove("hid");else if(d>4)top.classList.add("hid");else if(d<-4)top.classList.remove("hid");last=y},{passive:true});})();

(()=>{const g=$("yg");g.innerHTML="<i></i>".repeat(250);const cells=[...g.children],n=$("ycn");let t=0,run=false;
 const play=()=>{clearInterval(t);cells.forEach(c=>c.classList.remove("on"));n.textContent=250;let i=0;t=setInterval(()=>{for(let k=0;k<6&&i<250;k++,i++)cells[i].classList.add("on");if(i>=250)clearInterval(t)},19)};
 new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting&&!run){run=true;play()}else if(!e.isIntersecting&&e.intersectionRatio===0){run=false}})},{root:null,threshold:[0,.6]}).observe(g)})();




new IntersectionObserver(es=>es.forEach(e=>{const w=$("stw");if(e.isIntersecting){window.stwFit&&stwFit();w.classList.remove("go");void w.offsetWidth;w.classList.add("go")}}),{root:null,threshold:.6}).observe($("stw"));

(()=>{const w=$("rvw");w.querySelectorAll(".rv").forEach((c,k)=>c.style.setProperty("--dl",(k*.38)+"s"));
 const replay=()=>{w.classList.remove("in");void w.offsetWidth;setTimeout(()=>w.classList.add("in"),60)};
 let seen=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.3&&!seen){seen=true;replay()}else if(e.intersectionRatio===0){seen=false;w.classList.remove("in")}}),{root:null,threshold:[0,.3]}).observe(w);})();

(()=>{document.querySelectorAll(".trust .slot").forEach(sl=>{let vis=false;const ds=[...sl.querySelectorAll(".d i")];
 const roll=on=>ds.forEach((i,idx)=>{i.style.transitionDuration=on?(.7+idx*.1)+"s":"0s";i.style.transform=on?`translateY(-${30*1.25}em)`:"translateY(0)"});
 const chk=()=>{const r=sl.getBoundingClientRect(),q=VIEW();const v=r.top<q.bottom-60&&r.bottom>q.top+60;if(v&&!vis){vis=true;roll(false);requestAnimationFrame(()=>requestAnimationFrame(()=>roll(true)))}else if(!v&&vis){vis=false;roll(false)}};
 addEventListener("scroll",chk,{passive:true});chk()})})();



(()=>{const els=[...document.querySelectorAll("#fv .scene")];const chk=()=>{const q=VIEW();els.forEach(el=>{const r=el.getBoundingClientRect();if(r.top<q.top+q.height*.68&&r.bottom>q.top)el.classList.add("in");else if(r.bottom<q.top||r.top>q.bottom)el.classList.remove("in")})};addEventListener("scroll",chk,{passive:true});chk();})();

(()=>{const n=$("nph"),h=$("coh");document.querySelectorAll("#names>div").forEach((d,k)=>{d.style.setProperty("--k",k);d.querySelector(".who").style.setProperty("--wd",(k*.35)+"s")});
 new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.4){n.classList.add("in");h.classList.add("in")}else if(e.intersectionRatio===0){n.classList.remove("in");h.classList.remove("in")}}),{root:null,threshold:[0,.4]}).observe(n);})();

(()=>{const t=$("thusec"),pm=t.querySelector(".pm");new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.3){if(!t.classList.contains("play"))t.classList.add("play")}else if(e.intersectionRatio===0)t.classList.remove("play")}),{root:null,threshold:[0,.3]}).observe(pm)})();

(()=>{const k=$("k2");const play=()=>{k.classList.remove("play");void k.offsetWidth;k.classList.add("play")};
 let seen=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.6&&!seen){seen=true;play()}else if(e.intersectionRatio===0){seen=false;k.classList.remove("play")}}),{root:null,threshold:[0,.6]}).observe(k);})();

(()=>{const w=$("stw"),is=w.querySelectorAll(".s0 i"),l=is[4];const f=()=>{const x=l.offsetLeft+l.offsetWidth*0.62;w.style.setProperty("--sw",x+"px")};f();window.stwFit=f;document.fonts&&document.fonts.ready.then(f);window.addEventListener("resize",f)})();

(()=>{const w=$("expw"),c=$("experts");[...c.children].forEach((e,k)=>e.style.setProperty("--ed",(Math.floor(k/3)*.18+(k%3)*.08)+"s"));
 const play=()=>{w.classList.remove("in");void w.offsetWidth;setTimeout(()=>{w.classList.add("in");if($("ea").dataset.v==="5"){c.scrollLeft=0;setTimeout(()=>{c.scrollTo({left:c.scrollWidth-c.clientWidth,behavior:"smooth"});setTimeout(()=>c.scrollTo({left:0,behavior:"smooth"}),2200)},300)}},60)};
 let seen=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.4&&!seen){seen=true;play()}else if(e.intersectionRatio===0){seen=false;w.classList.remove("in")}}),{root:null,threshold:[0,.4]}).observe(w);})();

(()=>{const sec=$("artsec");[...sec.querySelectorAll("#pmart .art>*")].forEach((e,k)=>e.style.setProperty("--ad",(.3+k*.2)+"s"));
 const play=()=>{sec.classList.remove("in");void sec.offsetWidth;setTimeout(()=>sec.classList.add("in"),60)};
 let seen=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.3&&!seen){seen=true;play()}else if(e.intersectionRatio===0){seen=false;sec.classList.remove("in")}}),{root:null,threshold:[0,.3]}).observe($("pmart"));})();

(()=>{const g=$("rg"),n=$("r6n");let t=0;const play=()=>{g.classList.remove("in");void g.offsetWidth;clearInterval(t);n.textContent="x 6배";setTimeout(()=>{g.classList.add("in");if($("va").dataset.v==="3"){let x=1;n.textContent="1배";t=setInterval(()=>{x++;n.textContent=x+"배";if(x>=6)clearInterval(t)},160)}},60)};
 let seen=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.5&&!seen){seen=true;play()}else if(e.intersectionRatio===0){seen=false;g.classList.remove("in")}}),{root:null,threshold:[0,.5]}).observe(g);})();


(()=>{const sec=$("pricing"),pr=$("ppr"),FROM=won("ps"),TO=won("ppr");let t=0;const play=()=>{sec.classList.remove("in");void sec.offsetWidth;clearInterval(t);pr.textContent=TO.toLocaleString("ko-KR")+"원";setTimeout(()=>{sec.classList.add("in");if($("pa").dataset.v==="4"){const t0=performance.now();t=setInterval(()=>{const k=Math.min(1,(performance.now()-t0)/1000),v=Math.round(FROM-(FROM-TO)*(1-Math.pow(1-k,3)));pr.textContent=v.toLocaleString("ko-KR")+"원";if(k>=1)clearInterval(t)},30)}},60)};
 let seen=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.3&&!seen){seen=true;play()}else if(e.intersectionRatio===0){seen=false;sec.classList.remove("in")}}),{root:null,threshold:[0,.3]}).observe(sec.querySelector(".plan.best"));})();

(()=>{const r=document.getElementById("reviews");let done=false,stop=false,raf=0;
 const halt=()=>{if(stop)return;stop=true;cancelAnimationFrame(raf);r.classList.remove("rvflow")};let tx=0,ty=0;
 r.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse")halt()});
 r.addEventListener("wheel",e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY))halt()},{passive:true});
 r.addEventListener("touchstart",e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});
 r.addEventListener("touchmove",e=>{const dx=Math.abs(e.touches[0].clientX-tx),dy=Math.abs(e.touches[0].clientY-ty);if(dx>8&&dx>dy)halt()},{passive:true});
 const go=()=>{done=true;const to=r.scrollWidth-r.clientWidth,from=r.scrollLeft,dur=11000;let t0=0;r.classList.add("rvflow");
  const step=ts=>{if(stop)return;t0=t0||ts;const k=Math.min(1,(ts-t0)/dur),e=k;r.scrollLeft=from+(to-from)*e;if(k<1)raf=requestAnimationFrame(step);else r.classList.remove("rvflow")};raf=requestAnimationFrame(step)};
 new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.2&&!done&&!stop)go()}),{root:null,rootMargin:"0px 0px -90px 0px",threshold:[0,.2]}).observe(r);
 new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting&&done){cancelAnimationFrame(raf);r.classList.add("rvflow");r.scrollLeft=0;r.classList.remove("rvflow");done=false;stop=false}}),{root:null,threshold:0}).observe(r)})();
(()=>{const t=$("tvx");new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.35)t.classList.add("play");else if(!e.isIntersecting)t.classList.remove("play")}),{root:null,threshold:[0,.35]}).observe(t)})();
(()=>{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.9)e.target.classList.add("on");else if(!e.isIntersecting)e.target.classList.remove("on")}),{root:null,rootMargin:"0px 0px -90px 0px",threshold:[0,.9]});document.querySelectorAll(".draw").forEach(x=>io.observe(x));})();
/* 맨 위에서 더 당긴 자리 = 흰 머리줄 색 (2026-10-15 사용자 지시) — 공용 assets/overscroll-top.js 를 붙인다.
   맨 아래는 html·body 바탕(--g100, footer 와 같은 색) 그대로. */
document.documentElement.style.setProperty("--overscroll-top", "#fff");
document.body.appendChild(document.createElement("script")).src = "/assets/overscroll-top.js";
