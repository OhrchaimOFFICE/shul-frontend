const BACKEND_URL = "https://shul-backend.onrender.com";
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

  // Fullscreen overlay — designed for shul TV display, fills entire viewport
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
      React.createElement('button',{onClick:closeFullscreen,style:{position:'absolute',top:16,right:16,background:'rgba(255,255,255,0.15)',color:'#fff',border:'none',borderRadius:'50%',width:44,height:44,fontSize:'1.3rem',cursor:'pointer'}},'✕'),
      // Header with logo
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:20,marginBottom:20}},
        React.createElement('img',{src:'logo-tree.png',alt:'Ohr Chaim',style:{height:90,background:'rgba(255,255,255,0.95)',borderRadius:'50%',padding:8}}),
        React.createElement('div',null,
          React.createElement('h1',{style:{fontFamily:'var(--font-display)',color:'#c49a3c',fontSize:'2.4rem',margin:0,letterSpacing:1,fontWeight:700}},'Congregation Ohr Chaim'),
          React.createElement('p',{style:{color:'rgba(255,255,255,0.4)',fontSize:'1rem',margin:'4px 0 0',letterSpacing:2}},'317 W 47th St, Miami Beach, FL 33140'))),
      // Two columns filling remaining space
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,width:'100%',maxWidth:1600,flex:1,minHeight:0,paddingBottom:20}},
        // Left: All Zmanim
        React.createElement('div',{style:{background:'rgba(255,255,255,0.07)',borderRadius:14,padding:'20px 28px',border:'1px solid rgba(196,154,60,0.3)',display:'flex',flexDirection:'column',overflow:'hidden'}},
          React.createElement('h2',{style:{fontFamily:'var(--font-display)',color:'#c49a3c',marginBottom:16,fontSize:'2rem',textAlign:'center',fontWeight:700}},"Today's Zmanim"),
          React.createElement('div',{style:{flex:1,display:'flex',flexDirection:'column',justifyContent:'space-around'}},
            zmanimList.map(([n,v])=>React.createElement('div',{key:n,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.08)',fontSize:'1.4rem'}},
              React.createElement('span',{style:{color:'rgba(255,255,255,0.7)'}},n),
              React.createElement('span',{style:{fontWeight:700,color:'#fff',fontFamily:'var(--font-display)',fontSize:'1.5rem'}},v))))),
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
      todayShiurim.map(s=>React.createElement('div',{key:s.id,style:{fontSize:'0.8rem',padding:'3px 0',color:'#555'}},s.title+(s.time?' — '+s.time:'')))),
    // Buttons
    React.createElement('div',{style:{display:'flex',gap:6,marginTop:10}},
      React.createElement('button',{className:'zmanim-expand-btn',onClick:openFullscreen,style:{flex:1}},'Full Screen'),
      onExpand&&React.createElement('button',{className:'zmanim-expand-btn',onClick:onExpand,style:{flex:1}},'Zmanim Page'))
  );
}

