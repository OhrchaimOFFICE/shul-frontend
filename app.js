// Same-origin: Firebase Hosting rewrites /api/** to the Cloud Function, so the
// API is served from this site's own domain (no CORS). For local dev against a
// remote backend, set window.__BACKEND_URL__ before app.js loads.
const BACKEND_URL = (typeof window !== 'undefined' && window.__BACKEND_URL__) || "";
// --- Native (Capacitor) helpers. On the web these fall back to browser behavior. ---
// In the iOS/Android app the page origin is capacitor://localhost, so shareable
// links and external navigation must be handled explicitly.
const IS_NATIVE = !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const SITE_URL = IS_NATIVE ? 'https://ohrchaim.org' : (typeof window !== 'undefined' ? window.location.origin : '');
// Open an external URL (e.g. Stripe Checkout). In the native app this routes
// through the in-app browser plugin; in a normal browser it opens a new tab.
function openExternal(url){
  if(IS_NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser){
    window.Capacitor.Plugins.Browser.open({url:url});
  } else {
    // Web: same-tab redirect (matches the original Stripe-checkout behavior and
    // avoids popup blockers).
    window.location.href = url;
  }
}
const STRIPE_PUBLISHABLE_KEY = "pk_live_51TNzTG0rialmjNgrf4IGmygXrLa91bSAJ0kPe616KM9UOwkfVd5Fez0Vsyf5BFDstKaoLCbv4prVqNE7FmwPRSvP00S6BSyVs3";
if (window.__firebaseConfig__ && !firebase.apps.length) firebase.initializeApp(window.__firebaseConfig__);
const { useState, useEffect, useCallback, useRef, useLayoutEffect } = React;
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Shabbos'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// "Today" per the shul's timezone (America/New_York), NOT the viewer's — so a
// member davening from Israel doesn't see the wrong day's schedule/candle time.
function getTodayStr() { return new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'}); }
// ET day-of-week (0=Sun..6=Sat). Parsing the ET date string at noon is offset-safe.
function getTodayDow() { return new Date(getTodayStr()+'T12:00:00').getDay(); }
// Render a special Jewish-holiday schedule (Tisha B'Av, etc.) as time rows with
// optional italic notes. Used anywhere a day's davening times are shown.
function holidayScheduleRows(hs){
  if(!hs||!hs.items||!hs.items.length) return null;
  return React.createElement('div',{className:'holiday-schedule'},
    React.createElement('div',{style:{fontWeight:700,color:'#c49a3c',marginBottom:4}},hs.name),
    hs.items.map((it,i)=>React.createElement('div',{key:i,style:{marginBottom:it.note?6:2}},
      React.createElement('div',{className:'time-row'},
        React.createElement('span',{className:'time-label'},it.category||''),
        it.time&&React.createElement('span',{className:'time-value'},it.time)),
      it.note&&React.createElement('div',{style:{fontSize:'0.8rem',color:'#888',fontStyle:'italic',marginTop:1}},it.note))));
}
function formatDisplayDate(ds) { return new Date(ds+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}); }
function getSundayOfWeek(ds) { const d=new Date(ds+'T12:00:00'); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0]; }

// Client copy of the backend's emailTextToHtml (server.js) — used only so the
// Compose live preview matches what the server will send. KEEP IN SYNC.
function emailTextToHtml(text){
  if(!text)return '';
  let html=String(text).replace(/\r\n/g,'\n');
  html=html.replace(/(^|[\s(])(https?:\/\/[^\s<>"')]+)/g,(m,pre,url)=>pre+'<a href="'+url+'" style="color:#c49a3c;font-weight:600;">'+url+'</a>');
  html=html.replace(/\n/g,'<br>');
  html=html.replace(/(<\/(?:p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote)>)(\s*<br>)+/gi,'$1');
  html=html.replace(/(<br>\s*)+(<(?:p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|hr)\b)/gi,'$2');
  return html;
}

// Insert-at-cursor helpers for the email editors ("Insert Link" / "Donate
// button" toolbar). Works on the textarea's current selection.
function insertIntoTextarea(textareaId,currentValue,setValue,buildSnippet){
  const el=document.getElementById(textareaId);
  const start=el?el.selectionStart:currentValue.length;
  const end=el?el.selectionEnd:currentValue.length;
  const snippet=buildSnippet(currentValue.slice(start,end));
  if(snippet==null)return;
  setValue(currentValue.slice(0,start)+snippet+currentValue.slice(end));
}
function makeLinkSnippet(selectedText){
  const url=prompt('Link URL:','https://');
  if(!url||url==='https://')return null;
  return '<a href="'+url+'" style="color:#c49a3c;font-weight:600;">'+(selectedText||url)+'</a>';
}
function makeDonateButtonSnippet(){
  const label=prompt('Button text:','Donate Now');
  if(label===null)return null;
  const link=SITE_URL+'/#donate';
  return '\n<p style="text-align:center;margin:18px 0;"><a href="'+link+'" style="background:#c49a3c;color:#1a2744;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:700;display:inline-block;">'+(label.trim()||'Donate Now')+'</a></p>\n';
}
// Toolbar row rendered above each email editor.
function EditorToolbar(textareaId,currentValue,setValue){
  return React.createElement('div',{style:{display:'flex',gap:6,marginBottom:6,alignItems:'center'}},
    React.createElement('button',{type:'button',className:'btn btn-sm btn-outline',style:{padding:'3px 10px',fontSize:'0.78rem'},onClick:()=>insertIntoTextarea(textareaId,currentValue,setValue,makeLinkSnippet),title:'Select text first to turn it into a link, or insert a bare link'},'🔗 Insert Link'),
    React.createElement('button',{type:'button',className:'btn btn-sm btn-outline',style:{padding:'3px 10px',fontSize:'0.78rem'},onClick:()=>insertIntoTextarea(textareaId,currentValue,setValue,makeDonateButtonSnippet),title:'Insert a gold Donate button at the cursor'},'💛 Donate Button'),
    React.createElement('span',{style:{fontSize:'0.75rem',color:'#888'}},'Line breaks and pasted URLs are formatted automatically.'));
}

// pdf.js (vendored, same-origin) — loaded on demand the first time an admin
// attaches a PDF flyer, then used to rasterize each page to a JPEG so the
// flyer can be DISPLAYED inline in the weekly email.
let _pdfjsPromise=null;
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if(_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='/vendor/pdf.min.js';
    s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.js';resolve(window.pdfjsLib);}catch(e){reject(e);}};
    s.onerror=()=>reject(new Error('Failed to load the PDF library'));
    document.head.appendChild(s);
  });
  // Don't cache a rejected promise — otherwise one transient script-load failure
  // would permanently break PDF attach until a full page reload. Clear it so the
  // next attempt retries.
  _pdfjsPromise.catch(()=>{_pdfjsPromise=null;});
  return _pdfjsPromise;
}
async function renderPdfToImages(file,opts){
  const {scale=1.6,quality=0.82,maxPages=10}=opts||{};
  const pdfjsLib=await loadPdfJs();
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  const out=[];
  const n=Math.min(pdf.numPages,maxPages);
  for(let i=1;i<=n;i++){
    const page=await pdf.getPage(i);
    const viewport=page.getViewport({scale});
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport}).promise;
    out.push(canvas.toDataURL('image/jpeg',quality).split(',')[1]);
  }
  // Flag when the PDF had more pages than we rendered, so the caller can warn
  // the admin instead of silently dropping the tail pages.
  out.truncated=pdf.numPages>maxPages;
  out.totalPages=pdf.numPages;
  return out;
}
// JPEG/PNG flyers skip pdf.js entirely: draw onto a canvas and re-encode as
// JPEG so they ride the same inline-image pipeline as rasterized PDF pages.
function renderImageToJpeg(file,opts){
  const {maxDim=1600,quality=0.82}=opts||{};
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      try{
        const s=Math.min(1,maxDim/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.naturalWidth*s));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*s));
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',quality).split(',')[1]);
      }catch(e){reject(e);}finally{URL.revokeObjectURL(url);}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read that image'));};
    img.src=url;
  });
}
// Validate + rasterize attached flyers (PDF/JPEG/PNG) for an email. Returns
// {next, warnings} on success or {error} — up to 5 files, 15MB each, and the
// combined base64 payload must stay under ~20MB (the backend's 25MB JSON limit).
async function processFlyerFiles(files,existingPdfs){
  const okTypes=['application/pdf','image/jpeg','image/png'];
  if(existingPdfs.length+files.length>5) return {error:'Up to 5 flyers per email — you have '+existingPdfs.length+' attached and picked '+files.length+' more.'};
  for(const f of files){
    if(!okTypes.includes(f.type)) return {error:'"'+f.name+'" is not a PDF or JPEG/PNG image.'};
    if(f.size>15*1024*1024) return {error:'"'+f.name+'" is too large (max 15MB per file).'};
  }
  const added=[];const warnings=[];
  for(const f of files){
    const images=f.type==='application/pdf'?await renderPdfToImages(f):[await renderImageToJpeg(f)];
    if(!images.length) return {error:'Could not read "'+f.name+'".'};
    if(images.truncated) warnings.push('"'+f.name+'" has '+images.totalPages+' pages; only the first '+images.length+' were attached.');
    added.push({name:f.name,images});
  }
  const next=[...existingPdfs,...added];
  const bytes=next.reduce((s,p)=>s+p.images.reduce((a,b)=>a+b.length,0),0);
  if(bytes>20*1024*1024) return {error:'Those flyers total ~'+Math.round(bytes/1048576)+'MB, which is too large to email reliably. Remove one, or use fewer/lower-resolution pages.'};
  return {next,warnings};
}
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
// Endpoints whose payloads can be very large (slides return base64 image data
// URLs that easily exceed the localStorage 5–10MB quota) are not persisted.
const SWR_NO_PERSIST = new Set(['/api/slides', '/api/site-images']);
function apiFetchSWR(path, { onCached, onFresh, onError } = {}) {
  const key = 'swr:' + path;
  const persist = !SWR_NO_PERSIST.has(path);
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (raw && onCached) {
      const parsed = JSON.parse(raw);
      onCached(parsed);
    }
  } catch {}
  apiFetch(path).then(data => {
    if (persist) { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} }
    if (onFresh) onFresh(data);
  }).catch(err => { if (onError) onError(err); });
}
function fmtZ(iso) {
  if(!iso) return '--';
  // The zmanim/today endpoint returns ISO strings; the schedule/today endpoint
  // returns already-formatted strings ("5:43 PM"). Tolerate both.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
}
// Compact "5:43" form for the fullscreen TV board (no AM/PM).
function fmtShort(t) {
  if (!t) return '';
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York',hour12:true})
      .replace(/\s?[AP]M$/i,'').trim();
  }
  return String(t).replace(/\s?[AP]M$/i,'').trim();
}
// Hebrew names for the weekly parsha. Hebcal returns transliterated English
// like "Parashat Emor"; we strip the prefix and look up the Hebrew form.
const HEBREW_PARSHA = {
  'bereshit':'בראשית','noach':'נח','lech-lecha':'לך לך','vayera':'וירא',
  'chayei sara':'חיי שרה','toldot':'תולדות','vayetzei':'ויצא','vayishlach':'וישלח',
  'vayeshev':'וישב','miketz':'מקץ','vayigash':'ויגש','vayechi':'ויחי',
  'shemot':'שמות','vaera':'וארא','bo':'בא','beshalach':'בשלח','yitro':'יתרו',
  'mishpatim':'משפטים','terumah':'תרומה','tetzaveh':'תצוה','ki tisa':'כי תשא',
  'vayakhel':'ויקהל','pekudei':'פקודי','vayakhel-pekudei':'ויקהל-פקודי',
  'vayikra':'ויקרא','tzav':'צו','shmini':'שמיני','tazria':'תזריע','metzora':'מצרע',
  'tazria-metzora':'תזריע-מצרע','achrei mot':'אחרי מות','kedoshim':'קדשים',
  'achrei mot-kedoshim':'אחרי מות-קדשים','emor':'אמור','behar':'בהר',
  'bechukotai':'בחקתי','behar-bechukotai':'בהר-בחקתי','bamidbar':'במדבר',
  'nasso':'נשא','beha\'alotcha':'בהעלתך','sh\'lach':'שלח','shlach':'שלח',
  'korach':'קרח','chukat':'חקת','balak':'בלק','chukat-balak':'חקת-בלק',
  'pinchas':'פינחס','matot':'מטות','masei':'מסעי','matot-masei':'מטות-מסעי',
  'devarim':'דברים','vaetchanan':'ואתחנן','eikev':'עקב','re\'eh':'ראה',
  'shoftim':'שפטים','ki teitzei':'כי תצא','ki tavo':'כי תבוא',
  'nitzavim':'נצבים','vayeilech':'וילך','nitzavim-vayeilech':'נצבים-וילך',
  'ha\'azinu':'האזינו','vezot haberakhah':'וזאת הברכה'
};
function hebrewParsha(en) {
  if (!en) return '';
  const stripped = en.replace(/^Parashat\s+/i,'').trim().toLowerCase();
  return HEBREW_PARSHA[stripped] || en;
}

// ─── Liturgical bottom-strip helpers ──────────────────────────────
// All computed locally; no extra Hebcal calls. Hebrew month names come from
// /api/zmanim/today's hebrewDate.hm field (e.g. "Iyyar", "Nisan").

// Hebrew cardinal numbers (masculine) for 1-49, used for Omer counts.
const HEBREW_NUM_ONES = ['','אחד','שני','שלשה','ארבעה','חמשה','ששה','שבעה','שמנה','תשעה'];
const HEBREW_NUM_TEENS = ['עשרה','אחד עשר','שנים עשר','שלשה עשר','ארבעה עשר','חמשה עשר','ששה עשר','שבעה עשר','שמנה עשר','תשעה עשר'];
const HEBREW_NUM_TENS = ['','','עשרים','שלשים','ארבעים'];
function hebrewNumber(n) {
  if (n < 1) return '';
  if (n < 10) return HEBREW_NUM_ONES[n];
  if (n < 20) return HEBREW_NUM_TEENS[n - 10];
  const tens = Math.floor(n / 10), ones = n % 10;
  if (ones === 0) return HEBREW_NUM_TENS[tens];
  return HEBREW_NUM_ONES[ones] + ' ו' + HEBREW_NUM_TENS[tens];
}

// Compute the Omer day (1-49) from a Hebrew month/day. Returns 0 if not in Omer.
function omerDay(hm, hd) {
  const m = (hm || '').toLowerCase();
  const d = parseInt(hd, 10);
  if (!d) return 0;
  if ((m === 'nisan' || m === 'nissan') && d >= 16) return d - 15;
  if (m === 'iyar' || m === 'iyyar') return 15 + d;
  if (m === 'sivan' && d >= 1 && d <= 5) return 44 + d;
  return 0;
}

// Standard Hebrew formulation of "Today is X days [which is Y weeks and Z days]
// in the Omer". Used at the bottom of the fullscreen board.
function omerText(day) {
  if (day < 1 || day > 49) return '';
  const dayWord = day === 1 ? 'יום אחד' : (hebrewNumber(day) + ' ימים');
  if (day < 7) return 'היום ' + dayWord + ' בעומר';
  const weeks = Math.floor(day / 7);
  const remain = day % 7;
  const weekWord = weeks === 1 ? 'שבוע אחד' : (hebrewNumber(weeks) + ' שבועות');
  if (remain === 0) return 'היום ' + dayWord + ' שהם ' + weekWord + ' בעומר';
  const remainWord = remain === 1 ? 'יום אחד' : (hebrewNumber(remain) + ' ימים');
  return 'היום ' + dayWord + ' שהם ' + weekWord + ' ו' + remainWord + ' בעומר';
}

// Diaspora rule: "Vetein Tal U'Matar Livracha" begins at Maariv on Dec 4 (or
// Dec 5 in years preceding a Gregorian leap year), running through Mincha of
// Erev Pesach. Outside that window: "Vetein Bracha".
function veteinPhrase(now, hm, hd) {
  const m = (hm || '').toLowerCase();
  const d = parseInt(hd, 10) || 0;
  // From 15 Nisan through end of Tishrei: always Vetein Bracha.
  if ((m === 'nisan' || m === 'nissan') && d >= 15) return 'ותן ברכה';
  if (['iyar','iyyar','sivan','tamuz','tammuz','av','elul','tishrei','tishri'].includes(m)) return 'ותן ברכה';
  // Otherwise we're in Cheshvan / Kislev / Tevet / Shevat / Adar / early Nisan.
  // Find the most recent Dec 4/5 cutoff and compare.
  const yr = now.getFullYear();
  const cutoffDay = year => {
    const nextLeap = ((year + 1) % 4 === 0 && (year + 1) % 100 !== 0) || (year + 1) % 400 === 0;
    return new Date(year, 11, nextLeap ? 5 : 4, 18, 0);
  };
  const thisYear = cutoffDay(yr);
  const recentCutoff = (now >= thisYear) ? thisYear : cutoffDay(yr - 1);
  return now >= recentCutoff ? 'ותן טל ומטר לברכה' : 'ותן ברכה';
}

// Pirkei Avos: read on Shabbos afternoons during the Omer period in most
// Diaspora communities. Show the indicator from 16 Nisan through 5 Sivan.
function isPirkeiAvosSeason(hm, hd) {
  return omerDay(hm, hd) > 0;
}

// Seamless infinite vertical scroll. If the children's height exceeds the
// container, the content scrolls in a continuous loop with no visible snap:
// we render two identical copies stacked, animate transform from 0 to -50%
// (== exactly one copy's height), and the CSS loop boundary lands on a
// pixel-identical position. If content fits, no animation runs.
function ScrollPanel({children}) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const [scrolling, setScrolling] = useState(false);
  const [duration, setDuration] = useState(30);
  useEffect(() => {
    function measure() {
      const wrap = wrapRef.current, inner = innerRef.current;
      if (!wrap || !inner) return;
      const first = inner.firstElementChild;
      if (!first) return;
      const innerH = first.offsetHeight;
      const wrapH = wrap.clientHeight;
      const need = innerH > wrapH + 4;
      setScrolling(need);
      // ~25 px/sec feels like a comfortable shul-board pace.
      if (need) setDuration(Math.max(15, Math.round(innerH / 25)));
    }
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); cancelAnimationFrame(raf); };
  }, [children]);
  return React.createElement('div', {
    ref: wrapRef,
    style: { flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }
  },
    React.createElement('div', {
      ref: innerRef,
      style: scrolling ? { animation: 'vScroll ' + duration + 's linear infinite' } : null
    },
      React.createElement('div', null, children),
      scrolling && React.createElement('div', {'aria-hidden': 'true'}, children)
    )
  );
}

