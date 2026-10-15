const JOBS=[["dev", "개발"], ["uiux", "UI·UX 디자인"], ["mkt", "마케팅·그로스"], ["dsn", "디자인"], ["prd", "프로덕트·전략"], ["sales", "세일즈·GTM"], ["mfg", "제조·R&D"], ["fin", "재무·회계"], ["hr", "조직·피플"], ["com", "커머스·리테일"], ["log", "물류·공급망"], ["law", "법률·규제"], ["money", "금융·마켓"], ["media", "미디어·콘텐츠"], ["cx", "고객경험·CX"], ["med", "의료·헬스케어"], ["build", "건설"], ["space", "공간"], ["game", "게임"]];
const COMMON=[["career", "일 잘하는 법 · 커리어(공통)"]];
const QUIZ={"dev": ["결제 API에서 '멱등성'이 왜 중요할까?", "AI 코딩 도구 시대, 코드 리뷰는 어떻게 바뀔까?", "배포와 출시는 왜 분리해야 할까?", "기술 부채, 언제 갚아야 할까?"], "uiux": ["디자인 토큰은 왜 '의미'로 이름 지을까?", "AI 기능, 신뢰를 얻는 화면은 어떻게 다를까?", "사용성 테스트, 몇 명이면 충분할까?", "첫 화면이 비었을 때 무엇을 둘까?"], "dsn": ["로고보다 브랜드를 먼저 기억시키는 것은?", "생성형 AI 이미지, 브랜드에 쓸 기준은?", "패키지에서 매대 3초가 중요한 이유는?", "글꼴 하나가 브랜드 인상을 바꾸는 이유는?"], "mkt": ["마지막 클릭 기여 모델이 놓치는 것은?", "쿠키 없는 시대, 성과 측정은 어떻게 바뀔까?", "가입자 수보다 먼저 봐야 할 숫자는?", "할인은 왜 브랜드를 갉아먹을까?"], "prd": ["북극성 지표가 하위 지표와 부딪히면?", "AI 기능, 정확도보다 먼저 정할 것은?", "기능 요청, 그대로 만들면 왜 안 될까?", "로드맵에 날짜보다 먼저 적을 것은?"], "sales": ["할인 없이 가격 저항을 넘는 방법은?", "구매 검토에 AI 검색이 끼면 무엇이 바뀔까?", "파이프라인 예측이 자꾸 빗나가는 이유는?", "고객 갱신은 언제부터 준비할까?"], "mfg": ["공정 능력 지수가 낮다는 건 무슨 뜻일까?", "디지털 트윈, 어디부터 쓰면 효과가 클까?", "불량이 반복될 때 먼저 할 일은?", "연구 과제를 멈출 기준은 언제 정할까?"], "fin": ["운전자본이 늘면 왜 현금이 줄어들까?", "결산 자동화, 사람은 무엇에 집중할까?", "이익이 나는데 현금이 부족한 이유는?", "예산 회의에서 먼저 맞출 것은?"], "hr": ["보상 밴드가 없으면 생기는 문제는?", "AI 시대, 채용 평가 기준은 어떻게 바뀔까?", "1on1 의제는 누가 정해야 할까?", "보상 이야기는 언제 꺼내야 할까?"], "com": ["공헌이익으로 봐야 보이는 적자 상품은?", "숏폼 커머스가 상세페이지를 바꾸는 방식은?", "신규 고객보다 먼저 볼 숫자는?", "가격을 올릴 때 놓치기 쉬운 것은?"], "log": ["'채찍 효과'는 왜 생길까?", "물류 자동화, 사람 일은 어디로 옮겨갈까?", "재고를 늘리면 무엇을 잃을까?", "공급처를 하나로 몰면 생기는 위험은?"], "law": ["손해배상 한도 조항이 힘을 잃는 경우는?", "AI 규제가 강해지면 기업이 먼저 할 일은?", "계약서에서 가장 먼저 볼 조항은?", "개인정보, 얼마나 모아야 할까?"], "money": ["장단기 금리가 뒤집히면 무엇을 의심할까?", "기술 투자 붐, 숫자로 가려내는 법은?", "환율이 오르면 누가 웃을까?", "종목을 많이 담으면 분산이 될까?"], "media": ["구독형과 광고형, 기획이 왜 다를까?", "알고리즘이 바뀌어도 살아남는 채널은?", "조회수보다 먼저 볼 숫자는?", "플랫폼 의존을 줄이는 방법은?"], "cx": ["고객 노력 점수가 NPS보다 나을 때는?", "AI 상담원, 어디까지 맡기면 좋을까?", "상담을 줄이는 가장 좋은 방법은?", "챗봇 도입 때 꼭 남겨 둘 것은?"], "med": ["의료 AI의 민감도와 특이도는 무엇이 다를까?", "원격 진료가 넓어지면 병원은 어떻게 바뀔까?", "환자 경험은 어디서 만들어질까?", "헬스 데이터가 안 이어지는 이유는?"], "build": ["주공정선이 밀리면 왜 전체가 늦을까?", "모듈러 건축이 현장을 바꾸는 방식은?", "설계 변경이 늦어지면 무엇이 커질까?", "현장 사고를 줄이는 작은 습관은?"], "space": ["같은 면적이 더 넓어 보이는 동선은?", "하이브리드 근무 시대, 사무실의 역할은?", "매장 입구 3m가 중요한 이유는?", "조명이 체류 시간을 바꾸는 방식은?"], "game": ["게임 속 경제에 인플레이션이 생기는 이유는?", "AI가 게임 개발에 들어오면 무엇이 빨라질까?", "이용자가 가장 많이 떠나는 구간은?", "라이브 게임에서 신뢰를 만드는 것은?"], "career": ["연봉 협상, 먼저 숫자를 말하면 유리할까?", "1on1에서 매니저에게 꼭 물을 것은?", "성과 리뷰 전에 준비할 세 가지는?", "이직 타이밍, 무엇으로 판단할까?"]};
const EXPERTS=[["개발", "김○○", "현 네이버 백엔드 개발자 · 12년차"], ["UI·UX 디자인", "박○○", "현 토스 프로덕트 디자이너 · 8년차"], ["디자인", "배○○", "현 제일기획 아트디렉터 · 11년차"], ["마케팅·그로스", "이○○", "현 우아한형제들 그로스 마케터 · 11년차"], ["프로덕트·전략", "윤○○", "현 쿠팡 프로덕트 매니저 · 10년차"], ["세일즈·GTM", "장○○", "현 세일즈포스 코리아 영업 리드 · 12년차"], ["제조·R&D", "오○○", "현 삼성전자 공정 엔지니어 · 14년차"], ["재무·회계", "서○○", "현 삼일PwC 회계사 · 11년차"], ["조직·피플", "최○○", "현 삼성전자 인사 담당 · 10년차"], ["커머스·리테일", "신○○", "현 무신사 MD · 9년차"], ["물류·공급망", "권○○", "현 CJ대한통운 SCM 매니저 · 13년차"], ["법률·규제", "황○○", "현 김앤장 변호사 · 10년차"], ["금융·마켓", "정○○", "현 미래에셋 애널리스트 · 6년차"], ["미디어·콘텐츠", "안○○", "현 CJ ENM PD · 11년차"], ["고객경험·CX", "송○○", "현 카카오 CX 리드 · 9년차"], ["의료·헬스케어", "류○○", "현 서울아산병원 의료정보팀 · 12년차"], ["건설", "전○○", "현 현대건설 현장 엔지니어 · 13년차"], ["공간", "노○○", "현 현대백화점 공간 디자이너 · 9년차"], ["게임", "한○○", "현 넥슨 사업 PM · 11년차"]];
const REVIEWS=[["김○근님", "마케터", 5, "출근길에 간단하게 한번 보면 되니까 마음이 편합니다"], ["이○현님", "개발자", 5, "뉴스레터는 잘 안 보게 됐었는데 카톡으로 오니까 자연스럽게 보게 돼요"], ["박○은님", "디자이너", 4, "내가 트렌드를 잘 따라가고 있나 불안했었는데 적어도 그런 불안은 확실히 줄어든듯"], ["정○우님", "인사담당", 5, "생각보다 좋은 글들이 많아서 직장에서 추천했습니다."], ["최○진님", "취업 준비", 4, "취준생 커뮤니티에서 보고 구독했는데 면접 준비에 생각보다 도움 많이 되네요"], ["윤○서님", "PM", 5, "채용공고 브리핑 매주 받으니까 채용사이트 뒤지는 부담 줄어들어서 좋아요"]];
const $=id=>document.getElementById(id);
// 금액은 가격 블록 마크업(#ps·#ppr)이 정본 — page-audit 요금 대조가 그 마크업을 서버 plan 과 맞댄다.
const won=id=>+$(id).textContent.replace(/\D/g,"");
// 시안은 폰 안 .screen 이 스크롤했다. 실제 페이지는 문서가 스크롤하므로 기준 사각형은 뷰포트다.
const VIEW=()=>({top:0,bottom:innerHeight,height:innerHeight});
const chipHTML=(list,on)=>list.map(([k,l])=>`<button class="chip${k===on?" on":""}" data-k="${k}">${l}</button>`).join("");
function fitLine(el,min){el.style.fontSize="";const cs=getComputedStyle(el),room=el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),r=document.createRange(),need=()=>(r.selectNodeContents(el),r.getBoundingClientRect().width);let f=parseFloat(cs.fontSize);while(need()>room+0.5&&f>min){f-=0.5;el.style.fontSize=f+"px"}}   // 글자 폭을 안쪽 여백까지 빼고 잰다 — .t 가 넘친 글자를 잘라 scrollWidth 로는 안 보였다(2026-10-15)
function renderQuiz(k){$("quiz").innerHTML=QUIZ[k].map((q,i)=>`<li><span>Q${i+1}</span><span class="t">${q}</span></li>`).join("");const fit=()=>document.querySelectorAll("#quiz li").forEach(li=>fitLine(li,11));fit();document.fonts&&document.fonts.ready.then(fit)}   // Pretendard 가 온 뒤 다시 잰다 — 먼저 재면 기기마다 다른 대체 글꼴 폭으로 줄였다(2026-10-15 사용자 확정 2-가)
const CHIP_ORDER=[...JOBS.map(j=>j[0]==="dev"?JOBS.find(x=>x[0]==="mkt"):j[0]==="mkt"?JOBS.find(x=>x[0]==="dev"):j),...COMMON];
$("quizChips").innerHTML=chipHTML(CHIP_ORDER,"mkt");
const stars=n=>"★".repeat(n)+"<i>"+"★".repeat(5-n)+"</i>";
const expHTML=EXPERTS.map((e,i)=>`<div class="expert uni"><span class="tag">${e[0]}</span><div><div class="nm">${e[1]}</div><div class="cv">${e[2]}</div></div></div>`).join("");$("experts").innerHTML=expHTML;
const RVC=["#D89628", "#299BCE", "#3E6CD2", "#DD7832", "#697586", "#25A47A"];let rvi=0;const rvCard=r=>`<div class="rv"><div class="rh"><span class="rp"><i style="background:${RVC[(rvi++)%6]}"><svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="7" fill="#fff" fill-opacity=".92"/><path d="M6 38c1.5-8 7.2-12 14-12s12.5 4 14 12z" fill="#fff" fill-opacity=".92"/></svg></i>${r[0]} · ${r[1]}</span><span class="stars">${stars(r[2])}</span></div><p>${r[3]}</p></div>`;
const rvPages=[];for(let i=0;i<REVIEWS.length;i+=3)rvPages.push(REVIEWS.slice(i,i+3));
const rvSet=rvPages.map(pg=>`<div class="rpg">${pg.map(rvCard).join("")}</div>`).join("");$("reviews").innerHTML=rvSet;
document.querySelectorAll(".chips").forEach(t=>t.addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;const k=b.dataset.k;document.querySelectorAll(".chips .chip").forEach(x=>x.classList.toggle("on",x.dataset.k===k));renderQuiz(k)}));


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
 const set=v=>{v=Math.max(1000,Math.min(30000,+v||0));const p1=v*.01,p2=v*.02,mx=Math.max(p2,SUB);
  document.querySelectorAll("#sal .sv").forEach(i=>{if(document.activeElement!==i)i.value=v});
  document.querySelectorAll("#sal .pc button").forEach(b=>b.classList.toggle("on",+b.dataset.s===v));
  document.querySelector("#sal .sd").textContent=v.toLocaleString("ko-KR")+"만원";
  [[SUB,0],[p1,1],[p2,2]].forEach(([x,k])=>{$("h"+k).style.height=Math.max(3,x/mx*100)+"%";$("b"+k).textContent=(k?"+":"")+f(x)});
  rxSet(Math.round(p1/SUB)+"배")};
 document.querySelectorAll("#sal .sv").forEach(i=>i.addEventListener("input",()=>{if(i.value!=="")set(i.value)}));
 document.querySelector("#sal .pc").addEventListener("click",e=>{const b=e.target.closest("button");if(b)set(b.dataset.s)});
 set(4000)})();
