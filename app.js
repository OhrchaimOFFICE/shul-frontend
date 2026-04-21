const BACKEND_URL = "https://shul-backend.onrender.com";
const STRIPE_PUBLISHABLE_KEY = "pk_live_51TNzTG0rialmjNgrf4IGmygXrLa91bSAJ0kPe616KM9UOwkfVd5Fez0Vsyf5BFDstKaoLCbv4prVqNE7FmwPRSvP00S6BSyVs3";
if (window.__firebaseConfig__ && !firebase.apps.length) firebase.initializeApp(window.__firebaseConfig__);
const { useState, useEffect, useCallback, useRef } = React;
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Shabbos'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function getTodayStr() { return new Date().toLocaleDateString('en-CA'); }
function formatDisplayDate(ds) { return new Date(ds+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}); }
function getSundayOfWeek(ds) { const d=new Date(ds+'T12:00:00'); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0]; }
async function apiFetch(path, options={}) {
  const token = await firebase.auth().currentUser?.getIdToken();
  const headers = {'Content-Type':'application/json',...options.headers};
  if(token) headers['Authorization']='Bearer '+token;
  const res = await fetch(BACKEND_URL+path,{...options,headers});
  if(!res.ok){ const err=await res.json().catch(()=>({error:'Request failed'})); throw new Error(err.error||'Request failed'); }
  return res.json();
}

// Stale-while-revalidate cache for read-only endpoints. Returns the last cached
// payload synchronously (if any) via onCached, then calls onFresh with the new
// payload when the network fetch completes. Used to make repeat visits instant.
function apiFetchSWR(path, { onCached, onFresh, onError } = {}) {
  const key = 'swr:' + path;
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (raw && onCached) {
      const parsed = JSON.parse(raw);
      onCached(parsed);
    }
  } catch {}
  apiFetch(path).then(data => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
    if (onFresh) onFresh(data);
  }).catch(err => { if (onError) onError(err); });
}
function fmtZ(iso) { if(!iso) return '--'; return new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}); }

// ─── Zmanim Panel (MyZmanim + Davening + Shiurim + Fullscreen) ──
function ZmanimPanel({onExpand}) {
  const iframeRef = useRef(null);
  const [schedule,setSchedule]=useState(null);
  const [shiurim,setShiurim]=useState([]);
  const [fullZmanim,setFullZmanim]=useState(null);
  const [fullscreen,setFullscreen]=useState(false);

  function loadData(){
    apiFetch('/api/schedule/today').then(setSchedule).catch(()=>{});
    apiFetch('/api/shiurim').then(setShiurim).catch(()=>{});
    apiFetch('/api/zmanim/today').then(setFullZmanim).catch(()=>{});
  }

  useEffect(()=>{
    loadData();
    // Auto-refresh at midnight
    function scheduleRefresh(){
      const now=new Date();
      const midnight=new Date(now);
      midnight.setHours(24,0,5,0); // 12:00:05 AM next day
      const ms=midnight.getTime()-now.getTime();
      return setTimeout(()=>{loadData();if(iframeRef.current){
        const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:4px;font-family:"Open Sans",sans-serif;font-size:11px;}</style></head><body>'+
        '<script type="text/javascript" charset="UTF-8" src="https://www.myzmanim.com/widget.aspx?lang=en&mode=Standard&fsize=11&fcolor=1a2744&hcolor=faf8f3&bcolor=c49a3c&suf=s&key=36FtEjK2LSnQnGiOz2VBKgH53KnAY%2b3hrcR4Y6wUot92o8WG3B8YSbsll6LaSAYMQ1S2dIN6oyp87TiKzUQ%2f6a2g3uqknnDxxVJIYw2%2fTUbrQiUitklmn6Ld4hla%2bHNC"><\/script></body></html>';
        iframeRef.current.srcdoc=html;}scheduleRefresh();},ms);
    }
    const timer=scheduleRefresh();
    return ()=>clearTimeout(timer);
  },[]);

  useEffect(()=>{
    if(!iframeRef.current) return;
    const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:4px;font-family:"Open Sans",sans-serif;font-size:11px;}</style></head><body>'+
      '<script type="text/javascript" charset="UTF-8" src="https://www.myzmanim.com/widget.aspx?lang=en&mode=Standard&fsize=11&fcolor=1a2744&hcolor=faf8f3&bcolor=c49a3c&suf=s&key=36FtEjK2LSnQnGiOz2VBKgH53KnAY%2b3hrcR4Y6wUot92o8WG3B8YSbsll6LaSAYMQ1S2dIN6oyp87TiKzUQ%2f6a2g3uqknnDxxVJIYw2%2fTUbrQiUitklmn6Ld4hla%2bHNC"><\/script></body></html>';
    iframeRef.current.srcdoc=html;
  },[]);

  // Today's shiurim (filter by day of week)
  const todayDow=new Date().getDay();
  const todayShiurim=shiurim.filter(s=>s.dayOfWeek===todayDow);

  function openFullscreen(){setFullscreen(true);}
  function closeFullscreen(){setFullscreen(false);}

  // Only show candle lighting on Friday or Yom Tov
  const isFriday=new Date().getDay()===5;
  const showCandles=isFriday||(schedule?.dayType==='yomTov');

  // Fullscreen overlay - designed for shul TV display, fills entire viewport
  if(fullscreen){
    const zTimes=fullZmanim?.zmanim||schedule?.zmanim||{};
    const zmanimList=[
      ['Alot HaShachar',zTimes.alotHaShachar],
      ['Earliest Talis',zTimes.misheyakir],
      ['Sunrise',zTimes.sunrise],
      ['Latest Shema (MGA)',zTimes.sofZmanShmaMGA],
      ['Latest Shema (GRA)',zTimes.sofZmanShma],
      ['Latest Shacharis',zTimes.sofZmanTfilla],
      ['Chatzos',zTimes.chatzot],
      ['Earliest Mincha',zTimes.minchaGedola],
      ['Plag HaMincha',zTimes.plagHaMincha],
      ['Sunset',zTimes.sunset],
      ['Tzeis HaKochavim',zTimes.tzeit]
    ].filter(([_,v])=>v).map(([n,v])=>[n,fmtZ(v)]);

    return React.createElement('div',{style:{position:'fixed',inset:0,zIndex:9999,background:'linear-gradient(180deg, #1a2744 0%, #243456 100%)',overflow:'hidden',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',height:'100vh',width:'100vw',padding:'20px 40px'}},
      React.createElement('style',null,`
        @keyframes scrollZmanim { 0% { transform: translateY(0); } 50% { transform: translateY(calc(-50% + 0px)); } 50.01% { transform: translateY(calc(-50% + 0px)); } 100% { transform: translateY(0); } }
        .zmanim-scroll-wrap { animation: scrollZmanim 30s linear infinite; }
      `),
      React.createElement('button',{onClick:closeFullscreen,style:{position:'absolute',top:16,right:16,background:'rgba(255,255,255,0.15)',color:'#fff',border:'none',borderRadius:'50%',width:44,height:44,fontSize:'1.3rem',cursor:'pointer'}},'✕'),
      // Header with logo
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:20,marginBottom:20}},
        React.createElement('img',{src:'logo-hebrew-tree.png',alt:'Ohr Chaim',style:{height:100},onError:function(e){e.target.src='logo-tree.png';}}),
        React.createElement('div',null,
          React.createElement('h1',{style:{fontFamily:'var(--font-display)',color:'#c49a3c',fontSize:'2.6rem',margin:0,letterSpacing:1,fontWeight:700}},'Congregation Ohr Chaim'),
          React.createElement('p',{style:{color:'rgba(255,255,255,0.4)',fontSize:'1.1rem',margin:'4px 0 0',letterSpacing:2}},'317 W 47th St, Miami Beach, FL 33140'))),
      // Two columns filling remaining space
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,width:'100%',maxWidth:1600,flex:1,minHeight:0,paddingBottom:20}},
        // Left: All Zmanim - auto-scrolling
        React.createElement('div',{style:{background:'rgba(255,255,255,0.07)',borderRadius:14,padding:'20px 28px',border:'1px solid rgba(196,154,60,0.3)',display:'flex',flexDirection:'column',overflow:'hidden'}},
          React.createElement('h2',{style:{fontFamily:'var(--font-display)',color:'#c49a3c',marginBottom:16,fontSize:'2.2rem',textAlign:'center',fontWeight:700}},"Today's Zmanim"),
          React.createElement('div',{style:{flex:1,overflow:'hidden',position:'relative'}},
            React.createElement('div',{className:'zmanim-scroll-wrap'},
              zmanimList.concat(zmanimList).map(([n,v],i)=>React.createElement('div',{key:n+'-'+i,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.08)',fontSize:'1.6rem'}},
                React.createElement('span',{style:{color:'rgba(255,255,255,0.7)'}},n),
                React.createElement('span',{style:{fontWeight:700,color:'#fff',fontFamily:'var(--font-display)',fontSize:'1.7rem'}},v)))))),
        // Right: Davening + Shiurim
        React.createElement('div',{style:{background:'rgba(255,255,255,0.07)',borderRadius:14,padding:'20px 28px',border:'1px solid rgba(196,154,60,0.3)',display:'flex',flexDirection:'column',overflow:'hidden'}},
          React.createElement('h2',{style:{fontFamily:'var(--font-display)',color:'#c49a3c',marginBottom:16,fontSize:'2rem',textAlign:'center',fontWeight:700}},"Today's Schedule"),
          schedule&&React.createElement('div',{style:{color:'#fff'}},
            schedule.davening?.shacharis&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.1)',fontSize:'1.6rem'}},React.createElement('span',{style:{color:'rgba(255,255,255,0.8)'}},'Shacharis'),React.createElement('span',{style:{fontWeight:700,color:'#fff',fontFamily:'var(--font-display)'}},schedule.davening.shacharis)),
            schedule.davening?.earlyMincha&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.1)',fontSize:'1.6rem'}},React.createElement('span',{style:{color:'rgba(255,255,255,0.8)'}},'Early Mincha'),React.createElement('span',{style:{fontWeight:700,color:'#fff',fontFamily:'var(--font-display)'}},schedule.davening.earlyMincha)),
            schedule.davening?.mincha&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.1)',fontSize:'1.6rem'}},React.createElement('span',{style:{color:'rgba(255,255,255,0.8)'}},'Mincha'),React.createElement('span',{style:{fontWeight:700,color:'#fff',fontFamily:'var(--font-display)'}},schedule.davening.mincha)),
            schedule.davening?.minchaMaariv&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.1)',fontSize:'1.6rem'}},React.createElement('span',{style:{color:'rgba(255,255,255,0.8)'}},'Mincha / Maariv'),React.createElement('span',{style:{fontWeight:700,color:'#fff',fontFamily:'var(--font-display)'}},schedule.davening.minchaMaariv)),
            schedule.davening?.maariv&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.1)',fontSize:'1.6rem'}},React.createElement('span',{style:{color:'rgba(255,255,255,0.8)'}},'Maariv'),React.createElement('span',{style:{fontWeight:700,color:'#fff',fontFamily:'var(--font-display)'}},schedule.davening.maariv)),
            showCandles&&schedule.zmanim?.candleLighting&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'16px 20px',marginTop:8,background:'rgba(196,154,60,0.15)',borderRadius:10,fontSize:'1.6rem'}},React.createElement('span',{style:{color:'#c49a3c',fontWeight:700}},'Candle Lighting'),React.createElement('span',{style:{fontWeight:700,color:'#c49a3c',fontFamily:'var(--font-display)'}},schedule.zmanim.candleLighting))),
          todayShiurim.length>0&&React.createElement('div',{style:{marginTop:20,paddingTop:16,borderTop:'1px solid rgba(255,255,255,0.1)'}},
            React.createElement('h3',{style:{fontFamily:'var(--font-display)',color:'#c49a3c',marginBottom:10,fontSize:'1.4rem',fontWeight:700}},'Shiurim Today'),
            todayShiurim.map(s=>React.createElement('div',{key:s.id,style:{padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.08)',color:'#fff'}},
              React.createElement('div',{style:{fontWeight:700,fontSize:'1.15rem'}},s.title),
              React.createElement('div',{style:{color:'rgba(255,255,255,0.5)',fontSize:'1rem',marginTop:2}},[s.time,s.rabbi].filter(Boolean).join(' • '))))))));
  }

  // Normal sidebar panel
  return React.createElement('div',{className:'zmanim-panel'},
    React.createElement('div',{className:'zmanim-panel-title'},
      React.createElement('img',{src:'logo-tree.png',alt:'',className:'panel-tree-icon'}),
      "Today's Zmanim & Schedule"),
    React.createElement('iframe',{ref:iframeRef,style:{width:'100%',height:320,border:'none',borderRadius:4},title:'MyZmanim'}),
    // Davening times
    schedule&&React.createElement('div',{style:{marginTop:8,borderTop:'2px solid #c49a3c',paddingTop:8}},
      React.createElement('div',{style:{fontWeight:700,color:'#1a2744',fontSize:'0.9rem',marginBottom:6}},'Davening Times'),
      schedule.davening?.shacharis&&React.createElement('div',{className:'zman-row'},React.createElement('span',{className:'zman-name'},'Shacharis'),React.createElement('span',{className:'zman-time'},schedule.davening.shacharis)),
      schedule.davening?.earlyMincha&&React.createElement('div',{className:'zman-row'},React.createElement('span',{className:'zman-name'},'Early Mincha'),React.createElement('span',{className:'zman-time'},schedule.davening.earlyMincha)),
      schedule.davening?.mincha&&React.createElement('div',{className:'zman-row'},React.createElement('span',{className:'zman-name'},'Mincha'),React.createElement('span',{className:'zman-time'},schedule.davening.mincha)),
      schedule.davening?.minchaMaariv&&React.createElement('div',{className:'zman-row'},React.createElement('span',{className:'zman-name'},'Mincha/Maariv'),React.createElement('span',{className:'zman-time'},schedule.davening.minchaMaariv)),
      schedule.davening?.maariv&&React.createElement('div',{className:'zman-row'},React.createElement('span',{className:'zman-name'},'Maariv'),React.createElement('span',{className:'zman-time'},schedule.davening.maariv)),
      showCandles&&schedule.zmanim?.candleLighting&&React.createElement('div',{className:'zman-row',style:{color:'#c49a3c',fontWeight:600}},React.createElement('span',null,'Candle Lighting'),React.createElement('span',null,schedule.zmanim.candleLighting))),
    // Today's shiurim
    todayShiurim.length>0&&React.createElement('div',{style:{marginTop:8,borderTop:'1px solid #e0dcd4',paddingTop:6}},
      React.createElement('div',{style:{fontWeight:700,color:'#1a2744',fontSize:'0.85rem',marginBottom:4}},'Shiurim Today'),
      todayShiurim.map(s=>React.createElement('div',{key:s.id,style:{fontSize:'0.8rem',padding:'3px 0',color:'#555'}},s.title+(s.time?' - '+s.time:'')))),
    // Buttons
    React.createElement('div',{style:{display:'flex',gap:6,marginTop:10}},
      React.createElement('button',{className:'zmanim-expand-btn',onClick:openFullscreen,style:{flex:1}},'Full Screen'),
      onExpand&&React.createElement('button',{className:'zmanim-expand-btn',onClick:onExpand,style:{flex:1}},'Zmanim Page'))
  );
}

// ─── Ticker ──────────────────────────────────────────────────────
function ZmanimTicker() {
  const [data,setData]=useState(()=>{
    try { const raw = localStorage.getItem('swr:/api/zmanim/today'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  useEffect(()=>{apiFetchSWR('/api/zmanim/today',{onFresh:setData});},[]);
  if(!data) return null;
  const z=data.zmanim;
  const isFri=new Date().getDay()===5;
  const items=[['Sunrise',z.sunrise],['Shma',z.sofZmanShma],['Chatzos',z.chatzot],['Plag',z.plagHaMincha],['Sunset',z.sunset]].filter(([_,v])=>v);
  const showCandle=isFri&&z.candleLighting;
  return React.createElement('div',{className:'zmanim-ticker'},
    React.createElement('div',{className:'ticker-inner'},
      items.map(([l,v])=>React.createElement('span',{key:l},l+' ',React.createElement('b',null,fmtZ(v)))),
      showCandle&&React.createElement('span',{className:'ticker-hl'},'Candle Lighting ',React.createElement('b',null,fmtZ(z.candleLighting)))
    ));
}

// ─── Home ────────────────────────────────────────────────────────
function HomePage({navigate}) {
  const [schedule,setSchedule]=useState(null);
  const [shabbosData,setShabbosData]=useState(null);
  const [shiurim,setShiurim]=useState([]);
  const [loading,setLoading]=useState(true);
  const siteImages=useSiteImages();

  useEffect(()=>{
    let freshCount=0;
    function done(){freshCount++;if(freshCount>=3)setLoading(false);}
    apiFetchSWR('/api/schedule/today',{
      onCached:d=>{setSchedule(d);setLoading(false);},
      onFresh:d=>{setSchedule(d);done();},
      onError:done
    });
    apiFetchSWR('/api/schedule/shabbos',{
      onCached:setShabbosData,
      onFresh:d=>{setShabbosData(d);done();},
      onError:done
    });
    apiFetchSWR('/api/shiurim',{
      onCached:setShiurim,
      onFresh:d=>{setShiurim(d);done();},
      onError:done
    });
  },[]);

  const isFriday=new Date().getDay()===5;
  const showCandles=isFriday||(schedule?.dayType==='yomTov');
  const shabbosShiurim=shiurim.filter(s=>s.dayOfWeek===6);
  const sb=shabbosData; // shorthand

  return React.createElement('div',null,
    React.createElement('div',{className:'home-grid'},
      // Column 1: Today's davening + slideshow
      React.createElement('div',null,
        React.createElement('div',{className:'card'},
          React.createElement('div',{className:'card-header'},"Today's davening"),
          loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...'):
          schedule?React.createElement('div',null,
            schedule.holidays?.length>0&&React.createElement('div',{style:{marginBottom:10}},schedule.holidays.map((h,i)=>React.createElement('span',{className:'holiday-badge',key:i},h))),
            schedule.davening?.shacharis&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Shacharis'),React.createElement('span',{className:'time-value'},schedule.davening.shacharis)),
            schedule.davening?.earlyMincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Early Mincha'),React.createElement('span',{className:'time-value'},schedule.davening.earlyMincha)),
            schedule.davening?.mincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha'),React.createElement('span',{className:'time-value'},schedule.davening.mincha)),
            schedule.davening?.minchaMaariv&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha / Maariv'),React.createElement('span',{className:'time-value'},schedule.davening.minchaMaariv)),
            schedule.davening?.maariv&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Maariv'),React.createElement('span',{className:'time-value'},schedule.davening.maariv)),
            showCandles&&schedule.zmanim?.candleLighting&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},schedule.zmanim.candleLighting))
          ):React.createElement('p',{style:{color:'#888'}},'Unable to load.')),
        React.createElement(HeroSlideshow)),
      // Column 2: This Shabbos - full schedule
      React.createElement('div',null,
        React.createElement('div',{className:'card'},
          React.createElement('div',{className:'card-header'},'This Shabbos',sb?.parsha&&React.createElement('span',{className:'badge'},sb.parsha)),
          sb?React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'0.95rem',fontWeight:700,color:'#c49a3c',marginBottom:2,letterSpacing:0.5}},'FRIDAY NIGHT'),
            sb.candleLighting&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},sb.candleLighting)),
            sb.fridayMincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha / Kabbalas Shabbos'),React.createElement('span',{className:'time-value'},sb.fridayMincha)),
            React.createElement('div',{style:{fontSize:'0.95rem',fontWeight:700,color:'#c49a3c',marginTop:6,marginBottom:2,letterSpacing:0.5}},'SHABBOS DAY'),
            sb.shacharis&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Shacharis'),React.createElement('span',{className:'time-value'},sb.shacharis)),
            sb.sofZmanShma&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Latest Shema'),React.createElement('span',{className:'time-value'},sb.sofZmanShma)),
            sb.mincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha'),React.createElement('span',{className:'time-value'},sb.mincha)),
            sb.sunset&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Sunset'),React.createElement('span',{className:'time-value'},sb.sunset)),
            sb.shabbosEnds&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Shabbos Ends'),React.createElement('span',{className:'time-value'},sb.shabbosEnds)),
            shabbosShiurim.length>0&&React.createElement('div',{style:{marginTop:6,paddingTop:6,borderTop:'0.5px solid rgba(0,0,0,0.05)'}},
              React.createElement('div',{style:{fontSize:'0.95rem',fontWeight:700,color:'#1a2744',marginBottom:3}},'SHIURIM'),
              shabbosShiurim.map(s=>React.createElement('div',{key:s.id,style:{display:'flex',justifyContent:'space-between',padding:'2px 0',fontSize:'0.88rem'}},
                React.createElement('span',{style:{color:'#555'}},s.title+(s.rabbi?' - '+s.rabbi:'')),
                React.createElement('span',{style:{fontWeight:600,color:'#1a2744'}},s.time||'')))),
            React.createElement('div',{style:{marginTop:6,paddingTop:6,borderTop:'0.5px solid rgba(0,0,0,0.05)'}},
              React.createElement('div',{className:'sponsor-row'},
                React.createElement('div',{className:'sponsor-btn',onClick:()=>navigate('sponsorship')},
                  React.createElement('div',{className:'sponsor-label'},'Kiddush'),
                  React.createElement('div',{className:'sponsor-status'},'Available')),
                React.createElement('div',{className:'sponsor-btn',onClick:()=>navigate('sponsorship')},
                  React.createElement('div',{className:'sponsor-label'},'Seudas Shlishis'),
                  React.createElement('div',{className:'sponsor-status'},'Available'))))
          ):React.createElement('p',{style:{color:'#888'}},'Loading...'))),
      // Column 3: Zmanim panel
      React.createElement(ZmanimPanel,{onExpand:()=>navigate('zmanim')})),
    // Quick links
    React.createElement('div',{className:'quick-links'},
      [['Weekly Schedule','schedule'],['Calendar','calendar'],['Shiurim','shiurim'],['Full Zmanim','zmanim']].map(([l,p])=>
        React.createElement('div',{key:p,className:'quick-link',onClick:()=>navigate(p)},l))));
}