// ─── Zmanim Panel (MyZmanim + Davening + Shiurim + Fullscreen) ──
function ZmanimPanel({onExpand}) {
  const iframeRef = useRef(null);
  const [schedule,setSchedule]=useState(null);
  const [shiurim,setShiurim]=useState([]);
  const [fullZmanim,setFullZmanim]=useState(null);
  const [shabbosData,setShabbosData]=useState(null);
  const [fullscreen,setFullscreen]=useState(false);
  const [now,setNow]=useState(()=>new Date());
  // Admin-uploaded images (Site Images tab). The fullscreen TV board prefers
  // the dedicated 'fullscreenLogo' slot, then falls back to the top-bar logo,
  // then the bundled logo.png.
  const siteImages=useSiteImages();

  function loadData(){
    apiFetch('/api/schedule/today').then(setSchedule).catch(()=>{});
    apiFetch('/api/shiurim').then(setShiurim).catch(()=>{});
    apiFetch('/api/zmanim/today').then(setFullZmanim).catch(()=>{});
    apiFetch('/api/schedule/shabbos').then(setShabbosData).catch(()=>{});
  }

  // Live clock for the fullscreen TV board. Only ticks while fullscreen is
  // open so we don't waste cycles rendering the small panel every second.
  useEffect(()=>{
    if(!fullscreen) return;
    setNow(new Date());
    const t=setInterval(()=>setNow(new Date()),1000);
    return ()=>clearInterval(t);
  },[fullscreen]);

  useEffect(()=>{
    loadData();
    // Auto-refresh at midnight. Keep the latest timer id in a holder so cleanup
    // clears the CURRENTLY-pending chained timer (not just the first one) —
    // otherwise each night's re-scheduled timer survived unmount and fired
    // state updates on a dead component.
    let timer=null;
    function scheduleRefresh(){
      const now=new Date();
      const midnight=new Date(now);
      midnight.setHours(24,0,5,0); // 12:00:05 AM next day
      const ms=midnight.getTime()-now.getTime();
      timer=setTimeout(()=>{loadData();if(iframeRef.current){
        const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:4px;font-family:"Open Sans",sans-serif;font-size:11px;}</style></head><body>'+
        '<script type="text/javascript" charset="UTF-8" src="https://www.myzmanim.com/widget.aspx?lang=en&mode=Standard&fsize=11&fcolor=1a2744&hcolor=faf8f3&bcolor=c49a3c&suf=s&key=36FtEjK2LSnQnGiOz2VBKgH53KnAY%2b3hrcR4Y6wUot92o8WG3B8YSbsll6LaSAYMQ1S2dIN6oyp87TiKzUQ%2f6a2g3uqknnDxxVJIYw2%2fTUbrQiUitklmn6Ld4hla%2bHNC"><\/script></body></html>';
        iframeRef.current.srcdoc=html;}scheduleRefresh();},ms);
    }
    scheduleRefresh();
    return ()=>clearTimeout(timer);
  },[]);

  useEffect(()=>{
    if(!iframeRef.current) return;
    const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:4px;font-family:"Open Sans",sans-serif;font-size:11px;}</style></head><body>'+
      '<script type="text/javascript" charset="UTF-8" src="https://www.myzmanim.com/widget.aspx?lang=en&mode=Standard&fsize=11&fcolor=1a2744&hcolor=faf8f3&bcolor=c49a3c&suf=s&key=36FtEjK2LSnQnGiOz2VBKgH53KnAY%2b3hrcR4Y6wUot92o8WG3B8YSbsll6LaSAYMQ1S2dIN6oyp87TiKzUQ%2f6a2g3uqknnDxxVJIYw2%2fTUbrQiUitklmn6Ld4hla%2bHNC"><\/script></body></html>';
    iframeRef.current.srcdoc=html;
  },[]);

  // Today's shiurim (filter by day of week)
  const todayDow=getTodayDow();
  const todayShiurim=shiurim.filter(s=>s.dayOfWeek===todayDow);

  function openFullscreen(){setFullscreen(true);}
  function closeFullscreen(){setFullscreen(false);}

  // Only show candle lighting on Friday or Yom Tov
  const isFriday=getTodayDow()===5;
  const showCandles=isFriday||(schedule?.dayType==='yomTov');

  // Fullscreen TV board: traditional Hebrew shul layout, two columns + center
  // tree, live clock, no scrolling. Designed to fit on one screen.
  if(fullscreen){
    const z=fullZmanim?.zmanim||schedule?.zmanim||{};
    const sb=shabbosData||{};
    const hebDate=fullZmanim?.hebrewDate?.hebrew||'';
    const hebMonth=fullZmanim?.hebrewDate?.hm||'';
    const hebDay=fullZmanim?.hebrewDate?.hd||0;
    const englishDate=now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const clockStr=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',timeZone:'America/New_York',hour12:true}).toLowerCase();
    const todayShacharis=schedule?.davening?.shacharis;
    const todayMincha=schedule?.davening?.mincha||schedule?.davening?.minchaMaariv;
    const shabbosShiur=shiurim.find(s=>s.dayOfWeek===6);
    const parshaHe=hebrewParsha(sb.parsha);

    // Bottom announcement strip — Sefiras HaOmer / Vetein / Pirkei Avos.
    const omer=omerDay(hebMonth,hebDay);
    const bottomItems=[];
    if(omer>0) bottomItems.push(omerText(omer));
    bottomItems.push(veteinPhrase(now,hebMonth,hebDay));
    if(isPirkeiAvosSeason(hebMonth,hebDay)) bottomItems.push('פרקי אבות');

    // Right column = weekday zmanim. Hebrew labels read RTL within the column.
    const weekdayRows=[
      ['הנחת תפילין', fmtShort(z.misheyakir||z.alotHaShachar)],
      ['נץ החמה',     fmtShort(z.sunrise)],
      ['שחרית',       fmtShort(todayShacharis)],
      ['סוף זמן ק"ש מג"א', fmtShort(z.sofZmanShmaMGA)],
      ['סוף זמן ק"ש גר"א', fmtShort(z.sofZmanShma)],
      ['פלג המנחה',   fmtShort(z.plagHaMincha||z.plagHamincha)],
      ['מנחה',         fmtShort(todayMincha)],
      ['שקיעת החמה',  fmtShort(z.sunset)]
    ].filter(([_,t])=>t);

    // Left column = upcoming Shabbos / Yom Tov.
    const shabbosRows=[
      sb.candleLighting && ['הדלקת נרות', fmtShort(sb.candleLighting), false],
      sb.fridayMincha   && ['מנחה ערש"ק',  fmtShort(sb.fridayMincha),   false],
      sb.shacharis      && ['שחרית בשבת',  fmtShort(sb.shacharis),      false],
      shabbosShiur && shabbosShiur.time && ['שיעור', fmtShort(shabbosShiur.time), true],
      sb.mincha         && ['מנחה בשבת',   fmtShort(sb.mincha),         false],
      sb.shabbosEnds    && ['הבדלה',        fmtShort(sb.shabbosEnds),    false]
    ].filter(Boolean);

    const rowStyle={display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'10px 4px',borderBottom:'1px dashed rgba(245,232,200,0.12)',fontSize:'1.7rem'};
    const labelStyle=accent=>({color:accent?'#f0a93a':'rgba(245,232,200,0.9)',fontWeight:500});
    const timeStyle=accent=>({color:accent?'#f0a93a':'#f5e8c8',fontWeight:700,fontFamily:'var(--font-display)',direction:'ltr',minWidth:90,textAlign:'left'});
    const colHeader={textAlign:'center',fontSize:'1.7rem',color:'#e8c66a',borderBottom:'2px solid rgba(196,154,60,0.4)',paddingBottom:8,marginBottom:14,fontWeight:700,letterSpacing:1};

    return React.createElement('div',{style:{
      position:'fixed',inset:0,zIndex:9999,
      background:'radial-gradient(circle at 50% 30%, #1c160e 0%, #0a0807 80%)',
      color:'#f5e8c8',
      fontFamily:'var(--font-display), Georgia, serif',
      display:'flex',flexDirection:'column',
      height:'100vh',width:'100vw',overflow:'hidden',
      padding:'20px 32px',
      boxSizing:'border-box'
    }},
      React.createElement('style',null,'@keyframes vScroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}'),
      React.createElement('button',{onClick:closeFullscreen,style:{
        position:'absolute',top:14,right:14,zIndex:10,
        background:'rgba(245,232,200,0.08)',color:'#f5e8c8',
        border:'1px solid rgba(245,232,200,0.2)',borderRadius:'50%',
        width:40,height:40,fontSize:'1.1rem',cursor:'pointer'
      }},'✕'),

      // Top header: English title (left) | clock + dates (center) | Hebrew title (right)
      React.createElement('div',{style:{
        display:'grid',gridTemplateColumns:'1fr auto 1fr',
        alignItems:'center',gap:24,
        borderBottom:'1px solid rgba(196,154,60,0.4)',
        paddingBottom:12,marginBottom:18,flexShrink:0
      }},
        React.createElement('div',{style:{textAlign:'left'}},
          React.createElement('div',{style:{fontSize:'2.2rem',color:'#e8c66a',fontWeight:600,letterSpacing:1,lineHeight:1.1}},'Cong Ohr Chaim'),
          React.createElement('div',{style:{fontSize:'1rem',color:'rgba(245,232,200,0.55)',marginTop:6,letterSpacing:0.5}},englishDate)
        ),
        React.createElement('div',{style:{textAlign:'center',minWidth:280}},
          React.createElement('div',{style:{fontSize:'2.6rem',color:'#f5e8c8',fontWeight:600,letterSpacing:1}},clockStr)
        ),
        React.createElement('div',{style:{textAlign:'right',direction:'rtl'}},
          React.createElement('div',{style:{fontSize:'2.2rem',color:'#e8c66a',fontWeight:600,letterSpacing:1,lineHeight:1.1}},'קהל אור חיים'),
          hebDate && React.createElement('div',{style:{fontSize:'1rem',color:'rgba(245,232,200,0.55)',marginTop:6}},hebDate)
        )
      ),

      // Three-zone main: Shabbos (left) | Tree (center) | Weekday (right)
      React.createElement('div',{style:{
        display:'grid',gridTemplateColumns:'1fr 320px 1fr',
        gap:32,flex:1,minHeight:0,alignItems:'stretch'
      }},
        // LEFT: Shabbos / Yom Tov column
        React.createElement('div',{style:{direction:'rtl',padding:'0 16px',display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden'}},
          React.createElement('div',{style:colHeader},'זמנים לשבת ויו"ט'),
          parshaHe && React.createElement('div',{style:{textAlign:'center',fontSize:'2.6rem',fontWeight:700,color:'#e8c66a',margin:'2px 0 14px',letterSpacing:2,flexShrink:0}},parshaHe),
          shabbosRows.length>0
            ? React.createElement(ScrollPanel,{key:'sb-'+shabbosRows.length},
                shabbosRows.map(([label,time,accent])=>
                  React.createElement('div',{key:label,style:rowStyle},
                    React.createElement('span',{style:timeStyle(accent)},time||'—'),
                    React.createElement('span',{style:labelStyle(accent)},label))))
            : React.createElement('div',{style:{textAlign:'center',color:'rgba(245,232,200,0.4)',marginTop:24}},'Loading…')
        ),

        // CENTER: tree logo + donor credit
        React.createElement('div',{style:{
          textAlign:'center',display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'space-between',padding:'8px 0'
        }},
          (() => {
            const adminImg = siteImages.fullscreenLogo || siteImages.topLogo || siteImages.heroImage;
            const src = adminImg || 'logo.png';
            // Admin-uploaded images are already chosen to look right; only
            // apply heavy brightening when we're falling back to the bundled
            // dark logo.png on the dark board.
            const filter = adminImg
              ? 'drop-shadow(0 0 40px rgba(232,198,106,0.35))'
              : 'brightness(1.8) saturate(1.25) drop-shadow(0 0 40px rgba(232,198,106,0.4))';
            return React.createElement('div',{style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}},
              React.createElement('img',{
                src, alt:'',
                style:{maxWidth:'100%',maxHeight:'42vh',opacity:1,filter}
              })
            );
          })(),
          // Donor plaque (matches the inset panel in the reference photo).
          React.createElement('div',{style:{
            background:'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.4) 100%)',
            border:'1px solid rgba(196,154,60,0.35)',
            borderRadius:6,
            padding:'14px 20px',
            boxShadow:'inset 0 1px 0 rgba(245,232,200,0.1), 0 4px 12px rgba(0,0,0,0.4)',
            width:'90%',
            flexShrink:0,
            color:'#f5e8c8',
            fontFamily:'Georgia, "Playfair Display", serif',
            fontSize:'1.05rem',
            fontWeight:600,
            lineHeight:1.45,
            letterSpacing:0.3
          }},
            React.createElement('div',null,'Donated by'),
            React.createElement('div',null,'Dr. Victor and Irene Sabo'),
            React.createElement('div',null,'and family')
          )
        ),

        // RIGHT: Weekday column
        React.createElement('div',{style:{direction:'rtl',padding:'0 16px',display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden'}},
          React.createElement('div',{style:colHeader},'זמנים לחול'),
          weekdayRows.length>0
            ? React.createElement(ScrollPanel,{key:'wd-'+weekdayRows.length},
                weekdayRows.map(([label,time])=>
                  React.createElement('div',{key:label,style:rowStyle},
                    React.createElement('span',{style:timeStyle(false)},time),
                    React.createElement('span',{style:labelStyle(false)},label))))
            : React.createElement('div',{style:{textAlign:'center',color:'rgba(245,232,200,0.4)',marginTop:24}},'Loading…')
        )
      ),

      // Bottom announcement strip: Omer count, Vetein phrase, Pirkei Avos.
      React.createElement('div',{style:{
        flexShrink:0,marginTop:12,paddingTop:12,
        borderTop:'1px solid rgba(196,154,60,0.4)',
        direction:'rtl',
        display:'flex',justifyContent:'center',alignItems:'center',
        flexWrap:'wrap',gap:'0 24px',
        fontSize:'1.5rem',color:'#e8c66a',fontWeight:600,letterSpacing:1
      }},
        bottomItems.map((t,i)=>[
          i>0 && React.createElement('span',{key:'sep'+i,style:{color:'rgba(196,154,60,0.5)'}},'•'),
          React.createElement('span',{key:'item'+i},t)
        ])
      )
    );
  }

  // Normal sidebar panel
  return React.createElement('div',{className:'zmanim-panel'},
    React.createElement('div',{className:'zmanim-panel-title'},
      React.createElement('img',{src:'logo.png',alt:'',className:'panel-tree-icon'}),
      "Today's Zmanim & Schedule"),
    React.createElement('iframe',{ref:iframeRef,sandbox:'allow-scripts',style:{width:'100%',height:320,border:'none',borderRadius:4},title:'MyZmanim'}),
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
  const isFri=getTodayDow()===5;
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

  const isFriday=getTodayDow()===5;
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
            schedule.holidaySchedule?holidayScheduleRows(schedule.holidaySchedule):[
            schedule.davening?.shacharis&&React.createElement('div',{className:'time-row',key:'sh'},React.createElement('span',{className:'time-label'},'Shacharis'),React.createElement('span',{className:'time-value'},schedule.davening.shacharis)),
            schedule.davening?.earlyMincha&&React.createElement('div',{className:'time-row',key:'em'},React.createElement('span',{className:'time-label'},'Early Mincha'),React.createElement('span',{className:'time-value'},schedule.davening.earlyMincha)),
            schedule.davening?.mincha&&React.createElement('div',{className:'time-row',key:'mi'},React.createElement('span',{className:'time-label'},'Mincha'),React.createElement('span',{className:'time-value'},schedule.davening.mincha)),
            schedule.davening?.minchaMaariv&&React.createElement('div',{className:'time-row',key:'mm'},React.createElement('span',{className:'time-label'},'Mincha / Maariv'),React.createElement('span',{className:'time-value'},schedule.davening.minchaMaariv)),
            schedule.davening?.maariv&&React.createElement('div',{className:'time-row',key:'ma'},React.createElement('span',{className:'time-label'},'Maariv'),React.createElement('span',{className:'time-value'},schedule.davening.maariv)),
            isFriday&&schedule.zmanim?.earlyCandleLighting&&React.createElement('div',{className:'time-row',key:'ecl'},React.createElement('span',{className:'time-label'},'Early Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},schedule.zmanim.earlyCandleLighting)),
            showCandles&&schedule.zmanim?.candleLighting&&React.createElement('div',{className:'time-row',key:'cl'},React.createElement('span',{className:'time-label'},'Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},schedule.zmanim.candleLighting))]
          ):React.createElement('p',{style:{color:'#888'}},'Unable to load.')),
        React.createElement(HeroSlideshow)),
      // Column 2: This Shabbos - full schedule
      React.createElement('div',null,
        React.createElement('div',{className:'card'},
          React.createElement('div',{className:'card-header'},'This Shabbos',sb?.parsha&&React.createElement('span',{className:'badge'},sb.parsha)),
          sb?React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'0.95rem',fontWeight:700,color:'#c49a3c',marginBottom:2,letterSpacing:0.5}},'FRIDAY NIGHT'),
            sb.earlyCandleLighting&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Early Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},sb.earlyCandleLighting)),
            sb.candleLighting&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},sb.candleLighting)),
            sb.fridayMincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha / Kabbalas Shabbos'),React.createElement('span',{className:'time-value'},sb.fridayMincha)),
            React.createElement('div',{style:{fontSize:'0.95rem',fontWeight:700,color:'#c49a3c',marginTop:6,marginBottom:2,letterSpacing:0.5}},'SHABBOS DAY'),
            sb.shacharis&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Shacharis'),React.createElement('span',{className:'time-value'},sb.shacharis)),
            sb.sofZmanShma&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Latest Shema'),React.createElement('span',{className:'time-value'},sb.sofZmanShma)),
            sb.mincha&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Mincha'),React.createElement('span',{className:'time-value'},sb.mincha)),
            sb.sunset&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Sunset'),React.createElement('span',{className:'time-value'},sb.sunset)),
            sb.shabbosEnds&&React.createElement('div',{className:'time-row'},React.createElement('span',{className:'time-label'},'Havdalah'),React.createElement('span',{className:'time-value'},sb.shabbosEnds)),
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

    // Full-width prominent Shiurim card — shows every weekly shiur grouped
    // by day, with today's classes highlighted. Only renders if there's at
    // least one shiur configured.
    shiurim.length>0&&(()=>{
      const DAY_LABEL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Shabbos'];
      const todayDow=getTodayDow();
      const byDay={};
      shiurim.forEach(s=>{
        const d=Number.isFinite(s.dayOfWeek)?s.dayOfWeek:7;
        if(!byDay[d]) byDay[d]=[];
        byDay[d].push(s);
      });
      const dowOrder=Object.keys(byDay).map(Number).sort((a,b)=>{
        // Today first, then forward through the week, wrapping around.
        const aa=(a-todayDow+7)%7, bb=(b-todayDow+7)%7;
        return aa-bb;
      });
      return React.createElement('div',{className:'card',style:{marginTop:10,padding:'16px 20px',border:'1px solid rgba(196,154,60,0.35)'}},
        React.createElement('div',{className:'card-header',style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('span',null,'📖 Weekly Shiurim'),
          React.createElement('span',{className:'badge',style:{cursor:'pointer'},onClick:()=>navigate('shiurim')},'See all')),
        React.createElement('div',{style:{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))',
          gap:10,marginTop:8
        }},
          dowOrder.map(dow=>{
            const isToday=dow===todayDow;
            return React.createElement('div',{key:dow,style:{
              background:isToday?'rgba(196,154,60,0.1)':'var(--cream)',
              border:isToday?'2px solid var(--gold)':'1px solid var(--border)',
              borderRadius:'var(--radius)',
              padding:'12px 14px',
              display:'flex',flexDirection:'column',gap:6
            }},
              React.createElement('div',{style:{
                display:'flex',justifyContent:'space-between',alignItems:'center',
                marginBottom:4,paddingBottom:6,borderBottom:'1px solid rgba(0,0,0,0.06)'
              }},
                React.createElement('span',{style:{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem'}},DAY_LABEL[dow]||'Other'),
                isToday&&React.createElement('span',{style:{
                  background:'var(--gold)',color:'var(--navy)',fontSize:'0.7rem',
                  fontWeight:800,padding:'2px 8px',borderRadius:10,letterSpacing:0.5
                }},'TODAY')),
              byDay[dow].map(s=>React.createElement('div',{key:s.id},
                React.createElement('div',{style:{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem'}},s.title),
                React.createElement('div',{style:{fontSize:'0.82rem',color:'var(--text-medium)',marginTop:2}},
                  [s.time,s.rabbi,s.location].filter(Boolean).join(' • ')),
                s.topic&&React.createElement('div',{style:{fontSize:'0.78rem',color:'var(--text-light)',fontStyle:'italic',marginTop:2}},s.topic))));
          })));
    })(),

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
    let cancelled=false;
    setLoading(true);
    apiFetch('/api/schedule/week?start='+startDate).then(d=>{if(cancelled)return;setWeek(d.week);setLoading(false);}).catch(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
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
              // A Jewish-holiday schedule (Tisha B'Av, etc.) replaces the normal
              // davening rows for that day.
              day.holidaySchedule?holidayScheduleRows(day.holidaySchedule):[
              React.createElement('div',{className:'time-row',key:'sh'},React.createElement('span',{className:'time-label'},'Shacharis'),React.createElement('span',{className:'time-value'},day.davening?.shacharis||'--')),
              day.davening?.earlyMincha&&React.createElement('div',{className:'time-row',key:'em'},React.createElement('span',{className:'time-label'},'Early Mincha'),React.createElement('span',{className:'time-value'},day.davening.earlyMincha)),
              day.davening?.mincha&&React.createElement('div',{className:'time-row',key:'mi'},React.createElement('span',{className:'time-label'},'Mincha'),React.createElement('span',{className:'time-value'},day.davening.mincha)),
              day.davening?.minchaMaariv&&React.createElement('div',{className:'time-row',key:'mm'},React.createElement('span',{className:'time-label'},'Mincha / Maariv'),React.createElement('span',{className:'time-value'},day.davening.minchaMaariv)),
              day.davening?.maariv&&React.createElement('div',{className:'time-row',key:'ma'},React.createElement('span',{className:'time-label'},'Maariv'),React.createElement('span',{className:'time-value'},day.davening.maariv)),
              new Date(day.date+'T12:00:00').getDay()===5&&day.zmanim?.earlyCandleLighting&&React.createElement('div',{className:'time-row',key:'ecl'},React.createElement('span',{className:'time-label'},'Early Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},day.zmanim.earlyCandleLighting)),
              (new Date(day.date+'T12:00:00').getDay()===5||day.dayType==='yomTov')&&day.zmanim?.candleLighting&&React.createElement('div',{className:'time-row',key:'cl'},React.createElement('span',{className:'time-label'},'Candle Lighting'),React.createElement('span',{className:'time-value candle-lighting'},day.zmanim.candleLighting)),
              new Date(day.date+'T12:00:00').getDay()===6&&day.zmanim?.tzeis&&React.createElement('div',{className:'time-row',key:'hv'},React.createElement('span',{className:'time-label'},'Havdalah'),React.createElement('span',{className:'time-value'},day.zmanim.tzeis))],
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
  useEffect(()=>{let cancelled=false;setLoading(true);apiFetch('/api/calendar/'+year+'/'+month).then(d=>{if(cancelled)return;setData(d);setLoading(false);}).catch(()=>{if(!cancelled)setLoading(false);});return ()=>{cancelled=true;};},[year,month]);
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
  useEffect(()=>{let cancelled=false;setLoading(true);apiFetch('/api/zmanim/'+dateStr).then(d=>{if(cancelled)return;setData(d);setLoading(false);}).catch(()=>{if(!cancelled)setLoading(false);});return ()=>{cancelled=true;};},[dateStr]);
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
function AdminLogin({onLogin,notAdmin}) {
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  async function handle(e){e.preventDefault();setError('');setLoading(true);
    try{await firebase.auth().signInWithEmailAndPassword(email,password);onLogin();}catch(err){setError(err.message);}setLoading(false);}
  return React.createElement('div',{className:'auth-container'},
    React.createElement('div',{className:'auth-title'},'Admin Login'),
    React.createElement('div',{className:'auth-subtitle'},'Congregation Ohr Chaim'),
    // Distinguish "wrong password" (error) from "signed in, but this account has
    // no admin access" — otherwise a valid non-admin sign-in just silently
    // redisplays a blank form and looks broken.
    notAdmin&&React.createElement('div',{className:'message message-error'},
      'You are signed in, but this account does not have administrator access. Contact the office if you believe this is an error.',
      React.createElement('div',{style:{marginTop:8}},
        React.createElement('button',{type:'button',className:'btn btn-sm btn-outline',onClick:()=>firebase.auth().signOut()},'Sign out'))),
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
    // cache:no-store — admin needs to see the image they just uploaded, not a
    // 5-minute-old cached response from the public /api/site-images endpoint.
    fetch(BACKEND_URL+'/api/site-images',{cache:'no-store'})
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
      // cache:no-store — same reason as the other admin loaders: the public
      // /api/slides has a 60-second cache that would hide a just-added slide.
      const r=await fetch(BACKEND_URL+'/api/slides',{cache:'no-store'});
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
      React.createElement('p',null,'This site is operated by Congregation Ohr Chaim, 317 W 47th Street, Miami Beach, FL 33140, a tax-exempt religious organization under section 501(c)(3) of the Internal Revenue Code (EIN 59-2202972). Questions about this policy: office@ohrchaim.org.'),
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
      React.createElement('p',null,'By using this website you agree to these terms. The site is operated by Congregation Ohr Chaim, a tax-exempt religious organization under section 501(c)(3) of the Internal Revenue Code (EIN 59-2202972), located at 317 W 47th Street, Miami Beach, FL 33140.'),
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
  async function checkAccess(u){
    setChecking(true);
    if(u){try{const t=await u.getIdToken(true);const r=await fetch(BACKEND_URL+'/api/admin/davening-rules',{headers:{'Authorization':'Bearer '+t}});setIsAdmin(r.ok);}catch{setIsAdmin(false);}}
    else setIsAdmin(false);
    setChecking(false);
  }
  useEffect(()=>{const unsub=firebase.auth().onAuthStateChanged(u=>{setUser(u);checkAccess(u);});return unsub;},[]);
  if(checking) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Checking access...');
  // Signed in but NOT an admin: say so explicitly instead of silently redisplaying
  // a blank login form (which looks like the password was wrong).
  if(!user||!isAdmin) return React.createElement(AdminLogin,{notAdmin:!!user&&!isAdmin,onLogin:()=>checkAccess(firebase.auth().currentUser)});
  function openWelcomeDisplay(){
    // Open in a new tab so the admin can keep working while the kiosk runs.
    // In the native app there are no tabs, so navigate in place instead.
    if(IS_NATIVE){ window.location.hash = '#welcome'; return; }
    const url = window.location.pathname + '#welcome';
    window.open(url, '_blank');
  }
  return React.createElement('div',null,
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:8}},
      React.createElement('p',{style:{color:'#888',fontSize:'0.9rem'}},'Logged in as: '+user.email),
      React.createElement('div',{style:{display:'flex',gap:8}},
        React.createElement('button',{className:'btn btn-sm btn-primary',onClick:openWelcomeDisplay,title:'Open the entrance display in a new tab'},'📺 Open Welcome Display'),
        React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>firebase.auth().signOut()},'Sign Out'))),
    React.createElement('div',{className:'admin-tabs'},
      ['rules','overrides','holidays','shiurim','emails','autoemails','donations','members','tags','pledges','reasons','settings','highholidays','welcomesponsors','analytics','images','admins'].map(t=>React.createElement('button',{key:t,className:'admin-tab'+(tab===t?' active':''),onClick:()=>setTab(t)},
        t==='rules'?'Davening Rules':t==='overrides'?'Overrides':t==='holidays'?'Jewish Holidays':t==='shiurim'?'Shiurim':t==='emails'?'Email Center':t==='autoemails'?'Auto Emails':t==='donations'?'Donations':t==='members'?'Members':t==='tags'?'Member Tags':t==='pledges'?'Pledges/Billing':t==='reasons'?'Reasons':t==='settings'?'Settings':t==='highholidays'?'High Holiday Seating':t==='welcomesponsors'?'Welcome Display':t==='analytics'?'Analytics':t==='images'?'Site Images':'Admins'))),
    tab==='rules'&&React.createElement(AdminRulesEditor),
    tab==='overrides'&&React.createElement(AdminOverrides),
    tab==='holidays'&&React.createElement(AdminHolidays),
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
    tab==='welcomesponsors'&&React.createElement(AdminWelcomeSponsorships),
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

// Seat labels show only the LAST name of the assigned party, sized to fit the box.
function seatLastName(holder){const p=String(holder||'').trim().split(/\s+/);return p[p.length-1]||'';}
function seatNameFont(name){const n=(name||'').length;if(n<=6)return '0.72rem';if(n<=8)return '0.62rem';if(n<=10)return '0.54rem';if(n<=13)return '0.46rem';return '0.4rem';}
function escHtml(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function AdminSeating() {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [msg,setMsg]=useState('');
  const [selected,setSelected]=useState(null);
  const [form,setForm]=useState({holder:'',reservationId:''});
  const [seeding,setSeeding]=useState(false);
  const chartRef=useRef(null);
  // Perfectly fit each seat's name to its box by measuring: start at a comfortable
  // size and shrink until the text no longer overflows (width or height). Runs
  // after every render so it re-fits when assignments change.
  useLayoutEffect(()=>{
    const root=chartRef.current; if(!root) return;
    root.querySelectorAll('.seat-holder-box').forEach(el=>{
      const txt=(el.textContent||'').trim();
      if(!txt){ el.style.fontSize=''; return; }
      let fs=13; el.style.fontSize=fs+'px';
      // Font width scales ~linearly, so scale to the tightest of width/height in one step.
      const wRatio=el.clientWidth/(el.scrollWidth||1), hRatio=el.clientHeight/(el.scrollHeight||1);
      const r=Math.min(wRatio,hRatio,1);
      if(r<1){ fs=Math.max(4,fs*r-0.3); el.style.fontSize=fs+'px'; }
      // One correction pass in case rounding left a hair of overflow.
      if(el.scrollWidth>el.clientWidth+0.5||el.scrollHeight>el.clientHeight+0.5){ fs=Math.max(4,fs*Math.min(el.clientWidth/(el.scrollWidth||1),el.clientHeight/(el.scrollHeight||1))-0.3); el.style.fontSize=fs+'px'; }
    });
  });

  async function load(){
    setLoading(true);
    try{ setData(await apiFetch('/api/admin/seating/chart')); setMsg(''); }catch(e){ setMsg('Error: '+e.message); }
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
  // Open a print-ready view for a chosen section ('ladies' | 'mens' | 'both'),
  // each on its own A4 page. The browser's print dialog also offers "Save as PDF".
  function printSeating(which){
    const seats=data.layout.seats||[];
    const section=(title,secName)=>{
      const ss=seats.filter(s=>s.section===secName);
      if(!ss.length) return '';
      const minR=Math.min(...ss.map(s=>s.row)),maxR=Math.max(...ss.map(s=>s.row));
      const minC=Math.min(...ss.map(s=>s.col)),maxC=Math.max(...ss.map(s=>s.col));
      const nCols=maxC-minC+1;
      const cells=ss.map(s=>{const a=data.assignments[s.number];const last=a&&a.holder?seatLastName(a.holder):'';
        return '<div class="ps" style="grid-column:'+(s.col-minC+1)+';grid-row:'+(s.row-minR+1)+'"><div class="pn" style="background:'+(s.color||'#FFF176')+'">'+s.number+'</div><div class="ph">'+escHtml(last)+'</div></div>';}).join('');
      return '<div class="page"><h2>'+escHtml(title)+'</h2><p class="leg">Seat colors mark separate tables (each color change is a new table).</p><div class="pg" style="grid-template-columns:repeat('+nCols+',1fr)">'+cells+'</div></div>';
    };
    const html='<!doctype html><html><head><meta charset="utf-8"><title>High Holiday Seating</title><style>'+
      '@page{size:A4 landscape;margin:8mm}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#1a2744}'+
      '.page{page-break-after:always}.page:last-child{page-break-after:auto}'+
      'h2{text-align:center;margin:0 0 2mm;font-size:18px}'+
      '.leg{text-align:center;margin:0 0 4mm;font-size:10px;color:#555}'+
      '.pg{display:grid;gap:2px;width:100%}'+
      '.ps{border:1px solid #8a6f2b;border-radius:2px;overflow:hidden;display:flex;flex-direction:column;min-height:12mm}'+
      '.pn{color:#1a2744;font-weight:800;font-size:10px;text-align:center;padding:1px 0}'+
      '.ph{flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;text-align:center;padding:1px;word-break:break-word;line-height:1.05}'+
      '</style></head><body>'+
      ((which==='ladies'||which==='both')?section('Ladies Section — High Holiday Seating','ladies'):'')+
      ((which==='mens'||which==='both')?section("Men's Section — High Holiday Seating",'mens'):'')+
      '</body></html>';
    const w=window.open('','_blank');
    if(!w){setMsg('Please allow pop-ups to print/export the seating chart.');return;}
    w.document.write(html);w.document.close();w.focus();
    setTimeout(()=>{try{w.print();}catch(e){}},500);
  }

  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading seating chart...');
  // Load failed (not still loading) → show the error + retry instead of an
  // eternal spinner.
  if(!data) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:24}},
    React.createElement('p',{className:'message message-error'},msg||'Could not load the seating chart.'),
    React.createElement('button',{className:'btn btn-outline',onClick:load},'Retry'));

  const maxCol=Math.max(...data.layout.seats.map(s=>s.col))+1;
  const maxRow=Math.max(...data.layout.seats.map(s=>s.row))+1;
  const mehitzah=data.layout.mehitzahRow;
  // Section frames sized to actually contain their seats (num box at row+2,
  // holder box at row+3), so no seat spills outside its frame.
  function clusterStyle(pred){
    const ss=data.layout.seats.filter(pred);
    if(!ss.length) return null;
    const minR=Math.min(...ss.map(s=>s.row)),maxR=Math.max(...ss.map(s=>s.row));
    const minC=Math.min(...ss.map(s=>s.col)),maxC=Math.max(...ss.map(s=>s.col));
    return {frame:{gridColumn:(minC+1)+' / '+(maxC+2),gridRow:(minR+2)+' / '+(maxR+4)},
            label:{gridColumn:(minC+1)+' / '+(maxC+2),gridRow:(minR+1)+' / '+(minR+2)}};
  }
  const clLadies=clusterStyle(s=>s.section==='ladies'&&s.col<=15);
  const clSocial=clusterStyle(s=>s.section==='ladies'&&s.col>=16);
  const clPews=clusterStyle(s=>s.section==='mens'&&s.col<=3);
  const clMensCtr=clusterStyle(s=>s.section==='mens'&&s.col>=4&&s.col<=15);
  const clMensRight=clusterStyle(s=>s.section==='mens'&&s.col>=16);

  const assignedCount=Object.keys(data.assignments).length;
  const totalSeats=data.layout.seats.length;
  // How many seats each reservation already has assigned (so the picker can show
  // "reserved 3, assigned 1"). Seats are only assignable to people who reserved.
  const reservations=data.reservations||[];
  const assignedByRes={};
  Object.values(data.assignments||{}).forEach(a=>{if(a&&a.reservationId)assignedByRes[a.reservationId]=(assignedByRes[a.reservationId]||0)+1;});

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Seating Chart ('+assignedCount+'/'+totalSeats+' assigned)'),
        React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
          React.createElement('button',{className:'btn btn-sm btn-primary',onClick:()=>printSeating('ladies')},'Print Ladies'),
          React.createElement('button',{className:'btn btn-sm btn-primary',onClick:()=>printSeating('mens')},"Print Men's"),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>printSeating('both')},'Print Both'),
          React.createElement('button',{className:'btn btn-sm btn-outline',disabled:seeding,onClick:seedHolders},seeding?'Seeding...':'Seed Holders from Excel'),
          React.createElement('button',{className:'btn btn-sm btn-danger',onClick:clearAll},'Clear All'),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:load},'Refresh'))),
      React.createElement('p',{style:{color:'#555',margin:'10px 0 16px',fontSize:'0.9rem'}},'Click any seat to assign it to a reservation. The seat colors (orange / yellow / green) mark separate tables, matching the seating plan — each color change is a new table. An assigned seat has a bold navy outline and shows the last name. The horizontal bar is the mechitzah.'),
      React.createElement('div',{style:{overflowX:'auto',padding:12,background:'#faf8f3',borderRadius:8,border:'3px solid #1a2744'}},
        React.createElement('div',{className:'seating-chart',ref:chartRef,style:{
          display:'grid',
          gridTemplateColumns:'repeat('+maxCol+', 56px)',
          gridAutoRows:'22px',
          gap:1,
          width:'fit-content'
        }},
          // Section background panels (sized from the seats they contain)
          clLadies&&React.createElement('div',{className:'section-frame ladies',style:clLadies.frame}),
          clSocial&&React.createElement('div',{className:'section-frame social',style:clSocial.frame}),
          clPews&&React.createElement('div',{className:'section-frame mens-left',style:clPews.frame}),
          clMensCtr&&React.createElement('div',{className:'section-frame mens-center',style:clMensCtr.frame}),
          clMensRight&&React.createElement('div',{className:'section-frame mens-right',style:clMensRight.frame}),
          // Section labels
          clLadies&&React.createElement('div',{className:'section-label',style:clLadies.label},'Ladies Section'),
          clSocial&&React.createElement('div',{className:'section-label',style:clSocial.label},'Social Hall (Ladies)'),
          clPews&&React.createElement('div',{className:'section-label',style:clPews.label},'Men Pews'),
          clMensCtr&&React.createElement('div',{className:'section-label',style:clMensCtr.label},'Men Section'),
          clMensRight&&React.createElement('div',{className:'section-label',style:clMensRight.label},'Men (Right)'),
          // Seats
          data.layout.seats.flatMap(seat=>{
            const a=data.assignments[seat.number];
            const holder=a&&a.holder?a.holder:'';
            const isAssigned=!!holder;
            const tableColor=seat.color||'#FFF176';
            // Number box carries the table color (from the sheet) so adjacent
            // tables read as distinct. An assigned seat gets a bold navy outline.
            const num=React.createElement('button',{
              key:'n'+seat.number,
              className:'seat-num-box',
              style:{gridColumn:(seat.col+1),gridRow:(seat.row+2),background:tableColor,color:'#1a2744',border:isAssigned?'2px solid #1a2744':'1px solid #8a6f2b'},
              title:'Seat '+seat.number+(holder?', '+holder:''),
              onClick:()=>openAssign(seat)
            },seat.number);
            const lastName=holder?seatLastName(holder):'';
            const name=React.createElement('button',{
              key:'h'+seat.number,
              className:'seat-holder-box'+(holder?'':' empty'),
              style:{gridColumn:(seat.col+1),gridRow:(seat.row+3),background:isAssigned?'#fff':'#f7f3e8',border:isAssigned?'2px solid #1a2744':'1px solid #8a6f2b',borderTop:'none'},
              title:'Seat '+seat.number+(holder?', '+holder:''),
              onClick:()=>openAssign(seat)
            },lastName);
            return [num,name];
          }),
          React.createElement('div',{className:'mehitzah-bar',style:{
            gridColumn:'1 / -1',
            gridRow:(mehitzah+2)
          }},'MECHITZAH'))),
    selected&&React.createElement('div',{className:'card',style:{marginTop:16,border:'2px solid #c49a3c'}},
      React.createElement('div',{className:'card-header'},'Seat '+selected.number+' ('+selected.section+')'),
      reservations.length===0
        ?React.createElement('p',{style:{color:'#888'}},'No High Holiday reservations yet. Seats can only be assigned to people who have reserved.')
        :React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Assign this seat to a reservation'),
          React.createElement('select',{className:'form-input',value:form.reservationId,onChange:e=>{
            const r=reservations.find(x=>x.id===e.target.value);
            setForm({reservationId:e.target.value,holder:r?r.displayName:''});
          }},
            React.createElement('option',{value:''},'— choose a reservation —'),
            reservations.map(r=>React.createElement('option',{key:r.id,value:r.id},
              r.displayName+' — reserved '+r.numSeats+', assigned '+(assignedByRes[r.id]||0))))),
      React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
        React.createElement('button',{className:'btn btn-primary',onClick:save,disabled:!form.reservationId},'Save'),
        data.assignments[selected.number]&&React.createElement('button',{className:'btn btn-danger',onClick:clearSeat},'Clear'),
        React.createElement('button',{className:'btn btn-outline',onClick:()=>setSelected(null)},'Cancel')))));
}