// ─── Ticker ──────────────────────────────────────────────────────
function ZmanimTicker() {
  const [data,setData]=useState(null);
  useEffect(()=>{apiFetch('/api/zmanim/today').then(setData).catch(()=>{});},[]);
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

  useEffect(()=>{
    Promise.all([
      apiFetch('/api/schedule/today').then(setSchedule).catch(()=>{}),
      apiFetch('/api/schedule/shabbos').then(setShabbosData).catch(()=>{}),
      apiFetch('/api/shiurim').then(setShiurim).catch(()=>{})
    ]).then(()=>setLoading(false));
  },[]);

  const isFriday=new Date().getDay()===5;
  const showCandles=isFriday||(schedule?.dayType==='yomTov');
  const shabbosShiurim=shiurim.filter(s=>s.dayOfWeek===6);
  const sb=shabbosData; // shorthand

  return React.createElement('div',null,
    React.createElement('div',{className:'home-grid'},
      // Column 1: Today's davening
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
          ):React.createElement('p',{style:{color:'#888'}},'Unable to load.'))),
      // Column 2: This Shabbos — full schedule
      React.createElement('div',null,
        React.createElement('div',{className:'card'},
          React.createElement('div',{className:'card-header'},'This Shabbos',sb?.parsha&&React.createElement('span',{className:'badge'},sb.parsha)),
          sb?React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'0.82rem',fontWeight:600,color:'#c49a3c',marginBottom:2,letterSpacing:0.5}},'FRIDAY NIGHT'),
            sb.candleLighting&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},sb.candleLighting)),
            sb.fridayMincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha / Kabbalas Shabbos'),React.createElement('span',{className:'time-value'},sb.fridayMincha)),
            React.createElement('div',{style:{fontSize:'0.82rem',fontWeight:600,color:'#c49a3c',marginTop:6,marginBottom:2,letterSpacing:0.5}},'SHABBOS DAY'),
            sb.shacharis&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Shacharis'),React.createElement('span',{className:'time-value'},sb.shacharis)),
            sb.sofZmanShma&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Latest Shema'),React.createElement('span',{className:'time-value'},sb.sofZmanShma)),
            sb.mincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha'),React.createElement('span',{className:'time-value'},sb.mincha)),
            sb.sunset&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Sunset'),React.createElement('span',{className:'time-value'},sb.sunset)),
            sb.shabbosEnds&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Shabbos Ends'),React.createElement('span',{className:'time-value'},sb.shabbosEnds)),
            shabbosShiurim.length>0&&React.createElement('div',{style:{marginTop:6,paddingTop:6,borderTop:'0.5px solid rgba(0,0,0,0.05)'}},
              React.createElement('div',{style:{fontSize:'0.82rem',fontWeight:600,color:'#1a2744',marginBottom:3}},'SHIURIM'),
              shabbosShiurim.map(s=>React.createElement('div',{key:s.id,style:{display:'flex',justifyContent:'space-between',padding:'2px 0',fontSize:'0.88rem'}},
                React.createElement('span',{style:{color:'#555'}},s.title+(s.rabbi?' — '+s.rabbi:'')),
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
      ['rules','overrides','shiurim','emails','donations','members','pledges','reasons','settings','highholidays','analytics','admins'].map(t=>React.createElement('button',{key:t,className:'admin-tab'+(tab===t?' active':''),onClick:()=>setTab(t)},
        t==='rules'?'Davening Rules':t==='overrides'?'Overrides':t==='shiurim'?'Shiurim':t==='emails'?'Email Center':t==='donations'?'Donations':t==='members'?'Members':t==='pledges'?'Pledges/Billing':t==='reasons'?'Reasons':t==='settings'?'Settings':t==='highholidays'?'High Holidays':t==='analytics'?'Analytics':'Admins'))),
    tab==='rules'&&React.createElement(AdminRulesEditor),
    tab==='overrides'&&React.createElement(AdminOverrides),
    tab==='shiurim'&&React.createElement(AdminShiurim),
    tab==='emails'&&React.createElement(AdminEmailCenter),
    tab==='donations'&&React.createElement(AdminDonations),
    tab==='members'&&React.createElement(AdminMembers),
    tab==='pledges'&&React.createElement(AdminPledges),
    tab==='reasons'&&React.createElement(AdminReasons),
    tab==='settings'&&React.createElement(AdminSettings),
    tab==='highholidays'&&React.createElement(AdminHighHolidays),
    tab==='analytics'&&React.createElement(AdminAnalytics),
    tab==='admins'&&React.createElement(AdminAccounts));
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
      React.createElement('p',{style:{lineHeight:1.8,fontSize:'0.95rem'}},'Weekday Mincha/Maariv during DST: 10 min before plag, rounded down to nearest 5 min. During standard time: 10 min before sunset, rounded down to nearest 5. Friday night DST: additional early mincha at plag (rounded to 5). All times can be overridden for specific dates using Schedule Overrides.')));
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
  useEffect(()=>{apiFetch('/api/donations/reasons').then(setReasons).catch(()=>setReasons(['General Donation','Membership Dues','Building Fund','Torah Fund','Yahrzeit','In Honor Of','In Memory Of','Other']));},[]);
  function upd(k,v){setForm(p=>({...p,[k]:v}));}
  async function handleDonate(e){
    e.preventDefault();
    if(!form.amount||!form.firstName||!form.lastName||!form.email){setMsg('Please fill all required fields.');return;}
    setLoading(true);setMsg('');
    try{
      const pi=await apiFetch('/api/donations/create-payment',{method:'POST',body:JSON.stringify({...form,amount:parseFloat(form.amount),type:'donation'})});
      await apiFetch('/api/donations/confirm',{method:'POST',body:JSON.stringify({...form,amount:parseFloat(form.amount),paymentIntentId:pi.paymentIntentId,type:'donation'})});
      setStep('done');
    }catch(err){setMsg('Error: '+err.message);}
    setLoading(false);
  }
  if(step==='done') return React.createElement('div',null,React.createElement('div',{className:'card',style:{textAlign:'center',padding:40}},
    React.createElement('div',{style:{fontSize:'3rem',marginBottom:16}},'✅'),
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'Thank You!'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Your donation of $'+form.amount+' has been recorded. A receipt will be sent to '+form.email+'.'),
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
        React.createElement('button',{className:'btn btn-primary btn-block',type:'submit',disabled:loading,style:{marginTop:8,fontSize:'1.1rem',padding:'14px 28px'}},
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
            return React.createElement('option',{key:d,value:d},formatDisplayDate(d)+(label?' — '+label:''));
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
  useEffect(()=>{const unsub=firebase.auth().onAuthStateChanged(u=>{setUser(u);setLoading(false);});return unsub;},[]);
  useEffect(()=>{if(user){apiFetch('/api/auth/profile').then(p=>{setProfile(p);setEditForm({firstName:p.firstName||'',lastName:p.lastName||'',phone:p.phone||'',address:p.address||'',bio:p.bio||''});}).catch(()=>{});}},[user]);
  useEffect(()=>{const hash=window.location.hash;if(hash.includes('token=')){const token=hash.split('token=')[1]?.split('&')[0];if(token){setAuthMode('prefill');apiFetch('/api/auth/prefill/'+token).then(d=>{setRegForm(p=>({...p,firstName:d.firstName||'',lastName:d.lastName||'',email:d.email||'',phone:d.phone||'',address:d.address||'',spouseEmail:d.spouseEmail||''}));}).catch(err=>setError(err.message));}}},[]);

  async function handleLogin(e){e.preventDefault();setError('');try{await firebase.auth().signInWithEmailAndPassword(loginForm.email,loginForm.password);}catch(err){setError(err.message);}}
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
    React.createElement('img',{src:'logo-full.png',alt:'Congregation Ohr Chaim',className:'auth-logo'}),
    React.createElement('div',{className:'auth-title'},authMode==='prefill'?'Complete Your Account':'My Account'),
    React.createElement('div',{className:'auth-subtitle'},'Congregation Ohr Chaim'),
    error&&React.createElement('div',{className:'message message-error'},error),
    authMode==='login'?React.createElement('form',{onSubmit:handleLogin},
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:loginForm.email,onChange:e=>setLoginForm(p=>({...p,email:e.target.value})),required:true})),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Password'),React.createElement('input',{className:'form-input',type:'password',value:loginForm.password,onChange:e=>setLoginForm(p=>({...p,password:e.target.value})),required:true})),
      React.createElement('button',{className:'btn btn-primary btn-block',type:'submit'},'Sign In'),
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
        React.createElement('button',{className:'btn btn-sm btn-outline',style:{marginTop:16},onClick:()=>setEditing(true)},'Edit Profile'))));
}