// ─── Schedule ────────────────────────────────────────────────────
function SchedulePage({navigate}) {
  const [week,setWeek]=useState(null);
  const [loading,setLoading]=useState(true);
  const [startDate,setStartDate]=useState(getSundayOfWeek(getTodayStr()));
  useEffect(()=>{
    setLoading(true);
    apiFetch('/api/schedule/week?start='+startDate).then(d=>{setWeek(d.week);setLoading(false);}).catch(()=>setLoading(false));
  },[startDate]);
  function shift(n){const d=new Date(startDate+'T12:00:00');d.setDate(d.getDate()+n);setStartDate(d.toISOString().split('T')[0]);}
  function hdrClass(day){if(day.dayType==='shabbos')return'day-card-header shabbos';if(day.dayType==='yomTov')return'day-card-header yomtov';return'day-card-header';}
  return React.createElement('div',{className:'content-with-zmanim'},
    React.createElement('div',null,
      React.createElement('div',{className:'calendar-nav'},
        React.createElement('button',{onClick:()=>shift(-7)},'◀'),
        React.createElement('span',{className:'calendar-month-label'},'Week of '+formatDisplayDate(startDate).split(',').slice(1).join(',')),
        React.createElement('button',{onClick:()=>shift(7)},'▶')),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading schedule...'):
      week?React.createElement('div',{className:'schedule-grid'},
        week.map(day=>{const d=new Date(day.date+'T12:00:00');const dn=DAY_NAMES[d.getDay()];
          return React.createElement('div',{className:'day-card',key:day.date},
            React.createElement('div',{className:hdrClass(day)},
              React.createElement('div',{className:'day-name'},dn),
              React.createElement('div',{className:'day-date'},d.toLocaleDateString('en-US',{month:'short',day:'numeric'})),
              day.hebrewDate&&React.createElement('div',{className:'day-hebrew'},day.hebrewDate),
              day.parsha&&React.createElement('span',{className:'parsha-badge'},day.parsha),
              day.holidays?.length>0&&day.holidays.map((h,i)=>React.createElement('span',{className:'holiday-badge',key:i},h))),
            React.createElement('div',{className:'day-card-body'},
              React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Shacharis'),React.createElement('span',{className:'time-value'},day.davening?.shacharis||'--')),
              day.davening?.earlyMincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Early Mincha'),React.createElement('span',{className:'time-value'},day.davening.earlyMincha)),
              day.davening?.mincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha'),React.createElement('span',{className:'time-value'},day.davening.mincha)),
              day.davening?.minchaMaariv&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha / Maariv'),React.createElement('span',{className:'time-value'},day.davening.minchaMaariv)),
              day.davening?.maariv&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Maariv'),React.createElement('span',{className:'time-value'},day.davening.maariv)),
              (new Date(day.date+'T12:00:00').getDay()===5||day.dayType==='yomTov')&&day.zmanim?.candleLighting&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},day.zmanim.candleLighting)),
              React.createElement('div',{style:{marginTop:8,paddingTop:8,borderTop:'1px solid #f0ece3'}},
                React.createElement('div',{style:{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',color:'#888'}},
                  React.createElement('span',null,'Sunrise: '+(day.zmanim?.sunrise||'--')),
                  React.createElement('span',null,'Sunset: '+(day.zmanim?.sunset||'--'))))))})
      ):React.createElement('p',null,'Unable to load schedule.')),
    React.createElement(ZmanimPanel,{onExpand:()=>navigate('zmanim')}));
}

// ─── Calendar ────────────────────────────────────────────────────
function CalendarPage() {
  const today=new Date();
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth()+1);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{setLoading(true);apiFetch('/api/calendar/'+year+'/'+month).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));},[year,month]);
  function prev(){if(month===1){setMonth(12);setYear(y=>y-1);}else setMonth(m=>m-1);}
  function next(){if(month===12){setMonth(1);setYear(y=>y+1);}else setMonth(m=>m+1);}
  const firstDay=new Date(year,month-1,1).getDay();
  const daysInMonth=new Date(year,month,0).getDate();
  const todayStr=getTodayStr();
  function eventsFor(dayNum){
    const ds=year+'-'+String(month).padStart(2,'0')+'-'+String(dayNum).padStart(2,'0');
    const ev=[];
    if(data?.holidays) for(const h of data.holidays){const hd=h.date?.substring(0,10);if(hd===ds){if(h.category==='candles')ev.push({type:'candle',title:'🕯 '+h.title?.split(': ')[1]});else if(h.category==='parashat')ev.push({type:'shiur',title:h.title});else ev.push({type:'holiday',title:h.title});}}
    return ev;
  }
  return React.createElement('div',null,
    React.createElement('div',{className:'calendar-nav'},
      React.createElement('button',{onClick:prev},'◀'),
      React.createElement('span',{className:'calendar-month-label'},MONTH_NAMES[month-1]+' '+year),
      React.createElement('button',{onClick:next},'▶')),
    loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...'):
    React.createElement('div',{className:'calendar-grid'},
      ['Sun','Mon','Tue','Wed','Thu','Fri','Shab'].map(d=>React.createElement('div',{className:'calendar-day-header',key:d},d)),
      Array.from({length:firstDay},(_,i)=>React.createElement('div',{className:'calendar-day empty',key:'e'+i})),
      Array.from({length:daysInMonth},(_,i)=>{
        const dn=i+1;const ds=year+'-'+String(month).padStart(2,'0')+'-'+String(dn).padStart(2,'0');
        const isToday=ds===todayStr;const isShab=new Date(ds+'T12:00:00').getDay()===6;
        const hd=data?.hebrewDates?.[ds];const ev=eventsFor(dn);
        let cn='calendar-day';if(isToday)cn+=' today';if(isShab)cn+=' shabbos';
        return React.createElement('div',{className:cn,key:dn},
          React.createElement('div',{className:'calendar-day-number'},dn),
          hd&&React.createElement('div',{className:'calendar-day-hebrew'},hd.hd+' '+hd.hm),
          ev.length>0&&React.createElement('div',{className:'calendar-day-events'},ev.slice(0,3).map((e,j)=>React.createElement('div',{className:'calendar-event '+e.type,key:j},e.title))));
      })));
}

// ─── Full Zmanim ─────────────────────────────────────────────────
function ZmanimPage() {
  const [data,setData]=useState(null);const [loading,setLoading]=useState(true);const [dateStr,setDateStr]=useState(getTodayStr());
  useEffect(()=>{setLoading(true);apiFetch('/api/zmanim/'+dateStr).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));},[dateStr]);
  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  if(!data) return React.createElement('p',null,'Unable to load.');
  const z=data.zmanim;
  const col1=[['Alot HaShachar',z.alotHaShachar],['Misheyakir',z.misheyakir],['Sunrise (HaNetz)',z.sunrise],['Sof Zman Shma (MGA)',z.sofZmanShmaMGA],['Sof Zman Shma (GRA)',z.sofZmanShma],['Sof Zman Tfilla (MGA)',z.sofZmanTfillaMGA],['Sof Zman Tfilla (GRA)',z.sofZmanTfilla]].filter(([_,v])=>v);
  const col2=[['Chatzos',z.chatzot],['Mincha Gedola',z.minchaGedola],['Mincha Ketana',z.minchaKetana],['Plag HaMincha',z.plagHaMincha],['Sunset (Shkia)',z.sunset],['Tzeis HaKochavim',z.tzeit]].filter(([_,v])=>v);
  const showCandles=z.candleLighting&&(new Date(dateStr+'T12:00:00').getDay()===5);
  const rowStyle={display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',fontSize:'1.25rem',borderBottom:'1px solid rgba(0,0,0,0.06)'};
  const nameStyle={color:'#555',fontWeight:500};
  const timeStyle={color:'#1a2744',fontWeight:700,fontFamily:"'Playfair Display', serif"};
  return React.createElement('div',{style:{width:'100%'}},
    React.createElement('div',{className:'card',style:{padding:'28px 32px'}},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:12}},
        React.createElement('h2',{style:{fontFamily:"'Playfair Display', serif",fontSize:'2rem',color:'#1a2744',fontWeight:700,margin:0}},'Zmanim for '+formatDisplayDate(dateStr)),
        React.createElement('input',{type:'date',value:dateStr,onChange:e=>setDateStr(e.target.value),className:'form-input',style:{width:200,fontSize:'1.1rem'}})),
      data.hebrewDate?.hebrew&&React.createElement('p',{style:{fontSize:'1.3rem',color:'#c49a3c',fontWeight:700,marginBottom:20,textAlign:'center',fontFamily:"'Playfair Display', serif"}},data.hebrewDate.hebrew),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40}},
        React.createElement('div',{style:{background:'rgba(196,154,60,0.03)',borderRadius:8,padding:'8px 0',border:'0.5px solid rgba(196,154,60,0.15)'}},
          col1.map(([n,v])=>React.createElement('div',{style:rowStyle,key:n},
            React.createElement('span',{style:nameStyle},n),
            React.createElement('span',{style:timeStyle},fmtZ(v))))),
        React.createElement('div',{style:{background:'rgba(196,154,60,0.03)',borderRadius:8,padding:'8px 0',border:'0.5px solid rgba(196,154,60,0.15)'}},
          col2.map(([n,v])=>React.createElement('div',{style:rowStyle,key:n},
            React.createElement('span',{style:nameStyle},n),
            React.createElement('span',{style:timeStyle},fmtZ(v)))))),
      showCandles&&React.createElement('div',{style:{background:'#c49a3c',padding:'16px 24px',borderRadius:8,marginTop:20,display:'flex',justifyContent:'space-between',alignItems:'center'}},
        React.createElement('span',{style:{color:'#1a2744',fontWeight:700,fontSize:'1.3rem'}},'Candle Lighting'),
        React.createElement('span',{style:{color:'#1a2744',fontWeight:700,fontSize:'1.5rem',fontFamily:"'Playfair Display', serif"}},fmtZ(z.candleLighting))),
      React.createElement('p',{style:{textAlign:'center',marginTop:20,fontSize:'0.85rem',color:'#888'}},'317 W 47th St, Miami Beach')));
}

// ─── Shiurim ─────────────────────────────────────────────────────
function ShiurimPage() {
  const [shiurim,setShiurim]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{apiFetch('/api/shiurim').then(d=>{setShiurim(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  return React.createElement('div',null,React.createElement('div',{className:'card'},
    React.createElement('div',{className:'card-header'},'Weekly Shiurim'),
    shiurim.length===0?React.createElement('p',{style:{color:'#888'}},'No shiurim currently scheduled.'):
    shiurim.map(s=>React.createElement('div',{className:'shiur-card',key:s.id},
      React.createElement('div',{className:'shiur-day'},DAY_NAMES[s.dayOfWeek]?.substring(0,3)||'?'),
      React.createElement('div',{className:'shiur-info'},
        React.createElement('div',{className:'shiur-title'},s.title),
        React.createElement('div',{className:'shiur-details'},[s.time,s.rabbi,s.topic].filter(Boolean).join(' • ')))))));
}

// ─── Admin Login ─────────────────────────────────────────────────
function AdminLogin({onLogin}) {
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  async function handle(e){e.preventDefault();setError('');setLoading(true);
    try{await firebase.auth().signInWithEmailAndPassword(email,password);onLogin();}catch(err){setError(err.message);}setLoading(false);}
  return React.createElement('div',{className:'auth-container'},
    React.createElement('div',{className:'auth-title'},'Admin Login'),
    React.createElement('div',{className:'auth-subtitle'},'Congregation Ohr Chaim'),
    error&&React.createElement('div',{className:'message message-error'},error),
    React.createElement('form',{onSubmit:handle},
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:email,onChange:e=>setEmail(e.target.value),required:true})),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Password'),React.createElement('input',{className:'form-input',type:'password',value:password,onChange:e=>setPassword(e.target.value),required:true})),
      React.createElement('button',{className:'btn btn-primary btn-block',type:'submit',disabled:loading},loading?'Signing in...':'Sign In')));
}

// ─── Site Images (stored in Firestore, uploaded by admin) ────────
function HeroSlideshow() {
  const [slides,setSlides]=useState(()=>{
    try { const raw = localStorage.getItem('swr:/api/slides'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [idx,setIdx]=useState(0);
  useEffect(()=>{
    apiFetchSWR('/api/slides',{onFresh:setSlides});
  },[]);
  useEffect(()=>{
    if(slides.length<2)return;
    const t=setInterval(()=>setIdx(i=>(i+1)%slides.length),5000);
    return ()=>clearInterval(t);
  },[slides.length]);
  if(!slides.length) return null;
  return React.createElement('div',{className:'hero-slideshow'},
    slides.map((s,i)=>{
      const activeClass='hero-slide'+(i===idx?' active':'');
      if(s.kind==='text'){
        return React.createElement('div',{
          key:s.id,
          className:activeClass+' hero-slide-text',
          style:{background:s.bgColor||'#1a2744'}
        },
          s.title&&React.createElement('div',{className:'hero-slide-title'},s.title),
          s.body&&React.createElement('div',{className:'hero-slide-body'},s.body));
      }
      if(!s.dataUrl) return null;
      return React.createElement('img',{
        key:s.id,
        src:s.dataUrl,
        alt:'',
        className:activeClass
      });
    }));
}

function useSiteImages() {
  const [images,setImages]=useState(()=>{
    try { const raw = localStorage.getItem('swr:/api/site-images'); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(()=>{
    apiFetchSWR('/api/site-images',{onFresh:setImages});
  },[]);
  return images;
}

function AdminImages() {
  const [images,setImages]=useState({});
  const [loading,setLoading]=useState(true);
  const [msg,setMsg]=useState('');
  const slots=[
    {key:'topLogo',label:'Top Bar Logo',desc:'Shows in the top-left corner of every page (recommended: square, ~200px)'},
    {key:'heroImage',label:'Homepage Hero Image',desc:'Large image on the right side of the hero banner'},
    {key:'homepageImage',label:'Homepage Card Image',desc:'Shows in the Today\'s Davening card area'},
    {key:'zmanimPageImage',label:'Zmanim Page Image',desc:'Decorative image on the full Zmanim page'},
    {key:'fullscreenLogo',label:'Fullscreen TV Logo',desc:'Logo shown on the fullscreen zmanim display'},
    {key:'loginLogo',label:'Login Page Logo',desc:'Logo shown on the login/register page'},
    {key:'footerLogo',label:'Footer Logo',desc:'Logo shown in the site footer'},
  ];

  useEffect(()=>{
    fetch(BACKEND_URL+'/api/site-images')
      .then(r=>r.ok?r.json():{})
      .then(data=>{setImages(data||{});setLoading(false);})
      .catch(()=>setLoading(false));
  },[]);

  function uploadImage(key,e){
    const file=e.target.files[0];
    if(!file)return;
    if(file.size>5*1024*1024){setMsg('File too large. Max 5MB.');return;}
    const reader=new FileReader();
    reader.onload=async()=>{
      const base64=reader.result;
      const prev=images;
      setImages({...images,[key]:base64});
      try{
        await apiFetch('/api/admin/site-images/'+encodeURIComponent(key),{method:'PUT',body:JSON.stringify({dataUrl:base64})});
        setMsg(slots.find(s=>s.key===key)?.label+' uploaded!');
      }catch(err){setImages(prev);setMsg('Error saving: '+err.message);}
    };
    reader.readAsDataURL(file);
    e.target.value='';
  }

  async function removeImage(key){
    if(!confirm('Remove this image?'))return;
    const prev=images;
    const updated={...images};
    delete updated[key];
    setImages(updated);
    try{
      await apiFetch('/api/admin/site-images/'+encodeURIComponent(key),{method:'DELETE'});
      setMsg('Image removed.');
    }catch(err){setImages(prev);setMsg('Error: '+err.message);}
  }

  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Site Images'),
      React.createElement('p',{style:{color:'#555',marginBottom:16}},'Upload images for different sections of the website. Accepted formats: PNG, JPG. Max 5MB each.')),
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:16}},
      slots.map(s=>React.createElement('div',{className:'card',key:s.key},
        React.createElement('div',{style:{fontWeight:700,color:'#1a2744',fontSize:'1rem',marginBottom:4}},s.label),
        React.createElement('p',{style:{fontSize:'0.85rem',color:'#888',marginBottom:10}},s.desc),
        images[s.key]?React.createElement('div',null,
          React.createElement('img',{src:images[s.key],alt:s.label,style:{width:'100%',maxHeight:150,objectFit:'contain',borderRadius:8,marginBottom:8,background:'#f0ece3',padding:8}}),
          React.createElement('div',{style:{display:'flex',gap:6}},
            React.createElement('label',{className:'btn btn-sm btn-outline',style:{cursor:'pointer',flex:1}},'Replace',
              React.createElement('input',{type:'file',accept:'image/*',onChange:e=>uploadImage(s.key,e),style:{display:'none'}})),
            React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>removeImage(s.key)},'Remove'))
        ):React.createElement('label',{className:'btn btn-primary btn-block',style:{cursor:'pointer'}},'Upload Image',
          React.createElement('input',{type:'file',accept:'image/*',onChange:e=>uploadImage(s.key,e),style:{display:'none'}}))))),
    React.createElement(AdminSlideshow));
}

const MAX_SLIDES = 5;

function AdminSlideshow() {
  const [slides,setSlides]=useState([]);
  const [loading,setLoading]=useState(true);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const [textForm,setTextForm]=useState({title:'',body:'',bgColor:'#1a2744'});

  async function load(){
    try{
      const r=await fetch(BACKEND_URL+'/api/slides');
      setSlides(r.ok?await r.json():[]);
    }catch{setSlides([]);}
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  function onUpload(e){
    const file=e.target.files[0];
    e.target.value='';
    if(!file)return;
    if(file.size>5*1024*1024){setMsg('File too large. Max 5MB.');return;}
    if(slides.length>=MAX_SLIDES){setMsg(`Maximum ${MAX_SLIDES} slides. Remove one first.`);return;}
    const reader=new FileReader();
    reader.onload=async()=>{
      setBusy(true);
      try{
        await apiFetch('/api/admin/slides',{method:'POST',body:JSON.stringify({kind:'image',dataUrl:reader.result})});
        setMsg('Slide added.');
        await load();
      }catch(err){setMsg('Error: '+err.message);}
      setBusy(false);
    };
    reader.readAsDataURL(file);
  }

  async function onAddText(e){
    e.preventDefault();
    if(!textForm.title&&!textForm.body){setMsg('Title or body required.');return;}
    if(slides.length>=MAX_SLIDES){setMsg(`Maximum ${MAX_SLIDES} slides. Remove one first.`);return;}
    setBusy(true);
    try{
      await apiFetch('/api/admin/slides',{method:'POST',body:JSON.stringify({kind:'text',...textForm})});
      setMsg('Announcement slide added.');
      setTextForm({title:'',body:'',bgColor:'#1a2744'});
      await load();
    }catch(err){setMsg('Error: '+err.message);}
    setBusy(false);
  }

  async function onRemove(id){
    if(!confirm('Remove this slide?'))return;
    setBusy(true);
    try{
      await apiFetch('/api/admin/slides/'+encodeURIComponent(id),{method:'DELETE'});
      setMsg('Slide removed.');
      await load();
    }catch(err){setMsg('Error: '+err.message);}
    setBusy(false);
  }

  return React.createElement('div',{style:{marginTop:24}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},`Homepage Slideshow (${slides.length}/${MAX_SLIDES})`),
      React.createElement('p',{style:{color:'#555',marginBottom:12}},'Slides rotate on the homepage every 5 seconds. Mix photos and text announcements (mazel tovs, shiva notices, events). Max '+MAX_SLIDES+' slides total.'),
      msg&&React.createElement('div',{className:'message '+(msg.includes('Error')||msg.includes('Maximum')||msg.includes('too large')||msg.includes('required')?'message-error':'message-success')},msg),
      loading?React.createElement('p',{style:{color:'#888'}},'Loading...'):React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:12,marginBottom:12}},
        slides.map(s=>React.createElement('div',{key:s.id,style:{position:'relative'}},
          s.kind==='text'
            ?React.createElement('div',{style:{width:'100%',height:140,background:s.bgColor||'#1a2744',color:'#fff',borderRadius:8,padding:12,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center',overflow:'hidden'}},
              s.title&&React.createElement('div',{style:{fontWeight:800,fontSize:'1rem',marginBottom:4,color:'#c49a3c'}},s.title),
              s.body&&React.createElement('div',{style:{fontSize:'0.8rem',lineHeight:1.3}},s.body.length>120?s.body.slice(0,120)+'...':s.body))
            :React.createElement('img',{src:s.dataUrl,alt:'',style:{width:'100%',height:140,objectFit:'cover',borderRadius:8,background:'#f0ece3'}}),
          React.createElement('button',{className:'btn btn-sm btn-danger',disabled:busy,onClick:()=>onRemove(s.id),style:{position:'absolute',top:6,right:6}},'Remove')))),
      slides.length<MAX_SLIDES&&React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}},
        React.createElement('label',{className:'btn btn-primary',style:{cursor:busy?'not-allowed':'pointer',opacity:busy?0.6:1}},busy?'Uploading...':'Add Photo',
          React.createElement('input',{type:'file',accept:'image/*',disabled:busy,onChange:onUpload,style:{display:'none'}}))),
      slides.length<MAX_SLIDES&&React.createElement('form',{onSubmit:onAddText,style:{border:'1px solid #e0dcd4',borderRadius:8,padding:12,background:'#faf8f3'}},
        React.createElement('div',{style:{fontWeight:700,color:'#1a2744',marginBottom:8}},'Add Text Announcement (Mazel Tov, Shiva, Event)'),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 140px',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Title'),React.createElement('input',{className:'form-input',placeholder:'e.g. Mazel Tov!',value:textForm.title,onChange:e=>setTextForm(p=>({...p,title:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Background'),React.createElement('input',{className:'form-input',type:'color',value:textForm.bgColor,onChange:e=>setTextForm(p=>({...p,bgColor:e.target.value}))}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Body'),React.createElement('textarea',{className:'form-input',rows:3,placeholder:'e.g. Mazel Tov to the Cohen family on the birth of a baby girl!',value:textForm.body,onChange:e=>setTextForm(p=>({...p,body:e.target.value}))})),
        React.createElement('button',{className:'btn btn-primary',type:'submit',disabled:busy},busy?'Adding...':'Add Announcement'))));
}

