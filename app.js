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

// ─── Zmanim Panel (MyZmanim Widget via iframe) ──────────────────
function ZmanimPanel({onExpand}) {
  const iframeRef = useRef(null);
  useEffect(()=>{
    if(!iframeRef.current) return;
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:8px;font-family:"Open Sans",sans-serif;}</style></head><body>' +
      '<script type="text/javascript" charset="UTF-8" src="https://www.myzmanim.com/widget.aspx?lang=en&mode=Standard&fsize=12&fcolor=1a2744&hcolor=faf8f3&bcolor=c49a3c&suf=s&key=36FtEjK2LSnQnGiOz2VBKgH53KnAY%2b3hrcR4Y6wUot92o8WG3B8YSbsll6LaSAYMQ1S2dIN6oyp87TiKzUQ%2f6a2g3uqknnDxxVJIYw2%2fTUbrQiUitklmn6Ld4hla%2bHNC"><\/script>' +
      '<noscript>Find your daily zmanim at <a href="http://www.myzmanim.com/">MyZmanim.com</a>.</noscript></body></html>';
    iframeRef.current.srcdoc = html;
  },[]);
  return React.createElement('div',{className:'zmanim-panel'},
    React.createElement('div',{className:'zmanim-panel-title'},"Today's Zmanim"),
    React.createElement('iframe',{ref:iframeRef,style:{width:'100%',minHeight:420,border:'none',borderRadius:4},title:'MyZmanim'}),
    onExpand&&React.createElement('button',{className:'zmanim-expand-btn',onClick:onExpand},'View Full Zmanim Page')
  );
}

// ─── Ticker ──────────────────────────────────────────────────────
function ZmanimTicker() {
  const [data,setData]=useState(null);
  useEffect(()=>{apiFetch('/api/zmanim/today').then(setData).catch(()=>{});},[]);
  if(!data) return null;
  const z=data.zmanim;
  const items=[['Sunrise',z.sunrise],['Sof Zman Shma',z.sofZmanShma],['Chatzos',z.chatzot],['Plag',z.plagHaMincha],['Sunset',z.sunset],['Tzeis',z.tzeit]].filter(([_,v])=>v);
  if(z.candleLighting) items.push(['🕯 Candle Lighting',z.candleLighting]);
  return React.createElement('div',{className:'zmanim-ticker'},
    React.createElement('div',{className:'ticker-content'},
      items.concat(items).map(([l,v],i)=>React.createElement('span',{className:'ticker-item',key:l+i},React.createElement('span',{className:'ticker-label'},l+':'),' '+fmtZ(v)))
    ));
}