// ─── Admin Donations ─────────────────────────────────────────────
function AdminDonations() {
  const [donations,setDonations]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [year,setYear]=useState(new Date().getFullYear());
  const [mf,setMf]=useState({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:'',paymentMethod:'check'});
  const [reasons,setReasons]=useState([]);
  const [uploading,setUploading]=useState(false);
  useEffect(()=>{load();apiFetch('/api/donations/reasons').then(setReasons).catch(()=>{});},[year]);
  async function load(){setLoading(true);try{setDonations(await apiFetch('/api/admin/donations?year='+year));}catch(e){}setLoading(false);}
  async function recordManual(e){e.preventDefault();setMsg('');
    try{await apiFetch('/api/admin/manual-payment',{method:'POST',body:JSON.stringify({...mf,amount:parseFloat(mf.amount),type:'donation'})});setMsg('Payment recorded!');setMf({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:'',paymentMethod:'check'});load();}catch(err){setMsg('Error: '+err.message);}}
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
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Note'),React.createElement('input',{className:'form-input',value:mf.note,onChange:e=>setMf(p=>({...p,note:e.target.value}))}))),
        React.createElement('button',{className:'btn btn-primary',type:'submit',style:{marginTop:8}},'Record Payment'))),
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
        React.createElement('thead',null,React.createElement('tr',null,['Date','Name','Amount','Reason','Method','Receipt'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,donations.map(d=>React.createElement('tr',{key:d.id},
          React.createElement('td',null,d.createdAt?.substring(0,10)||'-'),React.createElement('td',null,d.displayName||'-'),
          React.createElement('td',{style:{fontWeight:700}},'$'+(d.amount||0).toFixed(2)),React.createElement('td',null,d.reason||'-'),React.createElement('td',null,d.paymentMethod||'-'),
          React.createElement('td',null,d.receiptSent?React.createElement('span',{style:{color:'#27ae60',fontSize:'0.8rem'}},'Sent'):
            d.email?React.createElement('button',{className:'btn btn-sm btn-outline',style:{padding:'3px 8px',fontSize:'0.7rem'},onClick:async()=>{try{await apiFetch('/api/admin/send-receipt',{method:'POST',body:JSON.stringify({donationId:d.id})});setMsg('Receipt sent to '+d.email);load();}catch(e){setMsg('Error: '+e.message);}}},'Send'):
            React.createElement('span',{style:{color:'#888',fontSize:'0.75rem'}},'No email')))))))));
}