function ContactPage() {
  const [form,setForm]=useState({name:'',email:'',phone:'',subject:'',message:''});
  const [sending,setSending]=useState(false);
  const [msg,setMsg]=useState('');
  const [done,setDone]=useState(false);
  function upd(k,v){setForm(p=>({...p,[k]:v}));}
  async function submit(e){
    e.preventDefault();
    if(!form.name||!form.email||!form.message){setMsg('Name, email, and message are required.');return;}
    setSending(true);setMsg('');
    try{
      await apiFetch('/api/contact',{method:'POST',body:JSON.stringify(form)});
      setDone(true);
    }catch(err){setMsg('Error: '+err.message);}
    setSending(false);
  }
  if(done) return React.createElement('div',{className:'card',style:{maxWidth:600,margin:'0 auto',textAlign:'center',padding:40}},
    React.createElement('div',{style:{fontSize:'3rem',marginBottom:16}},'✉️'),
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'Message Sent'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Thanks, '+form.name+'. We received your message and will be in touch soon.'),
    React.createElement('button',{className:'btn btn-primary',style:{marginTop:20},onClick:()=>{setDone(false);setForm({name:'',email:'',phone:'',subject:'',message:''});}},'Send Another'));
  return React.createElement('div',{style:{maxWidth:600,margin:'0 auto'}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Contact the Office'),
      React.createElement('p',{style:{marginBottom:16,color:'#555'}},'Send a message to the shul office. You can also email office@ohrchaim.org or visit us at 317 W 47th Street, Miami Beach, FL 33140.'),
      msg&&React.createElement('div',{className:'message message-error'},msg),
      React.createElement('form',{onSubmit:submit},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Name *'),React.createElement('input',{className:'form-input',value:form.name,onChange:e=>upd('name',e.target.value),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email *'),React.createElement('input',{className:'form-input',type:'email',value:form.email,onChange:e=>upd('email',e.target.value),required:true}))),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:form.phone,onChange:e=>upd('phone',e.target.value)})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),React.createElement('input',{className:'form-input',value:form.subject,onChange:e=>upd('subject',e.target.value)}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Message *'),React.createElement('textarea',{className:'form-input',rows:6,value:form.message,onChange:e=>upd('message',e.target.value),required:true})),
        React.createElement('button',{className:'btn btn-primary btn-block',type:'submit',disabled:sending,style:{marginTop:8}},sending?'Sending...':'Send Message'))));
}

function PrivacyPage() {
  return React.createElement('div',{style:{maxWidth:760,margin:'0 auto'}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Privacy Policy'),
      React.createElement('p',{style:{color:'#888',fontSize:'0.85rem'}},'Last updated: '+new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Who we are'),
      React.createElement('p',null,'This site is operated by Congregation Ohr Chaim, 317 W 47th Street, Miami Beach, FL 33140, a 501(c)(3) tax-exempt organization. Questions about this policy: office@ohrchaim.org.'),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Information we collect'),
      React.createElement('ul',null,
        React.createElement('li',null,'Account information you provide: name, email, phone, address, spouse email (optional), and yahrzeit entries.'),
        React.createElement('li',null,'Donation information: amounts, reasons, and dates. Card payment details are processed directly by Stripe and never touch our servers.'),
        React.createElement('li',null,'Basic log data automatically provided by your browser, such as IP and timestamps.')),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'How we use it'),
      React.createElement('ul',null,
        React.createElement('li',null,'Manage your membership, billing, kiddush sponsorships, and seat reservations.'),
        React.createElement('li',null,'Send davening schedules, membership reminders, donation receipts, yahrzeit reminders, and other shul communications.'),
        React.createElement('li',null,'Issue annual tax-deductible contribution summaries.')),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Sharing'),
      React.createElement('p',null,'We do not sell or rent your personal information. We share it only with service providers needed to operate this site (Stripe for payments, Google for email delivery, Firebase/Google Cloud for hosting and storage) under their standard data protection terms, or when required by law.'),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Your choices'),
      React.createElement('p',null,'You may view and edit your profile on the Account page, unsubscribe from automatic reminders in Settings, cancel automatic payments at any time, or request deletion by contacting the office.'),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Cookies'),
      React.createElement('p',null,'We use a single session cookie for login via Firebase Authentication. No advertising or tracking cookies are used.'),
      React.createElement('p',{style:{color:'#888',fontSize:'0.85rem',marginTop:24}},'This policy may be updated from time to time. Material changes will be communicated by email to active members.')));
}

function TermsPage() {
  return React.createElement('div',{style:{maxWidth:760,margin:'0 auto'}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Terms of Service'),
      React.createElement('p',{style:{color:'#888',fontSize:'0.85rem'}},'Last updated: '+new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Who these terms apply to'),
      React.createElement('p',null,'By using this website you agree to these terms. The site is operated by Congregation Ohr Chaim, a 501(c)(3) tax-exempt organization at 317 W 47th Street, Miami Beach, FL 33140.'),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Donations and payments'),
      React.createElement('p',null,'Donations are tax-deductible to the extent allowed by law. No goods or services are provided in exchange for a contribution unless explicitly stated. Card payments are processed by Stripe; we never see or store your full card number. Recurring membership payments continue until canceled from your Account page.'),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Refunds'),
      React.createElement('p',null,'Donations are generally non-refundable. If a payment was made in error, contact the office within 30 days at office@ohrchaim.org and we will review in good faith.'),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Seat reservations and sponsorships'),
      React.createElement('p',null,'High Holiday seats and kiddush/seudas shlishis sponsorships are confirmed once payment is received. Seat assignments are at the discretion of the shul. Scheduling conflicts may require the shul to move a sponsorship to a nearby date.'),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Your account'),
      React.createElement('p',null,'You are responsible for keeping your login credentials secure and for the accuracy of the information you submit. The shul may suspend or remove accounts that violate these terms or applicable law.'),
      React.createElement('h3',{style:{color:'#1a2744',marginTop:20}},'Disclaimer'),
      React.createElement('p',null,'Davening times, zmanim, and the calendar are provided as a convenience and should not be relied upon for questions of halacha. Consult a rav with any halachic question.'),
      React.createElement('p',{style:{color:'#888',fontSize:'0.85rem',marginTop:24}},'Governing law: Florida. Disputes will be resolved in Miami-Dade County, FL.')));
}

// ─── Admin Panel ─────────────────────────────────────────────────
function AdminPanel() {
  const [user,setUser]=useState(null);const [isAdmin,setIsAdmin]=useState(false);const [checking,setChecking]=useState(true);const [tab,setTab]=useState('rules');
  useEffect(()=>{const unsub=firebase.auth().onAuthStateChanged(async u=>{setUser(u);if(u){try{const t=await u.getIdToken();const r=await fetch(BACKEND_URL+'/api/admin/davening-rules',{headers:{'Authorization':'Bearer '+t}});setIsAdmin(r.ok);}catch{setIsAdmin(false);}}setChecking(false);});return unsub;},[]);
  if(checking) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Checking access...');
  if(!user||!isAdmin) return React.createElement(AdminLogin,{onLogin:()=>{setChecking(true);setTimeout(()=>setChecking(false),500);}});
  return React.createElement('div',null,
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}},
      React.createElement('p',{style:{color:'#888',fontSize:'0.9rem'}},'Logged in as: '+user.email),
      React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>firebase.auth().signOut()},'Sign Out')),
    React.createElement('div',{className:'admin-tabs'},
      ['rules','overrides','shiurim','emails','autoemails','donations','members','tags','pledges','reasons','settings','highholidays','seating','analytics','images','admins'].map(t=>React.createElement('button',{key:t,className:'admin-tab'+(tab===t?' active':''),onClick:()=>setTab(t)},
        t==='rules'?'Davening Rules':t==='overrides'?'Overrides':t==='shiurim'?'Shiurim':t==='emails'?'Email Center':t==='autoemails'?'Auto Emails':t==='donations'?'Donations':t==='members'?'Members':t==='tags'?'Member Tags':t==='pledges'?'Pledges/Billing':t==='reasons'?'Reasons':t==='settings'?'Settings':t==='highholidays'?'High Holidays':t==='seating'?'Seating':t==='analytics'?'Analytics':t==='images'?'Site Images':'Admins'))),
    tab==='rules'&&React.createElement(AdminRulesEditor),
    tab==='overrides'&&React.createElement(AdminOverrides),
    tab==='shiurim'&&React.createElement(AdminShiurim),
    tab==='emails'&&React.createElement(AdminEmailCenter),
    tab==='autoemails'&&React.createElement(AdminAutoEmails),
    tab==='donations'&&React.createElement(AdminDonations),
    tab==='members'&&React.createElement(AdminMembers),
    tab==='tags'&&React.createElement(AdminMemberTags),
    tab==='pledges'&&React.createElement(AdminPledges),
    tab==='reasons'&&React.createElement(AdminReasons),
    tab==='settings'&&React.createElement(AdminSettings),
    tab==='highholidays'&&React.createElement(AdminHighHolidays),
    tab==='seating'&&React.createElement(AdminSeating),
    tab==='analytics'&&React.createElement(AdminAnalytics),
    tab==='images'&&React.createElement(AdminImages),
    tab==='admins'&&React.createElement(AdminAccounts));
}

function AdminMemberTags() {
  const [tags,setTags]=useState([]);
  const [msg,setMsg]=useState('');
  const [form,setForm]=useState({name:'',annualDues:'',color:'#c49a3c',description:''});
  const [loading,setLoading]=useState(true);
  const [editingId,setEditingId]=useState(null);
  async function load(){setLoading(true);try{setTags(await apiFetch('/api/admin/member-tags'));}catch(e){setMsg('Error: '+e.message);}setLoading(false);}
  useEffect(()=>{load();},[]);
  async function save(e){
    e.preventDefault();setMsg('');
    if(!form.name){setMsg('Name required.');return;}
    const dues=parseFloat(form.annualDues);
    if(!Number.isFinite(dues)||dues<0){setMsg('Annual dues must be a non-negative number.');return;}
    try{
      if(editingId){
        await apiFetch('/api/admin/member-tags/'+editingId,{method:'PUT',body:JSON.stringify({...form,annualDues:dues})});
        setMsg('Tag updated.');
      } else {
        await apiFetch('/api/admin/member-tags',{method:'POST',body:JSON.stringify({...form,annualDues:dues})});
        setMsg('Tag created.');
      }
      setForm({name:'',annualDues:'',color:'#c49a3c',description:''});
      setEditingId(null);
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }
  function edit(t){setEditingId(t.id);setForm({name:t.name||'',annualDues:String(t.annualDues||0),color:t.color||'#c49a3c',description:t.description||''});}
  async function del(id){
    if(!confirm('Delete this tag? Any members currently tagged with it will have their tag cleared.'))return;
    try{const r=await apiFetch('/api/admin/member-tags/'+id,{method:'DELETE'});setMsg('Tag deleted. '+r.membersCleared+' member(s) cleared.');await load();}catch(e){setMsg('Error: '+e.message);}
  }
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')||msg.includes('required')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},editingId?'Edit Member Tag':'Create Member Tag'),
      React.createElement('p',{style:{color:'#555',marginBottom:12}},'Tags let you charge different annual dues to different categories of members (e.g. Full, Associate, Young Adult, Honorary, Staff). When a member has a tag, their auto-pay subscription uses the tag\'s dues amount instead of the global annualDues.'),
      React.createElement('form',{onSubmit:save},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 120px',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Tag Name *'),React.createElement('input',{className:'form-input',placeholder:'e.g. Full Member',value:form.name,onChange:e=>setForm(p=>({...p,name:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Annual Dues ($) *'),React.createElement('input',{className:'form-input',type:'number',min:'0',step:'0.01',value:form.annualDues,onChange:e=>setForm(p=>({...p,annualDues:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Badge Color'),React.createElement('input',{className:'form-input',type:'color',value:form.color,onChange:e=>setForm(p=>({...p,color:e.target.value}))}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Description (optional)'),React.createElement('input',{className:'form-input',value:form.description,onChange:e=>setForm(p=>({...p,description:e.target.value}))})),
        React.createElement('div',{style:{display:'flex',gap:8}},
          React.createElement('button',{className:'btn btn-primary',type:'submit'},editingId?'Save Changes':'Create Tag'),
          editingId&&React.createElement('button',{className:'btn btn-outline',type:'button',onClick:()=>{setEditingId(null);setForm({name:'',annualDues:'',color:'#c49a3c',description:''});}},'Cancel')))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'All Tags ('+tags.length+')'),
      loading?React.createElement('p',{style:{color:'#888'}},'Loading...'):
        tags.length===0?React.createElement('p',{style:{color:'#888'}},'No tags yet. Create one above to start using tiered membership dues.'):
        React.createElement('div',{className:'table-container'},React.createElement('table',null,
          React.createElement('thead',null,React.createElement('tr',null,['Tag','Annual Dues','Monthly (if paid that way)','Description','Actions'].map(h=>React.createElement('th',{key:h},h)))),
          React.createElement('tbody',null,tags.map(t=>React.createElement('tr',{key:t.id},
            React.createElement('td',null,React.createElement('span',{style:{display:'inline-block',padding:'3px 10px',borderRadius:12,background:(t.color||'#c49a3c')+'22',color:t.color||'#c49a3c',fontWeight:700,fontSize:'0.85rem'}},t.name)),
            React.createElement('td',{style:{fontWeight:700}},'$'+Number(t.annualDues||0).toFixed(2)),
            React.createElement('td',null,'$'+(Number(t.annualDues||0)/12).toFixed(2)),
            React.createElement('td',{style:{color:'#555'}},t.description||'-'),
            React.createElement('td',null,
              React.createElement('button',{className:'btn btn-sm btn-outline',style:{marginRight:6},onClick:()=>edit(t)},'Edit'),
              React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>del(t.id)},'Delete')))))))));
}

function AdminSeating() {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [msg,setMsg]=useState('');
  const [selected,setSelected]=useState(null);
  const [form,setForm]=useState({holder:'',reservationId:''});
  const [seeding,setSeeding]=useState(false);

  async function load(){
    setLoading(true);
    try{ setData(await apiFetch('/api/admin/seating/chart')); }catch(e){ setMsg('Error: '+e.message); }
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  function openAssign(seat){
    const existing=data.assignments[seat.number];
    setSelected(seat);
    setForm({
      holder:existing?.holder||'',
      reservationId:existing?.reservationId||''
    });
  }

  async function save(){
    if(!selected)return;
    try{
      const res=data.reservations.find(r=>r.id===form.reservationId);
      await apiFetch('/api/admin/seating/assign',{method:'PUT',body:JSON.stringify({
        seatNumber:selected.number,
        holder:form.holder||(res?res.displayName:''),
        reservationId:form.reservationId||null
      })});
      setSelected(null);
      await load();
      setMsg('Seat '+selected.number+' assigned.');
    }catch(e){setMsg('Error: '+e.message);}
  }

  async function clearSeat(){
    if(!selected)return;
    if(!confirm('Clear assignment for seat '+selected.number+'?'))return;
    try{
      await apiFetch('/api/admin/seating/'+selected.number,{method:'DELETE'});
      setSelected(null);
      await load();
      setMsg('Seat '+selected.number+' cleared.');
    }catch(e){setMsg('Error: '+e.message);}
  }

  async function seedHolders(){
    if(!confirm('Populate empty seats with the initial holder names from the Excel layout? Existing assignments will not be changed.'))return;
    setSeeding(true);
    try{
      const res=await apiFetch('/api/admin/seating/seed-holders',{method:'POST',body:JSON.stringify({})});
      setMsg('Seeded '+res.seeded+' seats ('+res.skipped+' skipped).');
      await load();
    }catch(e){setMsg('Error: '+e.message);}
    setSeeding(false);
  }

  async function clearAll(){
    if(!confirm('Clear ALL seat assignments? This will wipe every assignment on the chart. This cannot be undone.'))return;
    if(!confirm('Are you sure? Every seat will go back to unassigned.'))return;
    try{
      const res=await apiFetch('/api/admin/seating/clear-all',{method:'DELETE'});
      setMsg('Cleared '+res.cleared+' assignments.');
      await load();
    }catch(e){setMsg('Error: '+e.message);}
  }

  if(loading||!data) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading seating chart...');

  const maxCol=Math.max(...data.layout.seats.map(s=>s.col))+1;
  const maxRow=Math.max(...data.layout.seats.map(s=>s.row))+1;
  const mehitzah=data.layout.mehitzahRow;

  const assignedCount=Object.keys(data.assignments).length;
  const totalSeats=data.layout.seats.length;

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Seating Chart ('+assignedCount+'/'+totalSeats+' assigned)'),
        React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
          React.createElement('button',{className:'btn btn-sm btn-outline',disabled:seeding,onClick:seedHolders},seeding?'Seeding...':'Seed Holders from Excel'),
          React.createElement('button',{className:'btn btn-sm btn-danger',onClick:clearAll},'Clear All'),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:load},'Refresh'))),
      React.createElement('p',{style:{color:'#555',margin:'10px 0 16px',fontSize:'0.9rem'}},'Click any seat to assign a holder. Green = unassigned, gold = assigned. The horizontal bar is the mechitzah.'),
      React.createElement('div',{style:{overflowX:'auto',padding:12,background:'#faf8f3',borderRadius:8,border:'3px solid #1a2744'}},
        React.createElement('div',{className:'seating-chart',style:{
          display:'grid',
          gridTemplateColumns:'repeat('+maxCol+', 56px)',
          gridAutoRows:'22px',
          gap:1,
          width:'fit-content'
        }},
          // Section background panels (behind seats for grouping)
          React.createElement('div',{className:'section-frame ladies',style:{gridColumn:'6 / 16',gridRow:'1 / 11'}}),
          React.createElement('div',{className:'section-frame social',style:{gridColumn:'18 / 27',gridRow:'9 / 13'}}),
          React.createElement('div',{className:'section-frame mens-left',style:{gridColumn:'1 / 5',gridRow:'20 / 31'}}),
          React.createElement('div',{className:'section-frame mens-center',style:{gridColumn:'5 / 18',gridRow:'20 / 31'}}),
          React.createElement('div',{className:'section-frame mens-right',style:{gridColumn:'18 / 27',gridRow:'26 / 30'}}),
          // Section labels
          React.createElement('div',{className:'section-label',style:{gridColumn:'6 / 16',gridRow:'1 / 2'}},'Ladies Section'),
          React.createElement('div',{className:'section-label',style:{gridColumn:'18 / 27',gridRow:'9 / 10'}},'Social Hall (Ladies)'),
          React.createElement('div',{className:'section-label',style:{gridColumn:'1 / 5',gridRow:'20 / 21'}},'Men Pews'),
          React.createElement('div',{className:'section-label',style:{gridColumn:'5 / 18',gridRow:'20 / 21'}},'Men Section'),
          React.createElement('div',{className:'section-label',style:{gridColumn:'18 / 27',gridRow:'26 / 27'}},'Men (Right)'),
          // Seats
          data.layout.seats.flatMap(seat=>{
            const a=data.assignments[seat.number];
            const holder=a&&a.holder?a.holder:'';
            const isAssigned=!!holder;
            const cls=(isAssigned?'assigned ':'')+seat.section;
            const num=React.createElement('button',{
              key:'n'+seat.number,
              className:'seat-num-box '+cls,
              style:{gridColumn:(seat.col+1),gridRow:(seat.row+2)},
              title:'Seat '+seat.number+(holder?', '+holder:''),
              onClick:()=>openAssign(seat)
            },seat.number);
            const name=React.createElement('button',{
              key:'h'+seat.number,
              className:'seat-holder-box '+cls+(holder?'':' empty'),
              style:{gridColumn:(seat.col+1),gridRow:(seat.row+3)},
              title:'Seat '+seat.number+(holder?', '+holder:''),
              onClick:()=>openAssign(seat)
            },holder||'');
            return [num,name];
          }),
          React.createElement('div',{className:'mehitzah-bar',style:{
            gridColumn:'1 / -1',
            gridRow:(mehitzah+2)
          }},'MECHITZAH'))),
    selected&&React.createElement('div',{className:'card',style:{marginTop:16,border:'2px solid #c49a3c'}},
      React.createElement('div',{className:'card-header'},'Seat '+selected.number+' ('+selected.section+')'),
      React.createElement('div',{className:'form-group'},
        React.createElement('label',{className:'form-label'},'Holder Name'),
        React.createElement('input',{className:'form-input',value:form.holder,onChange:e=>setForm(p=>({...p,holder:e.target.value})),placeholder:'e.g. Kahn family'})),
      React.createElement('div',{className:'form-group'},
        React.createElement('label',{className:'form-label'},'Link to High-Holiday Reservation (optional)'),
        React.createElement('select',{className:'form-input',value:form.reservationId,onChange:e=>{
          const r=data.reservations.find(x=>x.id===e.target.value);
          setForm(p=>({reservationId:e.target.value,holder:r?r.displayName:p.holder}));
        }},
          React.createElement('option',{value:''},'(none)'),
          data.reservations.map(r=>React.createElement('option',{key:r.id,value:r.id},r.displayName+', '+r.numSeats+' seats')))),
      React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
        React.createElement('button',{className:'btn btn-primary',onClick:save},'Save'),
        data.assignments[selected.number]&&React.createElement('button',{className:'btn btn-danger',onClick:clearSeat},'Clear'),
        React.createElement('button',{className:'btn btn-outline',onClick:()=>setSelected(null)},'Cancel')))));
}