// 첫 카톡까지 — 결제 화면 시계와 같은 자(firstSendDay: 영업일·공휴일·서울 시각 08:00)로 센다. 기기 시간대·주말을 따로 세지 않는다(2026-10-15).
// 이 파일은 모듈이 아니라 동적 import 로 받는다. 못 받으면 마크업의 「--:--:--」 그대로 둔다 — 틀린 시각을 세지 않는다.
import("/assets/mypage-data.js").then(({firstSendDay})=>{const el=$("cdv");let last="";const tick=()=>{const n=new Date(),t=new Date(Date.parse(firstSendDay(n)+"T08:00:00+09:00"));const d=Math.floor((t-n)/1000),p=x=>String(x).padStart(2,"0");const v=$("ck").dataset.v,ms=(t-n)%1000,fr=v==="2"?`.${Math.floor(ms/100)}`:v==="3"||v==="4"?`.${String(Math.floor(ms/10)).padStart(2,"0")}`:v==="5"?`.${String(ms).padStart(3,"0")}`:"";const h=`<span>${p(Math.floor(d/3600))}</span>:<span>${p(Math.floor(d%3600/60))}</span>:<span>${p(d%60)}</span>`+(fr?`<i class="cfr${v==="4"?" big":""}">${fr}</i>`:"");if(h!==last){el.innerHTML=h;last=h}};const loop=()=>{tick();requestAnimationFrame(loop)};loop()});   // 실패는 삼키지 않는다 — track.js 의 오류 보고가 받는다 · 글자가 바뀔 때만 쓴다(매 프레임 innerHTML 을 갈면 프레임마다 스타일 재계산이 돈다 — 2026-10-15 실측)
(()=>{const sal=$("sal"),rg=sal.querySelector('input[type=range]');let demo=0;
 const fill=()=>rg.style.setProperty("--fill",((rg.value-rg.min)/(rg.max-rg.min)*100)+"%");rg.addEventListener("input",fill);fill();
 const run=()=>{if(sal.dataset.v!=="7")return;let t=0;clearInterval(demo);demo=setInterval(()=>{t+=1;const v=Math.round(4000+3000*Math.sin(t/12*Math.PI));rg.value=v;rg.dispatchEvent(new Event("input"));if(t>=24){clearInterval(demo);rg.value=4000;rg.dispatchEvent(new Event("input"))}},70)};
 rg.addEventListener("pointerdown",()=>clearInterval(demo));
 new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting)run()}),{root:null,threshold:.6}).observe(rg)})();