function AdminAutoEmails() {
  const [state,setState]=useState(null);
  const [msg,setMsg]=useState('');
  const [saving,setSaving]=useState(false);
  const [loadErr,setLoadErr]=useState('');
  function loadState(){setLoadErr('');apiFetch('/api/admin/auto-emails').then(setState).catch(err=>setLoadErr(err.message||'Failed to load'));}
  useEffect(()=>{loadState();},[]);
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
    {key:'membership',label:'Membership Dues Reminders',desc:'Runs monthly on the 1st at 10:00 AM ET. Emails members with unpaid dues (skips members on auto-pay and members whose spouse is already paid).'},
    {key:'pledge',label:'Pledge Reminders',desc:'Runs monthly on the 1st at 10:00 AM ET. Emails members with outstanding pledges after the configured start delay.'},
    {key:'fiscalYear',label:'Annual Tax Receipt Auto-Send',desc:'On January 1, automatically sends every donor a summary of their prior-year giving.'},
  ];
  if(loadErr) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:24}},
    React.createElement('p',{className:'message message-error'},'Could not load auto-email settings: '+loadErr),
    React.createElement('button',{className:'btn btn-outline',onClick:loadState},'Retry'));
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
  const [rules,setRules]=useState({});const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [msg,setMsg]=useState('');const [loadErr,setLoadErr]=useState('');
  function loadRules(){setLoading(true);setLoadErr('');apiFetch('/api/admin/davening-rules').then(d=>{setRules(d);setLoading(false);}).catch(e=>{setLoadErr(e.message||'Failed to load');setLoading(false);});}
  useEffect(()=>{loadRules();},[]);
  function upd(k,v){setRules(p=>({...p,[k]:v}));}
  async function save(){setSaving(true);setMsg('');try{await apiFetch('/api/admin/davening-rules',{method:'PUT',body:JSON.stringify(rules)});setMsg('Rules saved!');}catch(e){setMsg('Error: '+e.message);}setSaving(false);}
  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  // Never render the editor (with hardcoded defaults) on a load failure — saving
  // would overwrite the shul's real configured times with defaults.
  if(loadErr) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:24}},
    React.createElement('p',{className:'message message-error'},'Could not load the current rules: '+loadErr),
    React.createElement('button',{className:'btn btn-outline',onClick:loadRules},'Retry'));
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
  async function load(){setLoading(true);try{setOverrides(await apiFetch('/api/admin/schedule-overrides'));setMsg('');}catch(e){setMsg('Error loading overrides: '+e.message);}setLoading(false);}
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

// ─── Admin Jewish Holidays ───────────────────────────────────────
// Custom multi-part schedules for Jewish holidays (Tisha B'Av, etc.). Dates
// come from the Jewish calendar automatically; the admin sets the times.
const HOLIDAY_AUTO_OPTS=[['','— I\'ll type the time —'],['sunset','Auto: Shkia / Sunset'],['chatzos','Auto: Chatzos (midday)'],['tzeis','Auto: Tzeis / Nightfall'],['alos','Auto: Alos / Dawn'],['candleLighting','Auto: Candle Lighting'],['plag','Auto: Plag HaMincha'],['sunrise','Auto: Sunrise']];
function AdminHolidays(){
  const [holidays,setHolidays]=useState([]);
  const [seeded,setSeeded]=useState(true);
  const [loading,setLoading]=useState(true);
  const [loadErr,setLoadErr]=useState('');
  const [msg,setMsg]=useState('');
  const [openKey,setOpenKey]=useState('');
  const [previews,setPreviews]=useState({});
  const [busy,setBusy]=useState('');
  useEffect(()=>{load();},[]);
  function load(){setLoading(true);setLoadErr('');apiFetch('/api/admin/holidays').then(d=>{setHolidays(d.holidays||[]);setSeeded(d.seeded!==false);setLoading(false);}).catch(e=>{setLoadErr(e.message||'Failed to load');setLoading(false);});}
  function updateHoliday(key,updater){setHolidays(hs=>hs.map(h=>h.key===key?updater({...h}):h));}
  function setField(key,field,val){updateHoliday(key,h=>({...h,[field]:val}));}
  function updItem(key,si,ii,patch){updateHoliday(key,h=>({...h,sections:h.sections.map((s,i)=>i!==si?s:{...s,items:s.items.map((it,j)=>j!==ii?it:{...it,...patch})})}));}
  function addItem(key,si){updateHoliday(key,h=>({...h,sections:h.sections.map((s,i)=>i!==si?s:{...s,items:[...(s.items||[]),{category:'',time:'',note:'',auto:''}]})}));}
  function rmItem(key,si,ii){updateHoliday(key,h=>({...h,sections:h.sections.map((s,i)=>i!==si?s:{...s,items:s.items.filter((_,j)=>j!==ii)})}));}
  function setSecField(key,si,field,val){updateHoliday(key,h=>({...h,sections:h.sections.map((s,i)=>i!==si?s:{...s,[field]:val})}));}
  function addSection(key){updateHoliday(key,h=>({...h,sections:[...(h.sections||[]),{id:'sec'+Math.floor(Math.random()*1e6),label:'New day',match:[],items:[]}]}));}
  function rmSection(key,si){if(!confirm('Remove this day/section?'))return;updateHoliday(key,h=>({...h,sections:h.sections.filter((_,i)=>i!==si)}));}
  async function seedAll(){setBusy('seed');setMsg('');try{const r=await apiFetch('/api/admin/holidays/seed',{method:'POST'});setMsg('Set up '+(r.created||0)+' holidays.');load();}catch(e){setMsg('Error: '+e.message);}setBusy('');}
  async function saveHoliday(h){setBusy(h.key);setMsg('');try{await apiFetch('/api/admin/holidays/'+h.key,{method:'PUT',body:JSON.stringify({name:h.name,intro:h.intro,enabled:!!h.enabled,emailEnabled:!!h.emailEnabled,order:Number(h.order)||0,sections:(h.sections||[]).map(s=>({id:s.id,label:s.label,match:s.match,items:s.items}))})});setMsg('Saved “'+h.name+'”.');setSeeded(true);}catch(e){setMsg('Error: '+e.message);}setBusy('');}
  async function previewHoliday(key){setBusy('prev'+key);setMsg('');try{const r=await apiFetch('/api/admin/holidays/'+key+'/preview');setPreviews(p=>({...p,[key]:r.occurrences||[]}));if(!(r.occurrences||[]).length)setMsg('No upcoming date found in the next ~13 months (check the calendar names).');}catch(e){setMsg('Error: '+e.message);}setBusy('');}
  async function delHoliday(h){if(!confirm('Delete “'+h.name+'”? This removes its custom schedule.'))return;try{await apiFetch('/api/admin/holidays/'+h.key,{method:'DELETE'});setMsg('Deleted “'+h.name+'”.');load();}catch(e){setMsg('Error: '+e.message);}}
  async function addHoliday(){const name=prompt('Holiday name (for example: Yom HaAtzmaut):');if(!name)return;const key=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);if(!key){setMsg('Please use a name with letters.');return;}try{await apiFetch('/api/admin/holidays',{method:'POST',body:JSON.stringify({key,name})});setMsg('Added “'+name+'”. Open it to add the calendar names + times.');await new Promise(r=>setTimeout(r,300));load();setOpenKey(key);}catch(e){setMsg('Error: '+e.message);}}

  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading holidays...');
  if(loadErr) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:24}},React.createElement('p',{className:'message message-error'},'Could not load holidays: '+loadErr),React.createElement('button',{className:'btn btn-outline',onClick:load},'Retry'));

  function editor(h){
    return React.createElement('div',{style:{padding:'12px 14px',borderTop:'1px solid #e0dcd4'}},
      React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:12,alignItems:'flex-end',marginBottom:10}},
        React.createElement('div',{className:'form-group',style:{flex:'1 1 200px',margin:0}},React.createElement('label',{className:'form-label'},'Name'),React.createElement('input',{className:'form-input',value:h.name||'',onChange:e=>setField(h.key,'name',e.target.value)})),
        React.createElement('div',{className:'form-group',style:{width:90,margin:0}},React.createElement('label',{className:'form-label'},'Order'),React.createElement('input',{className:'form-input',type:'number',value:h.order||0,onChange:e=>setField(h.key,'order',e.target.value)})),
        React.createElement('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:'0.9rem'}},React.createElement('input',{type:'checkbox',checked:!!h.enabled,onChange:e=>setField(h.key,'enabled',e.target.checked)}),'Show on site & weekly email'),
        React.createElement('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:'0.9rem'}},React.createElement('input',{type:'checkbox',checked:!!h.emailEnabled,onChange:e=>setField(h.key,'emailEnabled',e.target.checked)}),'Offer holiday email')),
      React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Intro note (optional, shown above the schedule)'),React.createElement('input',{className:'form-input',value:h.intro||'',onChange:e=>setField(h.key,'intro',e.target.value)})),
      (h.sections||[]).map((s,si)=>React.createElement('div',{key:si,style:{border:'1px solid #e0dcd4',borderRadius:6,padding:10,marginBottom:10,background:'#faf8f3'}},
        React.createElement('div',{style:{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end',marginBottom:8}},
          React.createElement('div',{className:'form-group',style:{flex:'1 1 160px',margin:0}},React.createElement('label',{className:'form-label'},'Day label'),React.createElement('input',{className:'form-input',value:s.label||'',onChange:e=>setSecField(h.key,si,'label',e.target.value)})),
          React.createElement('div',{className:'form-group',style:{flex:'2 1 240px',margin:0}},React.createElement('label',{className:'form-label'},'Calendar names that trigger this day (comma-separated)'),React.createElement('input',{className:'form-input',value:(s.match||[]).join(', '),onChange:e=>setSecField(h.key,si,'match',e.target.value.split(',').map(x=>x.trim()).filter(Boolean)),placeholder:"e.g. Erev Tish'a B'Av"})),
          React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>rmSection(h.key,si),title:'Remove this day'},'✕')),
        React.createElement('table',{style:{width:'100%',borderCollapse:'collapse',fontSize:'0.88rem'}},
          React.createElement('thead',null,React.createElement('tr',null,
            React.createElement('th',{style:{textAlign:'left',padding:'2px 4px'}},'Item'),
            React.createElement('th',{style:{textAlign:'left',padding:'2px 4px',width:110}},'Time'),
            React.createElement('th',{style:{textAlign:'left',padding:'2px 4px',width:170}},'or Auto-calculate'),
            React.createElement('th',{style:{textAlign:'left',padding:'2px 4px'}},'Note'),
            React.createElement('th',{style:{width:28}}))),
          React.createElement('tbody',null,(s.items||[]).map((it,ii)=>React.createElement('tr',{key:ii},
            React.createElement('td',{style:{padding:'2px 4px'}},React.createElement('input',{className:'form-input',style:{margin:0},value:it.category||'',onChange:e=>updItem(h.key,si,ii,{category:e.target.value}),placeholder:'e.g. Mincha'})),
            React.createElement('td',{style:{padding:'2px 4px'}},React.createElement('input',{className:'form-input',style:{margin:0},value:it.time||'',onChange:e=>updItem(h.key,si,ii,{time:e.target.value}),placeholder:it.auto?'(auto)':'6:00 PM'})),
            React.createElement('td',{style:{padding:'2px 4px'}},React.createElement('select',{className:'form-input',style:{margin:0},value:it.auto||'',onChange:e=>updItem(h.key,si,ii,{auto:e.target.value})},HOLIDAY_AUTO_OPTS.map(([v,l])=>React.createElement('option',{key:v,value:v},l)))),
            React.createElement('td',{style:{padding:'2px 4px'}},React.createElement('input',{className:'form-input',style:{margin:0},value:it.note||'',onChange:e=>updItem(h.key,si,ii,{note:e.target.value}),placeholder:'optional'})),
            React.createElement('td',{style:{padding:'2px 4px',textAlign:'center'}},React.createElement('a',{href:'#',onClick:e=>{e.preventDefault();rmItem(h.key,si,ii);},style:{color:'#c0392b'}},'✕'))))),
        ),
        React.createElement('button',{className:'btn btn-sm btn-outline',style:{marginTop:6},onClick:()=>addItem(h.key,si)},'+ Add item')),
      ),
      React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>addSection(h.key)},'+ Add a day (e.g. Erev / Day 2)'),
      React.createElement('div',{style:{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}},
        React.createElement('button',{className:'btn btn-primary',onClick:()=>saveHoliday(h),disabled:busy===h.key},busy===h.key?'Saving...':'Save'),
        React.createElement('button',{className:'btn btn-outline',onClick:()=>previewHoliday(h.key),disabled:busy==='prev'+h.key},busy==='prev'+h.key?'Checking...':'Preview upcoming dates'),
        React.createElement('button',{className:'btn btn-danger',style:{marginLeft:'auto'},onClick:()=>delHoliday(h)},'Delete')),
      previews[h.key]&&previews[h.key].length>0&&React.createElement('div',{style:{marginTop:12,background:'#fff',border:'1px solid #e0dcd4',borderRadius:6,padding:12}},
        React.createElement('div',{style:{fontWeight:700,marginBottom:6}},'Next occurrence (from the Jewish calendar):'),
        previews[h.key].map((occ,i)=>React.createElement('div',{key:i,style:{marginBottom:8}},
          React.createElement('div',{style:{fontWeight:600,color:'#1a2744'}},(occ.sectionLabel||h.name)+' — '+new Date(occ.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})),
          occ.items.map((it,j)=>React.createElement('div',{key:j,style:{fontSize:'0.85rem',color:'#555',paddingLeft:10}},it.category+(it.time?': '+it.time:'')+(it.note?' — '+it.note:'')))))));
  }

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}},
        React.createElement('div',null,
          React.createElement('div',{className:'card-header',style:{marginBottom:2,paddingBottom:0,borderBottom:'none'}},'Jewish Holiday Schedules'),
          React.createElement('p',{style:{fontSize:'0.85rem',color:'#666',margin:0}},'Dates come from the Jewish calendar automatically each year. Set the times below; fast/Chatzos times can auto-calculate. A holiday only appears on the site once you turn on “Show on site”.')),
        React.createElement('div',{style:{display:'flex',gap:8}},
          !seeded&&React.createElement('button',{className:'btn btn-outline btn-sm',onClick:seedAll,disabled:busy==='seed'},busy==='seed'?'Setting up...':'Set up all holidays'),
          React.createElement('button',{className:'btn btn-primary btn-sm',onClick:addHoliday},'+ Add holiday'))),
      !seeded&&React.createElement('p',{style:{fontSize:'0.82rem',color:'#a05a2c',marginTop:8}},'Showing built-in defaults. Saving any holiday (or “Set up all holidays”) makes them editable and permanent.')),
    React.createElement('div',{style:{marginTop:12,display:'flex',flexDirection:'column',gap:8}},
      holidays.map(h=>React.createElement('div',{key:h.key,className:'card',style:{padding:0,overflow:'hidden'}},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer'},onClick:()=>setOpenKey(openKey===h.key?'':h.key)},
          React.createElement('span',{style:{fontWeight:700,color:'#1a2744',flex:1}},h.name),
          h.enabled?React.createElement('span',{style:{fontSize:'0.72rem',background:'rgba(39,174,96,0.15)',color:'#27ae60',padding:'2px 8px',borderRadius:10,fontWeight:700}},'On site'):React.createElement('span',{style:{fontSize:'0.72rem',background:'#eee',color:'#888',padding:'2px 8px',borderRadius:10,fontWeight:700}},'Off'),
          React.createElement('span',{style:{color:'#c49a3c',fontWeight:700}},openKey===h.key?'▾':'▸')),
        openKey===h.key&&editor(h)))));
}

// ─── Admin Shiurim ───────────────────────────────────────────────
function AdminShiurim() {
  const [shiurim,setShiurim]=useState([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [form,setForm]=useState({title:'',rabbi:'',time:'',dayOfWeek:0,topic:'',recurring:true,location:''});
  const [editingId,setEditingId]=useState(null);
  useEffect(()=>{load();},[]);
  // cache:no-store so the admin always sees the just-added shiur instead of
  // the 5-minute Cache-Control: public response served to the homepage.
  async function load(){setLoading(true);try{setShiurim(await apiFetch('/api/shiurim',{cache:'no-store'}));setMsg('');}catch(e){setMsg('Error loading shiurim: '+e.message);}setLoading(false);}
  function resetForm(){setForm({title:'',rabbi:'',time:'',dayOfWeek:0,topic:'',recurring:true,location:''});setEditingId(null);}
  async function save(){if(!form.title)return;try{
    if(editingId){await apiFetch('/api/admin/shiurim/'+editingId,{method:'PUT',body:JSON.stringify(form)});setMsg('Shiur updated!');}
    else{await apiFetch('/api/admin/shiurim',{method:'POST',body:JSON.stringify(form)});setMsg('Shiur added!');}
    resetForm();load();
  }catch(e){setMsg('Error: '+e.message);}}
  function startEdit(s){setEditingId(s.id);setForm({title:s.title||'',rabbi:s.rabbi||'',time:s.time||'',dayOfWeek:Number(s.dayOfWeek)||0,topic:s.topic||'',recurring:s.recurring!==false,location:s.location||''});window.scrollTo({top:0,behavior:'smooth'});}
  async function del(id){if(!confirm('Delete?'))return;try{await apiFetch('/api/admin/shiurim/'+id,{method:'DELETE'});if(editingId===id)resetForm();load();}catch(e){setMsg('Error: '+e.message);}}
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},editingId?'Edit Shiur':'Add Shiur'),
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
      React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
        React.createElement('button',{className:'btn btn-primary',onClick:save},editingId?'Save Changes':'Add Shiur'),
        editingId&&React.createElement('button',{className:'btn btn-outline',onClick:resetForm},'Cancel'))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Current Shiurim ('+shiurim.length+')'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      shiurim.length===0?React.createElement('p',{style:{color:'#888'}},'No shiurim yet.'):
      shiurim.map(s=>React.createElement('div',{className:'shiur-card',key:s.id},
        React.createElement('div',{className:'shiur-day'},DAY_NAMES[s.dayOfWeek]?.substring(0,3)||'?'),
        React.createElement('div',{className:'shiur-info'},
          React.createElement('div',{className:'shiur-title'},s.title,s.recurring===false&&React.createElement('span',{style:{marginLeft:6,fontSize:'0.7rem',background:'rgba(196,154,60,0.15)',color:'#c49a3c',padding:'2px 6px',borderRadius:8}},'One-time')),
          React.createElement('div',{className:'shiur-details'},[s.time,s.rabbi,s.topic,s.location].filter(Boolean).join(' • '))),
        React.createElement('button',{className:'btn btn-sm btn-outline',style:{marginRight:4},onClick:()=>startEdit(s)},'Edit'),
        React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>del(s.id)},'Delete')))));
}

// ─── Admin Accounts ──────────────────────────────────────────────
function AdminAccounts() {
  const [admins,setAdmins]=useState([]);const [loading,setLoading]=useState(true);const [email,setEmail]=useState('');const [msg,setMsg]=useState('');
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);try{setAdmins(await apiFetch('/api/admin/users'));setMsg('');}catch(e){setMsg('Error loading admins: '+e.message);}setLoading(false);}
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
  const paidPiRef=useRef(null); // holds a succeeded PaymentIntent id so a confirm retry never re-charges

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
      // If a previous attempt already charged the card but the confirm step
      // failed, DON'T create a new PaymentIntent / charge again — just retry the
      // server-side confirm with the already-succeeded PaymentIntent. This is
      // what prevents a network blip on /confirm from double-charging a donor.
      let paidPiId=paidPiRef.current;
      if(!paidPiId){
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
        paidPiId=result.paymentIntent.id;
        paidPiRef.current=paidPiId; // remember so a confirm retry never re-charges
      }
      await apiFetch('/api/donations/confirm',{method:'POST',body:JSON.stringify({...form,amount:parseFloat(form.amount),paymentIntentId:paidPiId,type:'donation'})});
      paidPiRef.current=null;
      setStep('done');
    }catch(err){
      setMsg(paidPiRef.current
        ? 'Your card was charged, but saving the receipt hit a snag. Please click Donate once more to finish — you will NOT be charged again.'
        : 'Error: '+err.message);
    }
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
      React.createElement('p',{style:{marginBottom:20,color:'#555'}},'Support Congregation Ohr Chaim. Contributions are tax-deductible to the extent allowed by law. EIN 59-2202972.'),
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