// ─── Admin Analytics moved to Phase 3 section below ─────────────



// ─── Admin Members ───────────────────────────────────────────────
function AdminMembers() {
  const [members,setMembers]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [prefilled,setPrefilled]=useState([]);const [uploading,setUploading]=useState(false);
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);try{setMembers(await apiFetch('/api/admin/members'));}catch(e){}try{setPrefilled(await apiFetch('/api/admin/prefilled-accounts'));}catch(e){}setLoading(false);}
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
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Name','Email','Phone','Role'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,members.map(m=>React.createElement('tr',{key:m.uid},
          React.createElement('td',null,m.displayName||'-'),React.createElement('td',null,m.email||'-'),React.createElement('td',null,m.phone||'-'),
          React.createElement('td',null,React.createElement('span',{style:{padding:'2px 8px',borderRadius:12,fontSize:'0.8rem',fontWeight:600,background:m.role==='admin'?'rgba(196,154,60,0.15)':'rgba(39,174,96,0.1)',color:m.role==='admin'?'#c49a3c':'#27ae60'}},m.role||'member')))))))));
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
          React.createElement('option',{value:'off'},'OFF — No automatic reminders'),
          React.createElement('option',{value:'on'},'ON — Send reminders automatically'))),
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
  const [weeklyCustomText,setWeeklyCustomText]=useState('');
  const [weeklySubject,setWeeklySubject]=useState("This Week's Davening Schedule — Congregation Ohr Chaim");
  const [weeklyPreviewHtml,setWeeklyPreviewHtml]=useState('');
  const [weeklyTargetGroup,setWeeklyTargetGroup]=useState('all');
  // Template form
  const [tplForm,setTplForm]=useState({name:'',subject:'',html:''});

  useEffect(()=>{
    apiFetch('/api/admin/email/recipients').then(setRecipients).catch(()=>{});
    apiFetch('/api/admin/email/templates').then(setTemplates).catch(()=>{});
    apiFetch('/api/admin/email/log').then(setLog).catch(()=>{});
  },[]);

  function getTargetEmails(group){
    if(group==='members') return recipients.filter(r=>r.role==='member').map(r=>r.email);
    if(group==='unpaid') return recipients.filter(r=>!r.membershipPaid&&!r.autoPayment).map(r=>r.email);
    if(group==='admins') return recipients.filter(r=>r.role==='admin').map(r=>r.email);
    return recipients.map(r=>r.email);
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
      const res=await apiFetch('/api/admin/email/preview-weekly',{method:'POST',body:JSON.stringify({startDate:weeklyStartDate})});
      let html=res.html||'';
      if(weeklyCustomText) html=html.replace('</table>','</table><div style="padding:16px 0;border-top:2px solid #c49a3c;margin-top:16px;">'+weeklyCustomText+'</div>');
      setWeeklyPreviewHtml(html);
    }catch(err){setMsg('Error: '+err.message);}
  }

  async function sendWeeklyCustom(){
    setSending(true);setMsg('');
    try{
      const targetEmails=getTargetEmails(weeklyTargetGroup);
      const res=await apiFetch('/api/admin/email/send-weekly-custom',{method:'POST',body:JSON.stringify({recipients:targetEmails,startDate:weeklyStartDate,customText:weeklyCustomText,subject:weeklySubject})});
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
            React.createElement('option',{value:'admins'},'Admins Only'))),
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
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Start Date (Sunday)'),
            React.createElement('input',{className:'form-input',type:'date',value:weeklyStartDate,onChange:e=>setWeeklyStartDate(e.target.value)})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Send To'),
            React.createElement('select',{className:'form-input',value:weeklyTargetGroup,onChange:e=>setWeeklyTargetGroup(e.target.value)},
              React.createElement('option',{value:'all'},'All ('+recipients.length+')'),
              React.createElement('option',{value:'members'},'Members'),
              React.createElement('option',{value:'admins'},'Admins'))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),
            React.createElement('input',{className:'form-input',value:weeklySubject,onChange:e=>setWeeklySubject(e.target.value)}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Custom Message (will appear below the schedule — supports HTML, <img> tags for images)'),
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
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:seedDefaults},'Load Default Templates')),
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
      ['settings','reservations','seating'].map(t=>React.createElement('button',{key:t,className:'btn btn-sm '+(subTab===t?'btn-primary':'btn-outline'),onClick:()=>setSubTab(t)},
        t==='settings'?'Settings':t==='reservations'?'Reservations':'Seating Chart'))),

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
          React.createElement('td',null,r.paymentMethod),React.createElement('td',null,(r.seatAssignments||[]).join(', ')||'—'))))))),

    subTab==='seating'&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Seating Chart'),
      React.createElement('div',{style:{textAlign:'center',marginBottom:12}},
        React.createElement('div',{style:{background:'#1a2744',color:'#c49a3c',padding:'6px 40px',display:'inline-block',borderRadius:'4px 4px 0 0',fontWeight:700,fontSize:'0.85rem'}},'ARON KODESH')),
      React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:3}},
        Array.from({length:settings.rows||10},(_,row)=>
          React.createElement('div',{key:row,style:{display:'flex',gap:3,alignItems:'center'}},
            React.createElement('span',{style:{width:28,textAlign:'right',fontSize:'0.7rem',color:'#888',marginRight:3}},'R'+(row+1)),
            Array.from({length:settings.seatsPerRow||10},(_,col)=>{
              const seatId='R'+(row+1)+'-S'+(col+1);
              const assigned=seatingData?.seatMap?.[seatId];
              return React.createElement('div',{key:col,style:{width:28,height:28,borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.55rem',fontWeight:600,cursor:'pointer',background:assigned?'#c49a3c':'#27ae60',color:'#fff'},
                title:assigned?assigned.name:seatId+' — Available',
                onClick:()=>{if(!assigned){const resId=prompt('Reservation ID for seat '+seatId+':');if(resId)assignSeat(resId,seatId);}}},col+1);}))))));
}
// ─── Main App (Top Nav Layout) ───────────────────────────────────
function App() {
  const [page,setPage]=useState(window.location.hash.replace('#','')||'home');
  const [mobileOpen,setMobileOpen]=useState(false);
  useEffect(()=>{function h(){setPage(window.location.hash.replace('#','')||'home');setMobileOpen(false);}window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h);},[]);
  function navigate(p){window.location.hash=p;setPage(p);setMobileOpen(false);}

  const navItems=[
    {id:'home',label:'Home'},{id:'schedule',label:'Davening'},{id:'calendar',label:'Calendar'},
    {id:'zmanim',label:'Zmanim'},{id:'shiurim',label:'Shiurim'},{id:'sponsorship',label:'Kiddush'},
    {id:'highholidays',label:'Seats'},{id:'account',label:'Account'},{id:'admin',label:'Admin'}
  ];
  const titles={home:'',schedule:'Weekly Davening Schedule',calendar:'Calendar',zmanim:'Zmanim',shiurim:'Weekly Shiurim',donate:'Donations',sponsorship:'Kiddush & Seudas Shlishis',highholidays:'High Holiday Seat Reservations',account:'My Account',admin:'Admin Panel'};
  const today=new Date();
  const secDate=today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const showHero=page==='home';

  return React.createElement('div',null,
    // Top bar
    React.createElement('div',{className:'top-bar'},
      React.createElement('div',{className:'top-bar-inner'},
        React.createElement('div',{className:'top-logo',onClick:()=>navigate('home')},
          React.createElement('img',{src:'logo-tree.png',alt:'Ohr Chaim',className:'top-logo-img'}),
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
    // Hero (home only) — with decorative tree
    showHero&&React.createElement('div',{className:'hero-banner'},
      React.createElement('img',{src:'logo-tree.png',alt:'',className:'hero-tree-bg'}),
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
      page==='admin'&&React.createElement(AdminPanel)),
    // Footer
    React.createElement('div',{className:'site-footer'},
      React.createElement('img',{src:'logo-full.png',alt:'Congregation Ohr Chaim',className:'footer-logo'}),
      React.createElement('div',{className:'footer-text'},'© '+today.getFullYear()+' Congregation Ohr Chaim • 317 W 47th Street, Miami Beach, FL')));
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
