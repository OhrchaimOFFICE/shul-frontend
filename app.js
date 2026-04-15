const BACKEND_URL = "https://shul-backend.onrender.com";
const { useState, useEffect, useCallback } = React;
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

// ─── Zmanim Panel ────────────────────────────────────────────────
function ZmanimPanel({onExpand}) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{apiFetch('/api/zmanim/today').then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  if(loading) return React.createElement('div',{className:'zmanim-panel'},React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...'));
  if(!data) return null;
  const z=data.zmanim;
  const list=[['Alot HaShachar',z.alotHaShachar],['Misheyakir',z.misheyakir],['Sunrise',z.sunrise],['Sof Zman Shma (MGA)',z.sofZmanShmaMGA],['Sof Zman Shma (GRA)',z.sofZmanShma],['Chatzos',z.chatzot],['Mincha Gedola',z.minchaGedola],['Plag HaMincha',z.plagHaMincha],['Sunset',z.sunset],['Tzeis',z.tzeit]].filter(([_,v])=>v);
  return React.createElement('div',{className:'zmanim-panel'},
    React.createElement('div',{className:'zmanim-panel-title'},"Today's Zmanim"),
    data.hebrewDate?.hebrew&&React.createElement('div',{style:{fontSize:'0.85rem',textAlign:'center',color:'#888',marginBottom:12}},data.hebrewDate.hebrew),
    list.map(([n,v])=>React.createElement('div',{className:'zman-row',key:n},React.createElement('span',{className:'zman-name'},n),React.createElement('span',{className:'zman-time'},fmtZ(v)))),
    z.candleLighting&&React.createElement('div',{className:'zman-row',style:{background:'rgba(196,154,60,0.08)',margin:'4px -8px',padding:'7px 8px',borderRadius:4}},
      React.createElement('span',{style:{color:'#c49a3c',fontWeight:600}},'🕯 Candle Lighting'),React.createElement('span',{style:{color:'#c49a3c',fontWeight:600}},fmtZ(z.candleLighting))),
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
      ['rules','overrides','shiurim','admins'].map(t=>React.createElement('button',{key:t,className:'admin-tab'+(tab===t?' active':''),onClick:()=>setTab(t)},
        t==='rules'?'Davening Rules':t==='overrides'?'Schedule Overrides':t==='shiurim'?'Manage Shiurim':'Admin Accounts'))),
    tab==='rules'&&React.createElement(AdminRulesEditor),
    tab==='overrides'&&React.createElement(AdminOverrides),
    tab==='shiurim'&&React.createElement(AdminShiurim),
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

// ─── Donate Placeholder ──────────────────────────────────────────
function DonatePage() {
  return React.createElement('div',null,React.createElement('div',{className:'card',style:{textAlign:'center',padding:40}},
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'Donations'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555',marginBottom:20}},'The donation portal will be available in the next phase. For now, please contact the shul office.'),
    React.createElement('p',{style:{fontSize:'1.1rem',fontWeight:600,color:'#1a2744'}},'317 W 47th St, Miami Beach, FL 33140')));
}

// ─── Main App ────────────────────────────────────────────────────
function App() {
  const [page,setPage]=useState(window.location.hash.replace('#','')||'home');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  useEffect(()=>{function h(){setPage(window.location.hash.replace('#','')||'home');setSidebarOpen(false);}window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h);},[]);
  function navigate(p){window.location.hash=p;setPage(p);setSidebarOpen(false);}
  const navItems=[{id:'home',label:'Home',icon:'🏠'},{id:'schedule',label:'Davening Times',icon:'🕐'},{id:'calendar',label:'Calendar',icon:'🗓'},{id:'zmanim',label:'Zmanim',icon:'☀️'},{id:'shiurim',label:'Shiurim',icon:'📖'},{id:'donate',label:'Donations',icon:'💝'},{id:'divider'},{id:'admin',label:'Admin Panel',icon:'⚙️'}];
  const titles={home:'Home',schedule:'Weekly Davening Schedule',calendar:'Calendar',zmanim:'Zmanim',shiurim:'Weekly Shiurim',donate:'Donations',admin:'Admin Panel'};
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
        React.createElement('div',{className:'header-date'},React.createElement('div',{className:'header-date-secular'},secDate))),
      React.createElement('div',{className:'page-content'},
        page==='home'&&React.createElement(HomePage,{navigate}),
        page==='schedule'&&React.createElement(SchedulePage,{navigate}),
        page==='calendar'&&React.createElement(CalendarPage),
        page==='zmanim'&&React.createElement(ZmanimPage),
        page==='shiurim'&&React.createElement(ShiurimPage),
        page==='donate'&&React.createElement(DonatePage),
        page==='admin'&&React.createElement(AdminPanel))));
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