// ─── Native donation link-out (App Store Guideline 3.2.2(iv)) ─────
// In the iOS app, charitable donations must not be collected in-app; instead we
// link out to the donation page on our website (opens in the system browser /
// SFSafariViewController). On the web these routes render the normal in-app
// Stripe forms (DonatePage / PayBillPage).
function DonateExternal() {
  return React.createElement('div',{style:{maxWidth:560,margin:'0 auto',padding:'32px 20px',textAlign:'center'}},
    React.createElement('h2',{style:{color:'#1a2744',marginBottom:12}},'Donate'),
    React.createElement('p',{style:{color:'#555',marginBottom:28,fontSize:'1.05rem',lineHeight:1.5}},'Support Congregation Ohr Chaim. Donations are processed securely on our website.'),
    React.createElement('button',{className:'btn btn-primary',style:{fontSize:'1.05rem',padding:'14px 32px'},onClick:()=>openExternal(SITE_URL+'/#donate')},'Donate on our website →'));
}
function PayBillExternal() {
  const token=(window.location.hash.split('token=')[1]||'').split('&')[0];
  return React.createElement('div',{style:{maxWidth:560,margin:'0 auto',padding:'32px 20px',textAlign:'center'}},
    React.createElement('h2',{style:{color:'#1a2744',marginBottom:12}},'Pay Your Bill'),
    React.createElement('p',{style:{color:'#555',marginBottom:28,fontSize:'1.05rem',lineHeight:1.5}},'Your payment is processed securely on our website.'),
    React.createElement('button',{className:'btn btn-primary',style:{fontSize:'1.05rem',padding:'14px 32px'},onClick:()=>openExternal(SITE_URL+'/#pay?token='+token)},'Continue on our website →'));
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
  const [subOptions,setSubOptions]=useState(null); // {standard, fairShare}
  const [subLevel,setSubLevel]=useState('standard');
  const [delBusy,setDelBusy]=useState(false);
  const [yahrzeits,setYahrzeits]=useState([]);
  const [yahrzeitForm,setYahrzeitForm]=useState({deceasedName:'',relationship:'',englishDeathDate:'',notes:''});
  const [yahrzeitBusy,setYahrzeitBusy]=useState(false);
  const [bills,setBills]=useState([]);
  const siteImages=useSiteImages();
  useEffect(()=>{const unsub=firebase.auth().onAuthStateChanged(u=>{setUser(u);setLoading(false);});return unsub;},[]);
  useEffect(()=>{if(user){
    apiFetch('/api/auth/profile').then(p=>{setProfile(p);setEditForm({firstName:p.firstName||'',lastName:p.lastName||'',phone:p.phone||'',address:p.address||'',bio:p.bio||''});}).catch(()=>{});
    apiFetch('/api/membership/subscription-status').then(setSubStatus).catch(()=>setSubStatus({active:false}));
    apiFetch('/api/membership/options').then(setSubOptions).catch(()=>{});
    apiFetch('/api/yahrzeits').then(setYahrzeits).catch(()=>{});
    apiFetch('/api/my-bills').then(setBills).catch(()=>setBills([]));
  }},[user]);
  useEffect(()=>{
    const hash=window.location.hash;
    if(hash.includes('sub=success')) setMsg('Automatic payment set up! Thank you.');
    else if(hash.includes('sub=cancel')) setMsg('Checkout canceled. You can try again anytime.');
  },[]);

  async function startSubscription(interval){
    setSubBusy(true);setMsg('');
    try{
      const res=await apiFetch('/api/membership/create-subscription-checkout',{method:'POST',body:JSON.stringify({interval,level:subLevel})});
      if(res.url) openExternal(res.url);
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

  async function deleteAccount(){
    if(!confirm('Permanently delete your account? This cannot be undone. Your profile and reminders will be removed and any automatic membership payment canceled.'))return;
    if(!confirm('Are you absolutely sure? Tap OK to permanently delete your account now.'))return;
    setDelBusy(true);setMsg('');
    try{
      await apiFetch('/api/auth/account',{method:'DELETE'});
      await firebase.auth().signOut();
      alert('Your account has been permanently deleted.');
      window.location.hash='#home';
    }catch(e){setMsg('Error: '+e.message);setDelBusy(false);}
  }
  useEffect(()=>{const hash=window.location.hash;if(hash.includes('token=')){const token=hash.split('token=')[1]?.split('&')[0];if(token){setAuthMode('prefill');apiFetch('/api/auth/prefill/'+token).then(d=>{setRegForm(p=>({...p,firstName:d.firstName||'',lastName:d.lastName||'',email:d.email||'',phone:d.phone||'',address:d.address||'',spouseEmail:d.spouseEmail||''}));}).catch(err=>setError(err.message));}}},[]);

  async function handleLogin(e){e.preventDefault();setError('');try{await firebase.auth().signInWithEmailAndPassword(loginForm.email,loginForm.password);}catch(err){setError(err.message);}}
  async function handleGoogle(){setError('');
    try{
      const provider=new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      // onAuthStateChanged picks up the sign-in; the backend auto-creates/links
      // the member record by email on the first profile fetch.
    }catch(err){
      if(err.code==='auth/account-exists-with-different-credential') setError('This email already has an account here. Please sign in with your email and password below.');
      else if(err.code==='auth/popup-closed-by-user'||err.code==='auth/cancelled-popup-request'){/* user dismissed */}
      else setError(err.message||'Google sign-in failed.');
    }
  }
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
    authMode!=='prefill'&&React.createElement('div',null,
      React.createElement('button',{type:'button',className:'btn btn-block',onClick:handleGoogle,style:{background:'#fff',border:'1px solid #d4cfc4',color:'#1a2744',display:'flex',alignItems:'center',justifyContent:'center',gap:10,fontWeight:600}},
        React.createElement('img',{src:'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',alt:'',width:18,height:18,style:{display:'block'}}),
        'Continue with Google'),
      React.createElement('div',{style:{textAlign:'center',color:'#aaa',fontSize:'0.85rem',margin:'12px 0'}},'— or —')),
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
    // My Bills — only renders when the member has at least one outstanding
    // pledge / invoice. Each row has a Pay button that opens the magic-link
    // payment page (same one members get from email invoices).
    bills.length>0&&React.createElement('div',{className:'card',style:{marginTop:16}},
      React.createElement('div',{className:'card-header'},'Outstanding Bills ('+bills.length+')'),
      React.createElement('p',{style:{color:'#555',marginBottom:12,fontSize:'0.9rem'}},'Pay your shul bills below. Each one is a single charge — no recurring subscription is created.'),
      bills.map(b=>React.createElement('div',{key:b.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',border:'1px solid #e0dcd4',borderRadius:8,marginBottom:8,background:'#faf8f3',flexWrap:'wrap',gap:8}},
        React.createElement('div',{style:{flex:1,minWidth:200}},
          React.createElement('div',{style:{fontWeight:700,color:'#1a2744',fontSize:'1.1rem'}},'$'+parseFloat(b.amount).toFixed(2),' — ',b.reason||'Pledge'),
          (b.dueDate||b.notes)&&React.createElement('div',{style:{fontSize:'0.85rem',color:'#666',marginTop:3}},[b.dueDate&&'Due '+b.dueDate,b.notes].filter(Boolean).join(' • '))),
        React.createElement('a',{href:'#pay?token='+b.payToken,className:'btn btn-primary btn-sm'},'Pay'))),
    ),
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
          // Membership level: Standard or Fair Share (shown only if Fair Share is configured).
          subOptions&&subOptions.fairShare>0&&React.createElement('div',{style:{marginBottom:12}},
            React.createElement('div',{style:{fontWeight:700,marginBottom:6,fontSize:'0.9rem'}},'Choose your membership level:'),
            React.createElement('label',{style:{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',border:'1px solid '+(subLevel==='standard'?'#c49a3c':'#e0dcd4'),borderRadius:6,marginBottom:6,cursor:'pointer',background:subLevel==='standard'?'rgba(196,154,60,0.08)':'#fff'}},
              React.createElement('input',{type:'radio',name:'subLevel',checked:subLevel==='standard',onChange:()=>setSubLevel('standard'),style:{marginTop:3}}),
              React.createElement('span',null,React.createElement('strong',null,'Standard Membership'),subOptions.standard>0&&React.createElement('span',null,' — $'+subOptions.standard.toLocaleString()+'/year'))),
            React.createElement('label',{style:{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',border:'1px solid '+(subLevel==='fairShare'?'#c49a3c':'#e0dcd4'),borderRadius:6,cursor:'pointer',background:subLevel==='fairShare'?'rgba(196,154,60,0.08)':'#fff'}},
              React.createElement('input',{type:'radio',name:'subLevel',checked:subLevel==='fairShare',onChange:()=>setSubLevel('fairShare'),style:{marginTop:3}}),
              React.createElement('span',null,React.createElement('strong',null,'Fair Share Membership'),' — $'+subOptions.fairShare.toLocaleString()+'/year',React.createElement('span',{style:{display:'block',fontSize:'0.82rem',color:'#666',marginTop:2}},'Reflects a member\'s proportional share of the shul\'s actual annual operating budget. Helps ensure the full cost of running the shul and its programs is met.')))),
          React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
            React.createElement('button',{className:'btn btn-primary',disabled:subBusy,onClick:()=>startSubscription('year')},subBusy?'Loading...':'Pay annually'),
            React.createElement('button',{className:'btn btn-primary',disabled:subBusy,onClick:()=>startSubscription('month')},subBusy?'Loading...':'Pay monthly')))),
    React.createElement('div',{className:'card',style:{marginTop:16,borderColor:'rgba(176,0,32,0.35)'}},
      React.createElement('div',{className:'card-header'},'Delete Account'),
      React.createElement('p',{style:{color:'#555',marginBottom:12}},'Permanently delete your account and personal profile. This cannot be undone. Any active automatic membership payment will be canceled. (Past donation receipts are retained as required for tax and accounting records.)'),
      React.createElement('button',{className:'btn btn-danger',disabled:delBusy,onClick:deleteAccount},delBusy?'Deleting...':'Delete My Account')),
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
  const [mf,setMf]=useState({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:'',paymentMethod:'check',fiscalYear:'',date:'',pledgeId:''});
  const [mfBusy,setMfBusy]=useState(false);
  const [reasons,setReasons]=useState([]);
  const [openBills,setOpenBills]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [importTag,setImportTag]=useState('');
  // Last batch-import response — surfaced below the upload button so admin can
  // see exactly how many rows imported, how many were duplicates, how many
  // linked to a member, and the full per-row error list.
  const [importResult,setImportResult]=useState(null);
  useEffect(()=>{load();apiFetch('/api/donations/reasons').then(setReasons).catch(()=>{});loadBills();},[year]);
  async function load(){setLoading(true);try{setDonations(await apiFetch('/api/admin/donations?year='+year));}catch(e){}setLoading(false);}
  async function loadBills(){try{const all=await apiFetch('/api/admin/pledges');setOpenBills((all||[]).filter(p=>p.status!=='paid'));}catch(e){}}
  async function recordManual(e){e.preventDefault();if(mfBusy)return;setMsg('');setMfBusy(true);
    try{
      const payload={...mf,amount:parseFloat(mf.amount),type:'donation'};
      if(mf.fiscalYear){payload.fiscalYear=parseInt(mf.fiscalYear);}
      if(!mf.fiscalYear)delete payload.fiscalYear;
      if(!mf.date)delete payload.date;
      if(!mf.pledgeId)delete payload.pledgeId;
      const res=await apiFetch('/api/admin/manual-payment',{method:'POST',body:JSON.stringify(payload)});
      const tail=res.routedToOffice?' Receipt sent to the office for printing.':res.receiptSent?' Receipt emailed to donor.':'';
      const billNote=mf.pledgeId?(res.billFullyPaid===false?' Applied to the selected invoice (partial — balance remaining).':' Applied to the selected invoice (marked paid).'):'';
      setMsg('Payment recorded.'+billNote+tail);
      setMf({firstName:'',lastName:'',email:'',phone:'',amount:'',reason:'General Donation',note:'',paymentMethod:'check',fiscalYear:'',date:'',pledgeId:''});
      load();loadBills();
    }catch(err){setMsg('Error: '+err.message);}
    setMfBusy(false);}
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
    setUploading(true);setMsg('Uploading...');setImportResult(null);
    try{
      const token=await firebase.auth().currentUser.getIdToken();
      const fd=new FormData();fd.append('file',file);
      if(importTag.trim()) fd.append('importTag',importTag.trim());
      const r=await fetch(BACKEND_URL+'/api/admin/upload-payments',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});
      const data=await r.json();
      if(r.ok){
        setImportResult(data);
        const parts=['Imported '+data.created+' of '+data.total];
        if(data.duplicatesSkipped) parts.push(data.duplicatesSkipped+' duplicates skipped');
        if(data.memberLinked) parts.push(data.memberLinked+' linked to members');
        if(data.errors?.length) parts.push(data.errors.length+' errors');
        setMsg(parts.join(' • '));
        load();
      } else setMsg('Error: '+(data.error||'upload failed'));
    }catch(err){setMsg('Error: '+err.message);}
    setUploading(false);
    e.target.value='';
  }
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Record Manual Payment (Check / Cash / Zelle)'),
      React.createElement('p',{style:{marginBottom:12,color:'#555',fontSize:'0.9rem'}},'Email is optional. If you leave it blank, the receipt will be emailed to the office for printing and mailing.'),
      React.createElement('form',{onSubmit:recordManual},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:mf.firstName,onChange:e=>setMf(p=>({...p,firstName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:mf.lastName,onChange:e=>setMf(p=>({...p,lastName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:mf.email,onChange:e=>setMf(p=>({...p,email:e.target.value})),placeholder:'(blank = print at office)'})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Amount ($) *'),React.createElement('input',{className:'form-input',type:'number',min:'1',step:'0.01',value:mf.amount,onChange:e=>setMf(p=>({...p,amount:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Reason'),React.createElement('select',{className:'form-input',value:mf.reason,onChange:e=>setMf(p=>({...p,reason:e.target.value}))},reasons.map(r=>React.createElement('option',{key:r,value:r},r)))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Method'),React.createElement('select',{className:'form-input',value:mf.paymentMethod,onChange:e=>setMf(p=>({...p,paymentMethod:e.target.value}))},['check','cash','zelle','venmo','other'].map(m=>React.createElement('option',{key:m,value:m},m.charAt(0).toUpperCase()+m.slice(1))))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Date (optional)'),React.createElement('input',{className:'form-input',type:'date',value:mf.date,onChange:e=>setMf(p=>({...p,date:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Fiscal Year (optional)'),React.createElement('input',{className:'form-input',type:'number',placeholder:'e.g. 2025',value:mf.fiscalYear,onChange:e=>setMf(p=>({...p,fiscalYear:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Note'),React.createElement('input',{className:'form-input',value:mf.note,onChange:e=>setMf(p=>({...p,note:e.target.value}))}))),
        React.createElement('div',{className:'form-group',style:{marginTop:8,background:'#faf8f3',padding:12,borderRadius:6,border:'1px solid #e0dcd4'}},
          React.createElement('label',{className:'form-label'},'Apply to an open invoice / bill (optional)'),
          React.createElement('select',{className:'form-input',value:mf.pledgeId,onChange:e=>{
            const id=e.target.value;
            const bill=openBills.find(b=>b.id===id);
            if(bill){
              const nm=(bill.memberName||'').trim().split(' ');
              setMf(p=>({...p,pledgeId:id,
                firstName:p.firstName||nm[0]||'',
                lastName:p.lastName||nm.slice(1).join(' ')||'',
                email:p.email||bill.memberEmail||'',
                amount:p.amount||(bill.amount!=null?String(bill.amount):''),
                reason:bill.reason||p.reason}));
            } else { setMf(p=>({...p,pledgeId:''})); }
          }},
            React.createElement('option',{value:''},'— Not applied to a bill —'),
            openBills.map(b=>React.createElement('option',{key:b.id,value:b.id},
              (b.reason||'Bill')+' — $'+(b.amount!=null?Number(b.amount).toFixed(2):'?')+' — '+(b.memberName||b.memberEmail||'')+(b.dueDate?(' ('+b.dueDate+')'):'')))),
          mf.pledgeId&&React.createElement('p',{style:{margin:'8px 0 0',fontSize:'0.85rem',color:'#555'}},'Recording this payment applies it to the selected bill — and any linked kiddush/seudas shlishis sponsorship. The bill is marked paid only once the full balance is covered.')),
        React.createElement('button',{className:'btn btn-primary',type:'submit',disabled:mfBusy,style:{marginTop:8}},mfBusy?'Recording...':'Record Payment'))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Import a Stripe Payment'),
      React.createElement('p',{style:{marginBottom:12,color:'#555',fontSize:'0.95rem'}},'If a Stripe payment cleared but is missing from the list below, paste its Payment ID (starts with "pi_") here to add it. You can find the ID on the Stripe dashboard payment page. Idempotent: won\'t double-add.'),
      React.createElement('button',{className:'btn btn-primary',onClick:importStripePayment},'Import Stripe Payment')),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Batch Import Payments from Excel'),
      React.createElement('p',{style:{marginBottom:8,color:'#555',fontSize:'0.95rem'}},'Upload a spreadsheet with columns First Name, Last Name, Email, Phone, Amount, Reason, Payment Method, Note, Date. Column header capitalization and minor variants (FName, Email Address, Phone #, etc.) are accepted. Only First Name, Last Name, and Amount are required.'),
      React.createElement('p',{style:{marginBottom:12,color:'#888',fontSize:'0.85rem'}},'Each row is auto-matched to a member by email then phone. Re-uploading the same file is safe — duplicates (same name + amount + date) are skipped.'),
      React.createElement('div',{style:{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap',marginBottom:8}},
        React.createElement('div',{className:'form-group',style:{flex:'1 1 220px',marginBottom:0}},
          React.createElement('label',{className:'form-label'},'Import Tag (optional)'),
          React.createElement('input',{className:'form-input',placeholder:'e.g. ShulCloud 2024',value:importTag,onChange:e=>setImportTag(e.target.value),disabled:uploading})),
        React.createElement('label',{className:'btn btn-primary',style:{cursor:uploading?'not-allowed':'pointer',opacity:uploading?0.6:1}},uploading?'Uploading...':'Upload Excel / CSV',
          React.createElement('input',{type:'file',accept:'.xlsx,.xls,.csv',onChange:uploadPayments,style:{display:'none'},disabled:uploading}))),
      importResult&&React.createElement('div',{style:{marginTop:12,padding:14,background:'#faf8f3',border:'1px solid #e0dcd4',borderRadius:8}},
        React.createElement('div',{style:{display:'flex',gap:18,flexWrap:'wrap',fontSize:'0.95rem',marginBottom:importResult.errors?.length?10:0}},
          React.createElement('span',null,React.createElement('strong',null,'Total rows: '),importResult.total||0),
          React.createElement('span',{style:{color:'#27ae60'}},React.createElement('strong',null,'Imported: '),importResult.created||0),
          (importResult.duplicatesSkipped>0)&&React.createElement('span',{style:{color:'#888'}},React.createElement('strong',null,'Duplicates: '),importResult.duplicatesSkipped),
          (importResult.memberLinked>0)&&React.createElement('span',{style:{color:'#1a2744'}},React.createElement('strong',null,'Linked to members: '),importResult.memberLinked),
          (importResult.errors?.length>0)&&React.createElement('span',{style:{color:'#c0392b'}},React.createElement('strong',null,'Errors: '),importResult.errors.length)),
        importResult.detectedColumns?.length>0&&React.createElement('div',{style:{fontSize:'0.85rem',color:'#666',marginBottom:6}},React.createElement('strong',null,'Columns found in your file: '),'[',importResult.detectedColumns.join(', '),']'),
        importResult.errors?.length>0&&React.createElement('details',{style:{marginTop:6}},
          React.createElement('summary',{style:{cursor:'pointer',color:'#c0392b',fontWeight:600}},'Show '+importResult.errors.length+' error row'+(importResult.errors.length===1?'':'s')),
          React.createElement('div',{style:{maxHeight:240,overflowY:'auto',marginTop:8,padding:10,background:'#fff',borderRadius:6,border:'1px solid #e0dcd4',fontSize:'0.82rem',fontFamily:'monospace',lineHeight:1.5}},
            importResult.errors.map((err,i)=>React.createElement('div',{key:i,style:{paddingBottom:6,marginBottom:6,borderBottom:i<importResult.errors.length-1?'1px solid #f0ece3':'none'}},err)))))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'All Donations'),
        React.createElement('div',{style:{display:'flex',gap:6,alignItems:'center'}},
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:async()=>{setMsg('Matching...');try{const r=await apiFetch('/api/admin/match-donations',{method:'POST'});setMsg('Matched '+r.matched+' donations to members ('+r.unmatched+' unmatched)');}catch(e){setMsg('Error: '+e.message);}}},'Match to Members'),
          React.createElement('button',{className:'btn btn-sm btn-outline',title:'Find Stripe subscription invoices that produced multiple donation rows (legacy webhook bug) and remove the duplicates.',onClick:async()=>{if(!confirm('Scan stripe-subscription donations and delete duplicate rows that share the same Stripe invoice?\\n\\nThe oldest row (or the one whose receipt was already sent) is kept.'))return;setMsg('Removing duplicates...');try{const r=await apiFetch('/api/admin/dedupe-subscription-donations',{method:'POST'});setMsg('Removed '+r.removed+' duplicate row(s) across '+r.invoicesScanned+' invoice(s).');await load();}catch(e){setMsg('Error: '+e.message);}}},'Remove Duplicates'),
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
  const [addForm,setAddForm]=useState({firstName:'',lastName:'',email:'',phone:'',address:'',spouseEmail:'',sendInvite:true});
  const [addBusy,setAddBusy]=useState(false);
  const [membershipDues,setMembershipDues]=useState(0);
  const [payModal,setPayModal]=useState(null); // member being marked paid
  const [payForm,setPayForm]=useState({method:'check',otherMethod:'',amount:''});
  const [payBusy,setPayBusy]=useState(false);
  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);
    try{setMembers(await apiFetch('/api/admin/members'));}catch(e){}
    try{setPrefilled(await apiFetch('/api/admin/prefilled-accounts'));}catch(e){}
    try{setTags(await apiFetch('/api/admin/member-tags'));}catch(e){}
    try{const ms=await apiFetch('/api/admin/membership-settings');setMembershipDues(Number(ms&&ms.annualDues)||0);}catch(e){}
    setLoading(false);
  }
  function openPayModal(m){
    const tag=m.tagId?tags.find(t=>t.id===m.tagId):null;
    const dues=tag?Number(tag.annualDues||0):membershipDues;
    setPayForm({method:'check',otherMethod:'',amount:dues?String(dues):''});
    setPayModal(m);
  }
  async function confirmPay(){
    if(!payModal)return;
    const method=payForm.method==='other'?(payForm.otherMethod.trim()||'other'):payForm.method;
    setPayBusy(true);setMsg('');
    try{
      const r=await apiFetch('/api/admin/members/'+payModal.uid+'/membership-paid',{method:'POST',body:JSON.stringify({method,amount:parseFloat(payForm.amount)||0})});
      setMsg((payModal.displayName||'Member')+' membership marked paid ('+method+(r.amount?(' · $'+Number(r.amount).toFixed(2)):'')+')'+(r.spouseUpdated?' — spouse resolved too':'')+'.');
      setPayModal(null);
      await load();
    }catch(err){setMsg('Error: '+err.message);}
    setPayBusy(false);
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
  async function toggleExempt(m){
    const next=!m.exemptFromDues;
    try{
      await apiFetch('/api/admin/members/'+m.uid,{method:'PUT',body:JSON.stringify({exemptFromDues:next})});
      setMsg(m.displayName+' marked '+(next?'exempt from dues':'not exempt')+'.');
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }
  async function editMember(m){
    const newEmail=prompt('Edit email for '+(m.displayName||m.uid)+'.\n\nChanging the email will update Firebase Auth and send a "set password" link to the NEW address. Leave blank to keep current.', m.email||'');
    if(newEmail===null) return; // user cancelled
    const trimmed=(newEmail||'').trim().toLowerCase();
    if(!trimmed){setMsg('Email cannot be blank.');return;}
    if(trimmed===(m.email||'').toLowerCase()){setMsg('Email unchanged.');return;}
    try{
      const r=await apiFetch('/api/admin/members/'+m.uid,{method:'PUT',body:JSON.stringify({email:trimmed})});
      setMsg('Email updated.'+(r.passwordResetSent?' Password-set link sent to '+trimmed+'.':r.passwordResetError?' Could not send link: '+r.passwordResetError:''));
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }
  async function resetPassword(m){
    const label=m.displayName||m.email||m.uid;
    if(!m.email){setMsg(label+' has no email on file — cannot reset password.');return;}
    if(!confirm('Reset password for '+label+'?\n\nA password-reset link will be emailed to '+m.email+'. They can use it to choose a new password.'))return;
    setMsg('Sending reset link...');
    try{
      const r=await apiFetch('/api/admin/members/'+m.uid+'/reset-password',{method:'POST'});
      setMsg('Password-reset link sent to '+(r.email||m.email)+'.');
    }catch(err){setMsg('Error: '+err.message);}
  }
  async function deleteOne(m){
    const label=m.displayName||m.email||m.uid;
    if(!m.uid){setMsg('Cannot delete: this member has no account id.');return;}
    if(!confirm('DELETE '+label+'?\n\nThis will permanently remove their member profile, Firebase Auth login, and any pending signup invites. Their donation history is preserved as tax records.\n\nThis cannot be undone.'))return;
    try{
      // Delete by uid, not email — so a spouse/housemate sharing the same email
      // address is NOT deleted along with this member.
      const r=await apiFetch('/api/admin/members/purge-by-uid',{method:'POST',body:JSON.stringify({uid:m.uid})});
      const result=(r.results||[])[0]||{};
      setMsg('Deleted '+label+': '+(result.usersDeleted||0)+' user, '+(result.authDeleted||0)+' login, '+(result.prefilledDeleted||0)+' pending invite.');
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }
  async function purgeDeadEmails(){
    const raw=prompt('Paste emails to permanently delete (one per line, or comma-separated). For each email we delete the member profile, Firebase Auth login, and pending invites. Donation history is preserved.');
    if(!raw) return;
    const emails=raw.split(/[,\n\r\s]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(!emails.length){setMsg('No valid emails.');return;}
    if(!confirm('Permanently delete '+emails.length+' account'+(emails.length===1?'':'s')+'?\n\n'+emails.join('\n')+'\n\nThis cannot be undone.'))return;
    setMsg('Purging...');
    try{
      const r=await apiFetch('/api/admin/members/purge-by-email',{method:'POST',body:JSON.stringify({emails})});
      const totals=(r.results||[]).reduce((acc,x)=>({u:acc.u+(x.usersDeleted||0),a:acc.a+(x.authDeleted||0),p:acc.p+(x.prefilledDeleted||0),e:acc.e+(x.errors||[]).length}),{u:0,a:0,p:0,e:0});
      setMsg('Purged '+emails.length+' email'+(emails.length===1?'':'s')+': '+totals.u+' user docs, '+totals.a+' logins, '+totals.p+' invites'+(totals.e?' ('+totals.e+' errors — check server logs)':'')+'.');
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }
  async function addSingleMember(e){
    e.preventDefault();setMsg('');
    if(!addForm.firstName.trim()||!addForm.lastName.trim()||!addForm.email.trim()){
      setMsg('First name, last name, and email are required.');return;
    }
    setAddBusy(true);
    try{
      const siteUrl=SITE_URL+'/';
      const r=await apiFetch('/api/admin/members/add-single',{method:'POST',body:JSON.stringify({...addForm,siteUrl})});
      const parts=['Added '+addForm.firstName+' '+addForm.lastName+'.'];
      if(addForm.sendInvite){
        if(r.emailSent) parts.push('Welcome email sent to '+addForm.email+'.');
        else if(r.emailError) parts.push('Email send failed: '+r.emailError+'. Signup link: '+r.signupLink);
        else parts.push('Welcome email queued.');
      }else{
        parts.push('Invite NOT emailed (sendInvite off). Manual link: '+r.signupLink);
      }
      setMsg(parts.join(' '));
      setAddForm({firstName:'',lastName:'',email:'',phone:'',address:'',spouseEmail:'',sendInvite:true});
      await load();
    }catch(err){setMsg('Error: '+err.message);}
    setAddBusy(false);
  }
  async function handleUpload(e){const file=e.target.files[0];if(!file)return;setUploading(true);setMsg('');
    const fd=new FormData();fd.append('file',file);
    try{const token=await firebase.auth().currentUser?.getIdToken();const res=await fetch(BACKEND_URL+'/api/admin/upload-roster',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});const data=await res.json();
      if(res.ok){setMsg('Created '+data.created+' pre-filled accounts.'+(data.errors?.length?' Errors: '+data.errors.join('; '):''));load();}else setMsg('Error: '+(data.error||'failed'));
    }catch(err){setMsg('Error: '+err.message);}setUploading(false);e.target.value='';}
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    payModal&&React.createElement('div',{style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000},onClick:()=>{if(!payBusy)setPayModal(null);}},
      React.createElement('div',{style:{background:'#fff',borderRadius:10,padding:20,width:'90%',maxWidth:420,boxShadow:'0 10px 40px rgba(0,0,0,0.2)'},onClick:e=>e.stopPropagation()},
        React.createElement('h3',{style:{margin:'0 0 4px',color:'#1a2744'}},'Mark Membership Paid'),
        React.createElement('p',{style:{margin:'0 0 14px',color:'#555',fontSize:'0.9rem'}},payModal.displayName||payModal.email||'Member'),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Amount ($)'),
          React.createElement('input',{className:'form-input',type:'number',min:'0',step:'0.01',value:payForm.amount,onChange:e=>setPayForm(p=>({...p,amount:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Payment method'),
          React.createElement('select',{className:'form-input',value:payForm.method,onChange:e=>setPayForm(p=>({...p,method:e.target.value}))},
            React.createElement('option',{value:'check'},'Check'),
            React.createElement('option',{value:'cash'},'Cash'),
            React.createElement('option',{value:'other'},'Other...'))),
        payForm.method==='other'&&React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Specify method'),
          React.createElement('input',{className:'form-input',placeholder:'e.g. Zelle, credit card, wire',value:payForm.otherMethod,onChange:e=>setPayForm(p=>({...p,otherMethod:e.target.value}))})),
        React.createElement('p',{style:{fontSize:'0.8rem',color:'#888',margin:'4px 0 12px'}},'Resolves this member'+(payModal.spouseUid?' and their spouse':'')+'. The amount is logged as a Membership Dues payment.'),
        React.createElement('div',{style:{display:'flex',gap:8,justifyContent:'flex-end'}},
          React.createElement('button',{className:'btn btn-outline',onClick:()=>setPayModal(null),disabled:payBusy},'Cancel'),
          React.createElement('button',{className:'btn btn-primary',onClick:confirmPay,disabled:payBusy},payBusy?'Saving...':'Confirm Paid'))) ),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Upload Member Roster (Excel)'),
      React.createElement('p',{style:{marginBottom:12,color:'#888',fontSize:'0.9rem'}},'Upload Excel with: First Name, Last Name, Email, Phone, Address, Spouse Email. Creates pre-filled signup links.'),
      React.createElement('label',{className:'btn btn-primary',style:{cursor:'pointer'}},uploading?'Uploading...':'📤 Upload Excel File',
        React.createElement('input',{type:'file',accept:'.xlsx,.xls,.csv',onChange:handleUpload,style:{display:'none'}}))),
    // One-off "Add Member" form for when you want to onboard a single person
    // without uploading an Excel. Same pipeline: creates a prefilledAccounts
    // row + (by default) fires the welcome+signup email.
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Add Single Member'),
      React.createElement('p',{style:{marginBottom:12,color:'#888',fontSize:'0.9rem'}},'Manually add one member. They get a welcome email with a "Set Up My Account" link. If a pending invite already exists for this email, it is refreshed instead of duplicated.'),
      React.createElement('form',{onSubmit:addSingleMember},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:addForm.firstName,onChange:e=>setAddForm(p=>({...p,firstName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:addForm.lastName,onChange:e=>setAddForm(p=>({...p,lastName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email *'),React.createElement('input',{className:'form-input',type:'email',value:addForm.email,onChange:e=>setAddForm(p=>({...p,email:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:addForm.phone,onChange:e=>setAddForm(p=>({...p,phone:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Address'),React.createElement('input',{className:'form-input',value:addForm.address,onChange:e=>setAddForm(p=>({...p,address:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Spouse Email'),React.createElement('input',{className:'form-input',type:'email',value:addForm.spouseEmail,onChange:e=>setAddForm(p=>({...p,spouseEmail:e.target.value}))}))),
        React.createElement('div',{style:{display:'flex',gap:12,alignItems:'center',marginTop:8,flexWrap:'wrap'}},
          React.createElement('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:'0.9rem',color:'#555'}},
            React.createElement('input',{type:'checkbox',checked:addForm.sendInvite,onChange:e=>setAddForm(p=>({...p,sendInvite:e.target.checked}))}),
            'Email welcome + signup link to this member'),
          React.createElement('button',{className:'btn btn-primary',type:'submit',disabled:addBusy},addBusy?'Adding...':'Add Member')))),
    prefilled.length>0&&React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Pre-filled Signup Links ('+prefilled.length+')'),
        React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
          React.createElement('button',{className:'btn btn-sm btn-danger',onClick:async()=>{
            const unclaimed=prefilled.filter(a=>!a.claimed).length;
            if(!unclaimed){setMsg('No unclaimed invites to clear.');return;}
            if(!confirm('Delete '+unclaimed+' unclaimed pre-filled signup links?\n\nThis cannot be undone. Old invite emails will stop working after deletion. Already-claimed members are NOT affected.'))return;
            setMsg('Clearing...');
            try{
              const r=await apiFetch('/api/admin/prefilled-accounts/unclaimed',{method:'DELETE'});
              setMsg('Cleared '+r.deleted+' unclaimed invite'+(r.deleted===1?'':'s')+'. '+r.kept+' claimed account'+(r.kept===1?'':'s')+' kept.');
              load();
            }catch(e){setMsg('Error: '+e.message);}
          }},'🗑 Clear Unclaimed'),
          React.createElement('button',{className:'btn btn-sm btn-primary',onClick:async()=>{
            const pending=prefilled.filter(a=>!a.claimed&&a.email);
            if(!pending.length){setMsg('No pending invites to send.');return;}
            if(!confirm('Send signup emails to '+pending.length+' pending members?'))return;
            setMsg('Sending...');
            try{
              const siteUrl=SITE_URL+'/';
              const res=await apiFetch('/api/admin/send-signup-invites',{method:'POST',body:JSON.stringify({accounts:pending.map(a=>({email:a.email,firstName:a.firstName,lastName:a.lastName,token:a.token})),siteUrl})});
              setMsg('Sent '+res.sent+' invite emails'+(res.failed?' ('+res.failed+' failed)':''));
            }catch(e){setMsg('Error: '+e.message);}
          }},'Send All Invites ('+prefilled.filter(a=>!a.claimed).length+')'))),
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
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:clearSel},'Clear ('+selectedUids.length+')'),
            React.createElement('button',{className:'btn btn-sm btn-danger',onClick:purgeDeadEmails,title:'Paste a list of dead emails to permanently delete in one go'},'🗑 Purge by Email...')),
          selectedUids.length>0&&React.createElement('div',{style:{padding:10,background:'#faf8f3',borderRadius:6,marginBottom:12,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}},
            React.createElement('strong',{style:{marginRight:8}},selectedUids.length+' selected:'),
            React.createElement('button',{className:'btn btn-sm btn-primary',onClick:()=>bulk({exemptFromDues:true},'Mark as Exempt from Dues')},'Mark Exempt'),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>bulk({exemptFromDues:false},'Remove Exempt')},'Remove Exempt'),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>bulk({membershipPaid:true},'Mark as Paid')},'Mark Paid'),
            React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>bulk({membershipPaid:false},'Mark as Unpaid')},'Mark Unpaid')),
          React.createElement('div',{className:'table-container'},React.createElement('table',null,
          React.createElement('thead',null,React.createElement('tr',null,['','Name','Email','Phone','Paid','Tag','Spouse','Role','Actions'].map(h=>React.createElement('th',{key:h||'sel'},h)))),
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
              React.createElement('td',null,React.createElement('span',{style:{padding:'2px 8px',borderRadius:12,fontSize:'0.8rem',fontWeight:600,background:m.role==='admin'?'rgba(196,154,60,0.15)':'rgba(39,174,96,0.1)',color:m.role==='admin'?'#c49a3c':'#27ae60'}},m.role||'member')),
              React.createElement('td',{style:{whiteSpace:'nowrap'}},
                !m.exemptFromDues&&!m.membershipPaid&&React.createElement('button',{className:'btn btn-sm btn-primary',style:{padding:'3px 8px',fontSize:'0.75rem',marginRight:4},onClick:()=>openPayModal(m),title:'Record a manual dues payment (cash/check/other) and resolve membership'},'Mark Paid'),
                React.createElement('button',{className:'btn btn-sm btn-outline',style:{padding:'3px 8px',fontSize:'0.75rem',marginRight:4},onClick:()=>resetPassword(m),title:'Email a password-reset link to this member'},'Reset PW'),
                React.createElement('button',{className:'btn btn-sm btn-outline',style:{padding:'3px 8px',fontSize:'0.75rem',marginRight:4},onClick:()=>toggleExempt(m),title:m.exemptFromDues?'Remove exempt flag — they will be billed':'Mark exempt — no dues, no reminders'},m.exemptFromDues?'Un-Exempt':'Exempt'),
                React.createElement('button',{className:'btn btn-sm btn-danger',style:{padding:'3px 8px',fontSize:'0.75rem'},onClick:()=>deleteOne(m),title:'Permanently delete this member'},'🗑')));
          })))));
      })()));
}