renderQuiz("mkt");

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

document.querySelectorAll(".chips").forEach(c=>c.addEventListener("click",e=>{if(e.target.closest(".chip"))document.querySelectorAll(".chw").forEach(w=>w.classList.add("used"))}));



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

(()=>{const a=$("garc"),n=$("gvn"),g=$("gauge");let raf=0;
 const set=v=>{a.setAttribute("stroke-dasharray",v.toFixed(2)+" 100");n.textContent=Math.round(Math.max(0,Math.min(57,v)))};
 const play=()=>{cancelAnimationFrame(raf);g.classList.remove("pop");const m=$("ga").dataset.v;if(m==="1"){set(57);return}
  const dur={"2":1000,"3":1300,"4":1800,"5":2800}[m],t0=performance.now();
  const ease={"2":t=>1-Math.pow(1-t,3),"3":t=>{const c1=2.2,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)},"4":t=>Math.floor(t*6)/6,"5":t=>1-Math.pow(1-t,2)}[m];
  const step=now=>{const t=Math.min(1,(now-t0)/dur);set(57*ease(t));if(t<1)raf=requestAnimationFrame(step);else{set(57);if(m==="5"){void g.offsetWidth;g.classList.add("pop")}}};set(0);raf=requestAnimationFrame(step)};
 let seen=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.5&&!seen){seen=true;play()}else if(e.intersectionRatio===0)seen=false}),{root:null,threshold:[0,.5]}).observe(g);})();