function AdminAutoEmails() {
  const [state,setState]=useState(null);
  const [msg,setMsg]=useState('');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    apiFetch('/api/admin/auto-emails').then(setState).catch(err=>setMsg('Error loading: '+err.message));
  },[]);
  async function toggle(key){
    if(!state||saving)return;
    const next={...state,[key]:!state[key]};
    setState(next);
    setSaving(true);
    try{
      await apiFetch('/api/admin/auto-emails',{method:'PUT',body:JSON.stringify({[key]:next[key]})});
      setMsg(next[key]?'Enabled.':'Disabled.');
    }catch(err){
      setState(state);
      setMsg('Error: '+err.message);
    }
    setSaving(false);
  }
  const rows=[
    {key:'master',label:'Reminder Scheduler (master switch)',desc:'Master switch for the daily reminder job. When OFF, no membership or pledge reminders are sent regardless of their individual switches.'},
    {key:'membership',label:'Membership Dues Reminders',desc:'Runs daily at 10:00 AM ET. Emails members with unpaid dues, respecting the reminder frequency set in Settings.'},
    {key:'pledge',label:'Pledge Reminders',desc:'Runs daily at 10:00 AM ET. Emails members with outstanding pledges after the configured start delay.'},
    {key:'fiscalYear',label:'Annual Tax Receipt Auto-Send',desc:'On January 1, automatically sends every donor a summary of their prior-year giving.'},
  ];
  if(!state) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  return React.createElement('div',null,
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Automatic Emails'),
      React.createElement('p',{style:{color:'#555',marginBottom:16}},'Toggle which emails fire automatically. Frequencies and amounts are configured under the Settings tab.'),
      msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
      React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:12}},
        rows.map(r=>{
          const on=!!state[r.key];
          const dimmed=r.key!=='master'&&r.key!=='fiscalYear'&&!state.master;
          return React.createElement('div',{key:r.key,style:{display:'flex',gap:16,alignItems:'center',padding:'14px 16px',border:'1px solid #eee',borderRadius:8,background:dimmed?'#fafafa':'#fff',opacity:dimmed?0.65:1}},
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontWeight:700,color:'#1a2744'}},r.label,dimmed&&React.createElement('span',{style:{fontWeight:400,color:'#888',marginLeft:8,fontSize:'0.85rem'}},'(master switch is off)')),
              React.createElement('p',{style:{fontSize:'0.85rem',color:'#666',margin:'4px 0 0'}},r.desc)),
            React.createElement('button',{
              className:'btn btn-sm '+(on?'btn-primary':'btn-outline'),
              disabled:saving,
              onClick:()=>toggle(r.key),
              style:{minWidth:90}
            },on?'On':'Off'));
        }))));
}

// ─── Admin Rules Editor ──────────────────────────────────────────
function AdminRulesEditor() {
  const [rules,setRules]=useState({});const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [msg,setMsg]=useState('');
  useEffect(()=>{apiFetch('/api/admin/davening-rules').then(d=>{setRules(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  function upd(k,v){setRules(p=>({...p,[k]:v}));}
  async function save(){setSaving(true);setMsg('');try{await apiFetch('/api/admin/davening-rules',{method:'PUT',body:JSON.stringify(rules)});setMsg('Rules saved!');}catch(e){setMsg('Error: '+e.message);}setSaving(false);}
  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  const fields=[
    {key:'weekdayShacharis',label:'Weekday Shacharis (Mon-Fri)',def:'6:55 AM',desc:'Regular weekday morning prayer'},
    {key:'sundayShacharis',label:'Sunday Shacharis',def:'8:15 AM',desc:'Sunday morning prayer'},
    {key:'holidayShacharis',label:'Legal Holiday Shacharis',def:'8:15 AM',desc:'US legal holidays'},
    {key:'cholHamoedShacharis',label:'Chol HaMoed Shacharis',def:'8:15 AM',desc:'Intermediate days of Sukkos/Pesach'},
    {key:'selichosShacharis',label:'Selichos Days Shacharis',def:'6:45 AM',desc:'Days with Selichos (Ashkenaz)'},
    {key:'asereYemeiShacharis',label:'Aseres Yemei Teshuva Shacharis',def:'6:35 AM',desc:'Ten Days of Repentance'},
    {key:'roshChodeshShacharis',label:'Rosh Chodesh Shacharis',def:'6:45 AM',desc:'Rosh Chodesh morning (not on Shabbos)'},
    {key:'shabbosYomTovShacharis',label:'Shabbos & Yom Tov Shacharis',def:'9:00 AM',desc:'Shabbos and Yom Tov mornings'},
    {key:'shabbosMinchaMinsBefore',label:'Shabbos Mincha (mins before shkia)',def:30,desc:'Rounded down to nearest 5 min',type:'number'},
    {key:'fridayStdMinchaMinsBefore',label:'Friday Mincha Std Time (mins before shkia)',def:15,desc:'Also used for Yom Tov Mincha',type:'number'},
    {key:'fridayEarlyMinchaMinsBeforePlag',label:'Friday Early Mincha (mins before plag hamincha)',def:0,desc:'DST Fridays only. 0 = at plag. Rounded down to nearest 5 min.',type:'number'},
    {key:'motzeiShabbosMinsBefore',label:'Motzei Shabbos Maariv (mins before tzeis)',def:10,desc:'Minutes before tzeis hakochavim',type:'number'},
  ];
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'rules-grid'},fields.map(f=>React.createElement('div',{className:'rule-card',key:f.key},
      React.createElement('div',{className:'rule-card-title'},f.label),
      React.createElement('input',{type:f.type||'text',value:rules[f.key]!==undefined?rules[f.key]:f.def,onChange:e=>upd(f.key,f.type==='number'?parseInt(e.target.value)||0:e.target.value),placeholder:String(f.def)}),
      React.createElement('div',{className:'rule-description'},f.desc)))),
    React.createElement('div',{style:{marginTop:20}},React.createElement('button',{className:'btn btn-primary',onClick:save,disabled:saving},saving?'Saving...':'Save All Rules')),
    React.createElement('div',{className:'card',style:{marginTop:24}},
      React.createElement('div',{className:'card-header'},'How Auto-Calculated Times Work'),
      React.createElement('p',{style:{lineHeight:1.8,fontSize:'0.95rem'}},'Weekday Mincha/Maariv during DST: 10 min before plag, rounded down to nearest 5 min. During standard time: 10 min before sunset, rounded down to nearest 5. Friday night DST: an early mincha shows based on plag hamincha, using the "mins before plag" value above (0 = at plag). All times can be overridden for specific dates using Schedule Overrides.')));
}

// ─── Admin Overrides ─────────────────────────────────────────────
function AdminOverrides() {
  const [overrides,setOverrides]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [nd,setNd]=useState('');const [nt,setNt]=useState({shacharis:'',mincha:'',maariv:'',earlyMincha:'',minchaMaariv:''});const [nn,setNn]=useState('');
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);try{setOverrides(await apiFetch('/api/admin/schedule-overrides'));}catch(e){}setLoading(false);}
  async function add(){if(!nd)return;setMsg('');try{const times={};Object.entries(nt).forEach(([k,v])=>{if(v)times[k]=v;});await apiFetch('/api/admin/schedule-override',{method:'POST',body:JSON.stringify({date:nd,times,note:nn})});setMsg('Override added!');setNd('');setNt({shacharis:'',mincha:'',maariv:'',earlyMincha:'',minchaMaariv:''});setNn('');load();}catch(e){setMsg('Error: '+e.message);}}
  async function del(date){if(!confirm('Delete override for '+date+'?'))return;try{await apiFetch('/api/admin/schedule-override/'+date,{method:'DELETE'});load();}catch(e){setMsg('Error: '+e.message);}}
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Add Schedule Override'),
      React.createElement('p',{style:{marginBottom:16,color:'#888',fontSize:'0.9rem'}},'Override auto-calculated times for a specific date. Only fill in times you want to change.'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:12}},
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Date'),React.createElement('input',{className:'form-input',type:'date',value:nd,onChange:e=>setNd(e.target.value)})),
        Object.entries({shacharis:'Shacharis',mincha:'Mincha',maariv:'Maariv',earlyMincha:'Early Mincha',minchaMaariv:'Mincha/Maariv'}).map(([k,l])=>
          React.createElement('div',{className:'form-group',key:k},React.createElement('label',{className:'form-label'},l),React.createElement('input',{className:'form-input',placeholder:'e.g. 7:00 PM',value:nt[k],onChange:e=>setNt(p=>({...p,[k]:e.target.value}))}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Note'),React.createElement('input',{className:'form-input',placeholder:'e.g. Rosh Hashana Day 1',value:nn,onChange:e=>setNn(e.target.value)}))),
      React.createElement('button',{className:'btn btn-primary',onClick:add,style:{marginTop:12}},'Add Override')),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Current Overrides'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      overrides.length===0?React.createElement('p',{style:{color:'#888'}},'No overrides set.'):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,React.createElement('th',null,'Date'),React.createElement('th',null,'Times'),React.createElement('th',null,'Note'),React.createElement('th',null,'Actions'))),
        React.createElement('tbody',null,overrides.map(o=>React.createElement('tr',{key:o.date},
          React.createElement('td',null,formatDisplayDate(o.date)),
          React.createElement('td',null,Object.entries(o.times||{}).map(([k,v])=>k+': '+v).join(', ')||'None'),
          React.createElement('td',null,o.note||'-'),
          React.createElement('td',null,React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>del(o.date)},'Delete')))))))));
}

// ─── Admin Shiurim ───────────────────────────────────────────────
function AdminShiurim() {
  const [shiurim,setShiurim]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [form,setForm]=useState({title:'',rabbi:'',time:'',dayOfWeek:0,topic:'',recurring:true,location:''});
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);try{setShiurim(await apiFetch('/api/shiurim'));}catch(e){}setLoading(false);}
  async function add(){if(!form.title)return;try{await apiFetch('/api/admin/shiurim',{method:'POST',body:JSON.stringify(form)});setForm({title:'',rabbi:'',time:'',dayOfWeek:0,topic:'',recurring:true,location:''});setMsg('Shiur added!');load();}catch(e){setMsg('Error: '+e.message);}}
  async function del(id){if(!confirm('Delete?'))return;try{await apiFetch('/api/admin/shiurim/'+id,{method:'DELETE'});load();}catch(e){setMsg('Error: '+e.message);}}
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Add Shiur'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:12}},
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Title *'),React.createElement('input',{className:'form-input',value:form.title,onChange:e=>setForm(p=>({...p,title:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Rabbi / Speaker'),React.createElement('input',{className:'form-input',value:form.rabbi,onChange:e=>setForm(p=>({...p,rabbi:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Time'),React.createElement('input',{className:'form-input',placeholder:'e.g. 8:00 PM',value:form.time,onChange:e=>setForm(p=>({...p,time:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Day of Week'),
          React.createElement('select',{className:'form-input',value:form.dayOfWeek,onChange:e=>setForm(p=>({...p,dayOfWeek:parseInt(e.target.value)}))},DAY_NAMES.map((d,i)=>React.createElement('option',{value:i,key:i},d)))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Topic / Description'),React.createElement('input',{className:'form-input',value:form.topic,onChange:e=>setForm(p=>({...p,topic:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Location'),React.createElement('input',{className:'form-input',placeholder:'e.g. Main Shul, Social Hall',value:form.location,onChange:e=>setForm(p=>({...p,location:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Schedule Type'),
          React.createElement('select',{className:'form-input',value:form.recurring?'recurring':'oneTime',onChange:e=>setForm(p=>({...p,recurring:e.target.value==='recurring'}))},
            React.createElement('option',{value:'recurring'},'Weekly Recurring'),
            React.createElement('option',{value:'oneTime'},'One-Time Event')))),
      React.createElement('button',{className:'btn btn-primary',onClick:add,style:{marginTop:12}},'Add Shiur')),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Current Shiurim ('+shiurim.length+')'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      shiurim.length===0?React.createElement('p',{style:{color:'#888'}},'No shiurim yet.'):
      shiurim.map(s=>React.createElement('div',{className:'shiur-card',key:s.id},
        React.createElement('div',{className:'shiur-day'},DAY_NAMES[s.dayOfWeek]?.substring(0,3)||'?'),
        React.createElement('div',{className:'shiur-info'},
          React.createElement('div',{className:'shiur-title'},s.title,s.recurring===false&&React.createElement('span',{style:{marginLeft:6,fontSize:'0.7rem',background:'rgba(196,154,60,0.15)',color:'#c49a3c',padding:'2px 6px',borderRadius:8}},'One-time')),
          React.createElement('div',{className:'shiur-details'},[s.time,s.rabbi,s.topic,s.location].filter(Boolean).join(' • '))),
        React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>del(s.id)},'Delete')))));
}

// ─── Admin Accounts ──────────────────────────────────────────────
function AdminAccounts() {
  const [admins,setAdmins]=useState([]);const [loading,setLoading]=useState(true);const [email,setEmail]=useState('');const [msg,setMsg]=useState('');
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);try{setAdmins(await apiFetch('/api/admin/users'));}catch(e){}setLoading(false);}
  async function add(){if(!email)return;setMsg('');try{await apiFetch('/api/admin/make-admin',{method:'POST',body:JSON.stringify({email})});setMsg('Admin added!');setEmail('');load();}catch(e){setMsg('Error: '+e.message);}}
  async function remove(uid){if(!confirm('Remove admin?'))return;try{await apiFetch('/api/admin/remove-admin',{method:'POST',body:JSON.stringify({uid})});load();}catch(e){setMsg('Error: '+e.message);}}
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Add Admin'),
      React.createElement('p',{style:{marginBottom:12,color:'#888',fontSize:'0.9rem'}},'Enter email of an existing user to grant admin access.'),
      React.createElement('div',{style:{display:'flex',gap:12,alignItems:'flex-end'}},
        React.createElement('div',{className:'form-group',style:{flex:1,marginBottom:0}},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:email,onChange:e=>setEmail(e.target.value)})),
        React.createElement('button',{className:'btn btn-primary',onClick:add},'Grant Admin'))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Current Admins'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      admins.length===0?React.createElement('p',{style:{color:'#888'}},'No admin accounts found.'):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,React.createElement('th',null,'Email'),React.createElement('th',null,'Actions'))),
        React.createElement('tbody',null,admins.map(a=>React.createElement('tr',{key:a.id},React.createElement('td',null,a.email||a.id),React.createElement('td',null,React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>remove(a.id)},'Remove')))))))));
}

// ─── Phase 2 components ─────────────────────────────────────────
// ─── Phase 2: Donations, Sponsorships, Accounts, Analytics ──────

// ─── Donation Page ───────────────────────────────────────────────
function DonatePage() {
  const [reasons,setReasons]=useState([]);
  const [form,setForm]=useState({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:''});
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState('');
  const [step,setStep]=useState('form');
  const [cardReady,setCardReady]=useState(false);
  const cardMountRef=useRef(null);
  const stripeRef=useRef(null);
  const cardElementRef=useRef(null);

  useEffect(()=>{apiFetch('/api/donations/reasons').then(setReasons).catch(()=>setReasons(['General Donation','Membership Dues','Building Fund','Torah Fund','Yahrzeit','In Honor Of','In Memory Of','Other']));},[]);

  useEffect(()=>{
    if(step!=='form') return;
    if(!window.Stripe){setMsg('Payment library failed to load. Please refresh the page.');return;}
    if(cardElementRef.current) return;
    const stripe=window.Stripe(STRIPE_PUBLISHABLE_KEY);
    const elements=stripe.elements();
    const card=elements.create('card',{style:{base:{fontSize:'18px',color:'#1a2744',fontFamily:'inherit','::placeholder':{color:'#888'}},invalid:{color:'#b00020'}}});
    let mounted=false;
    const mount=()=>{
      if(mounted) return;
      if(cardMountRef.current){card.mount(cardMountRef.current);mounted=true;}
      else setTimeout(mount,50);
    };
    mount();
    stripeRef.current=stripe;
    cardElementRef.current=card;
    setCardReady(true);
    return ()=>{try{card.destroy();}catch{}cardElementRef.current=null;setCardReady(false);};
  },[step]);

  function upd(k,v){setForm(p=>({...p,[k]:v}));}

  async function handleDonate(e){
    e.preventDefault();
    if(!form.amount||!form.firstName||!form.lastName||!form.email){setMsg('Please fill all required fields.');return;}
    if(!stripeRef.current||!cardElementRef.current){setMsg('Payment form is still loading. Please wait a moment and try again.');return;}
    setLoading(true);setMsg('');
    try{
      const pi=await apiFetch('/api/donations/create-payment',{method:'POST',body:JSON.stringify({...form,amount:parseFloat(form.amount),type:'donation'})});
      const result=await stripeRef.current.confirmCardPayment(pi.clientSecret,{
        payment_method:{
          card:cardElementRef.current,
          billing_details:{
            name:(form.firstName+' '+form.lastName).trim(),
            email:form.email,
            phone:form.phone||undefined
          }
        }
      });
      if(result.error){setMsg(result.error.message||'Payment failed. Please check your card details.');setLoading(false);return;}
      if(result.paymentIntent?.status!=='succeeded'){setMsg('Payment did not complete. Status: '+(result.paymentIntent?.status||'unknown'));setLoading(false);return;}
      await apiFetch('/api/donations/confirm',{method:'POST',body:JSON.stringify({...form,amount:parseFloat(form.amount),paymentIntentId:result.paymentIntent.id,type:'donation'})});
      setStep('done');
    }catch(err){setMsg('Error: '+err.message);}
    setLoading(false);
  }

  if(step==='done') return React.createElement('div',null,React.createElement('div',{className:'card',style:{textAlign:'center',padding:40}},
    React.createElement('div',{style:{fontSize:'3rem',marginBottom:16}},'✅'),
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'Thank You!'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Your donation of $'+form.amount+' has been received. A receipt will be sent to '+form.email+'.'),
    React.createElement('button',{className:'btn btn-primary',style:{marginTop:20},onClick:()=>{setStep('form');setForm({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:''});}},'Make Another Donation')));

  return React.createElement('div',{style:{maxWidth:600,margin:'0 auto'}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Make a Donation'),
      React.createElement('p',{style:{marginBottom:20,color:'#555'}},'Support Congregation Ohr Chaim. All donations are tax-deductible.'),
      msg&&React.createElement('div',{className:'message message-error'},msg),
      React.createElement('form',{onSubmit:handleDonate},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:form.firstName,onChange:e=>upd('firstName',e.target.value),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:form.lastName,onChange:e=>upd('lastName',e.target.value),required:true}))),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email *'),React.createElement('input',{className:'form-input',type:'email',value:form.email,onChange:e=>upd('email',e.target.value),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:form.phone,onChange:e=>upd('phone',e.target.value)}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Amount ($) *'),
          React.createElement('input',{className:'form-input',type:'number',min:'1',step:'0.01',value:form.amount,onChange:e=>upd('amount',e.target.value),required:true,style:{fontSize:'1.2rem',fontWeight:700}})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Reason for Donation'),
          React.createElement('select',{className:'form-input',value:form.reason,onChange:e=>upd('reason',e.target.value)},
            reasons.map(r=>React.createElement('option',{key:r,value:r},r)))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Note / Dedication (optional)'),
          React.createElement('input',{className:'form-input',value:form.note,onChange:e=>upd('note',e.target.value),placeholder:'In honor of... / In memory of...'})),
        React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Card Details *'),
          React.createElement('div',{ref:cardMountRef,style:{padding:'14px 14px',border:'1px solid #d4cfc4',borderRadius:8,background:'#fff',minHeight:52}}),
          React.createElement('p',{style:{fontSize:'0.85rem',color:'#888',marginTop:6}},'Secured by Stripe. We never see or store your card number.')),
        React.createElement('button',{className:'btn btn-primary btn-block',type:'submit',disabled:loading||!cardReady,style:{marginTop:8,fontSize:'1.1rem',padding:'14px 28px'}},
          loading?'Processing...':'💝 Donate $'+(form.amount||'0')))));
}

// ─── Sponsorship Page ────────────────────────────────────────────
function SponsorshipPage() {
  const [data,setData]=useState(null);const [loading,setLoading]=useState(true);
  const [selectedDate,setSelectedDate]=useState('');const [selectedType,setSelectedType]=useState('kiddush');
  const [form,setForm]=useState({firstName:'',lastName:'',email:'',phone:'',dedication:''});
  const [booking,setBooking]=useState(false);const [msg,setMsg]=useState('');const [done,setDone]=useState(false);
  useEffect(()=>{apiFetch('/api/sponsorships').then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  function upd(k,v){setForm(p=>({...p,[k]:v}));}
  async function handleBook(e){
    e.preventDefault();
    if(!selectedDate||!form.firstName||!form.lastName||!form.email){setMsg('Please fill all required fields.');return;}
    setBooking(true);setMsg('');
    try{await apiFetch('/api/sponsorships/book',{method:'POST',body:JSON.stringify({date:selectedDate,type:selectedType,...form})});setDone(true);}catch(err){setMsg(err.message);}
    setBooking(false);
  }
  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  if(done) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:40,maxWidth:600,margin:'0 auto'}},
    React.createElement('div',{style:{fontSize:'3rem',marginBottom:16}},'🎉'),
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'Sponsorship Confirmed!'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Your '+(selectedType==='kiddush'?'Kiddush':'Seudas Shlishis')+' for '+formatDisplayDate(selectedDate)+' has been confirmed.'),
    React.createElement('button',{className:'btn btn-primary',style:{marginTop:20},onClick:()=>{setDone(false);setForm({firstName:'',lastName:'',email:'',phone:'',dedication:''});setSelectedDate('');}},'Back'));
  if(!data) return React.createElement('p',null,'Unable to load.');
  const upcoming=data.upcoming||[];const reservations=data.reservations||{};const pricing=data.pricing||{};const parshaMap=data.parshaMap||{};const dateLabels=data.dateLabels||{};
  return React.createElement('div',{style:{maxWidth:700,margin:'0 auto'}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Sponsor Kiddush or Seudas Shlishis'),
      React.createElement('p',{style:{marginBottom:16,color:'#555'}},'Choose an upcoming Shabbos or Yom Tov below. Reservation cutoff: Wednesday at 8:00 PM.'),
      React.createElement('p',{style:{marginBottom:20,fontSize:'0.9rem',color:'#888'}},'Kiddush: $'+(pricing.kiddushPrice||'TBD')+' • Seudas Shlishis: $'+(pricing.seudasShlishisPrice||'TBD')),
      React.createElement('div',{className:'form-group'},
        React.createElement('label',{className:'form-label'},'Select Shabbos / Yom Tov'),
        React.createElement('select',{className:'form-input',value:selectedDate,onChange:e=>setSelectedDate(e.target.value)},
          React.createElement('option',{value:''},'-- Choose a Date --'),
          upcoming.map(d=>{
            const label=dateLabels[d]?dateLabels[d]:parshaMap[d]?parshaMap[d]:'';
            return React.createElement('option',{key:d,value:d},formatDisplayDate(d)+(label?' - '+label:''));
          }))),
      selectedDate&&React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}},
        ['kiddush','seudasShlishis'].map(t=>{
          const res=reservations[selectedDate]?.[t];const taken=!!res;
          const label=t==='kiddush'?'Kiddush':'Seudas Shlishis';
          return React.createElement('div',{key:t,className:'sponsor-card'+(taken?' taken':' available'),
            style:{cursor:taken?'default':'pointer',border:selectedType===t&&!taken?'3px solid #c49a3c':undefined},
            onClick:()=>{if(!taken)setSelectedType(t);}},
            React.createElement('div',{className:'sponsor-status '+(taken?'taken':'available')},taken?'TAKEN':'AVAILABLE'),
            React.createElement('div',{style:{fontSize:'1.1rem',fontWeight:700,color:'#1a2744'}},label),
            taken&&res&&React.createElement('div',{style:{fontSize:'0.85rem',color:'#555',marginTop:8}},'Sponsored by '+res.displayName));
        })),
      selectedDate&&!reservations[selectedDate]?.[selectedType]&&React.createElement('div',null,
        msg&&React.createElement('div',{className:'message message-error'},msg),
        React.createElement('form',{onSubmit:handleBook},
          React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:form.firstName,onChange:e=>upd('firstName',e.target.value),required:true})),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:form.lastName,onChange:e=>upd('lastName',e.target.value),required:true}))),
          React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email *'),React.createElement('input',{className:'form-input',type:'email',value:form.email,onChange:e=>upd('email',e.target.value),required:true})),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:form.phone,onChange:e=>upd('phone',e.target.value)}))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Dedication (e.g. In honor of...)'),React.createElement('input',{className:'form-input',value:form.dedication,onChange:e=>upd('dedication',e.target.value)})),
          React.createElement('button',{className:'btn btn-primary btn-block',type:'submit',disabled:booking,style:{marginTop:8}},booking?'Booking...':'Confirm Sponsorship')))));
}