// ─── Admin Pledges ───────────────────────────────────────────────
// ─── Admin Settings Center ───────────────────────────────────────
function AdminSettings() {
  const [reminderSettings,setReminderSettings]=useState({enabled:false,membershipEnabled:false,membershipFrequencyDays:30,membershipAmount:0,pledgeEnabled:false,pledgeFrequencyDays:30,pledgeStartAfterDays:7});
  const [sponsorSettings,setSponsorSettings]=useState({kiddushPrice:0,seudasShlishisPrice:0});
  const [membershipSettings,setMembershipSettings]=useState({annualDues:0,fairShareDues:0});
  const [resetting,setResetting]=useState(false);
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
  async function resetMembershipYear(){
    if(!confirm('Start a NEW membership year now?\n\nThis marks EVERY member (except those flagged exempt) as unpaid, so a fresh year of invoices can go out. Members currently on auto-pay keep their subscription.\n\nThis cannot be undone.'))return;
    if(!confirm('Are you sure? Every member will show as dues-not-paid until they pay again.'))return;
    setResetting(true);setMsg('');
    try{const r=await apiFetch('/api/admin/members/reset-membership-year',{method:'POST'});setMsg('New membership year started — '+(r.reset||0)+' members reset'+(r.skipped?', '+r.skipped+' exempt skipped':'')+(r.suppressedRoshHashanahYear?'. The automatic Rosh Hashanah reset is set to skip this year so it won\'t wipe payments received before then.':'')+'.');}catch(e){setMsg('Error: '+e.message);}
    setResetting(false);}
  async function runNow(){setRunning(true);setMsg('');
    try{const res=await apiFetch('/api/admin/run-reminders',{method:'POST'});setMsg(res.message||'Reminders sent!');}catch(e){setMsg('Error: '+e.message);}setRunning(false);}

  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),

    // Automated Reminders
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Automated Email Reminders'),
      React.createElement('p',{style:{marginBottom:16,color:'#555',fontSize:'0.9rem'}},'When enabled, the system automatically sends membership-dues reminders monthly on the 1st at 10:00 AM ET, and pledge reminders monthly on the 1st at 10:00 AM ET. Members with auto-payment enabled are skipped.'),
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
              React.createElement('input',{className:'form-input',type:'number',min:'1',value:reminderSettings.pledgeStartAfterDays,onChange:e=>setReminderSettings(p=>({...p,pledgeStartAfterDays:parseInt(e.target.value)||7}))}))))),
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
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
        React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Standard Annual Dues ($)'),
          React.createElement('input',{className:'form-input',type:'number',value:membershipSettings.annualDues,onChange:e=>setMembershipSettings(p=>({...p,annualDues:parseFloat(e.target.value)||0}))})),
        React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Fair Share Annual Dues ($)'),
          React.createElement('input',{className:'form-input',type:'number',value:membershipSettings.fairShareDues||0,onChange:e=>setMembershipSettings(p=>({...p,fairShareDues:parseFloat(e.target.value)||0}))}),
          React.createElement('p',{style:{fontSize:'0.8rem',color:'#888',margin:'4px 0 0'}},'Optional higher tier members can choose. Set to 0 to hide it.'))),
      React.createElement('button',{className:'btn btn-primary',onClick:saveMembership,style:{marginTop:8}},'Save Membership Settings'),
      React.createElement('div',{style:{marginTop:16,paddingTop:16,borderTop:'1px solid #e0dcd4'}},
        React.createElement('div',{style:{fontWeight:700,color:'#1a2744',marginBottom:4}},'Start a New Membership Year'),
        React.createElement('p',{style:{fontSize:'0.85rem',color:'#666',margin:'0 0 8px'}},'Marks every member (except exempt) as unpaid so you can invoice the new year. Membership also auto-resets at Rosh Hashanah; doing this in the weeks before Rosh Hashanah tells the automatic reset to skip this year so it won\'t wipe early payments.'),
        React.createElement('button',{className:'btn btn-danger',onClick:resetMembershipYear,disabled:resetting},resetting?'Working...':'Start New Membership Year'))));
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
  const [sf,setSf]=useState({date:'',type:'kiddush',firstName:'',lastName:'',email:'',phone:'',dedication:'',sendInvoice:true});
  const [sponsorships,setSponsorships]=useState([]);
  const [pricing,setPricing]=useState({kiddushPrice:0,seudasShlishisPrice:0});
  const [editSp,setEditSp]=useState(null); // {id, type, firstName, lastName, email, phone, dedication, amount}
  useEffect(()=>{load();loadSponsorships();apiFetch('/api/admin/sponsorship-settings').then(setPricing).catch(()=>{});apiFetch('/api/admin/pledge-reasons').then(setPledgeReasons).catch(()=>setPledgeReasons(['Membership Dues','Building Fund','Torah Fund','Kiddush Fund','General Pledge','Other']));},[]);
  async function load(){setLoading(true);try{setPledges(await apiFetch('/api/admin/pledges'));}catch(e){}setLoading(false);}
  async function loadSponsorships(){try{setSponsorships(await apiFetch('/api/admin/sponsorships'));}catch(e){}}
  function priceFor(type){return type==='kiddush'?(pricing.kiddushPrice||0):(pricing.seudasShlishisPrice||0);}
  function startEditSp(s){setEditSp({id:s.id,source:s.source,type:s.type||'kiddush',firstName:s.firstName||'',lastName:s.lastName||'',email:s.email||'',phone:s.phone||'',dedication:s.dedication||'',amount:s.amount!=null?String(s.amount):''});}
  // Switching type updates the amount to that type's price when the current
  // amount still matches the old type's price (so a hand-set amount is kept).
  function changeSpType(newType){setEditSp(p=>{const cur=parseFloat(p.amount);const wasOldPrice=Number.isFinite(cur)&&cur===priceFor(p.type);return {...p,type:newType,amount:wasOldPrice?String(priceFor(newType)):p.amount};});}
  async function saveEditSp(){setMsg('');try{
    const amount=editSp.amount===''?undefined:parseFloat(editSp.amount);
    if(editSp.source==='pledge'){
      // Backed by a bill (no sponsorship doc) — edit the pledge fields directly.
      const body={memberName:((editSp.firstName||'')+' '+(editSp.lastName||'')).trim(),memberEmail:editSp.email,memberPhone:editSp.phone,notes:editSp.dedication?('Dedication: '+editSp.dedication):'',reason:editSp.type==='kiddush'?'Kiddush Sponsorship':'Seudas Shlishis'};
      if(amount!==undefined)body.amount=amount;
      await apiFetch('/api/admin/pledges/'+editSp.id,{method:'PUT',body:JSON.stringify(body)});
    } else {
      await apiFetch('/api/admin/sponsorships/'+editSp.id,{method:'PUT',body:JSON.stringify({type:editSp.type,firstName:editSp.firstName,lastName:editSp.lastName,email:editSp.email,phone:editSp.phone,dedication:editSp.dedication,amount})});
    }
    setMsg('Sponsorship updated.');setEditSp(null);loadSponsorships();load();
  }catch(err){setMsg('Error: '+err.message);}}
  async function delSp(s){if(!confirm('Delete this sponsorship? Its unpaid bill (if any) will be removed too.'))return;try{
    if(s.source==='pledge'){await apiFetch('/api/admin/pledges/'+s.id,{method:'DELETE'});setMsg('Sponsorship bill deleted.');}
    else{const r=await apiFetch('/api/admin/sponsorships/'+s.id,{method:'DELETE'});setMsg('Sponsorship deleted.'+(r.billRemoved?' Linked bill removed.':''));}
    loadSponsorships();load();
  }catch(e){setMsg('Error: '+e.message);}}
  async function add(e){e.preventDefault();setMsg('');try{await apiFetch('/api/admin/pledges',{method:'POST',body:JSON.stringify(form)});setMsg('Pledge added!');setForm({memberName:'',memberEmail:'',amount:'',reason:'',dueDate:'',notes:''});load();}catch(err){setMsg('Error: '+err.message);}}
  async function markPaid(id){if(!confirm('Mark this bill as fully paid? This stops future reminders for it.'))return;try{await apiFetch('/api/admin/pledges/'+id,{method:'PUT',body:JSON.stringify({status:'paid',paidAt:new Date().toISOString()})});load();}catch(e){setMsg('Error: '+e.message);}}
  async function addSponsorship(e){e.preventDefault();setMsg('');
    if(!sf.date||!sf.firstName||!sf.lastName){setMsg('Error: date and name are required');return;}
    try{
      const r=await apiFetch('/api/admin/sponsorships',{method:'POST',body:JSON.stringify({...sf,siteUrl:SITE_URL+'/'})});
      setMsg('Sponsorship added ($'+(r.amount!=null?Number(r.amount).toFixed(2):'?')+'). A bill was created'+(r.invoiceSent?' and emailed':'')+' — record payment in the Donations tab and apply it to this invoice.');
      setSf({date:'',type:'kiddush',firstName:'',lastName:'',email:'',phone:'',dedication:'',sendInvoice:true});
      load();loadSponsorships();
    }catch(err){setMsg('Error: '+err.message);}}
  async function del(id){if(!confirm('Delete?'))return;try{await apiFetch('/api/admin/pledges/'+id,{method:'DELETE'});load();}catch(e){setMsg('Error: '+e.message);}}
  function payLink(p){return SITE_URL+'/'+'#pay?token='+(p.payToken||'');}
  function copyPayLink(p){try{navigator.clipboard.writeText(payLink(p));setMsg('Pay link copied to clipboard.');}catch(e){setMsg('Could not copy: '+e.message);}}
  async function sendInvoiceEmails(){
    if(!confirm('Send a "Pay $X Now" invoice email to every unpaid pledge with a member email? Members already invoiced recently will get a repeat reminder.'))return;
    setMsg('Sending...');
    try{
      const siteUrl=SITE_URL+'/';
      const r=await apiFetch('/api/admin/send-pledge-reminders',{method:'POST',body:JSON.stringify({siteUrl})});
      setMsg('Sent '+(r.sent||0)+' invoice email(s)'+(r.skipped?' ('+r.skipped+' skipped — no email on file)':''));
      load();
    }catch(e){setMsg('Error: '+e.message);}
  }
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Add Kiddush / Seudas Shlishis Sponsorship'),
      React.createElement('p',{style:{color:'#888',fontSize:'0.85rem',marginTop:0,marginBottom:12}},'For recording a sponsorship manually, including after the Wednesday cutoff. Creates the sponsorship plus a bill (invoice). Record payment in the Donations tab and apply it to the bill to mark it paid.'),
      React.createElement('form',{onSubmit:addSponsorship},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Shabbos / Date *'),React.createElement('input',{className:'form-input',type:'date',value:sf.date,onChange:e=>setSf(p=>({...p,date:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Type *'),React.createElement('select',{className:'form-input',value:sf.type,onChange:e=>setSf(p=>({...p,type:e.target.value}))},React.createElement('option',{value:'kiddush'},'Kiddush'),React.createElement('option',{value:'seudasShlishis'},'Seudas Shlishis'))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:sf.firstName,onChange:e=>setSf(p=>({...p,firstName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:sf.lastName,onChange:e=>setSf(p=>({...p,lastName:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:sf.email,onChange:e=>setSf(p=>({...p,email:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:sf.phone,onChange:e=>setSf(p=>({...p,phone:e.target.value}))})),
          React.createElement('div',{className:'form-group',style:{gridColumn:'1 / -1'}},React.createElement('label',{className:'form-label'},'Dedication'),React.createElement('input',{className:'form-input',value:sf.dedication,onChange:e=>setSf(p=>({...p,dedication:e.target.value})),placeholder:'e.g. In honor of...'}))),
        React.createElement('label',{style:{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:'0.9rem'}},React.createElement('input',{type:'checkbox',checked:sf.sendInvoice,onChange:e=>setSf(p=>({...p,sendInvoice:e.target.checked}))}),'Email the sponsor an invoice with a Pay-Now link'),
        React.createElement('button',{className:'btn btn-primary',type:'submit',style:{marginTop:8}},'Add Sponsorship'))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Sponsorships ('+sponsorships.length+')'),
      editSp&&React.createElement('div',{style:{background:'#faf8f3',border:'1px solid #e0dcd4',borderRadius:8,padding:14,marginBottom:14}},
        React.createElement('div',{style:{fontWeight:700,color:'#1a2744',marginBottom:8}},'Edit sponsorship details'),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:10}},
          React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label'},'Type'),
            React.createElement('select',{className:'form-input',value:editSp.type,onChange:e=>changeSpType(e.target.value)},
              React.createElement('option',{value:'kiddush'},'Kiddush'),
              React.createElement('option',{value:'seudasShlishis'},'Seudas Shlishis'))),
          React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label'},'First Name'),React.createElement('input',{className:'form-input',value:editSp.firstName,onChange:e=>setEditSp(p=>({...p,firstName:e.target.value}))})),
          React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label'},'Last Name'),React.createElement('input',{className:'form-input',value:editSp.lastName,onChange:e=>setEditSp(p=>({...p,lastName:e.target.value}))})),
          React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:editSp.email,onChange:e=>setEditSp(p=>({...p,email:e.target.value}))})),
          React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:editSp.phone,onChange:e=>setEditSp(p=>({...p,phone:e.target.value}))})),
          React.createElement('div',{className:'form-group',style:{marginBottom:0}},React.createElement('label',{className:'form-label'},'Amount ($)'),React.createElement('input',{className:'form-input',type:'number',min:'0',step:'0.01',value:editSp.amount,onChange:e=>setEditSp(p=>({...p,amount:e.target.value}))})),
          React.createElement('div',{className:'form-group',style:{marginBottom:0,gridColumn:'1 / -1'}},React.createElement('label',{className:'form-label'},'Dedication'),React.createElement('input',{className:'form-input',value:editSp.dedication,onChange:e=>setEditSp(p=>({...p,dedication:e.target.value}))}))),
        React.createElement('div',{style:{display:'flex',gap:8,marginTop:10}},
          React.createElement('button',{className:'btn btn-primary btn-sm',onClick:saveEditSp},'Save Changes'),
          React.createElement('button',{className:'btn btn-outline btn-sm',onClick:()=>setEditSp(null)},'Cancel')),
        React.createElement('p',{style:{margin:'8px 0 0',fontSize:'0.8rem',color:'#888'}},'Changes also update the linked unpaid bill. Switching type updates the amount to that type’s price (if it was still the old price). The date is fixed — to change it, delete and re-add.')),
      sponsorships.length===0?React.createElement('p',{style:{color:'#888'}},'No sponsorships yet.'):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Date','Type','Sponsor','Dedication','Amount','Status','Actions'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,sponsorships.map(s=>React.createElement('tr',{key:s.id},
          React.createElement('td',null,s.date||'-'),
          React.createElement('td',null,s.type==='kiddush'?'Kiddush':'Seudas Shlishis'),
          React.createElement('td',null,s.displayName||((s.firstName||'')+' '+(s.lastName||'')).trim()||'-'),
          React.createElement('td',{style:{fontSize:'0.85rem',color:'#555',maxWidth:220}},s.dedication||'-'),
          React.createElement('td',{style:{fontWeight:700}},'$'+(s.amount||0).toFixed(2)),
          React.createElement('td',null,React.createElement('span',{style:{padding:'2px 8px',borderRadius:12,fontSize:'0.8rem',fontWeight:600,background:s.status==='paid'?'rgba(39,174,96,0.1)':'rgba(192,57,43,0.1)',color:s.status==='paid'?'#27ae60':'#c0392b'}},s.status==='paid'?'Paid':'Unpaid')),
          React.createElement('td',null,
            React.createElement('button',{className:'btn btn-sm btn-outline',style:{marginRight:4},onClick:()=>startEditSp(s)},'Edit'),
            React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>delSp(s)},'Delete')))))))),
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
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'All Pledges & Billing'),
        React.createElement('button',{className:'btn btn-sm btn-primary',onClick:sendInvoiceEmails,title:'Email every unpaid pledge a "Pay Now" invoice link'},'📧 Send Invoices to All Unpaid')),
      React.createElement('p',{style:{color:'#888',fontSize:'0.85rem',marginTop:8}},'Each unpaid pledge has a unique Pay link. Members get it when invoiced by email; you can also copy it below to share manually.'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      pledges.length===0?React.createElement('p',{style:{color:'#888'}},'No pledges yet.'):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Name','Amount','Reason','Due','Status','Pay Link','Actions'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,pledges.map(p=>React.createElement('tr',{key:p.id},
          React.createElement('td',null,p.memberName||'-'),React.createElement('td',{style:{fontWeight:700}},'$'+(p.amount||0).toFixed(2)),
          React.createElement('td',null,p.reason||'-'),React.createElement('td',null,p.dueDate||'-'),
          React.createElement('td',null,React.createElement('span',{style:{padding:'2px 8px',borderRadius:12,fontSize:'0.8rem',fontWeight:600,background:p.status==='paid'?'rgba(39,174,96,0.1)':'rgba(192,57,43,0.1)',color:p.status==='paid'?'#27ae60':'#c0392b'}},p.status==='paid'?'Paid':'Unpaid')),
          React.createElement('td',null,
            p.status!=='paid'&&p.payToken?React.createElement('button',{className:'btn btn-sm btn-outline',style:{padding:'3px 8px',fontSize:'0.75rem'},onClick:()=>copyPayLink(p),title:payLink(p)},'Copy'):React.createElement('span',{style:{color:'#bbb',fontSize:'0.8rem'}},'—')),
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
  const [jobs,setJobs]=useState([]); // background send jobs (weekly/blast/sponsorship)
  const [msg,setMsg]=useState('');
  const [sending,setSending]=useState(false);
  // Compose form with preview
  const [composeForm,setComposeForm]=useState({subject:'',html:'',targetGroup:'all',personalize:false});
  const [showPreview,setShowPreview]=useState(false);
  // Weekly schedule
  const [weeklyStartDate,setWeeklyStartDate]=useState(getTodayStr());
  const [weeklyEndDate,setWeeklyEndDate]=useState(()=>{const d=new Date(getTodayStr()+'T12:00:00');d.setDate(d.getDate()+6);return d.toISOString().split('T')[0];});
  const [weeklyCustomText,setWeeklyCustomText]=useState('');
  const [weeklySubject,setWeeklySubject]=useState("This Week's Davening Schedule - Congregation Ohr Chaim");
  const [weeklyPreviewHtml,setWeeklyPreviewHtml]=useState('');
  const [weeklyTargetGroup,setWeeklyTargetGroup]=useState('all');
  const [weeklyShiurim,setWeeklyShiurim]=useState([]);
  const [weeklyShiurSel,setWeeklyShiurSel]=useState({}); // {shiurId: bool}
  const [composePdfs,setComposePdfs]=useState([]); // attached flyers for the compose blast
  const [composePdfBusy,setComposePdfBusy]=useState(false);
  const [weeklyPdfs,setWeeklyPdfs]=useState([]); // up to 5 of {name, images:[base64]}
  const [weeklyPdfBusy,setWeeklyPdfBusy]=useState(false);
  // Sponsorship email
  const nextShabbos=(()=>{const d=new Date(getTodayStr()+'T12:00:00');d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));return d.toISOString().split('T')[0];})();
  const [spDate,setSpDate]=useState(nextShabbos);
  const [spKiddush,setSpKiddush]=useState(true);
  const [spSeudas,setSpSeudas]=useState(true);
  const [spOtherOn,setSpOtherOn]=useState(false);
  const [spOtherText,setSpOtherText]=useState('');
  const [spSubject,setSpSubject]=useState('Sponsorship Opportunities - Congregation Ohr Chaim');
  const [spTargetGroup,setSpTargetGroup]=useState('all');
  const [spPreviewHtml,setSpPreviewHtml]=useState('');
  // Holiday-schedule email
  const [holidayList,setHolidayList]=useState([]);
  const [holKey,setHolKey]=useState('');
  const [holSubject,setHolSubject]=useState('');
  const [holCustomText,setHolCustomText]=useState('');
  const [holTargetGroup,setHolTargetGroup]=useState('all');
  const [holPreviewHtml,setHolPreviewHtml]=useState('');
  const [holPdfs,setHolPdfs]=useState([]); // up to 5 flyers {name, images:[base64]}
  const [holPdfBusy,setHolPdfBusy]=useState(false);
  // Template form
  const [tplForm,setTplForm]=useState({name:'',subject:'',html:''});
  // Custom per-member selection (shared between Compose and Weekly)
  const [selectedEmails,setSelectedEmails]=useState({});
  const [pickerFilter,setPickerFilter]=useState('');

  function loadJobs(){return apiFetch('/api/admin/email/jobs').then(setJobs).catch(()=>{});}
  useEffect(()=>{
    apiFetch('/api/admin/email/recipients').then(setRecipients).catch(()=>{});
    apiFetch('/api/admin/email/templates').then(setTemplates).catch(()=>{});
    apiFetch('/api/admin/email/log').then(setLog).catch(()=>{});
    loadJobs();
    apiFetch('/api/shiurim',{cache:'no-store'}).then(list=>{setWeeklyShiurim(list||[]);const sel={};(list||[]).forEach(s=>{sel[s.id]=true;});setWeeklyShiurSel(sel);}).catch(()=>{});
    apiFetch('/api/admin/holidays').then(d=>{const hs=(d.holidays||[]).filter(h=>h.emailEnabled);setHolidayList(hs);if(hs[0]){setHolKey(hs[0].key);setHolSubject(hs[0].name+' Schedule - Congregation Ohr Chaim');}}).catch(()=>{});
  },[]);
  // Auto-refresh the jobs panel while any send is still in progress, and refresh
  // the email log alongside it so delivery results appear without a manual reload.
  useEffect(()=>{
    const active=jobs.some(j=>j.status==='running');
    if(!active) return;
    const t=setInterval(()=>{loadJobs();apiFetch('/api/admin/email/log').then(setLog).catch(()=>{});},5000);
    return ()=>clearInterval(t);
  },[jobs]);
  async function retryJob(id){setMsg('');try{const r=await apiFetch('/api/admin/email/jobs/'+id+'/retry',{method:'POST'});setMsg('Retrying '+(r.requeued||0)+' recipient(s).');loadJobs();setTimeout(loadJobs,3000);}catch(e){setMsg('Error: '+e.message);}}
  async function cancelJob(id){if(!confirm('Cancel this send? Recipients not yet emailed will be skipped.'))return;setMsg('');try{await apiFetch('/api/admin/email/jobs/'+id+'/cancel',{method:'POST'});loadJobs();}catch(e){setMsg('Error: '+e.message);}}

  function getTargetEmails(group){
    const dedupe=list=>[...new Set(list.filter(Boolean))];
    if(group==='custom') return dedupe(Object.keys(selectedEmails).filter(e=>selectedEmails[e]));
    if(group==='members') return dedupe(recipients.filter(r=>r.role==='member').map(r=>r.email));
    if(group==='unpaid') return dedupe(recipients.filter(r=>!r.membershipPaid&&!r.autoPayment&&!r.pending).map(r=>r.email));
    if(group==='admins') return dedupe(recipients.filter(r=>r.role==='admin').map(r=>r.email));
    // 'allPlusPending' and 'resume' target everyone incl. unclaimed invitees.
    if(group==='allPlusPending'||group==='resume') return dedupe(recipients.map(r=>r.email));
    // default 'all' = registered accounts only (excludes pending invitees).
    return dedupe(recipients.filter(r=>!r.pending).map(r=>r.email));
  }
  const pendingCount=recipients.filter(r=>r.pending).length;
  const registeredCount=recipients.length-pendingCount;

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
    e.preventDefault();setMsg('');
    const targetEmails=getTargetEmails(composeForm.targetGroup);
    if(!targetEmails.length){setMsg('No recipients in the selected group.');return;}
    if(!confirm('Send this email to '+targetEmails.length+' recipient'+(targetEmails.length>1?'s':'')+'?'))return;
    setSending(true);
    try{
      const res=await apiFetch('/api/admin/email/send',{method:'POST',body:JSON.stringify({recipients:targetEmails,subject:composeForm.subject,html:composeForm.html,personalize:composeForm.personalize,pdfImages:composePdfs.length?composePdfs.flatMap(p=>p.images):null})});
      setMsg('Queued for '+(res.queued||targetEmails.length)+' recipient'+((res.queued||targetEmails.length)===1?'':'s')+' — sending in the background. Watch progress under "Sending" below.');
      setComposePdfs([]);
      loadJobs();setTimeout(loadJobs,3000);
    }catch(err){setMsg('Error: '+err.message);}
    setSending(false);
  }

  async function previewWeekly(){
    setMsg('');
    try{
      if(weeklyEndDate&&weeklyEndDate<weeklyStartDate){setMsg('End date must be on or after start date.');return;}
      const shiurIds=weeklyShiurim.filter(s=>weeklyShiurSel[s.id]).map(s=>s.id);
      // The backend composes the whole preview (flyer + custom text with link/
      // line-break formatting) exactly as the sent email — no client splicing.
      const res=await apiFetch('/api/admin/email/preview-weekly',{method:'POST',body:JSON.stringify({startDate:weeklyStartDate,endDate:weeklyEndDate,shiurIds,customText:weeklyCustomText,pdfImages:weeklyPdfs.length?weeklyPdfs.flatMap(p=>p.images):null})});
      setWeeklyPreviewHtml(res.html||'');
    }catch(err){setMsg('Error: '+err.message);}
  }

  async function sendWeeklyCustom(){
    setMsg('');
    if(weeklyEndDate&&weeklyEndDate<weeklyStartDate){setMsg('End date must be on or after start date.');return;}
    const targetEmails=getTargetEmails(weeklyTargetGroup);
    if(!targetEmails.length){setMsg('No recipients in the selected group.');return;}
    if(!confirm('Send the weekly schedule email to '+targetEmails.length+' recipient'+(targetEmails.length>1?'s':'')+'?'))return;
    setSending(true);
    try{
      const shiurIds=weeklyShiurim.filter(s=>weeklyShiurSel[s.id]).map(s=>s.id);
      const res=await apiFetch('/api/admin/email/send-weekly-custom',{method:'POST',body:JSON.stringify({recipients:targetEmails,startDate:weeklyStartDate,endDate:weeklyEndDate,customText:weeklyCustomText,subject:weeklySubject,shiurIds,pdfImages:weeklyPdfs.length?weeklyPdfs.flatMap(p=>p.images):null,pdfName:weeklyPdfs.length?weeklyPdfs.map(p=>p.name).join(', '):null})});
      const q=res.queued||targetEmails.length;
      setMsg('Queued for '+q+' recipient'+(q===1?'':'s')+' — sending in the background'+(weeklyPdfs.length?' (flyer'+(weeklyPdfs.length>1?'s':'')+' at the bottom)':'')+'. Watch progress under "Sending" below.');
      loadJobs();setTimeout(loadJobs,3000);
    }catch(err){setMsg('Error: '+err.message);}
    setSending(false);
  }

  function spBody(extra){return JSON.stringify({date:spDate,includeKiddush:spKiddush,includeSeudas:spSeudas,otherText:spOtherOn?spOtherText:null,subject:spSubject,siteUrl:SITE_URL+'/',...extra});}
  async function previewSponsorship(){setMsg('');
    if(!spKiddush&&!spSeudas&&!(spOtherOn&&spOtherText.trim())){setMsg('Pick Kiddush, Seudas Shlishis, or add Other text.');return;}
    try{const res=await apiFetch('/api/admin/email/sponsorship',{method:'POST',body:spBody({preview:true})});setSpPreviewHtml(res.html||'');}catch(err){setMsg('Error: '+err.message);}
  }
  async function sendSponsorship(){setMsg('');
    if(!spKiddush&&!spSeudas&&!(spOtherOn&&spOtherText.trim())){setMsg('Pick Kiddush, Seudas Shlishis, or add Other text.');return;}
    const targetEmails=getTargetEmails(spTargetGroup);
    if(!targetEmails.length){setMsg('No recipients in the selected group.');return;}
    if(!confirm('Send the sponsorship email to '+targetEmails.length+' recipient'+(targetEmails.length>1?'s':'')+'?'))return;
    setSending(true);
    try{
      const res=await apiFetch('/api/admin/email/sponsorship',{method:'POST',body:spBody({recipients:targetEmails})});
      const q=res.queued||targetEmails.length;
      setMsg('Queued for '+q+' recipient'+(q===1?'':'s')+' — sending in the background. Watch progress under "Sending" below.');
      loadJobs();setTimeout(loadJobs,3000);
    }catch(err){setMsg('Error: '+err.message);}
    setSending(false);
  }

  async function previewHolidayEmail(){setMsg('');setHolPreviewHtml('');
    if(!holKey){setMsg('Pick a holiday first.');return;}
    try{const res=await apiFetch('/api/admin/email/holiday',{method:'POST',body:JSON.stringify({key:holKey,customText:holCustomText,pdfImages:holPdfs.length?holPdfs.flatMap(p=>p.images):null,preview:true})});setHolPreviewHtml(res.html||'');if(!(res.occurrences||[]).length)setMsg('Heads up: no upcoming date for this holiday was found in the Jewish calendar, so the email would have no times.');}catch(err){setMsg('Error: '+err.message);}
  }
  async function sendHolidayEmail(){setMsg('');
    if(!holKey){setMsg('Pick a holiday first.');return;}
    const targetEmails=getTargetEmails(holTargetGroup);
    if(!targetEmails.length){setMsg('No recipients in the selected group.');return;}
    const hol=holidayList.find(h=>h.key===holKey);
    if(!confirm('Send the '+(hol?hol.name:'holiday')+' schedule email to '+targetEmails.length+' recipient'+(targetEmails.length>1?'s':'')+'?'))return;
    setSending(true);
    try{
      const res=await apiFetch('/api/admin/email/holiday',{method:'POST',body:JSON.stringify({key:holKey,recipients:targetEmails,subject:holSubject,customText:holCustomText,pdfImages:holPdfs.length?holPdfs.flatMap(p=>p.images):null})});
      const q=res.queued||targetEmails.length;
      setMsg('Queued for '+q+' recipient'+(q===1?'':'s')+' — sending in the background. Watch progress under "Sending" below.');
      loadJobs();setTimeout(loadJobs,3000);
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

  // Live send-progress panel. Every bulk send is a background job; this shows
  // each job's status and progress and lets an admin retry failures or cancel.
  const activeJobs=jobs.filter(j=>j.status==='running');
  function JobsPanel(){
    const statusLabel={running:'Sending…',done:'Sent',errors:'Sent with errors',cancelled:'Cancelled',failed:'Failed'};
    const statusColor={running:'#a05a2c',done:'#27ae60',errors:'#c0392b',cancelled:'#888',failed:'#c0392b'};
    return React.createElement('div',{className:'card'},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
        React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Sending Progress'),
        React.createElement('button',{className:'btn btn-sm btn-outline',onClick:loadJobs},'Refresh')),
      React.createElement('p',{style:{fontSize:'0.85rem',color:'#666',margin:'6px 0 12px'}},'Bulk emails send in the background so you don\'t have to wait. Progress updates automatically; a send that stops partway finishes on its own within a minute — you no longer need to "resume" manually.'),
      jobs.length===0?React.createElement('p',{style:{color:'#888'}},'No recent sends.'):
      React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:8}},
        jobs.map(j=>React.createElement('div',{key:j.id,style:{border:'1px solid #e0dcd4',borderRadius:6,padding:'10px 12px',background:'#faf8f3'}},
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}},
            React.createElement('div',{style:{fontWeight:700,color:'#1a2744',flex:'1 1 200px'}},j.subject||'(no subject)'),
            React.createElement('span',{style:{fontWeight:700,fontSize:'0.82rem',color:statusColor[j.status]||'#555'}},statusLabel[j.status]||j.status)),
          React.createElement('div',{style:{fontSize:'0.85rem',color:'#555',marginTop:4}},
            (j.sentCount||0)+' of '+(j.total||0)+' sent'+(j.failedCount?', '+j.failedCount+' failed':'')+(j.pendingCount?', '+j.pendingCount+' remaining':'')),
          React.createElement('div',{style:{height:6,background:'#e0dcd4',borderRadius:3,marginTop:6,overflow:'hidden'}},
            React.createElement('div',{style:{height:'100%',width:(j.total?Math.round(((j.sentCount||0)+(j.failedCount||0))/j.total*100):0)+'%',background:statusColor[j.status]||'#c49a3c'}})),
          ((j.status==='errors'||j.status==='failed')||j.status==='running')&&React.createElement('div',{style:{marginTop:8,display:'flex',gap:8}},
            (j.status==='errors'||j.status==='failed')&&React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>retryJob(j.id)},'Retry failed ('+(j.failedCount||j.pendingCount||0)+')'),
            j.status==='running'&&React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>cancelJob(j.id)},'Cancel'))))));
  }
  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{style:{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}},
      ['compose','weekly','sponsorship','holiday','templates','sending','log'].map(t=>React.createElement('button',{key:t,className:'btn btn-sm '+(subTab===t?'btn-primary':'btn-outline'),onClick:()=>{setSubTab(t);if(t==='sending')loadJobs();}},
        t==='compose'?'Compose Email':t==='weekly'?'Weekly Schedule':t==='sponsorship'?'Sponsorship Email':t==='holiday'?'Holiday Schedule':t==='templates'?'Templates':t==='sending'?('Sending'+(activeJobs.length?' ('+activeJobs.length+')':'')):'Email Log'))),
    // Always surface an in-progress send banner, even off the Sending tab.
    activeJobs.length>0&&subTab!=='sending'&&React.createElement('div',{className:'message message-success',style:{cursor:'pointer'},onClick:()=>setSubTab('sending')},
      activeJobs.length+' send'+(activeJobs.length>1?'s':'')+' in progress — click to view progress.'),

    subTab==='sending'&&JobsPanel(),

    // ── Compose with live preview ──
    subTab==='compose'&&React.createElement('div',null,
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Compose Email'),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Send To'),
          React.createElement('select',{className:'form-input',value:composeForm.targetGroup,onChange:e=>setComposeForm(p=>({...p,targetGroup:e.target.value}))},
            React.createElement('option',{value:'all'},'All Members ('+registeredCount+')'),
            React.createElement('option',{value:'allPlusPending'},'All + pending invites ('+recipients.length+')'),
            React.createElement('option',{value:'members'},'Members Only'),
            React.createElement('option',{value:'unpaid'},'Unpaid Members'),
            React.createElement('option',{value:'admins'},'Admins Only'),
            React.createElement('option',{value:'custom'},'Pick specific members...')),
          composeForm.targetGroup==='custom'&&MemberPicker()),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),
          React.createElement('input',{className:'form-input',value:composeForm.subject,onChange:e=>setComposeForm(p=>({...p,subject:e.target.value}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email Body (HTML)'),
          EditorToolbar('composeHtmlTA',composeForm.html,v=>setComposeForm(p=>({...p,html:v}))),
          React.createElement('textarea',{id:'composeHtmlTA',className:'form-input',rows:12,value:composeForm.html,onChange:e=>setComposeForm(p=>({...p,html:e.target.value})),style:{fontFamily:'monospace',fontSize:'0.85rem'}})),
        React.createElement('label',{style:{display:'flex',alignItems:'center',gap:8,margin:'8px 0',fontSize:'0.9rem'}},
          React.createElement('input',{type:'checkbox',checked:!!composeForm.personalize,onChange:e=>setComposeForm(p=>({...p,personalize:e.target.checked}))}),
          React.createElement('span',null,'Personalize with each member’s name — put ',React.createElement('code',null,'[Member Name]'),' in the body and it becomes each recipient’s name (“Member” if none on file).')),
        React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',margin:'10px 0',padding:'10px 12px',background:'#faf8f3',borderRadius:6,border:'1px solid #e0dcd4'}},
          composePdfs.length<5&&React.createElement('label',{className:'btn btn-outline btn-sm',style:{cursor:composePdfBusy?'wait':'pointer',margin:0,opacity:composePdfBusy?0.6:1}},composePdfBusy?'Rendering…':(composePdfs.length?'Add another attachment':'Attach flyer (PDF or JPEG)'),
            React.createElement('input',{type:'file',accept:'application/pdf,image/jpeg,image/png',multiple:true,disabled:composePdfBusy,style:{display:'none'},onChange:async e=>{
              const files=Array.from(e.target.files||[]);e.target.value='';
              if(!files.length)return;
              setComposePdfBusy(true);setMsg('Rendering attachment'+(files.length>1?'s':'')+'…');
              const r=await processFlyerFiles(files,composePdfs);
              if(r.error){setMsg(r.error);setComposePdfBusy(false);return;}
              setComposePdfs(r.next);
              setMsg((r.warnings.length?r.warnings.join(' ')+' ':'')+'Attachment'+(r.next.length>1?'s':'')+' ready ('+r.next.length+' of 5) — shown at the bottom of the email.');
              setComposePdfBusy(false);
            }})),
          composePdfs.length>0&&React.createElement('span',{style:{fontSize:'0.85rem',color:'#555',display:'flex',flexWrap:'wrap',gap:'2px 14px'}},
            composePdfs.map((p,i)=>React.createElement('span',{key:i},'📎 '+p.name+' ('+p.images.length+'p) ',
              React.createElement('a',{href:'#',onClick:e=>{e.preventDefault();setComposePdfs(prev=>prev.filter((_,j)=>j!==i));},style:{color:'#c0392b',marginLeft:4}},'remove')))),
          React.createElement('span',{style:{fontSize:'0.78rem',color:'#888',flexBasis:'100%'}},'JPEG/PNG/PDF attachments display reliably in the email. (“Upload Image” inserts a picture into the body, which some email apps hide.)')),
        React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
          React.createElement('button',{type:'button',className:'btn btn-outline',onClick:()=>handleImageUpload('compose')},'Upload Image'),
          React.createElement('button',{type:'button',className:'btn btn-outline',onClick:()=>setShowPreview(!showPreview)},showPreview?'Hide Preview':'Preview Email'),
          React.createElement('button',{className:'btn btn-primary',onClick:sendBlast,disabled:sending||!composeForm.subject},sending?'Sending...':'Send to '+getTargetEmails(composeForm.targetGroup).length+' recipients'))),
      showPreview&&React.createElement('div',{className:'card',style:{marginTop:12}},
        React.createElement('div',{className:'card-header'},'Email Preview'),
        React.createElement('iframe',{title:'Email preview',sandbox:'',srcDoc:(emailTextToHtml(composeForm.html)||'')+(composePdfs.length?'<div style="margin-top:16px;">'+composePdfs.flatMap(p=>p.images).map(b=>'<img src="data:image/jpeg;base64,'+b+'" style="max-width:100%;display:block;margin:0 auto 12px;">').join('')+'</div>':''),style:{width:'100%',height:420,border:'1px solid #e0dcd4',borderRadius:6,background:'#fff'}}))),

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
              React.createElement('option',{value:'all'},'All ('+registeredCount+')'),
              React.createElement('option',{value:'allPlusPending'},'All + pending invites ('+recipients.length+')'),
              React.createElement('option',{value:'members'},'Members'),
              React.createElement('option',{value:'admins'},'Admins'),
              React.createElement('option',{value:'custom'},'Pick specific members...'))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),
            React.createElement('input',{className:'form-input',value:weeklySubject,onChange:e=>setWeeklySubject(e.target.value)}))),
        weeklyTargetGroup==='custom'&&MemberPicker(),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Custom Message (appears just under the davening schedule, above shiurim/sponsorships)'),
          EditorToolbar('weeklyCustomTA',weeklyCustomText,setWeeklyCustomText),
          React.createElement('textarea',{id:'weeklyCustomTA',className:'form-input',rows:6,value:weeklyCustomText,onChange:e=>setWeeklyCustomText(e.target.value),placeholder:'Add announcements, images, or any custom content here... Paragraphs, links, and HTML all work.'})),
        React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:16,alignItems:'center',marginTop:12,padding:'10px 12px',background:'#faf8f3',borderRadius:6,border:'1px solid #e0dcd4'}},
          React.createElement('div',{style:{flexBasis:'100%'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:6}},
              React.createElement('span',{style:{fontSize:'0.9rem',fontWeight:600}},'Include shiurim in this email:'),
              weeklyShiurim.length>0&&React.createElement('a',{href:'#',style:{fontSize:'0.8rem',color:'#c49a3c'},onClick:e=>{e.preventDefault();const all={};weeklyShiurim.forEach(s=>{all[s.id]=true;});setWeeklyShiurSel(all);}},'All'),
              weeklyShiurim.length>0&&React.createElement('a',{href:'#',style:{fontSize:'0.8rem',color:'#c49a3c'},onClick:e=>{e.preventDefault();setWeeklyShiurSel({});}},'None')),
            weeklyShiurim.length===0?React.createElement('span',{style:{fontSize:'0.85rem',color:'#888'}},'No shiurim on file.'):
            React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px 16px'}},
              weeklyShiurim.map(s=>React.createElement('label',{key:s.id,style:{display:'flex',alignItems:'center',gap:6,fontSize:'0.85rem'}},
                React.createElement('input',{type:'checkbox',checked:!!weeklyShiurSel[s.id],onChange:e=>setWeeklyShiurSel(p=>({...p,[s.id]:e.target.checked}))}),
                (DAY_NAMES[s.dayOfWeek]?DAY_NAMES[s.dayOfWeek].slice(0,3)+' ':'')+s.title+(s.time?' ('+s.time+')':''))))),
          weeklyPdfs.length<5&&React.createElement('label',{className:'btn btn-outline btn-sm',style:{cursor:weeklyPdfBusy?'wait':'pointer',margin:0,opacity:weeklyPdfBusy?0.6:1}},weeklyPdfBusy?'Rendering…':(weeklyPdfs.length?'Add another flyer':'Attach flyer (PDF or JPEG)'),
            React.createElement('input',{type:'file',accept:'application/pdf,image/jpeg,image/png',multiple:true,disabled:weeklyPdfBusy,style:{display:'none'},onChange:async e=>{
              const files=Array.from(e.target.files||[]);e.target.value='';
              if(!files.length)return;
              if(weeklyPdfs.length+files.length>5){setMsg('Up to 5 flyers per email — you have '+weeklyPdfs.length+' attached and picked '+files.length+' more.');return;}
              const okTypes=['application/pdf','image/jpeg','image/png'];
              for(const f of files){
                if(!okTypes.includes(f.type)){setMsg('"'+f.name+'" is not a PDF or JPEG/PNG image.');return;}
                if(f.size>15*1024*1024){setMsg('"'+f.name+'" is too large (max 15MB per file).');return;}
              }
              setWeeklyPdfBusy(true);setMsg('Rendering flyer'+(files.length>1?'s':'')+'…');
              try{
                const added=[];
                const warnings=[];
                for(const f of files){
                  const images=f.type==='application/pdf'?await renderPdfToImages(f):[await renderImageToJpeg(f)];
                  if(!images.length){setMsg('Could not read "'+f.name+'".');setWeeklyPdfBusy(false);return;}
                  if(images.truncated)warnings.push('"'+f.name+'" has '+images.totalPages+' pages; only the first '+images.length+' were attached.');
                  added.push({name:f.name,images});
                }
                const next=[...weeklyPdfs,...added];
                // Guard against a doomed send: the whole payload (all flyers'
                // base64 JPEG pages) must fit under the backend's 25MB JSON body
                // limit. Warn now rather than let the send fail after the fact.
                const bytes=next.reduce((sum,p)=>sum+p.images.reduce((s,b64)=>s+b64.length,0),0);
                if(bytes>20*1024*1024){
                  setMsg('Those flyers total ~'+Math.round(bytes/1048576)+'MB, which is too large to email reliably. Remove one, or use fewer/lower-resolution pages.');
                  setWeeklyPdfBusy(false);return;
                }
                setWeeklyPdfs(next);
                setWeeklyPreviewHtml(''); // stale — force a fresh preview after the flyer set changed
                const total=next.length;
                setMsg((warnings.length?warnings.join(' ')+' ':'')+'Flyer'+(total>1?'s':'')+' ready ('+total+' of 5) — shown at the bottom of the email in the order listed.');
              }catch(err){setMsg('Flyer error: '+err.message);}
              setWeeklyPdfBusy(false);
            }})),
          weeklyPdfs.length>0&&React.createElement('span',{style:{fontSize:'0.85rem',color:'#555',display:'flex',flexWrap:'wrap',gap:'2px 14px'}},
            weeklyPdfs.map((p,i)=>React.createElement('span',{key:i},'📄 '+p.name+' ('+p.images.length+'p) ',
              React.createElement('a',{href:'#',onClick:e=>{e.preventDefault();setWeeklyPdfs(prev=>prev.filter((_,j)=>j!==i));setWeeklyPreviewHtml('');},style:{color:'#c0392b',marginLeft:4}},'remove'))))),
        React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
          React.createElement('button',{type:'button',className:'btn btn-outline',onClick:()=>handleImageUpload('weekly')},'Upload Image'),
          React.createElement('button',{className:'btn btn-outline',onClick:previewWeekly},'Generate Preview'),
          React.createElement('button',{className:'btn btn-primary',onClick:sendWeeklyCustom,disabled:sending},sending?'Sending...':'Send Weekly Email'))),
      weeklyPreviewHtml&&React.createElement('div',{className:'card',style:{marginTop:12}},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Preview'),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>setWeeklyPreviewHtml('')},'Close')),
        React.createElement('iframe',{title:'Weekly email preview',sandbox:'',srcDoc:weeklyPreviewHtml||'',style:{width:'100%',height:600,border:'1px solid #e0dcd4',borderRadius:6,background:'#fff',marginTop:12}}))),

    // ── Sponsorship email ──
    subTab==='sponsorship'&&React.createElement('div',null,
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Sponsorship Email'),
        React.createElement('p',{style:{marginTop:0,color:'#555',fontSize:'0.9rem'}},'Choose what to include. Kiddush / Seudas Shlishis pull that Shabbos’s status — the sponsor if booked, or an "available, sponsor it" appeal with price + link if open.'),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Shabbos / Date'),
            React.createElement('input',{className:'form-input',type:'date',value:spDate,onChange:e=>setSpDate(e.target.value)})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Send To'),
            React.createElement('select',{className:'form-input',value:spTargetGroup,onChange:e=>setSpTargetGroup(e.target.value)},
              React.createElement('option',{value:'all'},'All ('+registeredCount+')'),
              React.createElement('option',{value:'allPlusPending'},'All + pending invites ('+recipients.length+')'),
              React.createElement('option',{value:'members'},'Members'),
              React.createElement('option',{value:'admins'},'Admins'),
              React.createElement('option',{value:'custom'},'Pick specific members...'))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),
            React.createElement('input',{className:'form-input',value:spSubject,onChange:e=>setSpSubject(e.target.value)}))),
        spTargetGroup==='custom'&&MemberPicker(),
        React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:16,alignItems:'center',marginTop:6,padding:'10px 12px',background:'#faf8f3',borderRadius:6,border:'1px solid #e0dcd4'}},
          React.createElement('span',{style:{fontWeight:600,fontSize:'0.9rem'}},'Include:'),
          React.createElement('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:'0.9rem'}},React.createElement('input',{type:'checkbox',checked:spKiddush,onChange:e=>setSpKiddush(e.target.checked)}),'Kiddush'),
          React.createElement('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:'0.9rem'}},React.createElement('input',{type:'checkbox',checked:spSeudas,onChange:e=>setSpSeudas(e.target.checked)}),'Seudas Shlishis'),
          React.createElement('label',{style:{display:'flex',alignItems:'center',gap:6,fontSize:'0.9rem'}},React.createElement('input',{type:'checkbox',checked:spOtherOn,onChange:e=>setSpOtherOn(e.target.checked)}),'Other')),
        spOtherOn&&React.createElement('div',{className:'form-group',style:{marginTop:12}},React.createElement('label',{className:'form-label'},'Other — custom content'),
          EditorToolbar('spOtherTA',spOtherText,setSpOtherText),
          React.createElement('textarea',{id:'spOtherTA',className:'form-input',rows:5,value:spOtherText,onChange:e=>setSpOtherText(e.target.value),placeholder:'Add any other sponsorship (e.g. Shalosh Seudos, flowers, a yahrzeit, an appeal...). Paragraphs, links, and HTML all work.'})),
        React.createElement('div',{style:{display:'flex',gap:8,marginTop:12}},
          React.createElement('button',{className:'btn btn-outline',onClick:previewSponsorship},'Generate Preview'),
          React.createElement('button',{className:'btn btn-primary',onClick:sendSponsorship,disabled:sending},sending?'Sending...':'Send Sponsorship Email'))),
      spPreviewHtml&&React.createElement('div',{className:'card',style:{marginTop:12}},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Preview'),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>setSpPreviewHtml('')},'Close')),
        React.createElement('iframe',{title:'Sponsorship email preview',sandbox:'',srcDoc:spPreviewHtml||'',style:{width:'100%',height:500,border:'1px solid #e0dcd4',borderRadius:6,background:'#fff',marginTop:12}}))),

    // ── Holiday schedule email ──
    subTab==='holiday'&&React.createElement('div',null,
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Holiday Schedule Email'),
        holidayList.length===0?React.createElement('p',{style:{color:'#888'}},'No holidays are set up for email yet. Go to the “Jewish Holidays” tab, fill in a holiday\'s times, and turn on “Offer holiday email”.'):
        React.createElement('div',null,
          React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',gap:12}},
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Holiday'),
              React.createElement('select',{className:'form-input',value:holKey,onChange:e=>{const k=e.target.value;setHolKey(k);setHolPreviewHtml('');const h=holidayList.find(x=>x.key===k);if(h)setHolSubject(h.name+' Schedule - Congregation Ohr Chaim');}},
                holidayList.map(h=>React.createElement('option',{key:h.key,value:h.key},h.name)))),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Send To'),
              React.createElement('select',{className:'form-input',value:holTargetGroup,onChange:e=>setHolTargetGroup(e.target.value)},
                React.createElement('option',{value:'all'},'All ('+registeredCount+')'),
                React.createElement('option',{value:'allPlusPending'},'All + pending invites ('+recipients.length+')'),
                React.createElement('option',{value:'members'},'Members'),
                React.createElement('option',{value:'admins'},'Admins'),
                React.createElement('option',{value:'custom'},'Pick specific members...'))),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Subject'),
              React.createElement('input',{className:'form-input',value:holSubject,onChange:e=>setHolSubject(e.target.value)}))),
          holTargetGroup==='custom'&&MemberPicker(),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Custom message (optional, appears above the schedule)'),
            React.createElement('textarea',{className:'form-input',rows:4,value:holCustomText,onChange:e=>setHolCustomText(e.target.value),placeholder:'Add an announcement here... Paragraphs and links work.'})),
          React.createElement('p',{style:{fontSize:'0.82rem',color:'#666'}},'The schedule times are pulled automatically from what you set on the “Jewish Holidays” tab, for this holiday\'s next occurrence in the Jewish calendar.'),
          React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',marginTop:6,padding:'10px 12px',background:'#faf8f3',borderRadius:6,border:'1px solid #e0dcd4'}},
            holPdfs.length<5&&React.createElement('label',{className:'btn btn-outline btn-sm',style:{cursor:holPdfBusy?'wait':'pointer',margin:0,opacity:holPdfBusy?0.6:1}},holPdfBusy?'Rendering…':(holPdfs.length?'Add another flyer':'Attach flyer (PDF or JPEG)'),
              React.createElement('input',{type:'file',accept:'application/pdf,image/jpeg,image/png',multiple:true,disabled:holPdfBusy,style:{display:'none'},onChange:async e=>{
                const files=Array.from(e.target.files||[]);e.target.value='';
                if(!files.length)return;
                setHolPdfBusy(true);setMsg('Rendering flyer'+(files.length>1?'s':'')+'…');
                const r=await processFlyerFiles(files,holPdfs);
                if(r.error){setMsg(r.error);setHolPdfBusy(false);return;}
                setHolPdfs(r.next);setHolPreviewHtml('');
                setMsg((r.warnings.length?r.warnings.join(' ')+' ':'')+'Flyer'+(r.next.length>1?'s':'')+' ready ('+r.next.length+' of 5) — shown at the bottom of the email.');
                setHolPdfBusy(false);
              }})),
            holPdfs.length>0&&React.createElement('span',{style:{fontSize:'0.85rem',color:'#555',display:'flex',flexWrap:'wrap',gap:'2px 14px'}},
              holPdfs.map((p,i)=>React.createElement('span',{key:i},'📄 '+p.name+' ('+p.images.length+'p) ',
                React.createElement('a',{href:'#',onClick:e=>{e.preventDefault();setHolPdfs(prev=>prev.filter((_,j)=>j!==i));setHolPreviewHtml('');},style:{color:'#c0392b',marginLeft:4}},'remove'))))),
          React.createElement('div',{style:{display:'flex',gap:8,marginTop:8}},
            React.createElement('button',{className:'btn btn-outline',onClick:previewHolidayEmail},'Generate Preview'),
            React.createElement('button',{className:'btn btn-primary',onClick:sendHolidayEmail,disabled:sending},sending?'Sending...':'Send Holiday Email')))),
      holPreviewHtml&&React.createElement('div',{className:'card',style:{marginTop:12}},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',{className:'card-header',style:{marginBottom:0,paddingBottom:0,borderBottom:'none'}},'Preview'),
          React.createElement('button',{className:'btn btn-sm btn-outline',onClick:()=>setHolPreviewHtml('')},'Close')),
        React.createElement('iframe',{title:'Holiday email preview',sandbox:'',srcDoc:holPreviewHtml||'',style:{width:'100%',height:560,border:'1px solid #e0dcd4',borderRadius:6,background:'#fff',marginTop:12}}))),

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

  const truncatedNotice=data.truncated&&React.createElement('div',{className:'message message-error',style:{marginBottom:12}},'Showing the most recent 10,000 donations. Older records exist; narrow your date range to see them.');
  const topDonors=Object.entries(data.byPerson||{}).sort((a,b)=>b[1].total-a[1].total);
  const byMonthArr=Object.entries(data.byMonth||{}).sort((a,b)=>a[0].localeCompare(b[0]));
  const byReasonArr=Object.entries(data.byReason||{}).sort((a,b)=>b[1].total-a[1].total);
  const byMethodArr=Object.entries(data.byMethod||{}).sort((a,b)=>b[1].total-a[1].total);

  return React.createElement('div',null,
    truncatedNotice,
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
      // Render at most 500 rows in the DOM. Rendering all of them (up to
      // 10,000) created ~60k DOM nodes and froze the tab. Totals above are
      // computed server-side over the full set, so they stay accurate.
      (data.donations||[]).length>500&&React.createElement('div',{className:'message',style:{marginBottom:12,color:'#888'}},'Showing the first 500 of '+(data.donations||[]).length+' transactions in this range. Narrow the date range to see specific records.'),
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['Date','Name','Amount','Category','Method','Note'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,(data.donations||[]).slice(0,500).map(d=>React.createElement('tr',{key:d.id},
          React.createElement('td',null,d.createdAt?.substring(0,10)||'-'),
          React.createElement('td',{style:{cursor:'pointer',color:'#2980b9'},onClick:()=>{setSelectedPerson(d.displayName);setView('byDonor');}},d.displayName||'-'),
          React.createElement('td',{style:{fontWeight:700}},'$'+(d.amount||0).toFixed(2)),
          React.createElement('td',null,d.reason||'-'),React.createElement('td',null,d.paymentMethod||'-'),
          React.createElement('td',{style:{fontSize:'0.85rem',color:'#888'}},d.note||'-'))))))));
}