(()=>{const k=$("stk");const play=()=>{k.classList.remove("play");void k.offsetWidth;k.classList.add("play")};
 let seen=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.4&&!seen){seen=true;play()}else if(e.intersectionRatio===0){seen=false;k.classList.remove("play")}}),{root:null,threshold:[0,.4]}).observe(k);})();

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

document.querySelectorAll(".chips").forEach(c=>c.addEventListener("wheel",e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY))e.preventDefault()},{passive:false}));
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
(()=>{const a=document.querySelector(".a4");[...a.children].forEach((c,i)=>c.style.setProperty("--k",i));
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.35)a.classList.add("play");else if(!e.isIntersecting)a.classList.remove("play")}),{root:null,threshold:[0,.35]});io.observe(a);})();
(()=>{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio>=.9)e.target.classList.add("on");else if(!e.isIntersecting)e.target.classList.remove("on")}),{root:null,rootMargin:"0px 0px -90px 0px",threshold:[0,.9]});document.querySelectorAll(".draw").forEach(x=>io.observe(x));
 document.querySelectorAll(".chips").forEach(c=>c.addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;$("qhk").textContent=b.textContent.trim()}));
 const on=document.querySelector("#quizChips .chip.on");if(on)$("qhk").textContent=on.textContent.trim()})();
/* 맨 위에서 더 당긴 자리 = 흰 머리줄 색 (2026-10-15 사용자 지시) — 공용 assets/overscroll-top.js 를 붙인다.
   맨 아래는 html·body 바탕(--g100, footer 와 같은 색) 그대로. */
document.documentElement.style.setProperty("--overscroll-top", "#fff");
document.body.appendChild(document.createElement("script")).src = "/assets/overscroll-top.js";