// ─── Account Page ────────────────────────────────────────────────
function AccountPage() {
  const [user,setUser]=useState(null);const [profile,setProfile]=useState(null);const [loading,setLoading]=useState(true);
  const [authMode,setAuthMode]=useState('login');
  const [loginForm,setLoginForm]=useState({email:'',password:''});
  const [regForm,setRegForm]=useState({firstName:'',lastName:'',email:'',phone:'',address:'',password:'',spouseEmail:''});
  const [error,setError]=useState('');const [editing,setEditing]=useState(false);const [editForm,setEditForm]=useState({});const [msg,setMsg]=useState('');
  const [subStatus,setSubStatus]=useState(null);
  const [subBusy,setSubBusy]=useState(false);
  const [yahrzeits,setYahrzeits]=useState([]);
  const [yahrzeitForm,setYahrzeitForm]=useState({deceasedName:'',relationship:'',englishDeathDate:'',notes:''});
  const [yahrzeitBusy,setYahrzeitBusy]=useState(false);
  const siteImages=useSiteImages();
  useEffect(()=>{const unsub=firebase.auth().onAuthStateChanged(u=>{setUser(u);setLoading(false);});return unsub;},[]);
  useEffect(()=>{if(user){
    apiFetch('/api/auth/profile').then(p=>{setProfile(p);setEditForm({firstName:p.firstName||'',lastName:p.lastName||'',phone:p.phone||'',address:p.address||'',bio:p.bio||''});}).catch(()=>{});
    apiFetch('/api/membership/subscription-status').then(setSubStatus).catch(()=>setSubStatus({active:false}));
    apiFetch('/api/yahrzeits').then(setYahrzeits).catch(()=>{});
  }},[user]);
  useEffect(()=>{
    const hash=window.location.hash;
    if(hash.includes('sub=success')) setMsg('Automatic payment set up! Thank you.');
    else if(hash.includes('sub=cancel')) setMsg('Checkout canceled. You can try again anytime.');
  },[]);

  async function startSubscription(interval){
    setSubBusy(true);setMsg('');
    try{
      const res=await apiFetch('/api/membership/create-subscription-checkout',{method:'POST',body:JSON.stringify({interval})});
      if(res.url) window.location.href=res.url;
    }catch(e){setMsg('Error: '+e.message);setSubBusy(false);}
  }

  async function addYahrzeit(e){
    e.preventDefault();
    if(!yahrzeitForm.deceasedName||!yahrzeitForm.englishDeathDate){setMsg('Name and English date are required.');return;}
    setYahrzeitBusy(true);setMsg('');
    try{
      await apiFetch('/api/yahrzeits',{method:'POST',body:JSON.stringify(yahrzeitForm)});
      setYahrzeitForm({deceasedName:'',relationship:'',englishDeathDate:'',notes:''});
      setYahrzeits(await apiFetch('/api/yahrzeits'));
      setMsg('Yahrzeit added. A reminder email will go out 10 days before each year.');
    }catch(err){setMsg('Error: '+err.message);}
    setYahrzeitBusy(false);
  }
  async function deleteYahrzeit(id){
    if(!confirm('Remove this yahrzeit? No more reminders will be sent.'))return;
    try{
      await apiFetch('/api/yahrzeits/'+id,{method:'DELETE'});
      setYahrzeits(await apiFetch('/api/yahrzeits'));
    }catch(err){setMsg('Error: '+err.message);}
  }

  async function cancelSubscription(){
    if(!confirm('Cancel automatic membership payment? You will remain a paid member through the end of your current period, then auto-pay will stop.'))return;
    setSubBusy(true);setMsg('');
    try{
      await apiFetch('/api/membership/cancel-subscription',{method:'POST',body:JSON.stringify({})});
      setMsg('Automatic payment canceled. It will not renew.');
      const s=await apiFetch('/api/membership/subscription-status').catch(()=>({active:false}));
      setSubStatus(s);
    }catch(e){setMsg('Error: '+e.message);}
    setSubBusy(false);
  }
  useEffect(()=>{const hash=window.location.hash;if(hash.includes('token=')){const token=hash.split('token=')[1]?.split('&')[0];if(token){setAuthMode('prefill');apiFetch('/api/auth/prefill/'+token).then(d=>{setRegForm(p=>({...p,firstName:d.firstName||'',lastName:d.lastName||'',email:d.email||'',phone:d.phone||'',address:d.address||'',spouseEmail:d.spouseEmail||''}));}).catch(err=>setError(err.message));}}},[]);

  async function handleLogin(e){e.preventDefault();setError('');try{await firebase.auth().signInWithEmailAndPassword(loginForm.email,loginForm.password);}catch(err){setError(err.message);}}
  async function handleForgotPassword(){
    const email=(loginForm.email||prompt('Enter the email on your account:')||'').trim();
    if(!email)return;
    setError('');
    try{
      await firebase.auth().sendPasswordResetEmail(email);
      setError('Password reset email sent to '+email+'. Check your inbox.');
    }catch(err){setError(err.message);}
  }
  async function handleRegister(e){e.preventDefault();setError('');
    if(!regForm.firstName||!regForm.lastName||!regForm.email||!regForm.password){setError('All required fields must be filled.');return;}
    try{const hash=window.location.hash;const token=hash.includes('token=')?hash.split('token=')[1]?.split('&')[0]:null;
      if(token){await apiFetch('/api/auth/claim-prefill',{method:'POST',body:JSON.stringify({token,password:regForm.password})});
      }else{await apiFetch('/api/auth/register',{method:'POST',body:JSON.stringify(regForm)});}
      await firebase.auth().signInWithEmailAndPassword(regForm.email,regForm.password);
    }catch(err){setError(err.message);}}
  async function saveProfile(){setMsg('');try{await apiFetch('/api/auth/profile',{method:'PUT',body:JSON.stringify(editForm)});setProfile(p=>({...p,...editForm}));setEditing(false);setMsg('Profile updated!');}catch(e){setMsg('Error: '+e.message);}}

  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  if(!user) return React.createElement('div',{className:'auth-container'},
    siteImages.loginLogo&&React.createElement('img',{src:siteImages.loginLogo,alt:'Congregation Ohr Chaim',className:'auth-logo'}),
    React.createElement('div',{className:'auth-title'},authMode==='prefill'?'Complete Your Account':'My Account'),
    React.createElement('div',{className:'auth-subtitle'},'Congregation Ohr Chaim'),
    error&&React.createElement('div',{className:'message message-error'},error),
    authMode==='login'?React.createElement('form',{onSubmit:handleLogin},
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:loginForm.email,onChange:e=>setLoginForm(p=>({...p,email:e.target.value})),required:true})),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Password'),React.createElement('input',{className:'form-input',type:'password',value:loginForm.password,onChange:e=>setLoginForm(p=>({...p,password:e.target.value})),required:true})),
      React.createElement('button',{className:'btn btn-primary btn-block',type:'submit'},'Sign In'),
      React.createElement('p',{style:{marginTop:12,textAlign:'center'}},React.createElement('a',{href:'#',onClick:e=>{e.preventDefault();handleForgotPassword();},style:{color:'#c49a3c',fontWeight:600,fontSize:'0.9rem'}},'Forgot password?')),
      React.createElement('p',{style:{marginTop:16,textAlign:'center',color:'#888'}},'No account? ',React.createElement('a',{href:'#',onClick:e=>{e.preventDefault();setAuthMode('register');},style:{color:'#c49a3c',fontWeight:600}},'Create one'))
    ):React.createElement('form',{onSubmit:handleRegister},
      authMode==='prefill'&&React.createElement('div',{className:'message message-success',style:{marginBottom:16}},'Your info is pre-filled! Just create a password.'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:regForm.firstName,onChange:e=>setRegForm(p=>({...p,firstName:e.target.value})),required:true})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:regForm.lastName,onChange:e=>setRegForm(p=>({...p,lastName:e.target.value})),required:true}))),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email *'),React.createElement('input',{className:'form-input',type:'email',value:regForm.email,onChange:e=>setRegForm(p=>({...p,email:e.target.value})),required:true,readOnly:authMode==='prefill'})),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:regForm.phone,onChange:e=>setRegForm(p=>({...p,phone:e.target.value}))})),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Address'),React.createElement('input',{className:'form-input',value:regForm.address,onChange:e=>setRegForm(p=>({...p,address:e.target.value}))})),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Spouse Email (optional)'),React.createElement('input',{className:'form-input',type:'email',value:regForm.spouseEmail,onChange:e=>setRegForm(p=>({...p,spouseEmail:e.target.value}))})),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Password *'),React.createElement('input',{className:'form-input',type:'password',value:regForm.password,onChange:e=>setRegForm(p=>({...p,password:e.target.value})),required:true,minLength:6})),
      React.createElement('button',{className:'btn btn-primary btn-block',type:'submit'},'Create Account'),
      authMode!=='prefill'&&React.createElement('p',{style:{marginTop:16,textAlign:'center',color:'#888'}},'Have an account? ',React.createElement('a',{href:'#',onClick:e=>{e.preventDefault();setAuthMode('login');},style:{color:'#c49a3c',fontWeight:600}},'Sign in'))));
  return React.createElement('div',{style:{maxWidth:600,margin:'0 auto'}},
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'My Profile'),
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}},
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:700,color:'#1a2744'}},profile?.displayName||user.email),
          React.createElement('div',{style:{color:'#888'}},profile?.email)),
        React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>firebase.auth().signOut()},'Sign Out')),
      editing?React.createElement('div',null,
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name'),React.createElement('input',{className:'form-input',value:editForm.firstName,onChange:e=>setEditForm(p=>({...p,firstName:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name'),React.createElement('input',{className:'form-input',value:editForm.lastName,onChange:e=>setEditForm(p=>({...p,lastName:e.target.value}))}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',value:editForm.phone,onChange:e=>setEditForm(p=>({...p,phone:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Address'),React.createElement('input',{className:'form-input',value:editForm.address,onChange:e=>setEditForm(p=>({...p,address:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Bio'),React.createElement('textarea',{className:'form-input',rows:3,value:editForm.bio,onChange:e=>setEditForm(p=>({...p,bio:e.target.value}))})),
        React.createElement('div',{style:{display:'flex',gap:12}},React.createElement('button',{className:'btn btn-primary',onClick:saveProfile},'Save'),React.createElement('button',{className:'btn btn-outline',onClick:()=>setEditing(false)},'Cancel'))
      ):React.createElement('div',null,
        [['Phone',profile?.phone],['Address',profile?.address],['Bio',profile?.bio],['Spouse',profile?.spouseEmail]].filter(([_,v])=>v).map(([l,v])=>
          React.createElement('div',{key:l,style:{padding:'8px 0',borderBottom:'1px solid #f0ece3'}},React.createElement('span',{style:{color:'#888',marginRight:12}},l+':'),React.createElement('span',{style:{fontWeight:500}},v))),
        React.createElement('button',{className:'btn btn-sm btn-outline',style:{marginTop:16},onClick:()=>setEditing(true)},'Edit Profile'))),
    React.createElement('div',{className:'card',style:{marginTop:16}},
      React.createElement('div',{className:'card-header'},'Membership Payment'),
      profile?.membershipPaid
        ?React.createElement('div',{style:{padding:'8px 12px',background:'rgba(39,174,96,0.1)',color:'#27ae60',borderRadius:6,fontWeight:700,marginBottom:12}},'Paid for this fiscal year')
        :React.createElement('div',{style:{padding:'8px 12px',background:'rgba(176,0,32,0.08)',color:'#b00020',borderRadius:6,fontWeight:700,marginBottom:12}},'Dues not paid yet'),
      subStatus?.active
        ?React.createElement('div',null,
          React.createElement('p',{style:{margin:'4px 0'}},React.createElement('strong',null,'Automatic payment: '),'Active'),
          React.createElement('p',{style:{margin:'4px 0'}},React.createElement('strong',null,'Billing: '),'$'+(subStatus.amount||0).toFixed(2)+' every '+(subStatus.interval==='month'?'month':'year')),
          subStatus.currentPeriodEnd&&React.createElement('p',{style:{margin:'4px 0'}},React.createElement('strong',null,'Next charge: '),new Date(subStatus.currentPeriodEnd).toLocaleDateString()),
          subStatus.cancelAtPeriodEnd&&React.createElement('p',{style:{margin:'4px 0',color:'#b00020',fontWeight:600}},'This subscription will stop renewing at the end of the current period.'),
          !subStatus.cancelAtPeriodEnd&&React.createElement('button',{className:'btn btn-danger btn-sm',disabled:subBusy,onClick:cancelSubscription,style:{marginTop:8}},subBusy?'Working...':'Cancel automatic payment'))
        :React.createElement('div',null,
          React.createElement('p',{style:{color:'#555',marginBottom:12}},'Set up automatic membership payments. Pay the full annual amount once per year, or spread it across 12 monthly installments. Paying activates your membership automatically.'),
          React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
            React.createElement('button',{className:'btn btn-primary',disabled:subBusy,onClick:()=>startSubscription('year')},subBusy?'Loading...':'Pay annually'),
            React.createElement('button',{className:'btn btn-primary',disabled:subBusy,onClick:()=>startSubscription('month')},subBusy?'Loading...':'Pay monthly')))),
    React.createElement('div',{className:'card',style:{marginTop:16}},
      React.createElement('div',{className:'card-header'},'Yahrzeit Reminders'),
      React.createElement('p',{style:{color:'#555',marginBottom:12}},'Add yahrzeit dates for loved ones. We will email you a reminder 10 days before each year\'s observance.'),
      yahrzeits.length>0&&React.createElement('div',{style:{marginBottom:16}},
        yahrzeits.map(y=>React.createElement('div',{key:y.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',border:'1px solid #eee',borderRadius:6,marginBottom:6}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontWeight:700,color:'#1a2744'}},y.deceasedName,y.relationship?' ('+y.relationship+')':''),
            React.createElement('div',{style:{fontSize:'0.85rem',color:'#666'}},'Gregorian: '+y.englishDeathDate+' | Hebrew: '+(y.hebrewFormatted||(y.hebrewDay+' '+y.hebrewMonth)))),
          React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>deleteYahrzeit(y.id)},'Remove')))),
      React.createElement('form',{onSubmit:addYahrzeit},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Deceased Name *'),React.createElement('input',{className:'form-input',value:yahrzeitForm.deceasedName,onChange:e=>setYahrzeitForm(p=>({...p,deceasedName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Relationship'),React.createElement('input',{className:'form-input',placeholder:'e.g. father, grandmother',value:yahrzeitForm.relationship,onChange:e=>setYahrzeitForm(p=>({...p,relationship:e.target.value}))}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'English Date of Passing *'),React.createElement('input',{className:'form-input',type:'date',value:yahrzeitForm.englishDeathDate,onChange:e=>setYahrzeitForm(p=>({...p,englishDeathDate:e.target.value})),required:true}),React.createElement('p',{style:{fontSize:'0.8rem',color:'#888',marginTop:4}},'We will compute the Hebrew date automatically for accurate yearly reminders.')),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Notes (optional)'),React.createElement('input',{className:'form-input',value:yahrzeitForm.notes,onChange:e=>setYahrzeitForm(p=>({...p,notes:e.target.value}))})),
        React.createElement('button',{className:'btn btn-primary',type:'submit',disabled:yahrzeitBusy},yahrzeitBusy?'Adding...':'Add Yahrzeit'))));
}

// ─── Admin Donations ─────────────────────────────────────────────
function AdminDonations() {
  const [donations,setDonations]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [year,setYear]=useState(new Date().getFullYear());
  const [mf,setMf]=useState({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:'',paymentMethod:'check',fiscalYear:'',date:''});
  const [reasons,setReasons]=useState([]);
  const [uploading,setUploading]=useState(false);
  useEffect(()=>{load();apiFetch('/api/donations/reasons').then(setReasons).catch(()=>{});},[year]);
  async function load(){setLoading(true);try{setDonations(await apiFetch('/api/admin/donations?year='+year));}catch(e){}setLoading(false);}
  async function recordManual(e){e.preventDefault();setMsg('');
    try{
      const payload={...mf,amount:parseFloat(mf.amount),type:'donation'};
      if(mf.fiscalYear){payload.fiscalYear=parseInt(mf.fiscalYear);}
      if(!mf.fiscalYear)delete payload.fiscalYear;
      if(!mf.date)delete payload.date;
      const res=await apiFetch('/api/admin/manual-payment',{method:'POST',body:JSON.stringify(payload)});
      setMsg('Payment recorded'+(res.receiptSent?' and receipt sent.':'.'));
      setMf({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:'',paymentMethod:'check',fiscalYear:'',date:''});
      load();
    }catch(err){setMsg('Error: '+err.message);}}
  async function importStripePayment(){
    const id=prompt('Paste the Stripe Payment ID (starts with "pi_") from the Stripe dashboard payment page:');
    if(!id)return;
    const trimmed=id.trim();
    setMsg('Importing...');
    try{
      const res=await apiFetch('/api/admin/donations/import-stripe',{method:'POST',body:JSON.stringify({paymentIntentId:trimmed})});
      if(res.alreadyRecorded){
        const yearNote=res.fiscalYear?' Look under year '+res.fiscalYear+' in the list below.':'';
        const receiptNote=res.receiptSent?' Receipt email sent now.':(res.receiptError?(' Could not send receipt: '+res.receiptError):'');
        setMsg('Already in the system: $'+(res.amount||0).toFixed(2)+' for '+(res.email||'(no email)')+'.'+yearNote+receiptNote);
      } else setMsg('Imported $'+res.amount+' for '+(res.email||'(no email)')+(res.receiptSent?'. Receipt sent.':'. No receipt sent.'));
      load();
    }catch(err){setMsg('Error: '+err.message);}
  }

  async function uploadPayments(e){
    const file=e.target.files[0];if(!file)return;
    setUploading(true);setMsg('Uploading...');
    try{
      const token=await firebase.auth().currentUser.getIdToken();
      const fd=new FormData();fd.append('file',file);
      const r=await fetch(BACKEND_URL+'/api/admin/upload-payments',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});
      const data=await r.json();
      if(r.ok){setMsg('Imported '+data.created+' of '+data.total+' payments.'+(data.errors?.length?' Errors: '+data.errors.slice(0,3).join('; ')+(data.errors.length>3?' (+'+(data.errors.length-3)+' more)':''):''));load();}
      else setMsg('Error: '+(data.error||'upload failed'));
    }catch(err){setMsg('Error: '+err.message);}
    setUploading(false);
    e.target.value='';
  }
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Record Manual Payment (Check / Cash / Zelle)'),
      React.createElement('form',{onSubmit:recordManual},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:mf.firstName,onChange:e=>setMf(p=>({...p,firstName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:mf.lastName,onChange:e=>setMf(p=>({...p,lastName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:mf.email,onChange:e=>setMf(p=>({...p,email:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Amount ($) *'),React.createElement('input',{className:'form-input',type:'number',min:'1',step:'0.01',value:mf.amount,onChange:e=>setMf(p=>({...p,amount:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Reason'),React.createElement('select',{className:'form-input',value:mf.reason,onChange:e=>setMf(p=>({...p,reason:e.target.value}))},reasons.map(r=>React.createElement('option',{key:r,value:r},r)))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Method'),React.createElement('select',{className:'form-input',value:mf.paymentMethod,onChange:e=>setMf(p=>({...p,paymentMethod:e.target.value}))},['check','cash','zelle','venmo','other'].map(m=>React.createElement('option',{key:m,value:m},m.charAt(0).toUpperCase()+m.slice(1))))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Date (optional)'),React.createElement('input',{className:'form-input',type:'date',value:mf.date,onChange:e=>setMf(p=>({...p,date:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Fiscal Year (optional)'),React.createElement('input',{className:'form-input',type:'number',placeholder:'e.g. 2025',value:mf.fiscalYear,onChange:e=>setMf(p=>({...p,fiscalYear:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Note'),React.createElement('input',{className:'form-input',value:mf.note,onChange:e=>setMf(p=>({...p,note:e.target.value}))}))),
        React.createElement('button',{className:'btn btn-primary',type:'submit',style:{marginTop:8}},'Record Payment'))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Import a Stripe Payment'),
      React.createElement('p',{style:{marginBottom:12,color:'#555',fontSize:'0.95rem'}},'If a Stripe payment cleared but is missing from the list below, paste its Payment ID (starts with "pi_") here to add it. You can find the ID on the Stripe dashboard payment page. Idempotent: won\'t double-add.'),
      React.createElement('button',{className:'btn btn-primary',onClick:importStripePayment},'Import Stripe Payment')),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Batch Import Payments from Excel'),
      React.createElement('p',{style:{marginBottom:12,color:'#555',fontSize:'0.95rem'}},'Upload a spreadsheet with columns: First Name, Last Name, Email, Phone, Amount, Reason, Payment Method, Note, Date. Only First Name, Last Name, and Amount are required.'),
      React.createElement('label',{className:'btn btn-primary',style:{cursor:'pointer'}},uploading?'Uploading...':'Upload Excel / CSV',
        React.createElement('input',{type:'file',accept:'.xlsx,.xls,.csv',onChange:uploadPayments,style:{display:'none'},disabled:uploading}))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'All Donations'),
        React.createElement('div',{style:{display:'flex',gap:6,alignItems:'center'}},
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:async()=>{setMsg('Matching...');try{const r=await apiFetch('/api/admin/match-donations',{method:'POST'});setMsg('Matched '+r.matched+' donations to members ('+r.unmatched+' unmatched)');}catch(e){setMsg('Error: '+e.message);}}},'Match to Members'),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:async()=>{if(!confirm('Send '+year+' tax receipts to all donors?'))return;setMsg('Sending...');try{const r=await apiFetch('/api/admin/send-all-tax-receipts',{method:'POST',body:JSON.stringify({year})});setMsg('Sent to '+r.sent+' donors');}catch(e){setMsg('Error: '+e.message);}}},'Send '+year+' Tax Receipts'),
          React.createElement('select',{className:'form-input',style:{width:100},value:year,onChange:e=>setYear(parseInt(e.target.value))},[2024,2025,2026,2027,2028].map(y=>React.createElement('option',{key:y,value:y},y))))),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Date','Name','Amount','Reason','Method','Year','Receipt','Actions'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,donations.map(d=>React.createElement('tr',{key:d.id},
          React.createElement('td',null,d.createdAt?.substring(0,10)||'-'),React.createElement('td',null,d.displayName||'-'),
          React.createElement('td',{style:{fontWeight:700}},'$'+(d.amount||0).toFixed(2)),React.createElement('td',null,d.reason||'-'),React.createElement('td',null,d.paymentMethod||'-'),
          React.createElement('td',null,d.fiscalYear||'-'),
          React.createElement('td',null,d.receiptSent?React.createElement('span',{style:{color:'#27ae60',fontSize:'0.8rem'}},'Sent'):
            d.email?React.createElement('button',{className:'btn btn-sm btn-outline',style:{padding:'3px 8px',fontSize:'0.7rem'},onClick:async()=>{try{await apiFetch('/api/admin/send-receipt',{method:'POST',body:JSON.stringify({donationId:d.id})});setMsg('Receipt sent to '+d.email);load();}catch(e){setMsg('Error: '+e.message);}}},'Send'):
            React.createElement('span',{style:{color:'#888',fontSize:'0.75rem'}},'No email')),
          React.createElement('td',null,
            React.createElement('button',{className:'btn btn-sm btn-outline',style:{padding:'3px 8px',fontSize:'0.7rem',marginRight:4},onClick:async()=>{
              const ny=prompt('Reassign to fiscal year:',String(d.fiscalYear||year));
              if(!ny)return;
              try{await apiFetch('/api/admin/donations/'+d.id,{method:'PUT',body:JSON.stringify({fiscalYear:parseInt(ny)})});setMsg('Year updated.');load();}catch(e){setMsg('Error: '+e.message);}
            }},'Edit Year'),
            React.createElement('button',{className:'btn btn-sm btn-danger',style:{padding:'3px 8px',fontSize:'0.7rem'},onClick:async()=>{
              if(!confirm('Delete this donation record? The Stripe charge is NOT refunded.'))return;
              try{await apiFetch('/api/admin/donations/'+d.id,{method:'DELETE'});setMsg('Donation deleted.');load();}catch(e){setMsg('Error: '+e.message);}
            }},'Delete')))))))));
}