// ─── High Holiday Seats Page (Public) ────────────────────────────
function HighHolidaySeatsPage() {
  const [data,setData]=useState(null);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');const [done,setDone]=useState(false);
  const [form,setForm]=useState({firstName:'',lastName:'',email:'',phone:'',mensSeats:'1',womensSeats:'0',notes:''});
  const [payMethod,setPayMethod]=useState('card'); // 'card' | 'check'
  const [submitting,setSubmitting]=useState(false);
  const cardMountRef=useRef(null);const stripeRef=useRef(null);const cardElementRef=useRef(null);const paidPiRef=useRef(null);
  useEffect(()=>{apiFetch('/api/high-holidays/seats').then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));},[]);
  function upd(k,v){setForm(p=>({...p,[k]:v}));}
  // Mount the Stripe card field only when paying by card (and the form is open).
  useEffect(()=>{
    if(loading||done||!data?.settings?.enabled||payMethod!=='card') return;
    if(!window.Stripe){return;}
    if(cardElementRef.current) return;
    const stripe=window.Stripe(STRIPE_PUBLISHABLE_KEY);
    const card=stripe.elements().create('card',{style:{base:{fontSize:'18px',color:'#1a2744',fontFamily:'inherit','::placeholder':{color:'#888'}},invalid:{color:'#b00020'}}});
    let mounted=false;const mount=()=>{if(mounted)return;if(cardMountRef.current){card.mount(cardMountRef.current);mounted=true;}else setTimeout(mount,50);};mount();
    stripeRef.current=stripe;cardElementRef.current=card;
    return ()=>{try{card.destroy();}catch{}cardElementRef.current=null;};
  },[loading,done,data,payMethod]);

  async function handleReserve(e){
    e.preventDefault();setMsg('');
    const nSeats=(parseInt(form.mensSeats||0)||0)+(parseInt(form.womensSeats||0)||0);
    if(nSeats<1){setMsg('Please choose at least one seat.');return;}
    const total=(data.settings.seatPrice||0)*nSeats;
    setSubmitting(true);
    try{
      if(payMethod==='check'||total<=0){
        await apiFetch('/api/high-holidays/reserve',{method:'POST',body:JSON.stringify({...form,paymentMethod:total>0?'check':'free'})});
        setDone(true);setSubmitting(false);return;
      }
      // Card: pay first, then reserve with the verified PaymentIntent. Reuse a
      // succeeded PI on retry so a network blip can't double-charge.
      if(!stripeRef.current||!cardElementRef.current){setMsg('Payment form is still loading. Please wait a moment and try again.');setSubmitting(false);return;}
      let piId=paidPiRef.current;
      if(!piId){
        const pi=await apiFetch('/api/donations/create-payment',{method:'POST',body:JSON.stringify({amount:total,firstName:form.firstName,lastName:form.lastName,email:form.email,phone:form.phone,reason:'High Holiday Seats',type:'highHolidaySeats'})});
        const result=await stripeRef.current.confirmCardPayment(pi.clientSecret,{payment_method:{card:cardElementRef.current,billing_details:{name:(form.firstName+' '+form.lastName).trim(),email:form.email}}});
        if(result.error){setMsg(result.error.message||'Payment failed. Please check your card details.');setSubmitting(false);return;}
        if(result.paymentIntent?.status!=='succeeded'){setMsg('Payment did not complete. Status: '+(result.paymentIntent?.status||'unknown'));setSubmitting(false);return;}
        piId=result.paymentIntent.id;paidPiRef.current=piId;
      }
      await apiFetch('/api/high-holidays/reserve',{method:'POST',body:JSON.stringify({...form,paymentMethod:'stripe',paymentIntentId:piId})});
      paidPiRef.current=null;setDone(true);
    }catch(err){
      setMsg(paidPiRef.current?'Your card was charged, but saving the reservation hit a snag. Please click Reserve once more to finish — you will NOT be charged again.':('Error: '+err.message));
    }
    setSubmitting(false);
  }
  if(loading) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Loading...');
  if(done) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:40,maxWidth:600,margin:'0 auto'}},
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'Reservation '+(payMethod==='check'?'Received!':'Confirmed!')),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Your '+((parseInt(form.mensSeats||0)||0)+(parseInt(form.womensSeats||0)||0))+' seat(s) have been reserved.'+(payMethod==='check'?' Please mail your check to the office to complete payment. The office will assign your specific seats.':' The office will assign your specific seats.')),
    React.createElement('button',{className:'btn btn-primary',style:{marginTop:20},onClick:()=>{setDone(false);setForm({firstName:'',lastName:'',email:'',phone:'',mensSeats:'1',womensSeats:'0',notes:''});}},'Back'));
  if(!data?.settings?.enabled) return React.createElement('div',{className:'card',style:{textAlign:'center',padding:40,maxWidth:600,margin:'0 auto'}},
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'High Holiday Seats'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Seat reservations are not currently open.'));
  const total=(data.settings.seatPrice||0)*((parseInt(form.mensSeats||0)||0)+(parseInt(form.womensSeats||0)||0));
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
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},"Men's Seats"),React.createElement('input',{className:'form-input',type:'number',min:'0',value:form.mensSeats,onChange:e=>upd('mensSeats',e.target.value)})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},"Women's Seats"),React.createElement('input',{className:'form-input',type:'number',min:'0',value:form.womensSeats,onChange:e=>upd('womensSeats',e.target.value)})),
          React.createElement('div',{className:'form-group',style:{gridColumn:'1 / -1'}},React.createElement('label',{className:'form-label'},'Notes'),React.createElement('input',{className:'form-input',value:form.notes,onChange:e=>upd('notes',e.target.value)}))),
        React.createElement('div',{style:{background:'#faf8f3',padding:12,borderRadius:8,margin:'12px 0',textAlign:'center'}},
          React.createElement('span',{style:{fontSize:'1.1rem',fontWeight:700}},'Total: $'+total.toFixed(2))),
        total>0&&React.createElement('div',{style:{margin:'12px 0'}},
          React.createElement('div',{style:{fontWeight:700,marginBottom:6}},'How would you like to pay?'),
          React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}},
            React.createElement('label',{style:{flex:'1 1 180px',display:'flex',alignItems:'center',gap:8,padding:'10px 12px',border:'1px solid '+(payMethod==='card'?'#c49a3c':'#e0dcd4'),borderRadius:6,cursor:'pointer',background:payMethod==='card'?'rgba(196,154,60,0.08)':'#fff'}},
              React.createElement('input',{type:'radio',name:'payMethod',checked:payMethod==='card',onChange:()=>setPayMethod('card')}),'Pay now by card'),
            React.createElement('label',{style:{flex:'1 1 180px',display:'flex',alignItems:'center',gap:8,padding:'10px 12px',border:'1px solid '+(payMethod==='check'?'#c49a3c':'#e0dcd4'),borderRadius:6,cursor:'pointer',background:payMethod==='check'?'rgba(196,154,60,0.08)':'#fff'}},
              React.createElement('input',{type:'radio',name:'payMethod',checked:payMethod==='check',onChange:()=>setPayMethod('check')}),'Reserve now, mail a check')),
          payMethod==='card'&&React.createElement('div',{ref:cardMountRef,style:{padding:'14px',border:'1px solid #d4cfc4',borderRadius:8,background:'#fff',minHeight:52}}),
          payMethod==='check'&&React.createElement('p',{style:{fontSize:'0.9rem',color:'#666',margin:0}},'Your seats will be held. Please mail a check for $'+total.toFixed(2)+' to the office to complete your reservation.')),
        React.createElement('button',{className:'btn btn-primary btn-block',type:'submit',disabled:submitting},submitting?'Processing...':(total>0&&payMethod==='card'?'Pay $'+total.toFixed(2)+' & Reserve':'Reserve Seats')))));
}