// ─── Home ────────────────────────────────────────────────────────
function HomePage({navigate}) {
  const [schedule,setSchedule]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{apiFetch('/api/schedule/today').then(d=>{setSchedule(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  return React.createElement('div',{className:'content-with-zmanim'},
    React.createElement('div',null,
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Welcome to Congregation Ohr Chaim'),
        React.createElement('p',{style:{fontSize:'1.05rem',lineHeight:1.7}},'Located at 317 W 47th Street, Miami Beach. Join us for davening, shiurim, and community events.'),
        React.createElement('div',{style:{display:'flex',gap:12,marginTop:16,flexWrap:'wrap'}},
          React.createElement('button',{className:'btn btn-primary',onClick:()=>navigate('schedule')},'📅 This Week\'s Schedule'),
          React.createElement('button',{className:'btn btn-outline',onClick:()=>navigate('donate')},'💝 Make a Donation'))),
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},"Today's Davening Times"),
        loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...'):
        schedule?React.createElement('div',null,
          schedule.holidays?.length>0&&React.createElement('div',{style:{marginBottom:12}},schedule.holidays.map((h,i)=>React.createElement('span',{className:'holiday-badge',key:i},h))),
          schedule.davening?.shacharis&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Shacharis'),React.createElement('span',{className:'time-value'},schedule.davening.shacharis)),
          schedule.davening?.earlyMincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Early Mincha (Plag)'),React.createElement('span',{className:'time-value'},schedule.davening.earlyMincha)),
          schedule.davening?.mincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha'),React.createElement('span',{className:'time-value'},schedule.davening.mincha)),
          schedule.davening?.minchaMaariv&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha / Maariv'),React.createElement('span',{className:'time-value'},schedule.davening.minchaMaariv)),
          schedule.davening?.maariv&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Maariv'),React.createElement('span',{className:'time-value'},schedule.davening.maariv)),
          schedule.zmanim?.candleLighting&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'🕯 Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},schedule.zmanim.candleLighting))
        ):React.createElement('p',null,'Unable to load schedule.')),
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Quick Links'),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:12}},
          [['📅 Weekly Schedule','schedule'],['🗓 Calendar','calendar'],['📖 Shiurim','shiurim'],['🕐 Full Zmanim','zmanim']].map(([l,p])=>
            React.createElement('button',{key:p,className:'btn btn-outline btn-block',onClick:()=>navigate(p),style:{justifyContent:'flex-start',padding:'14px 18px',fontSize:'1.05rem'}},l))))),
    React.createElement(ZmanimPanel,{onExpand:()=>navigate('zmanim')}));
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
              day.zmanim?.candleLighting&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'🕯 Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},day.zmanim.candleLighting)),
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
  const all=[['Alot HaShachar',z.alotHaShachar],['Misheyakir',z.misheyakir],['Sunrise (HaNetz)',z.sunrise],['Sof Zman Shma (MGA)',z.sofZmanShmaMGA],['Sof Zman Shma (GRA)',z.sofZmanShma],['Sof Zman Tfilla (MGA)',z.sofZmanTfillaMGA],['Sof Zman Tfilla (GRA)',z.sofZmanTfilla],['Chatzos',z.chatzot],['Mincha Gedola',z.minchaGedola],['Mincha Ketana',z.minchaKetana],['Plag HaMincha',z.plagHaMincha],['Sunset (Shkia)',z.sunset],['Tzeis HaKochavim',z.tzeit]].filter(([_,v])=>v);
  return React.createElement('div',{className:'zmanim-full'},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header',style:{textAlign:'center'}},'Zmanim for '+formatDisplayDate(dateStr)),
      data.hebrewDate?.hebrew&&React.createElement('p',{style:{textAlign:'center',fontSize:'1.1rem',color:'#1a2744',fontWeight:600,marginBottom:16}},data.hebrewDate.hebrew),
      React.createElement('div',{style:{textAlign:'center',marginBottom:20}},React.createElement('input',{type:'date',value:dateStr,onChange:e=>setDateStr(e.target.value),className:'form-input',style:{maxWidth:200,display:'inline-block'}})),
      all.map(([n,v])=>React.createElement('div',{className:'zman-row',key:n},React.createElement('span',{className:'zman-name'},n),React.createElement('span',{className:'zman-time'},fmtZ(v)))),
      z.candleLighting&&React.createElement('div',{className:'zman-row',style:{background:'rgba(196,154,60,0.1)',margin:'8px -12px',padding:'10px 12px',borderRadius:6}},React.createElement('span',{style:{color:'#c49a3c',fontWeight:700}},'🕯 Candle Lighting'),React.createElement('span',{style:{color:'#c49a3c',fontWeight:700}},fmtZ(z.candleLighting))),
      React.createElement('p',{style:{textAlign:'center',marginTop:16,fontSize:'0.8rem',color:'#888'}},'Zmanim for 317 W 47th St, Miami Beach • Powered by Hebcal')));
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
      ['rules','overrides','shiurim','donations','members','pledges','analytics','admins'].map(t=>React.createElement('button',{key:t,className:'admin-tab'+(tab===t?' active':''),onClick:()=>setTab(t)},
        t==='rules'?'Davening Rules':t==='overrides'?'Schedule Overrides':t==='shiurim'?'Manage Shiurim':t==='donations'?'Donations':t==='members'?'Members':t==='pledges'?'Pledges/Billing':t==='analytics'?'Analytics':'Admin Accounts'))),
    tab==='rules'&&React.createElement(AdminRulesEditor),
    tab==='overrides'&&React.createElement(AdminOverrides),
    tab==='shiurim'&&React.createElement(AdminShiurim),
    tab==='donations'&&React.createElement(AdminDonations),
    tab==='members'&&React.createElement(AdminMembers),
    tab==='pledges'&&React.createElement(AdminPledges),
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
  const [form,setForm]=useState({title:'',rabbi:'',time:'',dayOfWeek:0,topic:''});
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);try{setShiurim(await apiFetch('/api/shiurim'));}catch(e){}setLoading(false);}
  async function add(){if(!form.title)return;try{await apiFetch('/api/admin/shiurim',{method:'POST',body:JSON.stringify(form)});setForm({title:'',rabbi:'',time:'',dayOfWeek:0,topic:''});setMsg('Shiur added!');load();}catch(e){setMsg('Error: '+e.message);}}
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
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Topic'),React.createElement('input',{className:'form-input',value:form.topic,onChange:e=>setForm(p=>({...p,topic:e.target.value}))}))),
      React.createElement('button',{className:'btn btn-primary',onClick:add,style:{marginTop:12}},'Add Shiur')),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Current Shiurim'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      shiurim.length===0?React.createElement('p',{style:{color:'#888'}},'No shiurim yet.'):
      shiurim.map(s=>React.createElement('div',{className:'shiur-card',key:s.id},
        React.createElement('div',{className:'shiur-day'},DAY_NAMES[s.dayOfWeek]?.substring(0,3)||'?'),
        React.createElement('div',{className:'shiur-info'},React.createElement('div',{className:'shiur-title'},s.title),React.createElement('div',{className:'shiur-details'},[s.time,s.rabbi,s.topic].filter(Boolean).join(' • '))),
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
  const upcoming=data.upcoming||[];const reservations=data.reservations||{};const pricing=data.pricing||{};
  return React.createElement('div',{style:{maxWidth:700,margin:'0 auto'}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Sponsor Kiddush or Seudas Shlishis'),
      React.createElement('p',{style:{marginBottom:16,color:'#555'}},'Choose an upcoming Shabbos below. Reservation cutoff: Wednesday at 8:00 PM.'),
      React.createElement('p',{style:{marginBottom:20,fontSize:'0.9rem',color:'#888'}},'Kiddush: $'+(pricing.kiddushPrice||'TBD')+' • Seudas Shlishis: $'+(pricing.seudasShlishisPrice||'TBD')),
      React.createElement('div',{className:'form-group'},
        React.createElement('label',{className:'form-label'},'Select Shabbos'),
        React.createElement('select',{className:'form-input',value:selectedDate,onChange:e=>setSelectedDate(e.target.value)},
          React.createElement('option',{value:''},'-- Choose a Shabbos --'),
          upcoming.map(d=>React.createElement('option',{key:d,value:d},formatDisplayDate(d))))),
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
  useEffect(()=>{load();apiFetch('/api/donations/reasons').then(setReasons).catch(()=>{});},[year]);
  async function load(){setLoading(true);try{setDonations(await apiFetch('/api/admin/donations?year='+year));}catch(e){}setLoading(false);}
  async function recordManual(e){e.preventDefault();setMsg('');
    try{await apiFetch('/api/admin/manual-payment',{method:'POST',body:JSON.stringify({...mf,amount:parseFloat(mf.amount),type:'donation'})});setMsg('Payment recorded!');setMf({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:'',paymentMethod:'check'});load();}catch(err){setMsg('Error: '+err.message);}}
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
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'All Donations'),
        React.createElement('select',{className:'form-input',style:{width:120},value:year,onChange:e=>setYear(parseInt(e.target.value))},[2024,2025,2026,2027].map(y=>React.createElement('option',{key:y,value:y},y)))),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Date','Name','Amount','Reason','Method'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,donations.map(d=>React.createElement('tr',{key:d.id},
          React.createElement('td',null,d.createdAt?.substring(0,10)||'-'),React.createElement('td',null,d.displayName||'-'),
          React.createElement('td',{style:{fontWeight:700}},'$'+(d.amount||0).toFixed(2)),React.createElement('td',null,d.reason||'-'),React.createElement('td',null,d.paymentMethod||'-'))))))));
}