// ─── Admin Analytics moved to Phase 3 section below ─────────────



// ─── Admin Members ───────────────────────────────────────────────
function AdminMembers() {
  const [members,setMembers]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [prefilled,setPrefilled]=useState([]);const [uploading,setUploading]=useState(false);
  const [tags,setTags]=useState([]);
  const [selected,setSelected]=useState({});
  const [filter,setFilter]=useState('');
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);
    try{setMembers(await apiFetch('/api/admin/members'));}catch(e){}
    try{setPrefilled(await apiFetch('/api/admin/prefilled-accounts'));}catch(e){}
    try{setTags(await apiFetch('/api/admin/member-tags'));}catch(e){}
    setLoading(false);
  }
  function toggleSel(uid){setSelected(p=>{const n={...p};if(n[uid])delete n[uid];else n[uid]=true;return n;});}
  function selectAll(rows){setSelected(p=>{const n={...p};rows.forEach(r=>{if(r.uid)n[r.uid]=true;});return n;});}
  function clearSel(){setSelected({});}
  const selectedUids=Object.keys(selected).filter(u=>selected[u]);
  async function bulk(updates,label){
    if(!selectedUids.length){setMsg('No members selected.');return;}
    if(!confirm(label+' for '+selectedUids.length+' member(s)?'))return;
    try{
      await apiFetch('/api/admin/members/bulk',{method:'PUT',body:JSON.stringify({uids:selectedUids,updates})});
      setMsg(label+' applied to '+selectedUids.length+' member(s).');
      clearSel();
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }
  async function setMemberTag(uid,tagId){
    try{
      await apiFetch('/api/admin/members/'+uid,{method:'PUT',body:JSON.stringify({tagId:tagId||null})});
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }
  async function handleUpload(e){const file=e.target.files[0];if(!file)return;setUploading(true);setMsg('');
    const fd=new FormData();fd.append('file',file);
    try{const token=await firebase.auth().currentUser?.getIdToken();const res=await fetch(BACKEND_URL+'/api/admin/upload-roster',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});const data=await res.json();
      if(res.ok){setMsg('Created '+data.created+' pre-filled accounts.'+(data.errors?.length?' Errors: '+data.errors.join('; '):''));load();}else setMsg('Error: '+(data.error||'failed'));
    }catch(err){setMsg('Error: '+err.message);}setUploading(false);e.target.value='';}
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Upload Member Roster (Excel)'),
      React.createElement('p',{style:{marginBottom:12,color:'#888',fontSize:'0.9rem'}},'Upload Excel with: First Name, Last Name, Email, Phone, Address, Spouse Email. Creates pre-filled signup links.'),
      React.createElement('label',{className:'btn btn-primary',style:{cursor:'pointer'}},uploading?'Uploading...':'📤 Upload Excel File',
        React.createElement('input',{type:'file',accept:'.xlsx,.xls,.csv',onChange:handleUpload,style:{display:'none'}}))),
    prefilled.length>0&&React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Pre-filled Signup Links ('+prefilled.length+')'),
        React.createElement('button',{className:'btn btn-sm btn-primary',onClick:async()=>{
          const pending=prefilled.filter(a=>!a.claimed&&a.email);
          if(!pending.length){setMsg('No pending invites to send.');return;}
          if(!confirm('Send signup emails to '+pending.length+' pending members?'))return;
          setMsg('Sending...');
          try{
            const siteUrl=window.location.origin+window.location.pathname;
            const res=await apiFetch('/api/admin/send-signup-invites',{method:'POST',body:JSON.stringify({accounts:pending.map(a=>({email:a.email,firstName:a.firstName,lastName:a.lastName,token:a.token})),siteUrl})});
            setMsg('Sent '+res.sent+' invite emails'+(res.failed?' ('+res.failed+' failed)':''));
          }catch(e){setMsg('Error: '+e.message);}
        }},'Send All Invites ('+prefilled.filter(a=>!a.claimed).length+')')),
      React.createElement('div',{className:'table-container',style:{marginTop:12}},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Name','Email','Status','Link'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,prefilled.slice(0,50).map(a=>React.createElement('tr',{key:a.token},
          React.createElement('td',null,(a.firstName||'')+' '+(a.lastName||'')),React.createElement('td',null,a.email),
          React.createElement('td',null,a.claimed?React.createElement('span',{style:{color:'#27ae60',fontWeight:600}},'✓ Claimed'):React.createElement('span',{style:{color:'#c49a3c'}},'Pending')),
          React.createElement('td',null,!a.claimed&&React.createElement('code',{style:{fontSize:'0.7rem',background:'#f0ece3',padding:'2px 6px',borderRadius:4,wordBreak:'break-all'}},'#signup?token='+a.token)))))))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'All Members ('+members.length+')'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      (()=>{
        const uidToName={};members.forEach(m=>{if(m.uid)uidToName[m.uid]=m.displayName||((m.firstName||'')+' '+(m.lastName||'')).trim();});
        const tagById={};tags.forEach(t=>{tagById[t.id]=t;});
        const f=(filter||'').toLowerCase();
        const filtered=!f?members:members.filter(m=>(m.displayName||'').toLowerCase().includes(f)||(m.email||'').toLowerCase().includes(f));
        return React.createElement('div',null,
          React.createElement('div',{style:{display:'flex',gap:8,alignItems:'center',marginBottom:12,flexWrap:'wrap'}},
            React.createElement('input',{className:'form-input',style:{flex:'1 1 200px'},placeholder:'Search name or email...',value:filter,onChange:e=>setFilter(e.target.value)}),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>selectAll(filtered)},'Select all shown'),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:clearSel},'Clear ('+selectedUids.length+')')),
          selectedUids.length>0&&React.createElement('div',{style:{padding:10,background:'#faf8f3',borderRadius:6,marginBottom:12,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}},
            React.createElement('strong',{style:{marginRight:8}},selectedUids.length+' selected:'),
            React.createElement('button',{className:'btn btn-sm btn-primary',onClick:()=>bulk({exemptFromDues:true},'Mark as Exempt from Dues')},'Mark Exempt'),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>bulk({exemptFromDues:false},'Remove Exempt')},'Remove Exempt'),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>bulk({membershipPaid:true},'Mark as Paid')},'Mark Paid'),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>bulk({membershipPaid:false},'Mark as Unpaid')},'Mark Unpaid')),
          React.createElement('div',{className:'table-container'},React.createElement('table',null,
          React.createElement('thead',null,React.createElement('tr',null,['','Name','Email','Phone','Paid','Tag','Spouse','Role'].map(h=>React.createElement('th',{key:h||'sel'},h)))),
          React.createElement('tbody',null,filtered.map(m=>{
            const spouseName=m.spouseUid&&uidToName[m.spouseUid]?uidToName[m.spouseUid]:(m.spouseEmail||'');
            const tag=m.tagId?tagById[m.tagId]:null;
            return React.createElement('tr',{key:m.uid,style:selected[m.uid]?{background:'rgba(196,154,60,0.08)'}:null},
              React.createElement('td',null,React.createElement('input',{type:'checkbox',checked:!!selected[m.uid],onChange:()=>toggleSel(m.uid)})),
              React.createElement('td',null,m.displayName||'-'),
              React.createElement('td',null,m.email||'-'),
              React.createElement('td',null,m.phone||'-'),
              React.createElement('td',null,
                m.exemptFromDues
                  ?React.createElement('span',{style:{color:'#1a2744',fontWeight:700,background:'rgba(196,154,60,0.15)',padding:'2px 8px',borderRadius:10,fontSize:'0.8rem'}},'Exempt')
                  :m.membershipPaid
                    ?React.createElement('span',{style:{color:'#27ae60',fontWeight:700}},'✓ Paid')
                    :React.createElement('span',{style:{color:'#b00020',fontWeight:600}},'Unpaid')),
              React.createElement('td',null,
                React.createElement('select',{className:'form-input',style:{padding:'4px 6px',fontSize:'0.85rem'},value:m.tagId||'',onChange:e=>setMemberTag(m.uid,e.target.value)},
                  React.createElement('option',{value:''},'(none)'),
                  tags.map(t=>React.createElement('option',{key:t.id,value:t.id},t.name+' ($'+Number(t.annualDues||0).toFixed(0)+')')))),
              React.createElement('td',{style:{fontSize:'0.85rem',color:'#555'}},spouseName||'-'),
              React.createElement('td',null,React.createElement('span',{style:{padding:'2px 8px',borderRadius:12,fontSize:'0.8rem',fontWeight:600,background:m.role==='admin'?'rgba(196,154,60,0.15)':'rgba(39,174,96,0.1)',color:m.role==='admin'?'#c49a3c':'#27ae60'}},m.role||'member')));
          })))));
      })()));
}

// ─── Admin Pledges ───────────────────────────────────────────────
// ─── Admin Settings Center ───────────────────────────────────────
function AdminSettings() {
  const [reminderSettings,setReminderSettings]=useState({enabled:false,membershipEnabled:false,membershipFrequencyDays:30,membershipAmount:0,pledgeEnabled:false,pledgeFrequencyDays:30,pledgeStartAfterDays:7});
  const [sponsorSettings,setSponsorSettings]=useState({kiddushPrice:0,seudasShlishisPrice:0});
  const [membershipSettings,setMembershipSettings]=useState({annualDues:0});
  const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');const [running,setRunning]=useState(false);

  useEffect(()=>{
    Promise.all([
      apiFetch('/api/admin/reminder-settings').then(setReminderSettings).catch(()=>{}),
      apiFetch('/api/admin/sponsorship-settings').then(setSponsorSettings).catch(()=>{}),
      apiFetch('/api/admin/membership-settings').then(setMembershipSettings).catch(()=>{})
    ]).then(()=>setLoading(false));
  },[]);

  async function saveReminders(){setMsg('');
    try{await apiFetch('/api/admin/reminder-settings',{method:'PUT',body:JSON.stringify(reminderSettings)});setMsg('Reminder settings saved!');}catch(e){setMsg('Error: '+e.message);}}
  async function saveSponsor(){setMsg('');
    try{await apiFetch('/api/admin/sponsorship-settings',{method:'PUT',body:JSON.stringify(sponsorSettings)});setMsg('Sponsorship pricing saved!');}catch(e){setMsg('Error: '+e.message);}}
  async function saveMembership(){setMsg('');
    try{await apiFetch('/api/admin/membership-settings',{method:'PUT',body:JSON.stringify(membershipSettings)});setMsg('Membership settings saved!');}catch(e){setMsg('Error: '+e.message);}}
  async function runNow(){setRunning(true);setMsg('');
    try{const res=await apiFetch('/api/admin/run-reminders',{method:'POST'});setMsg(res.message||'Reminders sent!');}catch(e){setMsg('Error: '+e.message);}setRunning(false);}

  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),

    // Automated Reminders
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Automated Email Reminders'),
      React.createElement('p',{style:{marginBottom:16,color:'#555',fontSize:'0.9rem'}},'When enabled, the system automatically sends reminders daily at 10:00 AM for unpaid membership dues and outstanding pledges. Members with auto-payment enabled are skipped.'),
      React.createElement('div',{className:'form-group'},
        React.createElement('label',{className:'form-label'},'Master Switch'),
        React.createElement('select',{className:'form-input',style:{maxWidth:300},value:reminderSettings.enabled?'on':'off',onChange:e=>setReminderSettings(p=>({...p,enabled:e.target.value==='on'}))},
          React.createElement('option',{value:'off'},'OFF - No automatic reminders'),
          React.createElement('option',{value:'on'},'ON - Send reminders automatically'))),
      reminderSettings.enabled&&React.createElement('div',null,
        // Membership section
        React.createElement('div',{style:{background:'#faf8f3',padding:16,borderRadius:8,marginBottom:16,border:'1px solid #e0dcd4'}},
          React.createElement('h3',{style:{color:'#1a2744',margin:'0 0 12px',fontSize:'1rem'}},'Membership Dues Reminders'),
          React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:12}},
            React.createElement('div',{className:'form-group',style:{marginBottom:0}},
              React.createElement('label',{className:'form-label'},'Enabled'),
              React.createElement('select',{className:'form-input',value:reminderSettings.membershipEnabled?'on':'off',onChange:e=>setReminderSettings(p=>({...p,membershipEnabled:e.target.value==='on'}))},
                React.createElement('option',{value:'off'},'Off'),React.createElement('option',{value:'on'},'On'))),
            React.createElement('div',{className:'form-group',style:{marginBottom:0}},
              React.createElement('label',{className:'form-label'},'Annual Dues Amount ($)'),
              React.createElement('input',{className:'form-input',type:'number',value:reminderSettings.membershipAmount,onChange:e=>setReminderSettings(p=>({...p,membershipAmount:parseFloat(e.target.value)||0}))})),
            React.createElement('div',{className:'form-group',style:{marginBottom:0}},
              React.createElement('label',{className:'form-label'},'Send reminder every X days'),
              React.createElement('input',{className:'form-input',type:'number',min:'1',value:reminderSettings.membershipFrequencyDays,onChange:e=>setReminderSettings(p=>({...p,membershipFrequencyDays:parseInt(e.target.value)||30}))})))),
        // Pledge section
        React.createElement('div',{style:{background:'#faf8f3',padding:16,borderRadius:8,marginBottom:16,border:'1px solid #e0dcd4'}},
          React.createElement('h3',{style:{color:'#1a2744',margin:'0 0 12px',fontSize:'1rem'}},'Pledge Reminders'),
          React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:12}},
            React.createElement('div',{className:'form-group',style:{marginBottom:0}},
              React.createElement('label',{className:'form-label'},'Enabled'),
              React.createElement('select',{className:'form-input',value:reminderSettings.pledgeEnabled?'on':'off',onChange:e=>setReminderSettings(p=>({...p,pledgeEnabled:e.target.value==='on'}))},
                React.createElement('option',{value:'off'},'Off'),React.createElement('option',{value:'on'},'On'))),
            React.createElement('div',{className:'form-group',style:{marginBottom:0}},
              React.createElement('label',{className:'form-label'},'Start reminders after X days'),
              React.createElement('input',{className:'form-input',type:'number',min:'1',value:reminderSettings.pledgeStartAfterDays,onChange:e=>setReminderSettings(p=>({...p,pledgeStartAfterDays:parseInt(e.target.value)||7}))})),
            React.createElement('div',{className:'form-group',style:{marginBottom:0}},
              React.createElement('label',{className:'form-label'},'Then repeat every X days'),
              React.createElement('input',{className:'form-input',type:'number',min:'1',value:reminderSettings.pledgeFrequencyDays,onChange:e=>setReminderSettings(p=>({...p,pledgeFrequencyDays:parseInt(e.target.value)||30}))}))))),
      React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
        React.createElement('button',{className:'btn btn-primary',onClick:saveReminders},'Save Reminder Settings'),
        React.createElement('button',{className:'btn btn-outline',onClick:runNow,disabled:running},running?'Running...':'Run Reminders Now'))),

    // Sponsorship pricing
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Sponsorship Pricing'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
        React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Kiddush Price ($)'),
          React.createElement('input',{className:'form-input',type:'number',value:sponsorSettings.kiddushPrice,onChange:e=>setSponsorSettings(p=>({...p,kiddushPrice:parseFloat(e.target.value)||0}))})),
        React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Seudas Shlishis Price ($)'),
          React.createElement('input',{className:'form-input',type:'number',value:sponsorSettings.seudasShlishisPrice,onChange:e=>setSponsorSettings(p=>({...p,seudasShlishisPrice:parseFloat(e.target.value)||0}))}))),
      React.createElement('button',{className:'btn btn-primary',onClick:saveSponsor,style:{marginTop:8}},'Save Pricing')),

    // Membership dues
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Membership Settings'),
      React.createElement('div',{className:'form-group'},
        React.createElement('label',{className:'form-label'},'Annual Membership Dues ($)'),
        React.createElement('input',{className:'form-input',type:'number',style:{maxWidth:200},value:membershipSettings.annualDues,onChange:e=>setMembershipSettings(p=>({...p,annualDues:parseFloat(e.target.value)||0}))})),
      React.createElement('button',{className:'btn btn-primary',onClick:saveMembership,style:{marginTop:8}},'Save Membership Settings')));
}

// ─── Admin Manage Reasons (Donation + Pledge dropdowns) ─────────
function AdminReasons() {
  const [donationReasons,setDonationReasons]=useState([]);
  const [pledgeReasons,setPledgeReasons]=useState([]);
  const [newDonation,setNewDonation]=useState('');
  const [newPledge,setNewPledge]=useState('');
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    Promise.all([
      apiFetch('/api/donations/reasons').then(setDonationReasons).catch(()=>setDonationReasons([])),
      apiFetch('/api/admin/pledge-reasons').then(setPledgeReasons).catch(()=>setPledgeReasons([]))
    ]).then(()=>setLoading(false));
  },[]);

  async function saveDonationReasons(list){
    try{await apiFetch('/api/admin/donation-reasons',{method:'PUT',body:JSON.stringify({reasons:list})});setDonationReasons(list);setMsg('Donation reasons saved!');}catch(e){setMsg('Error: '+e.message);}
  }
  async function savePledgeReasons(list){
    try{await apiFetch('/api/admin/pledge-reasons',{method:'PUT',body:JSON.stringify({reasons:list})});setPledgeReasons(list);setMsg('Pledge reasons saved!');}catch(e){setMsg('Error: '+e.message);}
  }
  function addDonationReason(){if(!newDonation.trim())return;saveDonationReasons([...donationReasons,newDonation.trim()]);setNewDonation('');}
  function removeDonationReason(i){saveDonationReasons(donationReasons.filter((_,idx)=>idx!==i));}
  function addPledgeReason(){if(!newPledge.trim())return;savePledgeReasons([...pledgeReasons,newPledge.trim()]);setNewPledge('');}
  function removePledgeReason(i){savePledgeReasons(pledgeReasons.filter((_,idx)=>idx!==i));}

  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}},
      // Donation reasons
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Donation Reasons'),
        React.createElement('p',{style:{fontSize:'0.85rem',color:'#888',marginBottom:12}},'These appear as dropdown options when making a donation or recording a manual payment.'),
        donationReasons.map((r,i)=>React.createElement('div',{key:i,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f0ece3'}},
          React.createElement('span',null,r),
          React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>removeDonationReason(i),style:{padding:'4px 10px',fontSize:'0.75rem'}},'Remove'))),
        React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
          React.createElement('input',{className:'form-input',value:newDonation,onChange:e=>setNewDonation(e.target.value),placeholder:'New reason...',style:{flex:1},onKeyDown:e=>{if(e.key==='Enter'){e.preventDefault();addDonationReason();}}}),
          React.createElement('button',{className:'btn btn-primary btn-sm',onClick:addDonationReason},'Add'))),
      // Pledge reasons
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Pledge / Billing Reasons'),
        React.createElement('p',{style:{fontSize:'0.85rem',color:'#888',marginBottom:12}},'These appear as dropdown options when creating a pledge or billing item.'),
        pledgeReasons.map((r,i)=>React.createElement('div',{key:i,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f0ece3'}},
          React.createElement('span',null,r),
          React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>removePledgeReason(i),style:{padding:'4px 10px',fontSize:'0.75rem'}},'Remove'))),
        React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
          React.createElement('input',{className:'form-input',value:newPledge,onChange:e=>setNewPledge(e.target.value),placeholder:'New reason...',style:{flex:1},onKeyDown:e=>{if(e.key==='Enter'){e.preventDefault();addPledgeReason();}}}),
          React.createElement('button',{className:'btn btn-primary btn-sm',onClick:addPledgeReason},'Add')))));
}