// ─── Admin High Holidays ─────────────────────────────────────────
function AdminHighHolidays() {
  const [subTab,setSubTab]=useState('settings');
  const [settings,setSettings]=useState({seatPrice:0,totalSeats:100,enabled:false,rows:10,seatsPerRow:10});
  const [reservations,setReservations]=useState([]);
  const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');
  const [addForm,setAddForm]=useState({firstName:'',lastName:'',email:'',phone:'',mensSeats:'1',womensSeats:'0',paymentMethod:'check',amount:'',notes:''});
  const [adding,setAdding]=useState(false);
  const addSeatTotal=(parseInt(addForm.mensSeats||0)||0)+(parseInt(addForm.womensSeats||0)||0);
  const [editRes,setEditRes]=useState(null); // {id, firstName, lastName, email, phone, numSeats, paymentMethod, amount, notes}

  useEffect(()=>{load();},[]);
  async function load(){setLoading(true);
    try{setSettings(await apiFetch('/api/admin/high-holidays/settings'));}catch(e){}
    try{setReservations(await apiFetch('/api/admin/high-holidays/reservations'));}catch(e){}
    setLoading(false);}

  async function saveSettings(){setMsg('');
    try{await apiFetch('/api/admin/high-holidays/settings',{method:'PUT',body:JSON.stringify(settings)});setMsg('Settings saved!');}catch(e){setMsg('Error: '+e.message);}}
  async function addReservation(e){e.preventDefault();if(adding)return;setMsg('');
    if(!addForm.firstName||!addForm.lastName||addSeatTotal<1){setMsg('First name, last name, and at least one seat are required.');return;}
    setAdding(true);
    try{
      await apiFetch('/api/admin/high-holidays/reservations',{method:'POST',body:JSON.stringify(addForm)});
      setMsg('Reservation added.');
      setAddForm({firstName:'',lastName:'',email:'',phone:'',mensSeats:'1',womensSeats:'0',paymentMethod:'check',amount:'',notes:''});
      await load();
    }catch(e){setMsg('Error: '+e.message);}
    setAdding(false);}
  function startEditRes(r){setEditRes({id:r.id,firstName:r.firstName||'',lastName:r.lastName||'',email:r.email||'',phone:r.phone||'',mensSeats:String(r.mensSeats!=null?r.mensSeats:(r.numSeats||0)),womensSeats:String(r.womensSeats!=null?r.womensSeats:0),paymentMethod:r.paymentMethod||'pending',amount:r.totalAmount!=null?String(r.totalAmount):'',notes:r.notes||''});}
  async function saveEditRes(){setMsg('');
    const tot=(parseInt(editRes.mensSeats||0)||0)+(parseInt(editRes.womensSeats||0)||0);
    if(!editRes.firstName||!editRes.lastName||tot<1){setMsg('First name, last name, and at least one seat are required.');return;}
    try{
      await apiFetch('/api/admin/high-holidays/reservations/'+editRes.id,{method:'PUT',body:JSON.stringify({firstName:editRes.firstName,lastName:editRes.lastName,email:editRes.email,phone:editRes.phone,mensSeats:editRes.mensSeats,womensSeats:editRes.womensSeats,paymentMethod:editRes.paymentMethod,amount:editRes.amount,notes:editRes.notes})});
      setMsg('Reservation updated.');setEditRes(null);await load();
    }catch(e){setMsg('Error: '+e.message);}}
  async function delReservation(r){
    if(!confirm('Delete '+(r.displayName||'this')+' reservation ('+r.numSeats+' seat'+(r.numSeats>1?'s':'')+')? Any assigned seats will be freed.'))return;
    try{await apiFetch('/api/admin/high-holidays/reservations/'+r.id,{method:'DELETE'});await load();}catch(e){setMsg('Error: '+e.message);}}

  const totalReserved=reservations.reduce((s,r)=>s+(r.numSeats||0),0);
  const totalMen=reservations.reduce((s,r)=>s+(r.mensSeats||0),0);
  const totalWomen=reservations.reduce((s,r)=>s+(r.womensSeats||0),0);
  const totalRevenue=reservations.reduce((s,r)=>s+(r.totalAmount||0),0);

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')?'message-error':'message-success')},msg),
    React.createElement('div',{style:{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}},
      ['settings','reservations','seatingmap'].map(t=>React.createElement('button',{key:t,className:'btn btn-sm '+(subTab===t?'btn-primary':'btn-outline'),onClick:()=>setSubTab(t)},
        t==='settings'?'Settings':t==='reservations'?'Reservations ('+reservations.length+')':'Seating Map'))),

    subTab==='settings'&&React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'High Holiday Settings'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:12}},
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Enabled'),
          React.createElement('select',{className:'form-input',value:settings.enabled?'yes':'no',onChange:e=>setSettings(p=>({...p,enabled:e.target.value==='yes'}))},
            React.createElement('option',{value:'no'},'Closed'),React.createElement('option',{value:'yes'},'Open'))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Price per Seat ($)'),React.createElement('input',{className:'form-input',type:'number',value:settings.seatPrice,onChange:e=>setSettings(p=>({...p,seatPrice:parseFloat(e.target.value)||0}))})),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Total Seats'),React.createElement('input',{className:'form-input',type:'number',value:settings.totalSeats,onChange:e=>setSettings(p=>({...p,totalSeats:parseInt(e.target.value)||0}))}),React.createElement('p',{style:{fontSize:'0.78rem',color:'#888',margin:'4px 0 0'}},'How many seats can be reserved in total (used for the “available” count).'))),
      React.createElement('button',{className:'btn btn-primary',onClick:saveSettings,style:{marginTop:8}},'Save'),
      React.createElement('p',{style:{fontSize:'0.85rem',color:'#666',marginTop:10}},'Set “Open” and a price to go live. People reserve seats (paying by card or mailing a check); assign their exact seats under the “Seating Map” tab.'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))',gap:12,marginTop:16}},
        [['Reserved',totalReserved+'/'+(settings.totalSeats||0)],["Men's / Women's",totalMen+' / '+totalWomen],['Bookings',reservations.length],['Revenue','$'+totalRevenue.toFixed(2)]].map(([l,v])=>
          React.createElement('div',{key:l,style:{background:'#faf8f3',padding:10,borderRadius:6,textAlign:'center'}},
            React.createElement('div',{style:{fontSize:'0.8rem',color:'#888'}},l),React.createElement('div',{style:{fontSize:'1.2rem',fontWeight:700}},v))))),

    subTab==='reservations'&&React.createElement('div',null,
      // Manually add a reservation (walk-in, phone, check in hand, comp, etc.).
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Add a Reservation'),
        React.createElement('form',{onSubmit:addReservation},
          React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',gap:12}},
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name *'),React.createElement('input',{className:'form-input',value:addForm.firstName,onChange:e=>setAddForm(p=>({...p,firstName:e.target.value})),required:true})),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name *'),React.createElement('input',{className:'form-input',value:addForm.lastName,onChange:e=>setAddForm(p=>({...p,lastName:e.target.value})),required:true})),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:addForm.email,onChange:e=>setAddForm(p=>({...p,email:e.target.value}))})),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:addForm.phone,onChange:e=>setAddForm(p=>({...p,phone:e.target.value}))})),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},"Men's Seats"),React.createElement('input',{className:'form-input',type:'number',min:'0',value:addForm.mensSeats,onChange:e=>setAddForm(p=>({...p,mensSeats:e.target.value}))})),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},"Women's Seats"),React.createElement('input',{className:'form-input',type:'number',min:'0',value:addForm.womensSeats,onChange:e=>setAddForm(p=>({...p,womensSeats:e.target.value}))})),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Payment'),
              React.createElement('select',{className:'form-input',value:addForm.paymentMethod,onChange:e=>setAddForm(p=>({...p,paymentMethod:e.target.value}))},
                React.createElement('option',{value:'check'},'Check (received)'),
                React.createElement('option',{value:'cash'},'Cash (received)'),
                React.createElement('option',{value:'paid'},'Paid (other)'),
                React.createElement('option',{value:'comp'},'Comp / no charge'),
                React.createElement('option',{value:'pending'},'Pending (owes)'))),
            React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Amount ($)'),React.createElement('input',{className:'form-input',type:'number',min:'0',step:'0.01',value:addForm.amount,onChange:e=>setAddForm(p=>({...p,amount:e.target.value})),placeholder:'auto ('+((settings.seatPrice||0)*addSeatTotal)+')'}))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Notes'),React.createElement('input',{className:'form-input',value:addForm.notes,onChange:e=>setAddForm(p=>({...p,notes:e.target.value})),placeholder:'e.g. paid by check #1234'})),
          React.createElement('p',{style:{fontSize:'0.8rem',color:'#888',margin:'0 0 8px'}},'Leave Amount blank to use the seat price × seats. Marking anything other than "Pending" records the payment as revenue. Assign their exact seats afterward on the Seating Map tab.'),
          React.createElement('button',{className:'btn btn-primary',type:'submit',disabled:adding},adding?'Adding...':'Add Reservation'))),
      editRes&&React.createElement('div',{className:'card',style:{border:'2px solid #c49a3c'}},
        React.createElement('div',{className:'card-header'},'Edit Reservation'),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',gap:12}},
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'First Name'),React.createElement('input',{className:'form-input',value:editRes.firstName,onChange:e=>setEditRes(p=>({...p,firstName:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Last Name'),React.createElement('input',{className:'form-input',value:editRes.lastName,onChange:e=>setEditRes(p=>({...p,lastName:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Email'),React.createElement('input',{className:'form-input',type:'email',value:editRes.email,onChange:e=>setEditRes(p=>({...p,email:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Phone'),React.createElement('input',{className:'form-input',type:'tel',value:editRes.phone,onChange:e=>setEditRes(p=>({...p,phone:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},"Men's Seats"),React.createElement('input',{className:'form-input',type:'number',min:'0',value:editRes.mensSeats,onChange:e=>setEditRes(p=>({...p,mensSeats:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},"Women's Seats"),React.createElement('input',{className:'form-input',type:'number',min:'0',value:editRes.womensSeats,onChange:e=>setEditRes(p=>({...p,womensSeats:e.target.value}))})),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Payment'),
            React.createElement('select',{className:'form-input',value:editRes.paymentMethod,onChange:e=>setEditRes(p=>({...p,paymentMethod:e.target.value}))},
              React.createElement('option',{value:'stripe'},'Card (Stripe)'),
              React.createElement('option',{value:'check'},'Check (received)'),
              React.createElement('option',{value:'cash'},'Cash (received)'),
              React.createElement('option',{value:'paid'},'Paid (other)'),
              React.createElement('option',{value:'comp'},'Comp / no charge'),
              React.createElement('option',{value:'pending'},'Pending (owes)'))),
          React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Amount ($)'),React.createElement('input',{className:'form-input',type:'number',min:'0',step:'0.01',value:editRes.amount,onChange:e=>setEditRes(p=>({...p,amount:e.target.value}))}))),
        React.createElement('div',{className:'form-group'},React.createElement('label',{className:'form-label'},'Notes'),React.createElement('input',{className:'form-input',value:editRes.notes,onChange:e=>setEditRes(p=>({...p,notes:e.target.value}))})),
        React.createElement('p',{style:{fontSize:'0.8rem',color:'#888',margin:'0 0 8px'}},'Renaming updates the name shown on any seats already assigned to this reservation.'),
        React.createElement('div',{style:{display:'flex',gap:8}},
          React.createElement('button',{className:'btn btn-primary',onClick:saveEditRes},'Save Changes'),
          React.createElement('button',{className:'btn btn-outline',onClick:()=>setEditRes(null)},'Cancel'))),
      React.createElement('div',{className:'card'},
        React.createElement('div',{className:'card-header'},'Reservations ('+reservations.length+')'),
        reservations.length===0?React.createElement('p',{style:{color:'#888'}},'None yet.'):
        React.createElement('div',{className:'table-container'},React.createElement('table',null,
          React.createElement('thead',null,React.createElement('tr',null,['Name','Email','Seats','Amount','Method','Assigned',''].map((h,i)=>React.createElement('th',{key:i},h)))),
          React.createElement('tbody',null,reservations.map(r=>React.createElement('tr',{key:r.id},
            React.createElement('td',null,r.displayName),React.createElement('td',null,r.email),
            React.createElement('td',null,r.numSeats,(r.mensSeats!=null||r.womensSeats!=null)&&React.createElement('span',{style:{color:'#888',fontSize:'0.82rem'}},' ('+(r.mensSeats||0)+'M / '+(r.womensSeats||0)+'W)')),React.createElement('td',{style:{fontWeight:700}},'$'+(r.totalAmount||0).toFixed(2)),
            React.createElement('td',null,r.paymentMethod),React.createElement('td',null,(r.seatAssignments||[]).join(', ')||'-'),
            React.createElement('td',null,
              React.createElement('button',{className:'btn btn-sm btn-outline',style:{marginRight:4},onClick:()=>startEditRes(r)},'Edit'),
              React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>delReservation(r)},'Delete'))))))))),

    // The real physical seat map — assign each reservation to specific seats here.
    subTab==='seatingmap'&&React.createElement(AdminSeating));
}

// ─── Admin: Welcome Display Sponsorships ─────────────────────────
// CRUD for the cycling sponsor cards on the entrance kiosk welcome page.
// "Title" is what's being sponsored (Kiddush, Flowers, Friday Night Dinner).
// "Sponsored by" is the donor name. "Dedication" is optional ("In honor of...").
function AdminWelcomeSponsorships() {
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [msg,setMsg]=useState('');
  const [form,setForm]=useState({title:'',sponsoredBy:'',dedication:'',active:true,order:0});
  const [editingId,setEditingId]=useState(null);

  async function load(){
    setLoading(true);
    try{ setItems(await apiFetch('/api/admin/welcome/sponsorships')); }catch(e){ setMsg('Error: '+e.message); }
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  async function save(e){
    e.preventDefault();setMsg('');
    if(!form.title.trim()){setMsg('Title required.');return;}
    try{
      const payload={
        title:form.title,
        sponsoredBy:form.sponsoredBy,
        dedication:form.dedication,
        active:form.active,
        order:parseInt(form.order)||0
      };
      if(editingId){
        await apiFetch('/api/admin/welcome/sponsorships/'+editingId,{method:'PUT',body:JSON.stringify(payload)});
        setMsg('Updated.');
      }else{
        await apiFetch('/api/admin/welcome/sponsorships',{method:'POST',body:JSON.stringify(payload)});
        setMsg('Added.');
      }
      setForm({title:'',sponsoredBy:'',dedication:'',active:true,order:0});
      setEditingId(null);
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }

  function edit(s){
    setEditingId(s.id);
    setForm({title:s.title||'',sponsoredBy:s.sponsoredBy||'',dedication:s.dedication||'',active:s.active!==false,order:s.order||0});
  }
  function cancelEdit(){
    setEditingId(null);
    setForm({title:'',sponsoredBy:'',dedication:'',active:true,order:0});
  }

  async function toggleActive(s){
    try{
      await apiFetch('/api/admin/welcome/sponsorships/'+s.id,{method:'PUT',body:JSON.stringify({active:!s.active})});
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }

  async function del(id){
    if(!confirm('Delete this sponsorship card from the welcome screen?'))return;
    try{
      await apiFetch('/api/admin/welcome/sponsorships/'+id,{method:'DELETE'});
      setMsg('Deleted.');
      await load();
    }catch(err){setMsg('Error: '+err.message);}
  }

  return React.createElement('div',null,
    msg&&React.createElement('div',{className:'message '+(msg.includes('Error')||msg.includes('required')?'message-error':'message-success')},msg),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},editingId?'Edit Sponsorship Card':'Add Sponsorship Card'),
      React.createElement('p',{style:{color:'#555',marginBottom:12,fontSize:'0.9rem'}},
        'These cards rotate on the entrance welcome display every 7 seconds. ',
        'Use "Title" for what is being sponsored (e.g. "Kiddush", "Seudas Shlishis", "Friday Night Dinner"), ',
        '"Sponsored by" for the donor name, and "Dedication" for the optional in-honor / in-memory line.'),
      React.createElement('form',{onSubmit:save},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 100px 100px',gap:12}},
          React.createElement('div',{className:'form-group'},
            React.createElement('label',{className:'form-label'},'Title *'),
            React.createElement('input',{className:'form-input',placeholder:'e.g. Kiddush',value:form.title,onChange:e=>setForm(p=>({...p,title:e.target.value})),required:true})),
          React.createElement('div',{className:'form-group'},
            React.createElement('label',{className:'form-label'},'Sponsored by'),
            React.createElement('input',{className:'form-input',placeholder:'e.g. The Cohen Family',value:form.sponsoredBy,onChange:e=>setForm(p=>({...p,sponsoredBy:e.target.value}))})),
          React.createElement('div',{className:'form-group'},
            React.createElement('label',{className:'form-label'},'Active'),
            React.createElement('select',{className:'form-input',value:form.active?'yes':'no',onChange:e=>setForm(p=>({...p,active:e.target.value==='yes'}))},
              React.createElement('option',{value:'yes'},'Yes'),
              React.createElement('option',{value:'no'},'No'))),
          React.createElement('div',{className:'form-group'},
            React.createElement('label',{className:'form-label'},'Order'),
            React.createElement('input',{className:'form-input',type:'number',value:form.order,onChange:e=>setForm(p=>({...p,order:e.target.value}))}))),
        React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Dedication (optional)'),
          React.createElement('input',{className:'form-input',placeholder:'e.g. In honor of their anniversary',value:form.dedication,onChange:e=>setForm(p=>({...p,dedication:e.target.value}))})),
        React.createElement('div',{style:{display:'flex',gap:8}},
          React.createElement('button',{className:'btn btn-primary',type:'submit'},editingId?'Save Changes':'Add Card'),
          editingId&&React.createElement('button',{className:'btn btn-outline',type:'button',onClick:cancelEdit},'Cancel')))),
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Current Sponsorship Cards ('+items.length+')'),
      loading?React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'})):
      items.length===0?React.createElement('p',{style:{color:'#888'}},'No sponsorship cards yet. Add one above and it will start cycling on the welcome display.'):
      React.createElement('div',{className:'table-container'},React.createElement('table',null,
        React.createElement('thead',null,React.createElement('tr',null,['#','Title','Sponsored by','Dedication','Active','Actions'].map(h=>React.createElement('th',{key:h},h)))),
        React.createElement('tbody',null,items.map(s=>React.createElement('tr',{key:s.id,style:s.active===false?{opacity:0.5}:null},
          React.createElement('td',null,s.order||0),
          React.createElement('td',{style:{fontWeight:700,color:'#1a2744'}},s.title),
          React.createElement('td',null,s.sponsoredBy||'—'),
          React.createElement('td',{style:{color:'#555'}},s.dedication||'—'),
          React.createElement('td',null,React.createElement('button',{className:'btn btn-sm '+(s.active!==false?'btn-primary':'btn-outline'),onClick:()=>toggleActive(s)},s.active!==false?'On':'Off')),
          React.createElement('td',null,
            React.createElement('button',{className:'btn btn-sm btn-outline',style:{marginRight:6},onClick:()=>edit(s)},'Edit'),
            React.createElement('button',{className:'btn btn-sm btn-danger',onClick:()=>del(s.id)},'Delete')))))))));
}