// ─── Admin Analytics ─────────────────────────────────────────────
function AdminAnalytics() {
  const [data,setData]=useState(null);const [loading,setLoading]=useState(true);const [year,setYear]=useState(new Date().getFullYear());
  useEffect(()=>{setLoading(true);apiFetch('/api/admin/donation-analytics?year='+year).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));},[year]);
  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  if(!data) return React.createElement('p',null,'Unable to load.');
  const topDonors=Object.entries(data.byPerson||{}).sort((a,b)=>b[1].total-a[1].total).slice(0,20);
  const byMonthArr=Object.entries(data.byMonth||{}).sort((a,b)=>a[0].localeCompare(b[0]));
  const byReasonArr=Object.entries(data.byReason||{}).sort((a,b)=>b[1].total-a[1].total);
  return React.createElement('div',null,
    React.createElement('div',{style:{display:'flex',justifyContent:'flex-end',marginBottom:20}},
      React.createElement('select',{className:'form-input',style:{width:120},value:year,onChange:e=>setYear(parseInt(e.target.value))},[2024,2025,2026,2027].map(y=>React.createElement('option',{key:y,value:y},y)))),
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:16,marginBottom:24}},
      [['Total Donations','$'+data.totalAmount.toFixed(2)],['Transactions',data.totalCount],['Unique Donors',Object.keys(data.byPerson||{}).length],['Avg Donation','$'+(data.totalCount?(data.totalAmount/data.totalCount).toFixed(2):'0')]].map(([l,v])=>
        React.createElement('div',{key:l,className:'card',style:{textAlign:'center',marginBottom:0}},
          React.createElement('div',{style:{fontSize:'0.85rem',color:'#888',marginBottom:4}},l),
          React.createElement('div',{style:{fontSize:'1.5rem',fontWeight:700,color:'#1a2744'}},v)))),
    React.createElement('div',{className:'card'},React.createElement('div',{className:'card-header'},'By Category'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Category','Count','Total'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,byReasonArr.map(([r,d])=>React.createElement('tr',{key:r},React.createElement('td',null,r),React.createElement('td',null,d.count),React.createElement('td',{style:{fontWeight:700}},'$'+d.total.toFixed(2)))))))),
    React.createElement('div',{className:'card'},React.createElement('div',{className:'card-header'},'By Month'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Month','Count','Total'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,byMonthArr.map(([m,d])=>React.createElement('tr',{key:m},React.createElement('td',null,m),React.createElement('td',null,d.count),React.createElement('td',{style:{fontWeight:700}},'$'+d.total.toFixed(2)))))))),
    React.createElement('div',{className:'card'},React.createElement('div',{className:'card-header'},'Top Donors'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Name','Donations','Total','Categories'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,topDonors.map(([name,d])=>React.createElement('tr',{key:name},React.createElement('td',null,name),React.createElement('td',null,d.count),React.createElement('td',{style:{fontWeight:700}},'$'+d.total.toFixed(2)),React.createElement('td',{style:{fontSize:'0.85rem'}},Object.keys(d.reasons||{}).join(', ')))))))));
}

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
      React.createElement('div',{className:'card-header'},'Pre-filled Signup Links ('+prefilled.length+')'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
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
function AdminPledges() {
  const [pledges,setPledges]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [form,setForm]=useState({memberName:'',memberEmail:'',amount:'',reason:'',dueDate:'',notes:''});
  useEffect(()=>{load();},[]);
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
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Reason'),React.createElement('input',{className:'form-input',value:form.reason,onChange:e=>setForm(p=>({...p,reason:e.target.value})),placeholder:'Membership, pledge, etc.'})),
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

// ─── Main App ────────────────────────────────────────────────────
function App() {
  const [page,setPage]=useState(window.location.hash.replace('#','')||'home');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  useEffect(()=>{function h(){setPage(window.location.hash.replace('#','')||'home');setSidebarOpen(false);}window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h);},[]);
  function navigate(p){window.location.hash=p;setPage(p);setSidebarOpen(false);}
  const navItems=[{id:'home',label:'Home',icon:'🏠'},{id:'schedule',label:'Davening Times',icon:'🕐'},{id:'calendar',label:'Calendar',icon:'🗓'},{id:'zmanim',label:'Zmanim',icon:'☀️'},{id:'shiurim',label:'Shiurim',icon:'📖'},{id:'donate',label:'Donations',icon:'💝'},{id:'sponsorship',label:'Kiddush / Seuda',icon:'🍷'},{id:'divider'},{id:'account',label:'My Account',icon:'👤'},{id:'admin',label:'Admin Panel',icon:'⚙️'}];
  const titles={home:'Home',schedule:'Weekly Davening Schedule',calendar:'Calendar',zmanim:'Zmanim',shiurim:'Weekly Shiurim',donate:'Donations',sponsorship:'Kiddush & Seudas Shlishis',account:'My Account',admin:'Admin Panel'};
  const today=new Date();
  const secDate=today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  return React.createElement('div',{className:'app-layout'},
    React.createElement('button',{className:'menu-toggle',onClick:()=>setSidebarOpen(!sidebarOpen)},sidebarOpen?'✕':'☰'),
    sidebarOpen&&React.createElement('div',{className:'sidebar-overlay show',onClick:()=>setSidebarOpen(false)}),
    React.createElement('nav',{className:'sidebar'+(sidebarOpen?' open':'')},
      React.createElement('div',{className:'sidebar-header'},
        React.createElement('div',{className:'sidebar-logo'},'Congregation',React.createElement('br'),'Ohr Chaim'),
        React.createElement('div',{className:'sidebar-logo-sub'},'MIAMI BEACH, FL')),
      React.createElement('div',{className:'sidebar-nav'},
        navItems.map(item=>item.id==='divider'?React.createElement('div',{className:'nav-divider',key:'div'}):
          React.createElement('button',{key:item.id,className:'nav-item'+(page===item.id?' active':''),onClick:()=>navigate(item.id)},
            React.createElement('span',{className:'nav-icon'},item.icon),item.label))),
      React.createElement('div',{className:'sidebar-footer'},'© '+today.getFullYear()+' Congregation Ohr Chaim')),
    React.createElement('main',{className:'main-content'},
      React.createElement(ZmanimTicker),
      React.createElement('header',{className:'main-header'},
        React.createElement('h1',null,titles[page]||'Congregation Ohr Chaim'),
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:10,flexShrink:0}},
          React.createElement('button',{className:'btn btn-primary',onClick:()=>navigate('donate'),style:{whiteSpace:'nowrap',padding:'8px 16px',fontSize:'0.85rem'}},'💝 Donate'),
          React.createElement('div',{className:'header-date'},React.createElement('div',{className:'header-date-secular'},secDate)))),
      React.createElement('div',{className:'page-content'},
        page==='home'&&React.createElement(HomePage,{navigate}),
        page==='schedule'&&React.createElement(SchedulePage,{navigate}),
        page==='calendar'&&React.createElement(CalendarPage),
        page==='zmanim'&&React.createElement(ZmanimPage),
        page==='shiurim'&&React.createElement(ShiurimPage),
        page==='donate'&&React.createElement(DonatePage),
        page==='sponsorship'&&React.createElement(SponsorshipPage),
        page==='account'&&React.createElement(AccountPage),
        page==='signup'&&React.createElement(AccountPage),
        page==='admin'&&React.createElement(AdminPanel))));
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