// ─── Admin Pledges ───────────────────────────────────────────────
function AdminPledges() {
  const [pledges,setPledges]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [form,setForm]=useState({memberName:'',memberEmail:'',amount:'',reason:'',dueDate:'',notes:''});
  const [pledgeReasons,setPledgeReasons]=useState([]);
  useEffect(()=>{load();apiFetch('/api/admin/pledge-reasons').then(setPledgeReasons).catch(()=>setPledgeReasons(['Membership Dues','Building Fund','Torah Fund','Kiddush Fund','General Pledge','Other']));},[]);
  async function load(){setLoading(true);try{setPledges(await apiFetch('/api/admin/pledges'));}catch(e){}setLoading(false);}
  async function add(e){e.preventDefault();setMsg('');try{await apiFetch('/api/admin/pledges',{method:'POST',body:JSON.stringify(form)});setMsg('Pledge added!');setForm({memberName:'',memberEmail:'',amount:'',reason:'',dueDate:'',notes:''});load();}catch(err){setMsg('Error: '+err.message);}}
  async function markPaid(id){try{await apiFetch('/api/admin/pledges/'+id,{method:'PUT',body:JSON.stringify({status:'paid',paidAt:new Date().toISOString()})});load();}catch(e){setMsg('Error: '+e.message);}}
  async function del(id){if(!confirm('Delete?'))return;try{await apiFetch('/api/admin/pledges/'+id,{method:'DELETE'});load();}catch(e){setMsg('Error: '+e.message);}}
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Add Pledge / Billing Item'),
      React.createElement('form',{onSubmit:add},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Member Name *'),React.createElement('input',{className:'form-input',value:form.memberName,onChange:e=>setForm(p=>({...p,memberName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:form.memberEmail,onChange:e=>setForm(p=>({...p,memberEmail:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Amount ($) *'),React.createElement('input',{className:'form-input',type:'number',min:'1',step:'0.01',value:form.amount,onChange:e=>setForm(p=>({...p,amount:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Reason'),React.createElement('select',{className:'form-input',value:form.reason,onChange:e=>setForm(p=>({...p,reason:e.target.value}))},React.createElement('option',{value:''},'-- Select --'),pledgeReasons.map(r=>React.createElement('option',{key:r,value:r},r)))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Due Date'),React.createElement('input',{className:'form-input',type:'date',value:form.dueDate,onChange:e=>setForm(p=>({...p,dueDate:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Notes'),React.createElement('input',{className:'form-input',value:form.notes,onChange:e=>setForm(p=>({...p,notes:e.target.value}))}))),
        React.createElement('button',{className:'btn btn-primary',type:'submit',style:{marginTop:8}},'Add'))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'All Pledges & Billing'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      pledges.length===0?React.createElement('p',{style:{color:'#888'}},'No pledges yet.'):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Name','Amount','Reason','Due','Status','Actions'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,pledges.map(p=>React.createElement('tr',{key:p.id},
          React.createElement('td',null,p.memberName||'-'),React.createElement('td',{style:{fontWeight:700}},'$'+(p.amount||0).toFixed(2)),
          React.createElement('td',null,p.reason||'-'),React.createElement('td',null,p.dueDate||'-'),
          React.createElement('td',null,React.createElement('span',{style:{padding:'2px 8px',borderRadius:12,fontSize:'0.8rem',fontWeight:600,background:p.status==='paid'?'rgba(39,174,96,0.1)':'rgba(192,57,43,0.1)',color:p.status==='paid'?'#27ae60':'#c0392b'}},p.status==='paid'?'Paid':'Unpaid')),
          React.createElement('td',null,
            p.status!=='paid'&&React.createElement('button',{className:'btn btn-sm btn-primary',onClick:()=>markPaid(p.id),style:{marginRight:4}},'Mark Paid'),
            React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>del(p.id)},'Delete')))))))));
}

// ─── Phase 3 UPDATED: Email Center, Analytics, High Holidays ────

// ─── Admin Email Center (Full Rewrite) ───────────────────────────
function AdminEmailCenter() {
  const [subTab,setSubTab]=useState('compose');
  const [templates,setTemplates]=useState([]);
  const [recipients,setRecipients]=useState([]);
  const [log,setLog]=useState([]);
  const [msg,setMsg]=useState('');
  const [sending,setSending]=useState(false);
  // Compose form with preview
  const [composeForm,setComposeForm]=useState({subject:'',html:'',targetGroup:'all'});
  const [showPreview,setShowPreview]=useState(false);
  // Weekly schedule
  const [weeklyStartDate,setWeeklyStartDate]=useState(getTodayStr());
  const [weeklyEndDate,setWeeklyEndDate]=useState(()=>{const d=new Date(getTodayStr()+'T12:00:00');d.setDate(d.getDate()+6);return d.toISOString().split('T')[0];});
  const [weeklyCustomText,setWeeklyCustomText]=useState('');
  const [weeklySubject,setWeeklySubject]=useState("This Week's Davening Schedule - Congregation Ohr Chaim");
  const [weeklyPreviewHtml,setWeeklyPreviewHtml]=useState('');
  const [weeklyTargetGroup,setWeeklyTargetGroup]=useState('all');
  // Template form
  const [tplForm,setTplForm]=useState({name:'',subject:'',html:''});
  // Custom per-member selection (shared between Compose and Weekly)
  const [selectedEmails,setSelectedEmails]=useState({});
  const [pickerFilter,setPickerFilter]=useState('');

  useEffect(()=>{
    apiFetch('/api/admin/email/recipients').then(setRecipients).catch(()=>{});
    apiFetch('/api/admin/email/templates').then(setTemplates).catch(()=>{});
    apiFetch('/api/admin/email/log').then(setLog).catch(()=>{});
  },[]);

  function getTargetEmails(group){
    if(group==='custom') return Object.keys(selectedEmails).filter(e=>selectedEmails[e]);
    if(group==='members') return recipients.filter(r=>r.role==='member').map(r=>r.email);
    if(group==='unpaid') return recipients.filter(r=>!r.membershipPaid&&!r.autoPayment).map(r=>r.email);
    if(group==='admins') return recipients.filter(r=>r.role==='admin').map(r=>r.email);
    return recipients.map(r=>r.email);
  }

  function toggleEmail(email){
    setSelectedEmails(p=>{const n={...p};if(n[email])delete n[email];else n[email]=true;return n;});
  }
  function filteredRecipients(){
    const q=pickerFilter.trim().toLowerCase();
    if(!q) return recipients;
    return recipients.filter(r=>(r.displayName||'').toLowerCase().includes(q)||(r.email||'').toLowerCase().includes(q));
  }
  function selectAllFiltered(){
    const fr=filteredRecipients();
    setSelectedEmails(p=>{const n={...p};fr.forEach(r=>{if(r.email)n[r.email]=true;});return n;});
  }
  function clearSelection(){setSelectedEmails({});}

  function MemberPicker(){
    const fr=filteredRecipients();
    const selectedCount=Object.keys(selectedEmails).filter(e=>selectedEmails[e]).length;
    return React.createElement('div',{className:'card',style:{marginTop:8,padding:12,background:'#faf8f3'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:8}},
        React.createElement('input',{className:'form-input',style:{flex:'1 1 200px'},placeholder:'Search name or email...',value:pickerFilter,onChange:e=>setPickerFilter(e.target.value)}),
        React.createElement('button',{type:'button',className:'btn btn-sm btn-outline',onClick:selectAllFiltered},'Select all shown'),
        React.createElement('button',{type:'button',className:'btn btn-sm btn-outline',onClick:clearSelection},'Clear'),
        React.createElement('span',{style:{fontWeight:700,color:'#1a2744'}},selectedCount+' selected')),
      React.createElement('div',{style:{maxHeight:260,overflowY:'auto',border:'1px solid #e0dcd4',borderRadius:6,background:'#fff'}},
        fr.length===0?React.createElement('p',{style:{padding:12,color:'#888',margin:0}},'No matches.'):
        fr.map(r=>React.createElement('label',{key:r.email||r.uid,style:{display:'flex',alignItems:'center',gap:10,padding:'6px 10px',cursor:'pointer',borderBottom:'1px solid #f0ece3'}},
          React.createElement('input',{type:'checkbox',checked:!!selectedEmails[r.email],onChange:()=>toggleEmail(r.email),disabled:!r.email}),
          React.createElement('span',{style:{flex:1}},r.displayName||'(no name)'),
          React.createElement('span',{style:{color:'#888',fontSize:'0.85rem'}},r.email||'no email'),
          r.role==='admin'&&React.createElement('span',{style:{fontSize:'0.7rem',background:'rgba(196,154,60,0.15)',color:'#c49a3c',padding:'2px 6px',borderRadius:10,fontWeight:700}},'admin')))));
  }

  async function sendBlast(e){
    e.preventDefault();setSending(true);setMsg('');
    try{
      const targetEmails=getTargetEmails(composeForm.targetGroup);
      const res=await apiFetch('/api/admin/email/send',{method:'POST',body:JSON.stringify({recipients:targetEmails,subject:composeForm.subject,html:composeForm.html})});
      setMsg('Sent to '+res.sent+' recipients'+(res.failed?' ('+res.failed+' failed)':''));
      apiFetch('/api/admin/email/log').then(setLog).catch(()=>{});
    }catch(err){setMsg('Error: '+err.message);}
    setSending(false);
  }

  async function previewWeekly(){
    setMsg('');
    try{
      if(weeklyEndDate&&weeklyEndDate<weeklyStartDate){setMsg('End date must be on or after start date.');return;}
      const res=await apiFetch('/api/admin/email/preview-weekly',{method:'POST',body:JSON.stringify({startDate:weeklyStartDate,endDate:weeklyEndDate})});
      let html=res.html||'';
      if(weeklyCustomText) html=html.replace('</table>','</table><div style="padding:16px 0;border-top:2px solid #c49a3c;margin-top:16px;">'+weeklyCustomText+'</div>');
      setWeeklyPreviewHtml(html);
    }catch(err){setMsg('Error: '+err.message);}
  }

  async function sendWeeklyCustom(){
    setSending(true);setMsg('');
    try{
      const targetEmails=getTargetEmails(weeklyTargetGroup);
      if(weeklyEndDate&&weeklyEndDate<weeklyStartDate){setMsg('End date must be on or after start date.');setSending(false);return;}
      const res=await apiFetch('/api/admin/email/send-weekly-custom',{method:'POST',body:JSON.stringify({recipients:targetEmails,startDate:weeklyStartDate,endDate:weeklyEndDate,customText:weeklyCustomText,subject:weeklySubject})});
      setMsg('Sent to '+res.sent+' recipients'+(res.failed?' ('+res.failed+' failed)':''));
      apiFetch('/api/admin/email/log').then(setLog).catch(()=>{});
    }catch(err){setMsg('Error: '+err.message);}
    setSending(false);
  }

  async function saveTemplate(e){
    e.preventDefault();setMsg('');
    try{await apiFetch('/api/admin/email/templates',{method:'POST',body:JSON.stringify(tplForm)});setMsg('Template saved!');setTplForm({name:'',subject:'',html:''});
      apiFetch('/api/admin/email/templates').then(setTemplates).catch(()=>{});}catch(err){setMsg('Error: '+err.message);}
  }

  async function deleteTemplate(id){if(!confirm('Delete template?'))return;
    try{await apiFetch('/api/admin/email/templates/'+id,{method:'DELETE'});setTemplates(t=>t.filter(x=>x.id!==id));}catch(e){setMsg('Error: '+e.message);}
  }

  async function seedDefaults(){setMsg('');
    try{const res=await apiFetch('/api/admin/email/seed-templates',{method:'POST'});setMsg('Created '+res.created+' default templates');
      apiFetch('/api/admin/email/templates').then(setTemplates).catch(()=>{});}catch(e){setMsg('Error: '+e.message);}
  }

  async function cleanTemplates(){setMsg('');
    try{const res=await apiFetch('/api/admin/email/clean-templates',{method:'POST',body:JSON.stringify({})});setMsg('Cleaned '+res.updated+' of '+res.total+' templates.');
      apiFetch('/api/admin/email/templates').then(setTemplates).catch(()=>{});}catch(e){setMsg('Error: '+e.message);}
  }

  function handleImageUpload(target){
    const input=document.createElement('input');
    input.type='file';input.accept='image/*';
    input.onchange=function(e){
      const file=e.target.files[0];if(!file)return;
      const reader=new FileReader();
      reader.onload=function(ev){
        const imgTag='<img src="'+ev.target.result+'" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />';
        if(target==='compose') setComposeForm(p=>({...p,html:p.html+'\n'+imgTag}));
        else if(target==='weekly') setWeeklyCustomText(p=>p+'\n'+imgTag);
        else if(target==='template') setTplForm(p=>({...p,html:p.html+'\n'+imgTag}));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function loadTemplate(tpl){setComposeForm({subject:tpl.subject||'',html:tpl.html||'',targetGroup:composeForm.targetGroup});setSubTab('compose');}

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{style:{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}},
      ['compose','weekly','templates','log'].map(t=>React.createElement('button',{key:t,className:'btn btn-sm '+(subTab===t?'btn-primary':'btn-outline'),onClick:()=>setSubTab(t)},
        t==='compose'?'Compose Email':t==='weekly'?'Weekly Schedule':t==='templates'?'Templates':'Email Log'))),

    // ── Compose with live preview ──
    subTab==='compose'&&React.createElement('div',null,
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Compose Email'),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Send To'),
          React.createElement('select',{className:'form-input',value:composeForm.targetGroup,onChange:e=>setComposeForm(p=>({...p,targetGroup:e.target.value}))},
            React.createElement('option',{value:'all'},'All Members ('+recipients.length+')'),
            React.createElement('option',{value:'members'},'Members Only'),
            React.createElement('option',{value:'unpaid'},'Unpaid Members'),
            React.createElement('option',{value:'admins'},'Admins Only'),
            React.createElement('option',{value:'custom'},'Pick specific members...')),
          composeForm.targetGroup==='custom'&&MemberPicker()),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),
          React.createElement('input',{className:'form-input',value:composeForm.subject,onChange:e=>setComposeForm(p=>({...p,subject:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email Body (HTML)'),
          React.createElement('textarea',{className:'form-input',rows:12,value:composeForm.html,onChange:e=>setComposeForm(p=>({...p,html:e.target.value})),style:{fontFamily:'monospace',fontSize:'0.85rem'}})),
        React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
          React.createElement('button',{type:'button',className:'btn btn-outline',onClick:()=>handleImageUpload('compose')},'Upload Image'),
          React.createElement('button',{type:'button',className:'btn btn-outline',onClick:()=>setShowPreview(!showPreview)},showPreview?'Hide Preview':'Preview Email'),
          React.createElement('button',{className:'btn btn-primary',onClick:sendBlast,disabled:sending||!composeForm.subject},sending?'Sending...':'Send to '+getTargetEmails(composeForm.targetGroup).length+' recipients'))),
      showPreview&&React.createElement('div',{className:'card',style:{marginTop:12}},
        React.createElement('div',{className:'card-header'},'Email Preview'),
        React.createElement('div',{style:{border:'1px solid #e0dcd4',borderRadius:6,padding:16,background:'#fff'},dangerouslySetInnerHTML:{__html:composeForm.html}}))),

    // ── Weekly schedule with date range + custom text + preview ──
    subTab==='weekly'&&React.createElement('div',null,
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Weekly Schedule Email'),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 2fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Start Date'),
            React.createElement('input',{className:'form-input',type:'date',value:weeklyStartDate,onChange:e=>setWeeklyStartDate(e.target.value)})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'End Date'),
            React.createElement('input',{className:'form-input',type:'date',value:weeklyEndDate,min:weeklyStartDate,onChange:e=>setWeeklyEndDate(e.target.value)})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Send To'),
            React.createElement('select',{className:'form-input',value:weeklyTargetGroup,onChange:e=>setWeeklyTargetGroup(e.target.value)},
              React.createElement('option',{value:'all'},'All ('+recipients.length+')'),
              React.createElement('option',{value:'members'},'Members'),
              React.createElement('option',{value:'admins'},'Admins'),
              React.createElement('option',{value:'custom'},'Pick specific members...'))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),
            React.createElement('input',{className:'form-input',value:weeklySubject,onChange:e=>setWeeklySubject(e.target.value)}))),
        weeklyTargetGroup==='custom'&&MemberPicker(),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Custom Message (will appear below the schedule - supports HTML, <img> tags for images)'),
          React.createElement('textarea',{className:'form-input',rows:6,value:weeklyCustomText,onChange:e=>setWeeklyCustomText(e.target.value),placeholder:'Add announcements, images, or any custom content here...'})),
        React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
          React.createElement('button',{type:'button',className:'btn btn-outline',onClick:()=>handleImageUpload('weekly')},'Upload Image'),
          React.createElement('button',{className:'btn btn-outline',onClick:previewWeekly},'Generate Preview'),
          React.createElement('button',{className:'btn btn-primary',onClick:sendWeeklyCustom,disabled:sending},sending?'Sending...':'Send Weekly Email'))),
      weeklyPreviewHtml&&React.createElement('div',{className:'card',style:{marginTop:12}},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Preview'),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>setWeeklyPreviewHtml('')},'Close')),
        React.createElement('div',{style:{border:'1px solid #e0dcd4',borderRadius:6,padding:16,background:'#fff',marginTop:12},dangerouslySetInnerHTML:{__html:weeklyPreviewHtml}}))),

    // ── Templates ──
    subTab==='templates'&&React.createElement('div',null,
      React.createElement('div',{className:'card'},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Email Templates'),
          React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:cleanTemplates},'Fix Character Encoding'),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:seedDefaults},'Load Default Templates'))),
        React.createElement('div',{style:{marginTop:16}},
          React.createElement('form',{onSubmit:saveTemplate},
            React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
              React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Template Name'),React.createElement('input',{className:'form-input',value:tplForm.name,onChange:e=>setTplForm(p=>({...p,name:e.target.value})),required:true})),
              React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),React.createElement('input',{className:'form-input',value:tplForm.subject,onChange:e=>setTplForm(p=>({...p,subject:e.target.value}))}))),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'HTML Body (use {{variable}} for placeholders)'),
              React.createElement('textarea',{className:'form-input',rows:8,value:tplForm.html,onChange:e=>setTplForm(p=>({...p,html:e.target.value})),style:{fontFamily:'monospace',fontSize:'0.85rem'}})),
            React.createElement('div',{style:{display:'flex',gap:8,marginTop:8}},
              React.createElement('button',{type:'button',className:'btn btn-outline btn-sm',onClick:()=>handleImageUpload('template')},'Upload Image'),
              React.createElement('button',{className:'btn btn-primary',type:'submit'},'Save Template'))))),
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Saved Templates ('+templates.length+')'),
        templates.length===0?React.createElement('p',{style:{color:'#888'}},'No templates. Click "Load Default Templates" above to create standard ones.'):
        templates.map(t=>React.createElement('div',{key:t.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #e0dcd4'}},
          React.createElement('div',{style:{flex:1}},React.createElement('div',{style:{fontWeight:600}},t.name||t.id),React.createElement('div',{style:{fontSize:'0.85rem',color:'#888'}},t.subject||'')),
          React.createElement('div',{style:{display:'flex',gap:6}},
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>{setTplForm({name:t.name||t.id,subject:t.subject||'',html:t.html||''})}},'Edit'),
            React.createElement('button',{className:'btn btn-sm btn-primary',onClick:()=>loadTemplate(t)},'Use in Compose'),
            React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>deleteTemplate(t.id)},'Delete')))))),

    // ── Log ──
    subTab==='log'&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Email Log (Last 100)'),
      log.length===0?React.createElement('p',{style:{color:'#888'}},'No emails sent yet.'):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Date','To','Subject','Status'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,log.map(l=>React.createElement('tr',{key:l.id},
          React.createElement('td',null,l.sentAt?.substring(0,16)||'-'),
          React.createElement('td',null,l.to||'-'),
          React.createElement('td',null,(l.subject||'-').substring(0,40)),
          React.createElement('td',null,React.createElement('span',{style:{color:l.status==='sent'?'#27ae60':'#c0392b',fontWeight:600}},l.status||'-')))))))));
}