// ─── Welcome / Kiosk Display Page ─────────────────────────────────
// Admin-only. Designed for a TV at the shul entrance: big welcome message
// + logo, today's zmanim + davening + classes on one side, cycling sponsor
// thank-you cards on the other. Light cream theme to feel welcoming.
function WelcomePage() {
  const [user,setUser]=useState(null);
  const [isAdmin,setIsAdmin]=useState(false);
  const [checking,setChecking]=useState(true);
  const [schedule,setSchedule]=useState(null);
  const [fullZmanim,setFullZmanim]=useState(null);
  const [shiurim,setShiurim]=useState([]);
  const [sponsorships,setSponsorships]=useState([]);
  const [sponsorIdx,setSponsorIdx]=useState(0);
  const [now,setNow]=useState(()=>new Date());
  const [fading,setFading]=useState(false);
  const [isFs,setIsFs]=useState(false);
  const siteImages=useSiteImages();

  // Browser fullscreen toggle (uses the Fullscreen API to hide browser chrome
  // on the TV). Listen so the icon flips if the user presses Esc.
  function toggleFs(){
    if(document.fullscreenElement||document.webkitFullscreenElement){
      (document.exitFullscreen||document.webkitExitFullscreen).call(document);
    }else{
      const el=document.documentElement;
      const req=el.requestFullscreen||el.webkitRequestFullscreen;
      if(req) req.call(el).catch(()=>{});
    }
  }
  useEffect(()=>{
    function onChange(){
      setIsFs(!!(document.fullscreenElement||document.webkitFullscreenElement));
    }
    document.addEventListener('fullscreenchange',onChange);
    document.addEventListener('webkitfullscreenchange',onChange);
    onChange();
    return ()=>{
      document.removeEventListener('fullscreenchange',onChange);
      document.removeEventListener('webkitfullscreenchange',onChange);
    };
  },[]);

  // Gate: must be logged in as admin to even render the kiosk page.
  useEffect(()=>{
    const unsub=firebase.auth().onAuthStateChanged(async u=>{
      setUser(u);
      if(u){
        try{
          const t=await u.getIdToken();
          const r=await fetch(BACKEND_URL+'/api/admin/davening-rules',{headers:{'Authorization':'Bearer '+t}});
          setIsAdmin(r.ok);
        }catch{setIsAdmin(false);}
      }else{
        setIsAdmin(false);
      }
      setChecking(false);
    });
    return unsub;
  },[]);

  // Load data once admin status is known; refresh every 5 minutes.
  useEffect(()=>{
    if(!isAdmin) return;
    function load(){
      apiFetch('/api/schedule/today').then(setSchedule).catch(()=>{});
      apiFetch('/api/zmanim/today').then(setFullZmanim).catch(()=>{});
      apiFetch('/api/shiurim').then(setShiurim).catch(()=>{});
      apiFetch('/api/welcome/sponsorships').then(setSponsorships).catch(()=>{});
    }
    load();
    const refreshT=setInterval(load,5*60*1000);
    return ()=>clearInterval(refreshT);
  },[isAdmin]);

  // Live clock
  useEffect(()=>{
    if(!isAdmin) return;
    const t=setInterval(()=>setNow(new Date()),1000);
    return ()=>clearInterval(t);
  },[isAdmin]);

  // Cycle sponsor cards with a short cross-fade.
  useEffect(()=>{
    if(sponsorships.length<2) return;
    const t=setInterval(()=>{
      setFading(true);
      setTimeout(()=>{
        setSponsorIdx(i=>(i+1)%sponsorships.length);
        setFading(false);
      },400);
    },7000);
    return ()=>clearInterval(t);
  },[sponsorships.length]);

  if(checking) return React.createElement('div',{className:'loading'},React.createElement('div',{className:'spinner'}),'Checking access...');
  if(!user||!isAdmin) return React.createElement(AdminLogin,{notAdmin:!!user&&!isAdmin,onLogin:()=>{setChecking(true);setTimeout(()=>setChecking(false),500);}});

  const logoSrc=siteImages.fullscreenLogo||siteImages.topLogo||siteImages.heroImage||'logo.png';
  const z=fullZmanim?.zmanim||schedule?.zmanim||{};
  const hebDate=fullZmanim?.hebrewDate?.hebrew||'';
  const englishDate=now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const clockStr=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York',hour12:true}).toLowerCase();
  const todayDow=now.getDay();
  const todayShiurim=shiurim.filter(s=>s.dayOfWeek===todayDow);
  const isFri=todayDow===5;
  const showCandles=isFri||(schedule?.dayType==='yomTov');

  const daveningRows=[
    schedule?.davening?.shacharis&&['Shacharis',schedule.davening.shacharis],
    schedule?.davening?.earlyMincha&&['Early Mincha',schedule.davening.earlyMincha],
    schedule?.davening?.mincha&&['Mincha',schedule.davening.mincha],
    schedule?.davening?.minchaMaariv&&['Mincha / Maariv',schedule.davening.minchaMaariv],
    schedule?.davening?.maariv&&['Maariv',schedule.davening.maariv]
  ].filter(Boolean);

  // Full daily zmanim list for the ticker at the bottom of the left card.
  const allZmanim=[
    ['Alot',fmtZ(z.alotHaShachar||z.alotHashachar)],
    ['Misheyakir',fmtZ(z.misheyakir)],
    ['Sunrise',fmtZ(z.sunrise)],
    ['Shema (MGA)',fmtZ(z.sofZmanShmaMGA)],
    ['Shema (GRA)',fmtZ(z.sofZmanShma)],
    ['Tefilla',fmtZ(z.sofZmanTfilla||z.sofZmanTfillaMGA)],
    ['Chatzos',fmtZ(z.chatzot||z.chatzos)],
    ['Mincha Gedola',fmtZ(z.minchaGedola)],
    ['Plag',fmtZ(z.plagHaMincha||z.plagHamincha)],
    ['Sunset',fmtZ(z.sunset)],
    ['Tzeis',fmtZ(z.tzeit||z.tzeis)]
  ].filter(([_,v])=>v&&v!=='--');

  // Clamp the index in case the list shrank after a refetch (avoids a blank card).
  const current=sponsorships.length?sponsorships[sponsorIdx%sponsorships.length]:null;

  return React.createElement('div',{style:{
    position:'fixed',inset:0,zIndex:9999,
    background:'linear-gradient(180deg,#faf8f3 0%,#f0ece3 100%)',
    display:'flex',flexDirection:'column',
    height:'100vh',width:'100vw',overflow:'hidden',
    padding:'28px 40px',boxSizing:'border-box',
    fontFamily:'var(--font-body)'
  }},
    React.createElement('style',null,
      '@keyframes welcomeFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}'+
      '@keyframes hTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}'
    ),

    // Top-right controls: fullscreen toggle + close.
    React.createElement('div',{style:{
      position:'absolute',top:14,right:14,zIndex:10,
      display:'flex',gap:8
    }},
      React.createElement('button',{
        onClick:toggleFs,
        title:isFs?'Exit fullscreen':'Enter fullscreen',
        style:{
          background:'rgba(26,39,68,0.08)',color:'#1a2744',
          border:'1px solid rgba(26,39,68,0.2)',borderRadius:'50%',
          width:40,height:40,fontSize:'1.1rem',cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center'
        }
      },isFs?'⤡':'⛶'),
      React.createElement('button',{
        onClick:()=>{window.location.hash='admin';},
        title:'Close welcome screen',
        style:{
          background:'rgba(26,39,68,0.08)',color:'#1a2744',
          border:'1px solid rgba(26,39,68,0.2)',borderRadius:'50%',
          width:40,height:40,fontSize:'1.1rem',cursor:'pointer'
        }
      },'✕')
    ),

    // Top header: logo + welcome text + date/clock
    React.createElement('div',{style:{
      textAlign:'center',marginBottom:24,flexShrink:0
    }},
      React.createElement('img',{src:logoSrc,alt:'',style:{height:120,width:'auto',marginBottom:12}}),
      React.createElement('h1',{style:{
        fontFamily:'var(--font-display)',fontSize:'3.4rem',color:'#1a2744',
        margin:'0 0 6px',fontWeight:700,letterSpacing:0.5,lineHeight:1.1
      }},'Welcome to ',React.createElement('span',{style:{color:'#c49a3c'}},'Congregation Ohr Chaim')),
      React.createElement('div',{style:{fontSize:'1.15rem',color:'#666',letterSpacing:0.5}},
        englishDate,
        hebDate&&React.createElement('span',null,'  •  ',React.createElement('span',{style:{color:'#c49a3c',fontWeight:600}},hebDate)),
        '  •  ',React.createElement('span',{style:{color:'#1a2744',fontWeight:600}},clockStr))
    ),

    // Two columns
    React.createElement('div',{style:{
      display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,
      flex:1,minHeight:0
    }},

      // LEFT: Today's davening + zmanim + classes
      React.createElement('div',{style:{
        background:'#fff',borderRadius:18,padding:'28px 32px',
        boxShadow:'0 4px 20px rgba(0,0,0,0.06)',
        border:'1px solid rgba(196,154,60,0.2)',
        display:'flex',flexDirection:'column',
        overflow:'hidden'
      }},
        React.createElement('h2',{style:{
          fontFamily:'var(--font-display)',fontSize:'2rem',color:'#1a2744',
          margin:'0 0 4px',fontWeight:700,textAlign:'center'
        }},"Today's Davening"),
        schedule?.parsha&&React.createElement('p',{style:{textAlign:'center',color:'#c49a3c',fontWeight:600,marginBottom:14}},'Parshas '+schedule.parsha),
        React.createElement('div',{style:{flex:'0 0 auto'}},
          daveningRows.length>0
            ?daveningRows.map(([l,v])=>React.createElement('div',{key:l,style:{
                display:'flex',justifyContent:'space-between',
                padding:'10px 0',borderBottom:'1px solid #f0ece3',fontSize:'1.4rem'
              }},
              React.createElement('span',{style:{color:'#555',fontWeight:500}},l),
              React.createElement('span',{style:{color:'#1a2744',fontWeight:700,fontFamily:'var(--font-display)'}},v)))
            :React.createElement('p',{style:{color:'#888',textAlign:'center',padding:20}},'Loading davening times…'),
          showCandles&&schedule?.zmanim?.candleLighting&&React.createElement('div',{style:{
            display:'flex',justifyContent:'space-between',
            padding:'12px 16px',marginTop:8,
            background:'rgba(196,154,60,0.1)',borderRadius:10,
            fontSize:'1.4rem'
          }},
            React.createElement('span',{style:{color:'#a07d2e',fontWeight:700}},'Candle Lighting'),
            React.createElement('span',{style:{color:'#a07d2e',fontWeight:700,fontFamily:'var(--font-display)'}},schedule.zmanim.candleLighting))
        ),

        // Today's classes
        todayShiurim.length>0&&React.createElement('div',{style:{marginTop:24,paddingTop:18,borderTop:'2px solid rgba(196,154,60,0.3)'}},
          React.createElement('h3',{style:{
            fontFamily:'var(--font-display)',fontSize:'1.5rem',color:'#1a2744',
            margin:'0 0 12px',fontWeight:700,textAlign:'center'
          }},"Today's Classes"),
          todayShiurim.map(s=>React.createElement('div',{key:s.id,style:{padding:'10px 0',borderBottom:'1px solid #f0ece3'}},
            React.createElement('div',{style:{fontWeight:700,color:'#1a2744',fontSize:'1.15rem'}},s.title),
            React.createElement('div',{style:{color:'#666',fontSize:'0.95rem',marginTop:2}},[s.time,s.rabbi,s.location].filter(Boolean).join(' • '))))),

        // Seamless horizontal ticker of every daily zman. Renders the full
        // list twice and animates translateX 0 -> -50% (== exactly one copy's
        // width) so the CSS loop snaps at a pixel-identical position.
        allZmanim.length>0&&React.createElement('div',{style:{
          marginTop:'auto',paddingTop:18,borderTop:'2px solid rgba(196,154,60,0.3)',
          overflow:'hidden',position:'relative',flexShrink:0
        }},
          React.createElement('div',{style:{
            display:'inline-block',whiteSpace:'nowrap',
            animation:'hTicker '+Math.max(40,allZmanim.length*5)+'s linear infinite'
          }},
            [0,1].map(copy=>React.createElement('span',{key:'tg'+copy,style:{display:'inline-block'}},
              allZmanim.map(([l,v])=>React.createElement('span',{key:l+'-'+copy,style:{
                display:'inline-flex',alignItems:'baseline',gap:10,
                padding:'0 28px',whiteSpace:'nowrap'
              }},
                React.createElement('span',{style:{
                  color:'#888',letterSpacing:1.5,textTransform:'uppercase',
                  fontSize:'0.78rem',fontWeight:600
                }},l),
                React.createElement('span',{style:{
                  color:'#1a2744',fontWeight:700,fontSize:'1.2rem',
                  fontFamily:'var(--font-display)'
                }},v)))
            ))
          )
        )
      ),

      // RIGHT: cycling sponsorship card
      React.createElement('div',{style:{
        background:'linear-gradient(135deg,#1a2744 0%,#243456 100%)',
        borderRadius:18,padding:'32px 36px',
        boxShadow:'0 4px 20px rgba(0,0,0,0.08)',
        display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',
        color:'#fff',position:'relative',overflow:'hidden'
      }},
        React.createElement('h2',{style:{
          fontFamily:'var(--font-display)',fontSize:'1.8rem',color:'#c49a3c',
          margin:'0 0 20px',fontWeight:700,textAlign:'center',letterSpacing:1
        }},'Thank You to Our Sponsors'),

        sponsorships.length===0
          ?React.createElement('div',{style:{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'1.1rem',padding:30}},
            'No sponsor cards configured yet. Add some in the admin "Welcome Display" tab.')
          :current&&React.createElement('div',{
              key:current.id,
              style:{
                textAlign:'center',width:'100%',maxWidth:600,
                opacity:fading?0:1,
                transition:'opacity 0.4s ease-in-out',
                animation:fading?'none':'welcomeFade 0.5s ease-out'
              }
            },
              React.createElement('div',{style:{
                fontSize:'0.95rem',color:'rgba(196,154,60,0.85)',
                letterSpacing:3,textTransform:'uppercase',marginBottom:14,fontWeight:600
              }},current.title||'Sponsorship'),
              current.sponsoredBy&&React.createElement('div',{style:{
                fontFamily:'var(--font-display)',fontSize:'2.6rem',
                color:'#fff',fontWeight:700,lineHeight:1.2,marginBottom:14
              }},current.sponsoredBy),
              current.dedication&&React.createElement('div',{style:{
                fontSize:'1.2rem',color:'rgba(255,255,255,0.85)',
                fontStyle:'italic',lineHeight:1.5,maxWidth:500,margin:'0 auto'
              }},current.dedication)
            ),

        // Cycle indicator dots
        sponsorships.length>1&&React.createElement('div',{style:{
          display:'flex',gap:8,marginTop:30
        }},
          sponsorships.map((s,i)=>React.createElement('div',{key:s.id,style:{
            width:10,height:10,borderRadius:'50%',
            background:i===sponsorIdx?'#c49a3c':'rgba(255,255,255,0.25)',
            transition:'background 0.3s'
          }})))
      )
    )
  );
}

// ─── Pay a specific bill (pledge) by magic-link token ───────────
// Public — no login needed. URL pattern: #pay?token=abc123. Fetches the
// pledge by token, shows the amount + reason, takes a card via Stripe
// Elements, posts to /api/pay/:token/create-payment, then confirms via
// Stripe.confirmCardPayment. The backend webhook does the post-payment
// work (mark pledge paid, record donation, send receipt).
function PayBillPage() {
  const [token,setToken]=useState(null);
  const [bill,setBill]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState('');
  const [email,setEmail]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [done,setDone]=useState(false);
  const [cardReady,setCardReady]=useState(false);
  const cardMountRef=useRef(null);
  const stripeRef=useRef(null);
  const cardElementRef=useRef(null);
  const clientSecretRef=useRef(null); // reused across retries so we don't create a second PaymentIntent

  // Extract token from hash on mount.
  useEffect(()=>{
    const hash=window.location.hash;
    const t=hash.includes('token=')?hash.split('token=')[1]?.split('&')[0]:null;
    if(!t){setErr('No bill token provided.');setLoading(false);return;}
    setToken(t);
    fetch(BACKEND_URL+'/api/pay/'+t).then(r=>r.json()).then(data=>{
      if(data.error){setErr(data.error);}else{setBill(data);}
      setLoading(false);
    }).catch(e=>{setErr('Failed to load bill: '+e.message);setLoading(false);});
  },[]);

  // Mount Stripe Elements once we have a valid unpaid bill.
  useEffect(()=>{
    if(!bill||bill.status==='paid'||done) return;
    if(!window.Stripe){setErr('Payment library failed to load. Please refresh.');return;}
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
  },[bill,done]);

  async function handlePay(e){
    e.preventDefault();
    if(!stripeRef.current||!cardElementRef.current){setErr('Payment form still loading. Try again in a moment.');return;}
    setSubmitting(true);setErr('');
    try{
      // Reuse the same PaymentIntent across retries (cache its clientSecret) so a
      // transient error after a successful charge doesn't mint a second PI and
      // double-charge the member; confirmCardPayment on an already-succeeded PI
      // just returns 'succeeded'.
      let clientSecret=clientSecretRef.current;
      if(!clientSecret){
        const r=await fetch(BACKEND_URL+'/api/pay/'+token+'/create-payment',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email})
        });
        const data=await r.json();
        if(!r.ok){setErr(data.error||'Payment setup failed.');setSubmitting(false);return;}
        clientSecret=data.clientSecret;
        clientSecretRef.current=clientSecret;
      }
      const result=await stripeRef.current.confirmCardPayment(clientSecret,{
        payment_method:{
          card:cardElementRef.current,
          billing_details:{
            name:bill.memberName||'',
            email:email||undefined
          }
        }
      });
      if(result.error){setErr(result.error.message||'Payment failed.');setSubmitting(false);return;}
      if(result.paymentIntent?.status!=='succeeded'){setErr('Payment did not complete. Status: '+(result.paymentIntent?.status||'unknown'));setSubmitting(false);return;}
      setDone(true);
    }catch(ex){setErr('Error: '+ex.message);}
    setSubmitting(false);
  }

  // Render
  if(loading) return React.createElement('div',{className:'loading',style:{padding:60}},React.createElement('div',{className:'spinner'}),'Loading bill...');
  if(err&&!bill) return React.createElement('div',{className:'card',style:{maxWidth:560,margin:'40px auto',textAlign:'center',padding:40}},
    React.createElement('h2',{style:{color:'#b00020'}},'Unable to load bill'),
    React.createElement('p',null,err),
    React.createElement('p',{style:{marginTop:20}},React.createElement('a',{href:'#home',style:{color:'#c49a3c'}},'Return to homepage')));
  if(bill&&bill.status==='paid') return React.createElement('div',{className:'card',style:{maxWidth:560,margin:'40px auto',textAlign:'center',padding:40}},
    React.createElement('div',{style:{fontSize:'3rem',marginBottom:16}},'✅'),
    React.createElement('h2',{style:{color:'#27ae60'}},'Already Paid'),
    React.createElement('p',null,'This bill was already paid. Thank you!'),
    React.createElement('p',{style:{marginTop:20}},React.createElement('a',{href:'#home',style:{color:'#c49a3c'}},'Return to homepage')));
  if(done) return React.createElement('div',{className:'card',style:{maxWidth:560,margin:'40px auto',textAlign:'center',padding:40}},
    React.createElement('div',{style:{fontSize:'3rem',marginBottom:16}},'✅'),
    React.createElement('div',{className:'card-header',style:{borderBottom:'none',textAlign:'center'}},'Thank You!'),
    React.createElement('p',{style:{fontSize:'1.1rem',color:'#555'}},'Your payment of $'+(bill.amount||0).toFixed(2)+' has been received. A receipt is on its way to your inbox.'),
    React.createElement('a',{href:'#home',className:'btn btn-primary',style:{marginTop:20,display:'inline-block'}},'Return to homepage'));

  return React.createElement('div',{style:{maxWidth:560,margin:'40px auto'}},
    React.createElement('div',{className:'card'},
      React.createElement('div',{className:'card-header'},'Pay Your Bill'),
      bill.memberName&&React.createElement('p',{style:{color:'#555',marginBottom:14}},'Bill for ',React.createElement('strong',null,bill.memberName)),
      React.createElement('div',{style:{background:'#faf8f3',padding:16,borderRadius:8,margin:'12px 0 18px',border:'1px solid #e0dcd4'}},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:'1.05rem'}},React.createElement('span',{style:{color:'#666'}},'Amount'),React.createElement('span',{style:{fontWeight:700,fontSize:'1.4rem',color:'#1a2744'}},'$'+parseFloat(bill.amount).toFixed(2))),
        bill.reason&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'6px 0'}},React.createElement('span',{style:{color:'#666'}},'For'),React.createElement('span',null,bill.reason)),
        bill.dueDate&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'6px 0'}},React.createElement('span',{style:{color:'#666'}},'Due'),React.createElement('span',null,bill.dueDate))),
      err&&React.createElement('div',{className:'message message-error'},err),
      React.createElement('form',{onSubmit:handlePay},
        React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Email (for receipt)'),
          React.createElement('input',{className:'form-input',type:'email',value:email,onChange:e=>setEmail(e.target.value),placeholder:'you@example.com'})),
        React.createElement('div',{className:'form-group'},
          React.createElement('label',{className:'form-label'},'Card Details'),
          React.createElement('div',{ref:cardMountRef,style:{padding:'14px 14px',border:'1px solid #d4cfc4',borderRadius:8,background:'#fff',minHeight:52}}),
          React.createElement('p',{style:{fontSize:'0.85rem',color:'#888',marginTop:6}},'Secured by Stripe. We never see or store your card number.')),
        React.createElement('button',{className:'btn btn-primary btn-block',type:'submit',disabled:submitting||!cardReady,style:{marginTop:8,fontSize:'1.1rem',padding:'14px 28px'}},
          submitting?'Processing...':'Pay $'+parseFloat(bill.amount).toFixed(2)))));
}

// ─── Main App (Top Nav Layout) ───────────────────────────────────
function App() {
  // "#signup?token=abc123" -> "signup" for route matching. Sub-pages still
  // read window.location.hash directly for their own query params (signup
  // token, Stripe checkout sub=success, etc.) — we just don't want the query
  // string to break the page === 'signup' check upstream.
  function pageFromHash(){
    return (window.location.hash.replace('#','').split(/[?&]/)[0])||'home';
  }
  const [page,setPage]=useState(pageFromHash());
  const [mobileOpen,setMobileOpen]=useState(false);
  const siteImages=useSiteImages();
  useEffect(()=>{function h(){setPage(pageFromHash());setMobileOpen(false);}window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h);},[]);
  function navigate(p){window.location.hash=p;setPage(p);setMobileOpen(false);}

  // Welcome kiosk page renders as a full-viewport overlay with its own admin
  // gate, so short-circuit the normal site chrome (top bar, hero, footer).
  if (page === 'welcome') return React.createElement(WelcomePage);

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
          React.createElement('img',{src:'logo.png',alt:'',className:'page-header-tree'}),
          React.createElement('h1',null,titles[page])),
        React.createElement('div',{className:'page-header-date'},secDate))),
    // Page content
    React.createElement('div',{className:'page-wrap'},
      page==='home'&&React.createElement(HomePage,{navigate}),
      page==='schedule'&&React.createElement(SchedulePage,{navigate}),
      page==='calendar'&&React.createElement(CalendarPage),
      page==='zmanim'&&React.createElement(ZmanimPage),
      page==='shiurim'&&React.createElement(ShiurimPage),
      page==='donate'&&React.createElement(IS_NATIVE?DonateExternal:DonatePage),
      page==='sponsorship'&&React.createElement(SponsorshipPage),
      page==='highholidays'&&React.createElement(HighHolidaySeatsPage),
      page==='account'&&React.createElement(AccountPage),
      page==='signup'&&React.createElement(AccountPage),
      page==='admin'&&React.createElement(AdminPanel),
      page==='contact'&&React.createElement(ContactPage),
      page==='pay'&&React.createElement(IS_NATIVE?PayBillExternal:PayBillPage),
      page==='privacy'&&React.createElement(PrivacyPage),
      page==='terms'&&React.createElement(TermsPage)),
    // Footer
    React.createElement('div',{className:'site-footer'},
      footerLogoSrc&&React.createElement('img',{src:footerLogoSrc,alt:'Congregation Ohr Chaim',className:'footer-logo'}),
      React.createElement('div',{className:'footer-text'},'© '+today.getFullYear()+' Congregation Ohr Chaim • 317 W 47th Street, Miami Beach, FL'),
      React.createElement('div',{className:'footer-links',style:{marginTop:8,fontSize:'0.85rem'}},
        React.createElement('a',{href:'#contact',style:{color:'var(--text-medium)',margin:'0 8px'}},'Contact'),
        React.createElement('a',{href:'#privacy',style:{color:'var(--text-medium)',margin:'0 8px'}},'Privacy Policy'),
        React.createElement('a',{href:'#terms',style:{color:'var(--text-medium)',margin:'0 8px'}},'Terms of Service'))));
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