// ─── Admin Analytics (Full Interactive Rewrite) ──────────────────
function AdminAnalytics() {
  const [data,setData]=useState(null);const [loading,setLoading]=useState(true);
  const [filters,setFilters]=useState({startDate:'',endDate:'',reason:'all',person:'all',method:'all'});
  const [selectedPerson,setSelectedPerson]=useState(null);
  const [view,setView]=useState('overview'); // overview, byCategory, byMonth, byDonor, donorDetail

  useEffect(()=>{loadData();},[]);
  function loadData(){
    setLoading(true);
    const params=new URLSearchParams();
    if(filters.startDate)params.set('startDate',filters.startDate);
    if(filters.endDate)params.set('endDate',filters.endDate);
    if(filters.reason!=='all')params.set('reason',filters.reason);
    if(filters.person!=='all')params.set('person',filters.person);
    if(filters.method!=='all')params.set('method',filters.method);
    apiFetch('/api/admin/donation-analytics-advanced?'+params.toString()).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));
  }

  function applyFilters(){loadData();}
  function clearFilters(){setFilters({startDate:'',endDate:'',reason:'all',person:'all',method:'all'});setTimeout(loadData,100);}

  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  if(!data) return React.createElement('p',null,'Unable to load.');

  const topDonors=Object.entries(data.byPerson||{}).sort((a,b)=>b[1].total-a[1].total);
  const byMonthArr=Object.entries(data.byMonth||{}).sort((a,b)=>a[0].localeCompare(b[0]));
  const byReasonArr=Object.entries(data.byReason||{}).sort((a,b)=>b[1].total-a[1].total);
  const byMethodArr=Object.entries(data.byMethod||{}).sort((a,b)=>b[1].total-a[1].total);

  return React.createElement('div',null,
    // Filters bar
    React.createElement('div',{className:'card',style:{marginBottom:16}},
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',gap:10,alignItems:'end'}},
        React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label',style:{fontSize:'0.8rem'}},'Start Date'),
          React.createElement('input',{className:'form-input',type:'date',value:filters.startDate,onChange:e=>setFilters(p=>({...p,startDate:e.target.value})),style:{fontSize:'0.85rem'}})),
        React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label',style:{fontSize:'0.8rem'}},'End Date'),
          React.createElement('input',{className:'form-input',type:'date',value:filters.endDate,onChange:e=>setFilters(p=>({...p,endDate:e.target.value})),style:{fontSize:'0.85rem'}})),
        React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label',style:{fontSize:'0.8rem'}},'Category'),
          React.createElement('select',{className:'form-input',value:filters.reason,onChange:e=>setFilters(p=>({...p,reason:e.target.value})),style:{fontSize:'0.85rem'}},
            React.createElement('option',{value:'all'},'All Categories'),
            (data.allReasons||[]).map(r=>React.createElement('option',{key:r,value:r},r)))),
        React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label',style:{fontSize:'0.8rem'}},'Donor'),
          React.createElement('select',{className:'form-input',value:filters.person,onChange:e=>setFilters(p=>({...p,person:e.target.value})),style:{fontSize:'0.85rem'}},
            React.createElement('option',{value:'all'},'All Donors'),
            (data.allPersons||[]).map(r=>React.createElement('option',{key:r,value:r},r)))),
        React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label',style:{fontSize:'0.8rem'}},'Method'),
          React.createElement('select',{className:'form-input',value:filters.method,onChange:e=>setFilters(p=>({...p,method:e.target.value})),style:{fontSize:'0.85rem'}},
            React.createElement('option',{value:'all'},'All Methods'),
            (data.allMethods||[]).map(r=>React.createElement('option',{key:r,value:r},r)))),
        React.createElement('div',{style:{display:'flex',gap:6}},
          React.createElement('button',{className:'btn btn-sm btn-primary',onClick:applyFilters},'Apply'),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:clearFilters},'Clear')))),

    // Summary cards
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:12,marginBottom:16}},
      [['Total','$'+data.totalAmount.toFixed(2)],['Transactions',data.totalCount],['Donors',data.uniqueDonors],['Average','$'+(data.totalCount?(data.totalAmount/data.totalCount).toFixed(2):'0')]].map(([l,v])=>
        React.createElement('div',{key:l,className:'card',style:{textAlign:'center',marginBottom:0,padding:16}},
          React.createElement('div',{style:{fontSize:'0.8rem',color:'#888'}},l),React.createElement('div',{style:{fontSize:'1.4rem',fontWeight:700,color:'#1a2744'}},v)))),

    // View tabs
    React.createElement('div',{style:{display:'flex',gap:6,marginBottom:12}},
      ['overview','byCategory','byMonth','byDonor','transactions'].map(v=>React.createElement('button',{key:v,className:'btn btn-sm '+(view===v?'btn-secondary':'btn-outline'),onClick:()=>{setView(v);setSelectedPerson(null);}},
        v==='overview'?'Overview':v==='byCategory'?'By Category':v==='byMonth'?'By Month':v==='byDonor'?'By Donor':'All Transactions'))),

    // Overview
    view==='overview'&&React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}},
      React.createElement('div',{className:'card'},React.createElement('div',{className:'card-header'},'By Category'),
        byReasonArr.map(([r,d])=>React.createElement('div',{key:r,style:{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f0ece3',cursor:'pointer'},onClick:()=>{setFilters(p=>({...p,reason:r}));loadData();setView('transactions');}},
          React.createElement('span',null,r+' ('+d.count+')'),React.createElement('span',{style:{fontWeight:700}},'$'+d.total.toFixed(2))))),
      React.createElement('div',{className:'card'},React.createElement('div',{className:'card-header'},'By Payment Method'),
        byMethodArr.map(([m,d])=>React.createElement('div',{key:m,style:{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f0ece3',cursor:'pointer'},onClick:()=>{setFilters(p=>({...p,method:m}));loadData();setView('transactions');}},
          React.createElement('span',null,m+' ('+d.count+')'),React.createElement('span',{style:{fontWeight:700}},'$'+d.total.toFixed(2)))))),

    // By Category
    view==='byCategory'&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Donations by Category'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Category','Count','Total','Avg'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,byReasonArr.map(([r,d])=>React.createElement('tr',{key:r,style:{cursor:'pointer'},onClick:()=>{setFilters(p=>({...p,reason:r}));loadData();setView('transactions');}},
          React.createElement('td',null,r),React.createElement('td',null,d.count),React.createElement('td',{style:{fontWeight:700}},'$'+d.total.toFixed(2)),
          React.createElement('td',null,'$'+(d.count?d.total/d.count:0).toFixed(2)))))))),

    // By Month
    view==='byMonth'&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Donations by Month'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Month','Count','Total'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,byMonthArr.map(([m,d])=>React.createElement('tr',{key:m},
          React.createElement('td',null,m),React.createElement('td',null,d.count),React.createElement('td',{style:{fontWeight:700}},'$'+d.total.toFixed(2)))))))),

    // By Donor (clickable to see details)
    view==='byDonor'&&!selectedPerson&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'All Donors ('+topDonors.length+')'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Name','Donations','Total','Last Donation'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,topDonors.map(([name,d])=>React.createElement('tr',{key:name,style:{cursor:'pointer'},onClick:()=>setSelectedPerson(name)},
          React.createElement('td',{style:{color:'#2980b9',fontWeight:600}},name),React.createElement('td',null,d.count),
          React.createElement('td',{style:{fontWeight:700}},'$'+d.total.toFixed(2)),
          React.createElement('td',null,d.donations?.[d.donations.length-1]?.date||'-'))))))),

    // Donor detail view
    view==='byDonor'&&selectedPerson&&React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},selectedPerson),
        React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>setSelectedPerson(null)},'Back to All Donors')),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}},
        React.createElement('div',{style:{background:'#faf8f3',padding:10,borderRadius:6,textAlign:'center'}},React.createElement('div',{style:{fontSize:'0.8rem',color:'#888'}},'Total'),React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:700}},'$'+(data.byPerson[selectedPerson]?.total||0).toFixed(2))),
        React.createElement('div',{style:{background:'#faf8f3',padding:10,borderRadius:6,textAlign:'center'}},React.createElement('div',{style:{fontSize:'0.8rem',color:'#888'}},'Donations'),React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:700}},data.byPerson[selectedPerson]?.count||0)),
        React.createElement('div',{style:{background:'#faf8f3',padding:10,borderRadius:6,textAlign:'center'}},React.createElement('div',{style:{fontSize:'0.8rem',color:'#888'}},'Email'),React.createElement('div',{style:{fontSize:'0.9rem'}},data.byPerson[selectedPerson]?.email||'-'))),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Date','Amount','Category','Method'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,(data.byPerson[selectedPerson]?.donations||[]).map((d,i)=>React.createElement('tr',{key:i},
          React.createElement('td',null,d.date||'-'),React.createElement('td',{style:{fontWeight:700}},'$'+(d.amount||0).toFixed(2)),
          React.createElement('td',null,d.reason||'-'),React.createElement('td',null,d.method||'-'))))))),

    // All transactions
    view==='transactions'&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'All Transactions ('+data.totalCount+')'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Date','Name','Amount','Category','Method','Note'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,(data.donations||[]).map(d=>React.createElement('tr',{key:d.id},
          React.createElement('td',null,d.createdAt?.substring(0,10)||'-'),
          React.createElement('td',{style:{cursor:'pointer',color:'#2980b9'},onClick:()=>{setSelectedPerson(d.displayName);setView('byDonor');}},d.displayName||'-'),
          React.createElement('td',{style:{fontWeight:700}},'$'+(d.amount||0).toFixed(2)),
          React.createElement('td',null,d.reason||'-'),React.createElement('td',null,d.paymentMethod||'-'),
          React.createElement('td',{style:{fontSize:'0.85rem',color:'#888'}},d.note||'-'))))))));
}

// ─── High Holiday Seats Page (Public) ────────────────────────────
function HighHolidaySeatsPage() {
  const [data,setData]=useState(null);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');const [done,setDone]=useState(false);
  const [form,setForm]=useState({firstName:'',lastName:'',email:'',phone:'',numSeats:'1',notes:''});
  useEffect(()=>{apiFetch('/api/high-holidays/seats').then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  function upd(k,v){setForm(p=>({...p,[k]:v}));}
  async function handleReserve(e){
    e.preventDefault();setMsg('');
    try{await apiFetch('/api/high-holidays/reserve',{method:'POST',body:JSON.stringify(form)});setDone(true);}catch(err){setMsg(err.message);}
  }
  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  if(done) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:40,maxWidth:600,margin:'0 auto'}},
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'Reservation Confirmed!'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Your '+form.numSeats+' seat(s) have been reserved.'),
    React.createElement('button',{className:'btn btn-primary',style:{marginTop:20},onClick:()=>{setDone(false);setForm({firstName:'',lastName:'',email:'',phone:'',numSeats:'1',notes:''});}},'Back'));
  if(!data?.settings?.enabled) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:40,maxWidth:600,margin:'0 auto'}},
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'High Holiday Seats'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Seat reservations are not currently open.'));
  return React.createElement('div',{style:{maxWidth:600,margin:'0 auto'}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Reserve High Holiday Seats'),
      React.createElement('div',{style:{display:'flex',gap:20,marginBottom:20}},
        React.createElement('div',{style:{background:'#faf8f3',padding:12,borderRadius:8,flex:1,textAlign:'center'}},
          React.createElement('div',{style:{fontSize:'0.85rem',color:'#888'}},'Price per seat'),
          React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:700,color:'#1a2744'}},'$'+(data.settings.seatPrice||0))),
        React.createElement('div',{style:{background:'#faf8f3',padding:12,borderRadius:8,flex:1,textAlign:'center'}},
          React.createElement('div',{style:{fontSize:'0.85rem',color:'#888'}},'Available'),
          React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:700,color:data.availableCount>0?'#27ae60':'#c0392b'}},data.availableCount))),
      msg&&React.createElement('div',{className:'message message-error'},msg),
      data.availableCount>0&&React.createElement('form',{onSubmit:handleReserve},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:form.firstName,onChange:e=>upd('firstName',e.target.value),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:form.lastName,onChange:e=>upd('lastName',e.target.value),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email *'),React.createElement('input',{className:'form-input',type:'email',value:form.email,onChange:e=>upd('email',e.target.value),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:form.phone,onChange:e=>upd('phone',e.target.value)})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Seats *'),React.createElement('input',{className:'form-input',type:'number',min:'1',max:data.availableCount,value:form.numSeats,onChange:e=>upd('numSeats',e.target.value),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Notes'),React.createElement('input',{className:'form-input',value:form.notes,onChange:e=>upd('notes',e.target.value)}))),
        React.createElement('div',{style:{background:'#faf8f3',padding:12,borderRadius:8,margin:'12px 0',textAlign:'center'}},
          React.createElement('span',{style:{fontSize:'1.1rem',fontWeight:700}},'Total: $'+((data.settings.seatPrice||0)*parseInt(form.numSeats||1)).toFixed(2))),
        React.createElement('button',{className:'btn btn-primary btn-block',type:'submit'},'Reserve Seats'))));
}

// ─── Admin High Holidays ─────────────────────────────────────────
function AdminHighHolidays() {
  const [subTab,setSubTab]=useState('settings');
  const [settings,setSettings]=useState({seatPrice:0,totalSeats:100,enabled:false,rows:10,seatsPerRow:10});
  const [reservations,setReservations]=useState([]);
  const [seatingData,setSeatingData]=useState(null);
  const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');

  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);
    try{setSettings(await apiFetch('/api/admin/high-holidays/settings'));}catch(e){}
    try{setReservations(await apiFetch('/api/admin/high-holidays/reservations'));}catch(e){}
    try{setSeatingData(await apiFetch('/api/admin/high-holidays/seating-chart'));}catch(e){}
    setLoading(false);}

  async function saveSettings(){setMsg('');
    try{await apiFetch('/api/admin/high-holidays/settings',{method:'PUT',body:JSON.stringify(settings)});setMsg('Settings saved!');}catch(e){setMsg('Error: '+e.message);}}

  async function assignSeat(resId,seatId){
    const res=reservations.find(r=>r.id===resId);if(!res)return;
    const assignments=[...(res.seatAssignments||[]),seatId];
    try{await apiFetch('/api/admin/high-holidays/assign-seat',{method:'PUT',body:JSON.stringify({reservationId:resId,seatAssignments:assignments})});load();}catch(e){setMsg('Error: '+e.message);}}

  const totalReserved=reservations.reduce((s,r)=>s+(r.numSeats||0),0);
  const totalRevenue=reservations.reduce((s,r)=>s+(r.totalAmount||0),0);

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{style:{display:'flex',gap:8,marginBottom:16}},
      ['settings','reservations'].map(t=>React.createElement('button',{key:t,className:'btn btn-sm '+(subTab===t?'btn-primary':'btn-outline'),onClick:()=>setSubTab(t)},
        t==='settings'?'Settings':'Reservations'))),

    subTab==='settings'&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'High Holiday Settings'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:12}},
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Enabled'),
          React.createElement('select',{className:'form-input',value:settings.enabled?'yes':'no',onChange:e=>setSettings(p=>({...p,enabled:e.target.value==='yes'}))},
            React.createElement('option',{value:'no'},'Closed'),React.createElement('option',{value:'yes'},'Open'))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Price per Seat ($)'),React.createElement('input',{className:'form-input',type:'number',value:settings.seatPrice,onChange:e=>setSettings(p=>({...p,seatPrice:parseFloat(e.target.value)||0}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Total Seats'),React.createElement('input',{className:'form-input',type:'number',value:settings.totalSeats,onChange:e=>setSettings(p=>({...p,totalSeats:parseInt(e.target.value)||0}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Rows'),React.createElement('input',{className:'form-input',type:'number',value:settings.rows,onChange:e=>setSettings(p=>({...p,rows:parseInt(e.target.value)||0}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Seats per Row'),React.createElement('input',{className:'form-input',type:'number',value:settings.seatsPerRow,onChange:e=>setSettings(p=>({...p,seatsPerRow:parseInt(e.target.value)||0}))}))),
      React.createElement('button',{className:'btn btn-primary',onClick:saveSettings,style:{marginTop:8}},'Save'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:16}},
        [['Reserved',totalReserved+'/'+(settings.totalSeats||0)],['Bookings',reservations.length],['Revenue','$'+totalRevenue.toFixed(2)]].map(([l,v])=>
          React.createElement('div',{key:l,style:{background:'#faf8f3',padding:10,borderRadius:6,textAlign:'center'}},
            React.createElement('div',{style:{fontSize:'0.8rem',color:'#888'}},l),React.createElement('div',{style:{fontSize:'1.2rem',fontWeight:700}},v))))),

    subTab==='reservations'&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Reservations ('+reservations.length+')'),
      reservations.length===0?React.createElement('p',{style:{color:'#888'}},'None yet.'):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Name','Email','Seats','Amount','Method','Assigned'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,reservations.map(r=>React.createElement('tr',{key:r.id},
          React.createElement('td',null,r.displayName),React.createElement('td',null,r.email),
          React.createElement('td',null,r.numSeats),React.createElement('td',{style:{fontWeight:700}},'$'+(r.totalAmount||0).toFixed(2)),
          React.createElement('td',null,r.paymentMethod),React.createElement('td',null,(r.seatAssignments||[]).join(', ')||'-'))))))),

    React.createElement('p',{style:{color:'#888',fontSize:'0.9rem',marginTop:16}},'To assign seats to the physical pews, use the dedicated "Seating" tab in the main admin menu.'));
}
// ─── Main App (Top Nav Layout) ───────────────────────────────────
function App() {
  const [page,setPage]=useState(window.location.hash.replace('#','')||'home');
  const [mobileOpen,setMobileOpen]=useState(false);
  const siteImages=useSiteImages();
  useEffect(()=>{function h(){setPage(window.location.hash.replace('#','')||'home');setMobileOpen(false);}window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h);},[]);
  function navigate(p){window.location.hash=p;setPage(p);setMobileOpen(false);}

  const navItems=[
    {id:'home',label:'Home'},{id:'schedule',label:'Davening'},{id:'calendar',label:'Calendar'},
    {id:'zmanim',label:'Zmanim'},{id:'shiurim',label:'Shiurim'},{id:'sponsorship',label:'Kiddush'},
    {id:'highholidays',label:'Seats'},{id:'contact',label:'Contact'},{id:'account',label:'Account'},{id:'admin',label:'Admin'}
  ];
  const titles={home:'',schedule:'Weekly Davening Schedule',calendar:'Calendar',zmanim:'Zmanim',shiurim:'Weekly Shiurim',donate:'Donations',sponsorship:'Kiddush & Seudas Shlishis',highholidays:'High Holiday Seat Reservations',contact:'Contact the Office',account:'My Account',admin:'Admin Panel',privacy:'Privacy Policy',terms:'Terms of Service'};
  const today=new Date();
  const secDate=today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const showHero=page==='home';
  const topLogoSrc=siteImages.topLogo||'logo.png';
  const heroImgSrc=siteImages.heroImage||null;
  const footerLogoSrc=siteImages.footerLogo||null;

  return React.createElement('div',null,
    // Top bar
    React.createElement('div',{className:'top-bar'},
      React.createElement('div',{className:'top-bar-inner'},
        React.createElement('div',{className:'top-logo',onClick:()=>navigate('home')},
          React.createElement('img',{src:topLogoSrc,alt:'Ohr Chaim',className:'top-logo-img'}),
          React.createElement('div',{className:'top-logo-text'},
            React.createElement('h2',null,'Ohr Chaim'),
            React.createElement('span',null,'Miami Beach, FL'))),
        React.createElement('div',{className:'top-nav'},
          navItems.map(item=>React.createElement('button',{key:item.id,className:'top-nav-item'+(page===item.id?' active':''),onClick:()=>navigate(item.id)},item.label)),
          React.createElement('button',{className:'top-sponsor-btn',onClick:()=>navigate('sponsorship')},'Sponsor Kiddush'),
          React.createElement('button',{className:'top-donate-btn',onClick:()=>navigate('donate')},'Donate')))),
    // Mobile menu toggle
    React.createElement('button',{className:'menu-toggle',onClick:()=>setMobileOpen(!mobileOpen)},mobileOpen?'✕':'☰'),
    React.createElement('div',{className:'mobile-nav'+(mobileOpen?' open':'')},
      navItems.map(item=>React.createElement('button',{key:item.id,className:'mobile-nav-item'+(page===item.id?' active':''),onClick:()=>navigate(item.id)},item.label)),
      React.createElement('button',{className:'mobile-nav-item',onClick:()=>navigate('donate'),style:{color:'#c49a3c'}},'Donate')),
    // Ticker
    React.createElement(ZmanimTicker),
    // Hero (home only) - with decorative tree
    showHero&&React.createElement('div',{className:'hero-banner'},
      heroImgSrc&&React.createElement('img',{src:heroImgSrc,alt:'',className:'hero-tree-bg'}),
      React.createElement('div',{className:'hero-inner'},
        React.createElement('div',{className:'hero-text'},
          React.createElement('h1',null,'Welcome to ',React.createElement('em',null,'Congregation Ohr Chaim')),
          React.createElement('p',null,'317 W 47th Street, Miami Beach, FL 33140')),
        React.createElement('div',{className:'hero-cta'},
          React.createElement('button',{className:'hero-cta-primary',onClick:()=>navigate('donate')},'Make a Donation'),
          React.createElement('button',{className:'hero-cta-secondary',onClick:()=>navigate('schedule')},"This Week's Schedule")))),
    // Page header (non-home pages)
    !showHero&&titles[page]&&React.createElement('div',{className:'page-wrap',style:{paddingBottom:0}},
      React.createElement('div',{className:'page-header'},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:12}},
          React.createElement('img',{src:'logo-tree.png',alt:'',className:'page-header-tree'}),
          React.createElement('h1',null,titles[page])),
        React.createElement('div',{className:'page-header-date'},secDate))),
    // Page content
    React.createElement('div',{className:'page-wrap'},
      page==='home'&&React.createElement(HomePage,{navigate}),
      page==='schedule'&&React.createElement(SchedulePage,{navigate}),
      page==='calendar'&&React.createElement(CalendarPage),
      page==='zmanim'&&React.createElement(ZmanimPage),
      page==='shiurim'&&React.createElement(ShiurimPage),
      page==='donate'&&React.createElement(DonatePage),
      page==='sponsorship'&&React.createElement(SponsorshipPage),
      page==='highholidays'&&React.createElement(HighHolidaySeatsPage),
      page==='account'&&React.createElement(AccountPage),
      page==='signup'&&React.createElement(AccountPage),
      page==='admin'&&React.createElement(AdminPanel),
      page==='contact'&&React.createElement(ContactPage),
      page==='privacy'&&React.createElement(PrivacyPage),
      page==='terms'&&React.createElement(TermsPage)),
    // Footer
    React.createElement('div',{className:'site-footer'},
      footerLogoSrc&&React.createElement('img',{src:footerLogoSrc,alt:'Congregation Ohr Chaim',className:'footer-logo'}),
      React.createElement('div',{className:'footer-text'},'© '+today.getFullYear()+' Congregation Ohr Chaim • 317 W 47th Street, Miami Beach, FL'),
      React.createElement('div',{className:'footer-links',style:{marginTop:8,fontSize:'0.85rem'}},
        React.createElement('a',{href:'#contact',style:{color:'rgba(255,255,255,0.55)',margin:'0 8px'}},'Contact'),
        React.createElement('a',{href:'#privacy',style:{color:'rgba(255,255,255,0.55)',margin:'0 8px'}},'Privacy Policy'),
        React.createElement('a',{href:'#terms',style:{color:'rgba(255,255,255,0.55)',margin:'0 8px'}},'Terms of Service'))));
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
