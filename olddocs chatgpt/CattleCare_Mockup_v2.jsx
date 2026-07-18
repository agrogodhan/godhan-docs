import { useState } from "react";
import {
  Home, List, Plus, Bell, ShoppingCart, ChevronLeft, ChevronRight,
  Mic, Bluetooth, Wifi, Heart, Activity, Thermometer, TrendingUp,
  BarChart2, User, Settings, AlertTriangle, CheckCircle, Star,
  MessageSquare, Video, Calendar, MapPin, Award, Zap, Battery, Cpu,
  Package, Edit, Search, Filter, Info, ArrowUp, ArrowDown, Minus,
  RefreshCw, Eye, Lock, FileText, DollarSign, ChevronDown,
  MoreVertical, Droplets, X, Menu, PanelLeft
} from "lucide-react";

// ── Design System ─────────────────────────────────────────────
const C = {
  primary:"#1a3a1a", mid:"#2e5e2e", light:"#eaf4ea",
  gold:"#b8860b",    goldL:"#fdf6e3",
  blue:"#1a3a5c",    blueL:"#e8f0f8",
  red:"#c0392b",     redL:"#fdf0ef",
  amber:"#c97d20",   amberL:"#fff8ee",
  teal:"#1a5c52",    tealL:"#e8f5f3",
  purple:"#4a1a6e",  purpleL:"#f2eaf8",
  bg:"#f0f5f0",      surface:"#ffffff",
  border:"#d8e8d8",  text1:"#1a1a1a",
  text2:"#445544",   text3:"#889988",
  gray1:"#f5f5f5",   gray2:"#e8e8e8",
};
const PC = ["#1a5c52","#1a3a5c","#4a1a6e","#b8860b"];
const PL = ["#e8f5f3","#e8f0f8","#f2eaf8","#fdf6e3"];
const pc = p => PC[p-1]; const pl = p => PL[p-1];

// ── Screen list ───────────────────────────────────────────────
const SCREENS = [
  {id:"language",   label:"Language Selection",  phase:1, cat:"Onboarding"},
  {id:"login",      label:"Phone / OTP Login",   phase:1, cat:"Onboarding"},
  {id:"farm_setup", label:"Farm Setup",          phase:1, cat:"Onboarding"},
  {id:"add_cow",    label:"Add First Cow",       phase:1, cat:"Onboarding"},
  {id:"home",       label:"Home Dashboard",      phase:1, cat:"Core App"},
  {id:"herd_list",  label:"Herd List",           phase:1, cat:"Core App"},
  {id:"cow_detail", label:"Cow Detail",          phase:1, cat:"Core App"},
  {id:"milk_log",   label:"Milk Log Entry",      phase:1, cat:"Core App"},
  {id:"voice_log",  label:"Voice Log",           phase:1, cat:"Core App"},
  {id:"feed_log",   label:"Feed Purchase Log",   phase:1, cat:"Core App"},
  {id:"health_evt", label:"Health Event Log",    phase:1, cat:"Core App"},
  {id:"profile",    label:"Profile / Settings",  phase:1, cat:"Core App"},
  {id:"ble_setup",  label:"BLE Collar Setup",    phase:2, cat:"IoT"},
  {id:"live_dash",  label:"Live Dashboard",      phase:2, cat:"IoT"},
  {id:"alert_list", label:"Health Alert List",   phase:2, cat:"IoT"},
  {id:"alert_det",  label:"Alert Detail",        phase:2, cat:"IoT"},
  {id:"cow_vitals", label:"Cow Vitals Live",     phase:2, cat:"IoT"},
  {id:"risk_score", label:"AI Risk Score",       phase:3, cat:"AI Engine"},
  {id:"herd_dash",  label:"Herd Analytics",      phase:3, cat:"AI Engine"},
  {id:"rankings",   label:"Cow Rankings",        phase:3, cat:"AI Engine"},
  {id:"revenue",    label:"Revenue View",        phase:3, cat:"AI Engine"},
  {id:"milk_pred",  label:"Milk Prediction",     phase:3, cat:"AI Engine"},
  {id:"market",     label:"Marketplace Home",    phase:4, cat:"Marketplace"},
  {id:"create_lst", label:"Create Listing",      phase:4, cat:"Marketplace"},
  {id:"passport",   label:"Health Passport",     phase:4, cat:"Marketplace"},
  {id:"farm_store", label:"Farm Store",          phase:4, cat:"Marketplace"},
  {id:"product",    label:"Product Detail",      phase:4, cat:"Marketplace"},
  {id:"vet",        label:"Vet Consultation",    phase:4, cat:"Marketplace"},
];

// ── Developer annotations ─────────────────────────────────────
const NOTES = {
  language:  {comp:"LanguageSelectionScreen",   api:"PUT /api/auth/profile",                nav:"→ login",                   state:"selectedLang: string",              note:"6 language tiles. Stored in AsyncStorage. Default = phone OS language."},
  login:     {comp:"LoginScreen",               api:"POST /api/auth/send-otp\nPOST /api/auth/verify-otp",nav:"→ farm_setup (new user) | home (returning)",state:"phone, otp, step: phone|otp",       note:"6-digit OTP via SMS. JWT in SecureStore. 30s resend cooldown."},
  farm_setup:{comp:"FarmSetupScreen",           api:"POST /api/farms",                      nav:"→ add_cow",                 state:"farmName, state, district, wifi",    note:"GPS auto-detected. WiFi field needed for Phase 2 collar planning."},
  add_cow:   {comp:"AddFirstCowScreen",         api:"POST /api/cows",                       nav:"→ home",                    state:"name, breed, dob, parity, lastCalving", note:"Breed dropdown: HF Cross, Gir, Sahiwal, Jersey Cross, Murrah Buffalo, Mixed."},
  home:      {comp:"HomeDashboardScreen",       api:"GET /api/dashboard/today\nGET /api/dashboard/pnl",nav:"Tab: home",               state:"todayData, alerts[], unlogged[]",    note:"Pull-to-refresh. KPI cards drill-down. Updates on focus via useFocusEffect."},
  herd_list: {comp:"HerdListScreen",            api:"GET /api/cows",                        nav:"Tab: herd | → cow_detail",  state:"cows[], search, filterBreed, sortBy", note:"FlatList + search bar. Phase 2 adds health ring. Swipe actions for quick log."},
  cow_detail:{comp:"CowDetailScreen",           api:"GET /api/cows/:id/profile",            nav:"← herd | 4 tabs",           state:"tab, cow, milkData, healthEvents",   note:"4 tabs: Overview, Milk, Health, Genealogy. FAB for quick milk log. Phase 2 adds Live tab."},
  milk_log:  {comp:"MilkLogEntryScreen",        api:"POST /api/cows/:id/milk",              nav:"← cow_detail or FAB",       state:"cowId, yield, session, note",       note:"Large number pad. Session auto-detected from clock time. Voice mic launches voice_log."},
  voice_log: {comp:"VoiceLogScreen",            api:"POST /api/auth/voice/parse\nPOST /api/cows/:id/milk",nav:"← milk_log",              state:"listening, transcript, parsed, step",note:"Full-screen mic. TTS confirmation in Hindi. Haptic on save. Offline: Whisper Tiny."},
  feed_log:  {comp:"FeedPurchaseLogScreen",     api:"POST /api/feed/purchase",              nav:"← home FAB or + menu",      state:"feedType, qty, unit, cost, vendor",  note:"8 feed types. District avg price shown for comparison. Voice input supported."},
  health_evt:{comp:"HealthEventLogScreen",      api:"POST /api/cows/:id/health-event",      nav:"← cow_detail Health tab",   state:"eventType, date, medicine, dose",   note:"Withdrawal period auto-computed for antibiotics. Vaccine adds to schedule."},
  profile:   {comp:"ProfileSettingsScreen",     api:"GET /api/auth/profile\nPUT /api/auth/profile",nav:"Tab: profile",             state:"user, farm, language, subscription",note:"Language switcher. Referral code shown. DPDP data export button."},
  ble_setup: {comp:"BLESetupWizard",            api:"POST /api/devices/provision",          nav:"← devices, 4-step wizard",  state:"step:1-4, devices[], selected, cow", note:"Request BLE permission. Collar must be powered on. BLE disabled after provisioning."},
  live_dash: {comp:"LiveDashboardScreen",       api:"GET /api/dashboard/today\nWS /ws/farm/:id",nav:"Tab: home (Phase 2)",       state:"liveData, alertCount, zones",       note:"WebSocket for 30s real-time updates. Zone bar (shed vs open area)."},
  alert_list:{comp:"HealthAlertListScreen",     api:"GET /api/alerts/active\nPUT /api/alerts/:id/resolve",nav:"Tab: bell",               state:"alerts[], filter, loading",         note:"Sorted by severity then time. Swipe-to-resolve. Red badge count on tab."},
  alert_det: {comp:"AlertDetailScreen",         api:"GET /api/alerts/:id\nPUT /api/alerts/:id/resolve",nav:"← alert_list",             state:"alert, cow, note, suggestedProducts",note:"Vitals at alert time shown. Suggested medicines. Links to vet consult."},
  cow_vitals:{comp:"CowVitalsLiveScreen",       api:"GET /api/cows/:id/risk\nWebSocket",    nav:"← cow_detail Live tab",     state:"vitals, riskScore, trend, history", note:"Real-time gauges. 24h sparkline charts. Phase 3 adds AI risk ring."},
  risk_score:{comp:"AIRiskScoreScreen",         api:"GET /api/cows/:id/risk\nGET /api/cows/:id/risk/explain",nav:"← alert or cow_detail",    state:"score, features[], illnessType",    note:"Large gauge 0-100. 14-feature breakdown. Feedback buttons train the model."},
  herd_dash: {comp:"HerdAnalyticsScreen",       api:"GET /api/herd/summary/today\nGET /api/herd/trend",nav:"Tab: analytics, 5 sub-tabs",state:"activeView:1-5, period",            note:"5 views via chip selector. Redis-cached at 15min. Today Summary default."},
  rankings:  {comp:"CowRankingsScreen",         api:"GET /api/herd/rankings?mode=yield",    nav:"← herd_analytics view 3",  state:"sortMode, cows[], page",            note:"7 sort modes via horizontal chips. Consider Sell = composite AI score."},
  revenue:   {comp:"RevenueViewScreen",         api:"GET /api/herd/revenue\nGET /api/herd/revenue/calendar",nav:"← herd_analytics view 4",  state:"period, revenue, milkPrice",        note:"Indian number format (lakh). Forecast calendar. PDF export button."},
  milk_pred: {comp:"MilkPredictionScreen",      api:"GET /api/cows/:id/milk/forecast\nGET /api/cows/:id/milk/roi",nav:"← cow_detail Milk tab",    state:"forecast, confidence, roiData",     note:"Wood curve chart. 30-day forecast with confidence band. ROI calculator."},
  market:    {comp:"MarketplaceHomeScreen",     api:"GET /api/marketplace/listings",        nav:"Tab: market",               state:"listings[], filters, search",       note:"Grade filter chips. Breed filter. Price range. Each card shows 4 scores."},
  create_lst:{comp:"CreateListingScreen",       api:"GET /api/cows (eligible)\nPOST /api/marketplace/listings",nav:"← marketplace FAB",        state:"selectedCow, price, type: fixed|auction",note:"Only 30+ days data cows eligible. Price advisor shown. ₹299 listing fee."},
  passport:  {comp:"HealthPassportScreen",      api:"GET /api/marketplace/listings/:id/passport",nav:"← listing detail",         state:"passport, activeSection",           note:"Full-screen PDF-like view. SHA-256 signed QR code. All 4 scores. ROI calc."},
  farm_store:{comp:"FarmStoreScreen",           api:"GET /api/shop/suggestions\nGET /api/shop/products",nav:"Tab: shop",                state:"suggestions[], category, search",   note:"Data-driven suggestions first. 6 category grid. Group order banner."},
  product:   {comp:"ProductDetailScreen",       api:"GET /api/shop/products/:id\nPOST /api/shop/orders",nav:"← farm_store",             state:"product, qty, groupOrderAvailable", note:"Herd quantity calculator. Withdrawal period for medicines. UPI checkout."},
  vet:       {comp:"VetConsultScreen",          api:"POST /api/vet/consultations\nGET /api/vet/list",nav:"← alert_detail or shop",    state:"type: text|video, vet, cowContext", note:"Collar data auto-attached. ₹99 text / ₹299 video. Vet sees live data. Rx gateway."},
};

// ── Shared primitives ─────────────────────────────────────────
const sp  = (b=0,a=0) => ({spacing:{before:b,after:a}});
const gap = (n=8) => <div style={{height:n}}/>;

const StatusBar = ({light}) => (
  <div style={{height:44,background:light?"transparent":C.primary,display:"flex",
    alignItems:"center",justifyContent:"space-between",padding:"0 20px 0 16px",flexShrink:0}}>
    <span style={{fontSize:12,fontWeight:600,color:light?C.text1:"#fff"}}>9:41</span>
    <div style={{display:"flex",gap:5,alignItems:"center"}}>
      <div style={{width:15,height:9,border:`1.5px solid ${light?C.text1:"#fff"}`,borderRadius:2,position:"relative"}}>
        <div style={{position:"absolute",top:1,left:1,right:3,bottom:1,background:light?C.text1:"#fff",borderRadius:1,width:"70%"}}/>
      </div>
      <Wifi size={12} color={light?C.text1:"#fff"}/>
    </div>
  </div>
);

const TopBar = ({title,sub,back,right,bg,tc}) => (
  <div style={{background:bg||C.primary,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
    {back && <ChevronLeft size={22} color={tc||"#fff"} style={{cursor:"pointer",flexShrink:0}}/>}
    <div style={{flex:1}}>
      <div style={{fontSize:17,fontWeight:700,color:tc||"#fff"}}>{title}</div>
      {sub && <div style={{fontSize:11,color:tc?`${tc}99`:"rgba(255,255,255,0.65)",marginTop:1}}>{sub}</div>}
    </div>
    {right}
  </div>
);

const BottomNav = ({active,phase=1}) => {
  const tabs = phase>=4
    ? [["home","Home",Home],["herd","Herd",List],["market","Market",ShoppingCart],["bell","Alerts",Bell],["me","Me",User]]
    : [["home","Home",Home],["herd","Herd",List],["add","Log",Plus],["bell","Alerts",Bell],["me","Me",User]];
  return (
    <div style={{height:64,background:"#fff",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",flexShrink:0}}>
      {tabs.map(([id,lbl,Icon]) => (
        <div key={id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,paddingTop:6}}>
          {id==="add"
            ? <div style={{width:36,height:36,borderRadius:18,background:C.mid,display:"flex",alignItems:"center",justifyContent:"center",marginTop:-10,boxShadow:"0 2px 8px rgba(46,94,46,.4)"}}><Plus size={18} color="#fff"/></div>
            : <>
              <div style={{width:34,height:26,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:13,background:active===id?C.light:"transparent"}}>
                <Icon size={17} color={active===id?C.mid:C.text3}/>
              </div>
              <span style={{fontSize:9,fontWeight:active===id?700:400,color:active===id?C.mid:C.text3}}>{lbl}</span>
            </>
          }
        </div>
      ))}
    </div>
  );
};

const Card = ({children,style}) => (
  <div style={{background:"#fff",borderRadius:12,padding:14,boxShadow:"0 1px 3px rgba(0,0,0,.07)",border:`1px solid ${C.border}`,...style}}>{children}</div>
);

const Btn = ({label,icon:Icon,size="md",variant="primary",full,style,color}) => {
  const bg = variant==="primary"?C.mid:variant==="ghost"?"transparent":"#fff";
  const tc = variant==="primary"?"#fff":color||C.mid;
  const bdr = variant==="outline"?`1.5px solid ${color||C.mid}`:"none";
  const h = {sm:34,md:44,lg:50}[size];
  const fs = {sm:13,md:14,lg:15}[size];
  return (
    <div style={{height:h,background:bg,border:bdr,borderRadius:h/2,display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",width:full?"100%":"auto",paddingLeft:14,paddingRight:14,...style}}>
      {Icon && <Icon size={fs} color={tc}/>}
      <span style={{fontSize:fs,fontWeight:600,color:tc}}>{label}</span>
    </div>
  );
};

const Badge = ({label,color,bg,size="sm"}) => (
  <div style={{display:"inline-flex",alignItems:"center",background:bg||C.light,color:color||C.mid,borderRadius:20,padding:size==="sm"?"2px 8px":"4px 12px",fontSize:size==="sm"?11:13,fontWeight:700,flexShrink:0}}>{label}</div>
);

const GradeTag = ({g}) => {
  const m = {S:[C.gold,C.goldL],A:[C.mid,C.light],B:[C.blue,C.blueL],C:[C.amber,C.amberL],D:[C.red,C.redL]};
  const [c,b] = m[g]||[C.text3,C.gray1];
  return <Badge label={`Grade ${g}`} color={c} bg={b}/>;
};

const Input = ({label,placeholder,value,icon:Icon,hint}) => (
  <div style={{marginBottom:13}}>
    {label && <div style={{fontSize:12,fontWeight:600,color:C.text2,marginBottom:5}}>{label}</div>}
    <div style={{height:44,border:`1.5px solid ${C.border}`,borderRadius:10,background:"#fff",display:"flex",alignItems:"center",paddingLeft:Icon?10:13,paddingRight:13,gap:8}}>
      {Icon && <Icon size={15} color={C.text3}/>}
      <span style={{fontSize:14,color:value?C.text1:C.text3,flex:1}}>{value||placeholder}</span>
    </div>
    {hint && <div style={{fontSize:10,color:C.text3,marginTop:3}}>{hint}</div>}
  </div>
);

const Sel = ({label,value}) => (
  <div style={{marginBottom:13}}>
    {label && <div style={{fontSize:12,fontWeight:600,color:C.text2,marginBottom:5}}>{label}</div>}
    <div style={{height:44,border:`1.5px solid ${C.border}`,borderRadius:10,background:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between",paddingLeft:13,paddingRight:12}}>
      <span style={{fontSize:14,color:value?C.text1:C.text3}}>{value||"Select..."}</span>
      <ChevronDown size={15} color={C.text3}/>
    </div>
  </div>
);

const SecLabel = ({label,action}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,marginTop:2}}>
    <span style={{fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:.5}}>{label}</span>
    {action && <span style={{fontSize:12,color:C.mid,fontWeight:600}}>{action}</span>}
  </div>
);

const Kpi = ({label,value,unit,sub,color,icon:Icon}) => (
  <Card style={{flex:1,padding:11,textAlign:"center"}}>
    {Icon && <Icon size={14} color={color||C.mid} style={{marginBottom:2}}/>}
    <div style={{fontSize:18,fontWeight:900,color:color||C.text1,lineHeight:1.1}}>{value}<span style={{fontSize:11,fontWeight:400}}>{unit}</span></div>
    <div style={{fontSize:10,color:C.text3,marginTop:1}}>{label}</div>
    {sub && <div style={{fontSize:10,color:sub.startsWith("+")?C.mid:C.amber,fontWeight:600,marginTop:1}}>{sub}</div>}
  </Card>
);

const VChip = ({label,value,unit,status}) => {
  const sc = {ok:C.light,warn:C.amberL,alert:C.redL};
  const tc = {ok:C.mid,warn:C.amber,alert:C.red};
  return (
    <div style={{background:sc[status]||sc.ok,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
      <div style={{fontSize:14,fontWeight:900,color:tc[status]||tc.ok}}>{value}<span style={{fontSize:9}}>{unit}</span></div>
      <div style={{fontSize:9,color:C.text3,marginTop:1}}>{label}</div>
    </div>
  );
};

const Div = () => <div style={{height:1,background:C.border,margin:"7px 0"}}/>;
const Scrl = ({children,style}) => <div style={{overflowY:"auto",flex:1,...style}}>{children}</div>;

// ── Individual Screens ────────────────────────────────────────
const LanguageScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.light}}>
    <StatusBar/>
    <div style={{flex:1,padding:20,display:"flex",flexDirection:"column"}}>
      <div style={{textAlign:"center",marginBottom:24,marginTop:16}}>
        <div style={{width:64,height:64,background:C.mid,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
          <span style={{fontSize:32}}>🐄</span>
        </div>
        <div style={{fontSize:24,fontWeight:800,color:C.primary}}>CattleCare</div>
        <div style={{fontSize:13,color:C.text2,marginTop:4}}>भाषा चुनें / Choose Language</div>
      </div>
      {[["हिंदी","Hindi","hi",true],["मराठी","Marathi","mr",false],["ગુજરાતી","Gujarati","gu",false],["ਪੰਜਾਬੀ","Punjabi","pa",false],["తెలుగు","Telugu","te",false],["English","English","en",false]].map(([n,e,c,s]) => (
        <div key={c} style={{background:s?C.mid:"#fff",borderRadius:11,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,marginBottom:8,border:s?`2px solid ${C.primary}`:`1.5px solid ${C.border}`}}>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:s?"#fff":C.text1}}>{n}</div>
            <div style={{fontSize:11,color:s?"rgba(255,255,255,.7)":C.text3}}>{e}</div>
          </div>
          {s && <CheckCircle size={18} color="#fff"/>}
        </div>
      ))}
      {gap(12)}
      <Btn label="Continue →" size="lg" full/>
    </div>
  </div>
);

const LoginScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <div style={{flex:1,padding:22}}>
      <div style={{marginTop:20,marginBottom:28}}>
        <div style={{fontSize:26,fontWeight:800,color:C.primary}}>नमस्ते! 👋</div>
        <div style={{fontSize:14,color:C.text2,marginTop:4}}>अपना मोबाइल नंबर दर्ज करें</div>
        <div style={{fontSize:11,color:C.text3}}>Enter your mobile number</div>
      </div>
      <div style={{background:C.light,borderRadius:11,padding:13,marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:700,color:C.mid,marginBottom:8}}>📱 MOBILE NUMBER</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{background:"#fff",borderRadius:8,padding:"9px 10px",border:`1.5px solid ${C.border}`,display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:15}}>🇮🇳</span><span style={{fontSize:13,fontWeight:600,color:C.text2}}>+91</span>
          </div>
          <div style={{flex:1,background:"#fff",borderRadius:8,padding:"9px 12px",border:`1.5px solid ${C.mid}`}}>
            <span style={{fontSize:17,fontWeight:700,color:C.text1,letterSpacing:1.5}}>98765 43210</span>
          </div>
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,color:C.text2,fontWeight:600,marginBottom:8}}>OTP — Enter code sent to +91 98765 43210</div>
        <div style={{display:"flex",gap:7}}>
          {["3","7","8","2","1","9"].map((d,i) => (
            <div key={i} style={{flex:1,height:50,background:i<5?C.light:"#fff",border:`2px solid ${i===5?C.mid:C.border}`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:C.primary}}>{d}</div>
          ))}
        </div>
        <div style={{fontSize:11,color:C.text3,marginTop:6,textAlign:"center"}}>Resend OTP in 00:22</div>
      </div>
      <Btn label="Verify & Continue →" size="lg" full/>
      {gap(16)}
      <div style={{textAlign:"center",fontSize:10,color:C.text3,lineHeight:1.5}}>By continuing you agree to CattleCare Terms & Privacy Policy (DPDP Act 2023)</div>
    </div>
  </div>
);

const FarmSetupScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <TopBar title="अपना फार्म बनाएं" sub="Step 1 of 3" back bg="#fff" tc={C.primary}/>
    <div style={{height:4,background:C.border}}><div style={{height:4,width:"33%",background:C.mid,borderRadius:2}}/></div>
    <Scrl style={{padding:18}}>
      <Input label="Farm Name / फार्म का नाम" value="Verma Dairy Farm"/>
      <Sel label="State / राज्य" value="Maharashtra"/>
      <Sel label="District / जिला" value="Nashik"/>
      <Input label="Farm Size (acres)" value="1.0" hint="Used for WiFi access point planning"/>
      <Input label="Total Cattle Count" value="118"/>
      <div style={{background:C.blueL,borderRadius:10,padding:11,marginBottom:13}}>
        <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:5}}>📍 GPS Location (auto-detected)</div>
        <div style={{fontSize:12,color:C.text2}}>19.9975° N, 73.7898° E — Nashik, MH</div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text2,marginBottom:7}}>WiFi available on farm?</div>
        <div style={{display:"flex",gap:8}}>
          {[["Yes ✓",true],["No",false]].map(([l,v]) => (
            <div key={l} style={{flex:1,height:42,background:v?C.mid:"#fff",border:`1.5px solid ${v?C.mid:C.border}`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:v?"#fff":C.text2}}>{l}</div>
          ))}
        </div>
        <div style={{fontSize:10,color:C.mid,marginTop:5}}>* Required for IoT collar connection (Phase 2)</div>
      </div>
      <Btn label="Save & Add First Cow →" size="lg" full/>
      {gap(20)}
    </Scrl>
  </div>
);

const AddCowScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <TopBar title="पहली गाय जोड़ें" sub="Step 2 of 3" back bg="#fff" tc={C.primary}/>
    <div style={{height:4,background:C.border}}><div style={{height:4,width:"66%",background:C.mid,borderRadius:2}}/></div>
    <Scrl style={{padding:18}}>
      <div style={{background:C.light,borderRadius:11,padding:13,marginBottom:18,textAlign:"center"}}>
        <div style={{width:60,height:60,background:C.mid,borderRadius:30,margin:"0 auto 8px",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:28}}>🐄</span></div>
        <div style={{fontSize:12,color:C.text3}}>Tap to add photo (optional)</div>
      </div>
      <Input label="Cow Name / गाय का नाम" placeholder="e.g. Laxmi, Ganga, Kamla" value="Laxmi"/>
      <Sel label="Breed / नस्ल" value="HF Cross (Holstein Friesian)"/>
      <div style={{display:"flex",gap:11}}>
        <div style={{flex:1}}><Input label="Age" value="4 years"/></div>
        <div style={{flex:1}}><Sel label="Parity" value="3rd lactation"/></div>
      </div>
      <Input label="Last Calving Date" placeholder="DD/MM/YYYY" icon={Calendar} value="05/04/2025"/>
      <div style={{background:C.goldL,borderRadius:9,padding:11,marginBottom:13}}>
        <div style={{fontSize:11,fontWeight:700,color:C.gold,marginBottom:3}}>💡 WHY THIS MATTERS</div>
        <div style={{fontSize:11,color:C.text2}}>Calving date lets CattleCare track Days In Milk (DIM) and predict yield from Day 1.</div>
      </div>
      <Btn label="Add Cow & Finish Setup" size="lg" full/>
      {gap(8)}
      <Btn label="Skip — add cows later" size="md" full variant="ghost"/>
      {gap(20)}
    </Scrl>
  </div>
);

const HomeScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.65)"}}>नमस्ते, Verma Ji 👋</div>
          <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>आज का सारांश</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.55)"}}>Wednesday, 29 April 2026</div>
        </div>
        <div style={{position:"relative"}}>
          <Bell size={21} color="#fff"/>
          <div style={{position:"absolute",top:-3,right:-3,width:15,height:15,background:C.red,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.primary}`}}>
            <span style={{fontSize:8,color:"#fff",fontWeight:800}}>3</span>
          </div>
        </div>
      </div>
      {gap(10)}
    </div>
    <Scrl style={{padding:12}}>
      <div style={{display:"flex",gap:9,marginBottom:11}}>
        <Kpi label="Today Milk" value="847" unit=" L" sub="+19L vs yesterday"/>
        <Kpi label="Logged" value="112" unit="/118" sub="6 pending" color={C.blue}/>
      </div>
      <div style={{display:"flex",gap:9,marginBottom:14}}>
        <Kpi label="Month Revenue" value="₹4.1L" sub="+7.5%" color={C.gold}/>
        <Kpi label="Active Alerts" value="3" sub="2 critical" color={C.red}/>
      </div>
      <SecLabel label="Active Alerts" action="See all →"/>
      <Card style={{marginBottom:12,padding:0,overflow:"hidden"}}>
        {[["#c0392b","🔴","Laxmi (COW-112)","Fever — 39.8°C","2m ago"],["#c97d20","🟡","Nandini (COW-078)","Low Rumination 288/hr","18m ago"]].map(([bc,d,n,m,t]) => (
          <div key={n} style={{padding:"9px 13px",borderLeft:`4px solid ${bc}`,borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:14}}>{d}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:C.text1}}>{n}</div>
              <div style={{fontSize:11,color:C.text2}}>{m}</div>
            </div>
            <div style={{fontSize:10,color:C.text3}}>{t}</div>
          </div>
        ))}
        <div style={{padding:"9px 13px",display:"flex",gap:6,alignItems:"center"}}>
          <Info size={12} color={C.blue}/>
          <span style={{fontSize:11,color:C.blue,fontWeight:600}}>Savitri: Calving expected in 3 days — prepare</span>
        </div>
      </Card>
      <SecLabel label="Not Logged Today — 6 cows" action="Log all →"/>
      <Card style={{marginBottom:12,padding:10}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {["Kamla","Radha","Parvati","Surabhi","Gomati","Savitri"].map(n => (
            <div key={n} style={{background:C.gray1,borderRadius:7,padding:"5px 10px",display:"flex",alignItems:"center",gap:3}}>
              <span style={{fontSize:11}}>🐄</span><span style={{fontSize:11,fontWeight:600,color:C.text2}}>{n}</span>
            </div>
          ))}
        </div>
      </Card>
      <SecLabel label="Session Breakdown"/>
      <Card style={{marginBottom:12}}>
        {[["🌅 Morning","501 L","Avg 488L",C.mid],["🌆 Evening","346 L","Avg 340L",C.blue]].map(([s,v,c,col]) => (
          <div key={s} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <div style={{width:7,height:7,borderRadius:4,background:col,flexShrink:0}}/>
            <div style={{flex:1,fontSize:12,color:C.text2}}>{s}</div>
            <div style={{fontSize:13,fontWeight:700,color:C.text1}}>{v}</div>
            <div style={{fontSize:10,color:C.text3}}>{c}</div>
          </div>
        ))}
      </Card>
      {gap(8)}
    </Scrl>
    <BottomNav active="home"/>
  </div>
);

const HerdListScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>Herd — 118 Cattle</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>102 producing • 9 dry • 7 calves</div>
        </div>
        <Filter size={19} color="#fff"/>
      </div>
      <div style={{padding:"0 13px 10px"}}>
        <div style={{background:"rgba(255,255,255,.15)",borderRadius:9,padding:"7px 11px",display:"flex",gap:7,alignItems:"center"}}>
          <Search size={14} color="rgba(255,255,255,.6)"/>
          <span style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>Search by name or tag...</span>
        </div>
      </div>
      <div style={{paddingLeft:12,paddingBottom:9,display:"flex",gap:7,overflowX:"auto"}}>
        {["All (118)","Alerts ⚠ 3","Estrus 🔴 2","Grade S ⭐","Peak Yield"].map((f,i) => (
          <div key={f} style={{background:i===0?"#fff":"rgba(255,255,255,.2)",borderRadius:20,padding:"4px 11px",whiteSpace:"nowrap",fontSize:11,fontWeight:600,color:i===0?C.mid:"#fff",flexShrink:0}}>{f}</div>
        ))}
      </div>
    </div>
    <Scrl style={{padding:11}}>
      {[["COW-033","Kamdhenu","HF Cross","4yr Lac.3","14.8L","A","ok"],["COW-112","Laxmi","HF Cross","5yr Lac.4","12.2L","A","alert"],["COW-078","Nandini","HF Cross","4yr Lac.3","11.8L","A","warn"],["COW-047","Savitri","Gir","6yr Lac.5","9.4L","B","ok"],["COW-091","Meera","Sahiwal","3yr Lac.2","7.2L","B","ok"]].map(([id,name,breed,info,y,g,s]) => (
        <Card key={id} style={{marginBottom:9}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:42,height:42,borderRadius:21,background:s==="alert"?C.redL:s==="warn"?C.amberL:C.light,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`2.5px solid ${s==="alert"?C.red:s==="warn"?C.amber:C.mid}`}}>
              <span style={{fontSize:20}}>🐄</span>
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:14,fontWeight:700,color:C.text1}}>{name}</span>
                <GradeTag g={g}/>
                {s==="alert" && <AlertTriangle size={13} color={C.red}/>}
                {s==="warn" && <AlertTriangle size={13} color={C.amber}/>}
              </div>
              <div style={{fontSize:11,color:C.text3}}>{breed} • {info}</div>
              <div style={{display:"flex",gap:5,marginTop:3}}>
                <Badge label={`🥛 ${y}`} color={C.mid} bg={C.light}/>
                <Badge label={id} color={C.text3} bg={C.gray1}/>
              </div>
            </div>
            <ChevronRight size={15} color={C.text3}/>
          </div>
        </Card>
      ))}
      {gap(8)}
    </Scrl>
    <BottomNav active="herd"/>
  </div>
);

const CowDetailScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 0",display:"flex",gap:11,alignItems:"center"}}>
        <ChevronLeft size={21} color="#fff"/>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:800,color:"#fff"}}>Laxmi — COW-112</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>HF Cross • 5yr • Lactation 4 • DIM 62</div>
        </div>
        <MoreVertical size={19} color="#fff"/>
      </div>
      <div style={{padding:"11px 16px 0",display:"flex",gap:7}}>
        {[["A","Health"],["M4","Milk"],["F4","Feed"],["P4","Pedigree"]].map(([v,l]) => (
          <div key={l} style={{background:"rgba(255,255,255,.15)",borderRadius:7,padding:"5px 9px",textAlign:"center",flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{v}</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,.65)"}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",paddingLeft:7,marginTop:10,borderTop:"1px solid rgba(255,255,255,.1)"}}>
        {["Overview","Milk","Health","Genealogy"].map((t,i) => (
          <div key={t} style={{padding:"9px 13px",fontSize:12,fontWeight:i===0?700:400,color:i===0?"#fff":"rgba(255,255,255,.55)",borderBottom:i===0?"2px solid #fff":"2px solid transparent"}}>{t}</div>
        ))}
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <SecLabel label="Today's Vitals"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:13}}>
        <VChip label="Body Temp" value="38.9" unit="°C" status="ok"/>
        <VChip label="Heart Rate" value="72" unit=" bpm" status="ok"/>
        <VChip label="SpO₂" value="97" unit="%" status="ok"/>
        <VChip label="Rumination" value="412" unit="/hr" status="ok"/>
      </div>
      <SecLabel label="Milk Today"/>
      <Card style={{marginBottom:13}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:22,fontWeight:800,color:C.mid}}>12.4 <span style={{fontSize:13,fontWeight:400,color:C.text3}}>litres</span></div>
            <div style={{fontSize:11,color:C.text3}}>Morning 7.2L + Evening 5.2L</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.gold}}>₹434 today</div>
            <div style={{fontSize:10,color:C.text3}}>at ₹35/L</div>
          </div>
        </div>
        <Div/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.text3}}>
          <span>7d avg: 12.8L</span><span>30d avg: 12.4L</span><span>Peak: 15.5L</span>
        </div>
      </Card>
      <SecLabel label="Reproduction"/>
      <Card style={{marginBottom:13}}>
        {[["Last calving","05 Apr 2025"],["Days In Milk","DIM 62 — Peak Phase"],["Next estrus","~15 May 2026"]].map(([k,v]) => (
          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <span style={{fontSize:12,color:C.text2}}>{k}</span>
            <span style={{fontSize:12,fontWeight:600,color:C.text1}}>{v}</span>
          </div>
        ))}
      </Card>
      {gap(8)}
    </Scrl>
    <div style={{position:"absolute",bottom:12,right:14}}>
      <div style={{width:48,height:48,borderRadius:24,background:C.mid,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 3px 12px rgba(46,94,46,.4)"}}><Droplets size={20} color="#fff"/></div>
    </div>
    <BottomNav active="herd"/>
  </div>
);

const MilkLogScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <TopBar title="दूध लॉग करें" sub="Log Milk Yield" back bg="#fff" tc={C.primary}
      right={<div style={{background:C.light,borderRadius:20,padding:"4px 9px",display:"flex",alignItems:"center",gap:5}}><Mic size={13} color={C.mid}/><span style={{fontSize:11,color:C.mid,fontWeight:600}}>Voice</span></div>}/>
    <div style={{padding:"13px 15px 0"}}>
      <div style={{background:C.light,borderRadius:11,padding:11,marginBottom:14,display:"flex",alignItems:"center",gap:11}}>
        <div style={{width:42,height:42,borderRadius:21,background:C.mid,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:20}}>🐄</span>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:C.primary}}>Laxmi — COW-112</div>
          <div style={{fontSize:11,color:C.text3}}>Last: 5.2L (Evening yesterday)</div>
        </div>
        <ChevronDown size={17} color={C.mid}/>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text2,marginBottom:7}}>Session / सत्र</div>
        <div style={{display:"flex",gap:7}}>
          {[["🌅","Morning",true],["🌆","Evening",false],["🌙","Night",false]].map(([e,l,s]) => (
            <div key={l} style={{flex:1,height:44,background:s?C.mid:"#fff",border:`1.5px solid ${s?C.mid:C.border}`,borderRadius:9,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
              <span style={{fontSize:15}}>{e}</span>
              <span style={{fontSize:10,fontWeight:600,color:s?"#fff":C.text3}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div style={{flex:1,padding:"0 15px 15px",display:"flex",flexDirection:"column"}}>
      <div style={{textAlign:"center",marginBottom:14}}>
        <div style={{fontSize:56,fontWeight:900,color:C.primary,lineHeight:1}}>7.5</div>
        <div style={{fontSize:16,color:C.text3}}>Litres / लीटर</div>
        <div style={{fontSize:11,color:C.text3,marginTop:3}}>Expected: ~7.2L based on history</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
        {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(d => (
          <div key={d} style={{height:50,background:d==="⌫"?C.light:C.gray1,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:d==="⌫"?18:20,fontWeight:700,color:d==="⌫"?C.red:C.text1}}>{d}</div>
        ))}
      </div>
      <Input placeholder="Note (optional): calf fed first..." icon={Edit} label=""/>
      <Btn label="✓ Save — Laxmi Morning 7.5L" size="lg" full/>
    </div>
  </div>
);

const VoiceLogScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.primary}}>
    <StatusBar/>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:22}}>
      <div style={{fontSize:14,color:"rgba(255,255,255,.7)",marginBottom:6}}>बोलिए... / Speak now</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.45)",marginBottom:28,textAlign:"center"}}>"Laxmi aaj subah saadhe aath litre"</div>
      <div style={{position:"relative",marginBottom:28}}>
        {[0,1,2].map(i => (
          <div key={i} style={{position:"absolute",width:88+i*36,height:88+i*36,borderRadius:"50%",background:`rgba(255,255,255,${.07-i*.02})`,top:`${-i*18}px`,left:`${-i*18}px`}}/>
        ))}
        <div style={{width:88,height:88,borderRadius:44,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10,position:"relative",boxShadow:"0 4px 20px rgba(0,0,0,.3)"}}>
          <Mic size={38} color={C.mid}/>
        </div>
      </div>
      <div style={{background:"rgba(255,255,255,.12)",borderRadius:13,padding:14,width:"100%",marginBottom:18}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginBottom:5}}>📝 Recognised:</div>
        <div style={{fontSize:16,fontWeight:600,color:"#fff",fontStyle:"italic"}}>"Laxmi aaj subah saadhe aath litre"</div>
      </div>
      <div style={{background:"rgba(255,255,255,.12)",borderRadius:13,padding:14,width:"100%",marginBottom:20}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginBottom:8}}>🧠 Parsed:</div>
        {[["Cow","Laxmi (COW-112)"],["Session","Morning (subah)"],["Yield","8.5 Litres (saadhe aath)"]].map(([k,v]) => (
          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,.55)"}}>{k}</span>
            <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{fontSize:14,color:"rgba(255,255,255,.85)",textAlign:"center",marginBottom:16}}>🔊 <em>"Laxmi, subah, 8.5 litre. Sahi hai kya?"</em></div>
      <div style={{display:"flex",gap:10,width:"100%"}}>
        <Btn label="हाँ / Yes ✓" size="lg" variant="outline" color="#fff" style={{flex:1,border:"2px solid rgba(255,255,255,.55)"}}/>
        <Btn label="Retry" size="lg" variant="ghost" color="rgba(255,255,255,.55)" style={{flex:1}}/>
      </div>
    </div>
    <div style={{padding:"0 22px 28px",textAlign:"center"}}>
      <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>Tap anywhere to cancel</div>
    </div>
  </div>
);

const FeedLogScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <TopBar title="Feed Purchase Log" sub="चारा खरीद" back bg="#fff" tc={C.primary}
      right={<div style={{background:C.light,borderRadius:20,padding:"4px 9px",display:"flex",alignItems:"center",gap:4}}><Mic size={13} color={C.mid}/><span style={{fontSize:11,color:C.mid,fontWeight:600}}>Voice</span></div>}/>
    <Scrl style={{padding:16}}>
      <Sel label="Feed Type / चारे का प्रकार" value="Concentrate / Compound Feed"/>
      <Input label="Feed Name / Brand" value="HindustanFeeds Gold"/>
      <div style={{display:"flex",gap:11}}>
        <div style={{flex:1}}><Input label="Quantity" value="25"/></div>
        <div style={{flex:1}}><Sel label="Unit" value="Bags (50kg)"/></div>
      </div>
      <Input label="Total Cost (₹)" value="35,500" icon={DollarSign}/>
      <div style={{background:C.amberL,borderRadius:9,padding:11,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:5}}>📊 Price vs District Average</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
          <span style={{color:C.text2}}>Your price: <strong>₹1,420/bag</strong></span>
          <span style={{color:C.mid,fontWeight:600}}>Avg: ₹1,380/bag</span>
        </div>
        <div style={{fontSize:10,color:C.amber,marginTop:3}}>⚠ 3% above district average</div>
      </div>
      <Input label="Vendor Name" value="Sharma Feeds, Nashik" icon={Package}/>
      <Input label="Estimated Days Supply" value="17 days" icon={Calendar} hint="Auto-calculates daily cost: ₹2,088/day for 118 cows"/>
      <div style={{background:C.light,borderRadius:9,padding:11,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:C.text2}}>Daily feed cost</span>
          <span style={{fontSize:13,fontWeight:700,color:C.mid}}>₹2,088/day</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
          <span style={{fontSize:11,color:C.text3}}>Per cow per day</span>
          <span style={{fontSize:11,fontWeight:600,color:C.text2}}>₹17.69/cow</span>
        </div>
      </div>
      <Btn label="Save Purchase Log" size="lg" full/>
      {gap(20)}
    </Scrl>
  </div>
);

const HealthEvtScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <TopBar title="Health Event" sub="स्वास्थ्य घटना" back bg="#fff" tc={C.primary}/>
    <Scrl style={{padding:16}}>
      <div style={{background:C.redL,borderRadius:11,padding:11,marginBottom:14,display:"flex",alignItems:"center",gap:9}}>
        <span style={{fontSize:22}}>🐄</span>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.primary}}>Laxmi — COW-112</div>
          <div style={{fontSize:11,color:C.red,fontWeight:600}}>Active Alert: Fever 39.8°C</div>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text2,marginBottom:7}}>Event Type</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {[["💊","Treatment",true],["💉","Vaccination",false],["👨‍⚕️","Vet Visit",false],["🤒","Illness",false]].map(([e,l,s]) => (
            <div key={l} style={{height:52,background:s?C.redL:C.gray1,border:`1.5px solid ${s?C.red:C.border}`,borderRadius:9,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
              <span style={{fontSize:17}}>{e}</span>
              <span style={{fontSize:11,fontWeight:600,color:s?C.red:C.text2}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <Input label="Medicine / दवा" value="Melonex 5ml (Antipyretic)" icon={Package}/>
      <Input label="Dose" value="5ml IM injection"/>
      <Input label="Date" value="29 Apr 2026" icon={Calendar}/>
      <div style={{background:C.amberL,borderRadius:9,padding:11,marginBottom:13,border:`1.5px solid ${C.amber}`}}>
        <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:3}}>⚠ Milk Withdrawal Period</div>
        <div style={{fontSize:11,color:C.text2}}>Melonex: <strong>3-day withdrawal</strong>. Laxmi's milk excluded until 2 May 2026.</div>
      </div>
      <Btn label="Save Health Event" size="lg" full style={{background:C.red}}/>
      {gap(20)}
    </Scrl>
  </div>
);

const ProfileScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"11px 16px 18px",display:"flex",gap:13,alignItems:"center"}}>
        <div style={{width:52,height:52,borderRadius:26,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:26}}>👨‍🌾</span></div>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:800,color:"#fff"}}>Ramesh Verma</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>Verma Dairy Farm • Nashik, MH</div>
          <div style={{display:"flex",gap:5,marginTop:4}}>
            <Badge label="✓ KYC Verified" color="rgba(255,255,255,.9)" bg="rgba(255,255,255,.15)"/>
            <Badge label="⭐ Premium" color={C.gold} bg={C.goldL}/>
          </div>
        </div>
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <Card style={{marginBottom:13,background:C.goldL,border:`1.5px solid ${C.gold}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.gold}}>Premium Subscription</div>
            <div style={{fontSize:12,color:C.text2}}>118 collars × ₹149/month</div>
            <div style={{fontSize:11,color:C.text3}}>Renews 1 May 2026 • ₹17,582</div>
          </div>
          <ChevronRight size={17} color={C.gold}/>
        </div>
      </Card>
      <Card style={{marginBottom:13}}>
        <div style={{fontSize:13,fontWeight:700,color:C.primary,marginBottom:7}}>🎁 Referral Program</div>
        <div style={{background:C.light,borderRadius:7,padding:9,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:14,fontWeight:800,color:C.mid,letterSpacing:2}}>VERMA2026</span>
          <Badge label="Copy" color={C.mid} bg={C.light}/>
        </div>
        <div style={{fontSize:11,color:C.text3}}>2 successful referrals • ₹1,000 credit earned</div>
      </Card>
      {[["Language / भाषा",[["🌐","App Language","हिंदी"],["🔔","Notifications","All on"]]],["Farm",[["🏠","Farm Profile","Verma Dairy"],["📊","My Collars","118 active"],["📤","Export My Data","CSV"]]],["Account",[["🔒","Privacy (DPDP Act)",""],["❓","Help & Support",""],["👋","Logout",""]]]].map(([title,items]) => (
        <div key={title} style={{marginBottom:13}}>
          <SecLabel label={title}/>
          <Card style={{padding:0,overflow:"hidden"}}>
            {items.map(([icon,label,value],i) => (
              <div key={label} style={{padding:"11px 13px",display:"flex",alignItems:"center",gap:11,borderBottom:i<items.length-1?`1px solid ${C.border}`:"none"}}>
                <span style={{fontSize:17,width:22,textAlign:"center"}}>{icon}</span>
                <span style={{flex:1,fontSize:13,color:C.text1}}>{label}</span>
                {value && <span style={{fontSize:12,color:C.text3}}>{value}</span>}
                <ChevronRight size={15} color={C.text3}/>
              </div>
            ))}
          </Card>
        </div>
      ))}
      {gap(8)}
    </Scrl>
    <BottomNav active="me"/>
  </div>
);

const BLESetupScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <TopBar title="New Collar Setup" sub="कॉलर जोड़ें" back bg="#fff" tc={C.primary}/>
    <div style={{padding:"11px 18px",display:"flex",gap:7,alignItems:"center"}}>
      {["Scan","Found","Assign","Done"].map((s,i) => (
        <div key={s} style={{display:"flex",alignItems:"center",flex:i<3?"none":1}}>
          <div style={{width:26,height:26,borderRadius:13,background:i===1?C.mid:i<1?C.light:C.gray2,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {i<1?<CheckCircle size={15} color={C.mid}/>:<span style={{fontSize:11,fontWeight:700,color:i===1?"#fff":C.text3}}>{i+1}</span>}
          </div>
          {i<3 && <div style={{flex:1,height:2,background:i<1?C.mid:C.gray2,marginLeft:3,marginRight:3}}/>}
        </div>
      ))}
    </div>
    <div style={{flex:1,padding:"0 18px 18px"}}>
      <div style={{textAlign:"center",marginBottom:18}}>
        <div style={{fontSize:15,fontWeight:700,color:C.primary}}>Collar Found! 📡</div>
        <div style={{fontSize:12,color:C.text3}}>BLE device detected nearby</div>
      </div>
      <Card style={{marginBottom:14,border:`2px solid ${C.mid}`,background:C.light}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:44,height:44,borderRadius:22,background:C.mid,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Cpu size={22} color="#fff"/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:C.primary}}>CattleCollar-A1B2C3</div>
            <div style={{display:"flex",gap:6,marginTop:3}}>
              <Badge label="✓ Unpaired" color={C.mid} bg={C.light}/>
              <Badge label="Battery 87%" color={C.text2} bg={C.gray1}/>
            </div>
          </div>
          <div style={{width:9,height:9,borderRadius:5,background:C.mid,boxShadow:`0 0 5px ${C.mid}`}}/>
        </div>
      </Card>
      <SecLabel label="Assign to Cow / गाय को दें"/>
      <Sel label="" value="Laxmi — COW-112 (unequipped)"/>
      <SecLabel label="Farm WiFi Credentials"/>
      <Input label="WiFi Network" value="VermaDairy_2.4G" icon={Wifi}/>
      <Input label="WiFi Password" value="••••••••••" icon={Lock}/>
      <div style={{background:C.blueL,borderRadius:9,padding:11,marginBottom:14}}>
        <div style={{fontSize:11,color:C.blue}}>📡 Collar connects to WiFi directly — phone not needed after setup. BLE disabled automatically after provisioning.</div>
      </div>
      <Btn label="Send to Collar & Connect" size="lg" full/>
    </div>
  </div>
);

const LiveDashScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 11px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:7,height:7,borderRadius:4,background:"#4ade80",boxShadow:"0 0 5px #4ade80"}}/>
            <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>Live Dashboard</div>
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>118 collars active • synced 12s ago</div>
        </div>
        <RefreshCw size={19} color="#fff"/>
      </div>
      <div style={{margin:"0 14px 12px",background:"rgba(0,0,0,.2)",borderRadius:7,overflow:"hidden",height:26}}>
        <div style={{display:"flex",height:"100%",alignItems:"center"}}>
          <div style={{width:"65%",height:"100%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",paddingLeft:9}}><span style={{fontSize:11,color:"#fff",fontWeight:600}}>🏠 Shed: 77</span></div>
          <div style={{flex:1,height:"100%",display:"flex",alignItems:"center",paddingLeft:7}}><span style={{fontSize:11,color:"rgba(255,255,255,.75)"}}>🌿 Open: 41</span></div>
        </div>
      </div>
    </div>
    <Scrl style={{padding:12}}>
      <div style={{display:"flex",gap:8,marginBottom:11}}>
        <Kpi label="Avg Temp" value="38.8" unit="°C" sub="Normal"/>
        <Kpi label="Avg HR" value="68" unit=" bpm" sub="Normal" color={C.blue}/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:13}}>
        <Kpi label="Avg SpO₂" value="97" unit="%" sub="Healthy" color={C.teal}/>
        <Kpi label="Avg Rumin." value="398" unit="/hr" sub="Good"/>
      </div>
      <SecLabel label="⚠ Active Alerts — 3" action="Resolve all"/>
      <Card style={{marginBottom:13,padding:0,overflow:"hidden",border:`1.5px solid ${C.red}`}}>
        {[["🔴","Laxmi","COW-112","Fever 39.8°C","2m"],["🟠","Nandini","COW-078","Low Rumination 288/hr","18m"],["🔵","Savitri","COW-047","Calving in ~3 days","1h"]].map(([d,n,id,m,t]) => (
          <div key={id} style={{padding:"9px 13px",display:"flex",gap:7,alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:13}}>{d}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:C.text1}}>{n} <span style={{fontSize:10,color:C.text3,fontWeight:400}}>({id})</span></div>
              <div style={{fontSize:11,color:C.text2}}>{m}</div>
            </div>
            <div style={{fontSize:10,color:C.text3}}>{t}</div>
          </div>
        ))}
      </Card>
      <SecLabel label="Herd Health Distribution"/>
      <Card style={{marginBottom:12}}>
        {[["Normal (0-25)","94 cows","80%",C.mid],["Watch (26-45)","14 cows","12%",C.blue],["Elevated (46-64)","7 cows","6%",C.amber],["High Risk (65+)","3 cows","2%",C.red]].map(([l,c,p,col]) => (
          <div key={l} style={{marginBottom:7}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
              <span style={{fontSize:11,color:C.text2}}>{l}</span>
              <span style={{fontSize:11,fontWeight:600,color:col}}>{c}</span>
            </div>
            <div style={{height:5,background:C.gray2,borderRadius:3}}><div style={{height:5,width:p,background:col,borderRadius:3}}/></div>
          </div>
        ))}
      </Card>
      {gap(8)}
    </Scrl>
    <BottomNav active="home" phase={2}/>
  </div>
);

const AlertListScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.red}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 11px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>Health Alerts</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>3 active • 2 critical</div>
        </div>
        <Filter size={19} color="#fff"/>
      </div>
      <div style={{paddingLeft:13,paddingBottom:10,display:"flex",gap:7}}>
        {["All (3)","Critical (2)","Warning (1)","Resolved (14)"].map((f,i) => (
          <div key={f} style={{background:i===0?"#fff":"rgba(255,255,255,.2)",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:600,color:i===0?C.red:"#fff",flexShrink:0}}>{f}</div>
        ))}
      </div>
    </div>
    <Scrl style={{padding:11}}>
      {[["c","🔴","CRITICAL","Fever Alert","Laxmi — COW-112","Body temp 39.8°C — threshold 39.5°C. Possible infection.","2 min ago"],["w","🟠","WARNING","Predictive Risk","Nandini — COW-078","AI Risk Score 68. Rumination -22% from baseline.","18 min ago"],["i","🔵","INFO","Calving Alert","Savitri — COW-047","Pre-calving temp drop. Calving expected in 8-24h.","1 hr ago"]].map(([t,d,sev,title,cow,msg,time]) => (
        <Card key={title} style={{marginBottom:9,borderLeft:`4px solid ${t==="c"?C.red:t==="w"?C.amber:C.blue}`,padding:0}}>
          <div style={{padding:"11px 13px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                <span style={{fontSize:15}}>{d}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:C.text1}}>{title}</div>
                  <div style={{fontSize:10,color:C.text3}}>{cow}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <Badge label={sev} color={t==="c"?C.red:t==="w"?C.amber:C.blue} bg={t==="c"?C.redL:t==="w"?C.amberL:C.blueL}/>
                <div style={{fontSize:9,color:C.text3,marginTop:1}}>{time}</div>
              </div>
            </div>
            <div style={{fontSize:11,color:C.text2,marginBottom:8}}>{msg}</div>
            <div style={{display:"flex",gap:7}}>
              <Btn label="Resolve" size="sm" variant="outline" color={t==="c"?C.red:t==="w"?C.amber:C.blue} style={{flex:1,border:`1px solid ${t==="c"?C.red:t==="w"?C.amber:C.blue}`}}/>
              <Btn label="View Cow" size="sm" variant="ghost" color={C.text3} style={{flex:1}}/>
            </div>
          </div>
        </Card>
      ))}
      {gap(8)}
    </Scrl>
    <BottomNav active="bell" phase={2}/>
  </div>
);

const AlertDetScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <div style={{background:C.red}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 13px",display:"flex",gap:11,alignItems:"center"}}>
        <ChevronLeft size={21} color="#fff"/>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>Fever Alert — CRITICAL</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>Laxmi (COW-112) • 2 min ago</div>
        </div>
        <Badge label="UNRESOLVED" color="#fff" bg="rgba(255,255,255,.2)"/>
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <SecLabel label="Vitals at Alert Time — 09:41"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:13}}>
        <VChip label="Body Temp" value="39.8" unit="°C" status="alert"/>
        <VChip label="Heart Rate" value="94" unit=" bpm" status="warn"/>
        <VChip label="Rumination" value="312" unit="/hr" status="warn"/>
        <VChip label="Activity" value="38" unit="/100" status="warn"/>
      </div>
      <Card style={{marginBottom:13,border:`1.5px solid ${C.red}`,background:C.redL}}>
        <div style={{fontSize:12,fontWeight:700,color:C.red,marginBottom:6}}>⚠ Why this fired:</div>
        <div style={{fontSize:11,color:C.text2,lineHeight:1.6}}>Body temp <strong>39.8°C</strong> exceeded HF Cross threshold (39.5°C). Temperature rising +0.12°C/hr for 6 hours. Rumination 22% below her personal 7-day average.</div>
      </Card>
      <SecLabel label="Suggested Treatment" action="Order →"/>
      <Card style={{marginBottom:13}}>
        {[["💊","Melonex 30ml","Antipyretic — OTC","₹85"],["🧪","Oxytetracycline","Antibiotic — Rx required","₹220"],["💧","ORS Sachets 10pk","Rehydration — OTC","₹45"]].map(([e,n,d,p]) => (
          <div key={n} style={{display:"flex",gap:9,marginBottom:9}}>
            <span style={{fontSize:18,flexShrink:0}}>{e}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:C.text1}}>{n}</div>
              <div style={{fontSize:10,color:C.text3}}>{d}</div>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:C.mid,flexShrink:0}}>{p}</span>
          </div>
        ))}
        <Btn label="Add to Cart (₹350 total)" size="sm" full variant="outline" color={C.mid} style={{border:`1.5px solid ${C.mid}`,marginTop:3}}/>
      </Card>
      <SecLabel label="Resolve Alert"/>
      <Card style={{marginBottom:13}}>
        <Sel label="What did you do?" value="Examined — gave medicine"/>
        <Input label="Notes" placeholder="Any observations or treatment..."/>
        <Btn label="✓ Mark as Resolved" size="md" full/>
      </Card>
      <div style={{display:"flex",gap:9,marginBottom:13}}>
        <Btn label="📞 Call Vet" size="md" variant="outline" color={C.blue} style={{flex:1,border:`1.5px solid ${C.blue}`}}/>
        <Btn label="📹 Video Consult" size="md" variant="outline" color={C.teal} style={{flex:1,border:`1.5px solid ${C.teal}`}}/>
      </div>
      {gap(8)}
    </Scrl>
  </div>
);

const CowVitalsScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 13px",display:"flex",gap:11,alignItems:"center"}}>
        <ChevronLeft size={21} color="#fff"/>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>Laxmi — Live Vitals</div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:5,height:5,borderRadius:3,background:"#4ade80",boxShadow:"0 0 4px #4ade80"}}/>
            <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>Live • updates every 30s</div>
          </div>
        </div>
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <Card style={{marginBottom:13,textAlign:"center",padding:18}}>
        <div style={{fontSize:11,fontWeight:700,color:C.text3,marginBottom:7,textTransform:"uppercase",letterSpacing:.5}}>AI Risk Score</div>
        <div style={{width:90,height:90,borderRadius:45,border:`8px solid ${C.redL}`,borderTopColor:C.red,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 7px"}}>
          <div><div style={{fontSize:26,fontWeight:900,color:C.red}}>71</div><div style={{fontSize:9,color:C.text3}}>/100</div></div>
        </div>
        <div style={{fontSize:12,fontWeight:700,color:C.red}}>HIGH RISK</div>
        <div style={{fontSize:10,color:C.text3}}>Possible illness in next 24-48h</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:13}}>
        {[["🌡","Body Temp","39.8","°C",C.red,"38.0-39.5°C"],["❤️","Heart Rate","94","bpm",C.amber,"48-80 bpm"],["🫁","SpO₂","96","%",C.mid,"96-100%"],["🐄","Rumination","312","/hr",C.amber,"380-600/hr"],["⚡","Activity","38","/100",C.amber,"45-85"],["📍","Zone","Shed","",C.blue,"AP03 — shed"]].map(([e,l,v,u,col,hint]) => (
          <Card key={l} style={{padding:11,textAlign:"center"}}>
            <span style={{fontSize:18}}>{e}</span>
            <div style={{fontSize:18,fontWeight:900,color:col,marginTop:3}}>{v}<span style={{fontSize:9,fontWeight:400,color:C.text3}}>{u}</span></div>
            <div style={{fontSize:10,fontWeight:600,color:C.text2,marginTop:1}}>{l}</div>
            <div style={{fontSize:9,color:C.text3}}>{hint}</div>
          </Card>
        ))}
      </div>
      <SecLabel label="24h Temperature Trend"/>
      <Card style={{marginBottom:13,padding:13}}>
        <div style={{display:"flex",alignItems:"flex-end",gap:2,height:55,marginBottom:5}}>
          {[38.2,38.3,38.4,38.3,38.5,38.6,38.7,38.8,38.9,39.0,39.2,39.4,39.5,39.6,39.7,39.8].map((v,i) => (
            <div key={i} style={{flex:1,background:v>=39.5?C.red:v>=39.0?C.amber:C.mid,borderRadius:"2px 2px 0 0",height:`${((v-38)/2)*100}%`,minHeight:3}}/>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:9,color:C.text3}}>09:00</span>
          <span style={{fontSize:9,color:C.red,fontWeight:600}}>↑ Rising trend</span>
          <span style={{fontSize:9,color:C.text3}}>Now</span>
        </div>
      </Card>
      {gap(8)}
    </Scrl>
  </div>
);

const RiskScoreScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.red}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 13px",display:"flex",gap:11,alignItems:"center"}}>
        <ChevronLeft size={21} color="#fff"/>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>AI Health Prediction</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>Laxmi (COW-112) • Updated 2 min ago</div>
        </div>
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <Card style={{marginBottom:13,textAlign:"center",padding:22}}>
        <div style={{fontSize:11,fontWeight:700,color:C.text3,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Risk Score</div>
        <div style={{position:"relative",width:148,height:148,margin:"0 auto 14px"}}>
          <svg width="148" height="148" style={{transform:"rotate(-90deg)"}}>
            <circle cx="74" cy="74" r="62" fill="none" stroke={C.gray2} strokeWidth="11"/>
            <circle cx="74" cy="74" r="62" fill="none" stroke={C.red} strokeWidth="11" strokeDasharray="390" strokeDashoffset={`${390*(1-0.71)}`} strokeLinecap="round"/>
          </svg>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
            <div style={{fontSize:38,fontWeight:900,color:C.red,lineHeight:1}}>71</div>
            <div style={{fontSize:11,color:C.text3}}>/ 100</div>
          </div>
        </div>
        <div style={{background:C.redL,borderRadius:9,padding:9}}>
          <div style={{fontSize:14,fontWeight:800,color:C.red}}>HIGH RISK</div>
          <div style={{fontSize:11,color:C.text2,marginTop:3}}>Predicted: <strong>Fever / Systemic</strong> (74%)</div>
          <div style={{fontSize:10,color:C.text3,marginTop:2}}>Likely onset: next 24-48 hours</div>
        </div>
      </Card>
      <SecLabel label="Signal Breakdown — 14 Features"/>
      <Card style={{marginBottom:13}}>
        {[["Rumination drop rate","-22% vs baseline",C.red,"HIGH"],["Temperature drift","+0.12°C/hr × 6h",C.red,"HIGH"],["Activity decline","-18% from normal",C.amber,"MED"],["Heart rate trend","+14 bpm trend",C.amber,"MED"],["Grazing time","-2.1 hours today",C.amber,"MED"],["SpO₂ trend","96% borderline",C.blue,"LOW"]].map(([f,v,col,sev]) => (
          <div key={f} style={{display:"flex",gap:7,alignItems:"center",marginBottom:7}}>
            <div style={{width:7,height:7,borderRadius:4,background:col,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:600,color:C.text1}}>{f}</div>
              <div style={{fontSize:10,color:C.text3}}>{v}</div>
            </div>
            <Badge label={sev} color={col} bg={col===C.red?C.redL:col===C.amber?C.amberL:C.blueL} size="sm"/>
          </div>
        ))}
      </Card>
      <SecLabel label="Your Feedback — Trains AI"/>
      <div style={{display:"flex",gap:7,marginBottom:13}}>
        <Btn label="🤒 Confirmed ill" size="sm" variant="outline" color={C.red} style={{flex:1,border:`1px solid ${C.red}`}}/>
        <Btn label="✓ Examined OK" size="sm" variant="outline" color={C.mid} style={{flex:1,border:`1px solid ${C.mid}`}}/>
        <Btn label="False alarm" size="sm" variant="outline" color={C.text3} style={{flex:1,border:`1px solid ${C.border}`}}/>
      </div>
      {gap(8)}
    </Scrl>
  </div>
);

const HerdDashScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 10px"}}>
        <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>Farm Analytics</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>Verma Dairy Farm • 118 cows</div>
      </div>
      <div style={{paddingLeft:13,paddingBottom:10,display:"flex",gap:7,overflowX:"auto"}}>
        {["Today ✓","Trend","Rankings","Revenue","Alerts"].map((v,i) => (
          <div key={v} style={{background:i===0?"#fff":"rgba(255,255,255,.2)",borderRadius:20,padding:"5px 13px",fontSize:12,fontWeight:600,color:i===0?C.mid:"#fff",flexShrink:0}}>{v}</div>
        ))}
      </div>
    </div>
    <Scrl style={{padding:12}}>
      <div style={{display:"flex",gap:8,marginBottom:11}}>
        <Kpi label="Total Yield" value="847" unit="L" sub="+19L vs yesterday"/>
        <Kpi label="Revenue" value="₹29,645" sub="+2.3% above avg" color={C.gold}/>
      </div>
      <SecLabel label="Session Breakdown"/>
      <Card style={{marginBottom:12}}>
        {[["🌅 Morning","501 L","59.1%",C.mid],["🌆 Evening","346 L","40.9%",C.blue]].map(([s,v,p,c]) => (
          <div key={s} style={{marginBottom:9}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:12,color:C.text2}}>{s}</span>
              <span style={{fontSize:12,fontWeight:700}}>{v}</span>
            </div>
            <div style={{height:7,background:C.gray2,borderRadius:4}}><div style={{height:7,width:p,background:c,borderRadius:4}}/></div>
          </div>
        ))}
        <Div/>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:C.text2}}>TOTAL</span>
          <span style={{fontSize:14,fontWeight:800,color:C.mid}}>847 Litres</span>
        </div>
      </Card>
      <SecLabel label="Last 7 Days"/>
      <Card style={{marginBottom:12,padding:13}}>
        <div style={{display:"flex",alignItems:"flex-end",gap:4,height:64,marginBottom:5}}>
          {[790,808,795,812,828,841,847].map((v,i) => (
            <div key={i} style={{flex:1,background:i===6?C.mid:C.light,borderRadius:"3px 3px 0 0",height:`${((v-780)/70)*100}%`,minHeight:5}}/>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          {["M","T","W","T","F","S","T"].map((d,i) => (
            <span key={i} style={{flex:1,textAlign:"center",fontSize:9,color:i===6?C.mid:C.text3,fontWeight:i===6?700:400}}>{d}</span>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:6,fontSize:11,color:C.mid,fontWeight:600}}>↑ Trending up +7.2% week-on-week</div>
      </Card>
      <SecLabel label="Month Projection"/>
      <Card style={{marginBottom:11}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
          <span style={{fontSize:12,color:C.text2}}>Month to date</span>
          <span style={{fontSize:13,fontWeight:700}}>₹4,08,920</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:C.text2}}>Projected full month</span>
          <span style={{fontSize:13,fontWeight:700,color:C.mid}}>₹5,23,440</span>
        </div>
      </Card>
      {gap(8)}
    </Scrl>
    <BottomNav active="home" phase={3}/>
  </div>
);

const RankingsScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 10px"}}>
        <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>Cow Rankings</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>118 cows • 7 sort modes</div>
      </div>
      <div style={{paddingLeft:13,paddingBottom:10,display:"flex",gap:7,overflowX:"auto"}}>
        {["Top Yield ✓","Best Efficiency","Declining","Growing","At Peak","Consider Sell"].map((m,i) => (
          <div key={m} style={{background:i===0?"#fff":"rgba(255,255,255,.2)",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:600,color:i===0?C.mid:"#fff",flexShrink:0}}>{m}</div>
        ))}
      </div>
    </div>
    <Scrl style={{padding:11}}>
      {[["#1",C.gold,"Kamdhenu","COW-033","14.8L","F4","A","↑ +0.8L","DIM 62 Peak"],["#2",C.text2,"Nandini","COW-078","12.2L","F4","A","↑ +0.4L","DIM 48 Peak"],["#3",C.text2,"Savitri","COW-047","11.8L","F3","A","→ stable","DIM 79 Decline"],["#4",C.text2,"Ganga","COW-055","11.5L","F3","B","↓ -0.3L","DIM 95 Decline"],["#5",C.text2,"Radha","COW-062","10.9L","F5","A","↑ +0.6L","DIM 41 Rising"]].map(([rank,rankC,name,id,yield_,eff,g,trend,stage]) => (
        <Card key={id} style={{marginBottom:9}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:30,height:30,borderRadius:15,background:rank==="#1"?C.goldL:C.gray1,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:12,fontWeight:800,color:rankC}}>{rank}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:13,fontWeight:700,color:C.text1}}>{name}</span>
                <GradeTag g={g}/>
                <Badge label={eff} color={C.teal} bg={C.tealL}/>
              </div>
              <div style={{fontSize:10,color:C.text3}}>{id} • {stage}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:15,fontWeight:800,color:C.mid}}>{yield_}</div>
              <div style={{fontSize:10,color:trend.startsWith("↑")?C.mid:trend.startsWith("↓")?C.red:C.text3,fontWeight:600}}>{trend}</div>
            </div>
          </div>
        </Card>
      ))}
      {gap(8)}
    </Scrl>
  </div>
);

const RevenueScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.gold}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 13px"}}>
        <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>Revenue View</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>April 2026 • ₹35/litre</div>
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <Card style={{marginBottom:13,background:C.goldL,border:`1.5px solid ${C.gold}`}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.text3,marginBottom:5}}>GROSS MILK REVENUE (MONTH)</div>
          <div style={{fontSize:34,fontWeight:900,color:C.gold}}>₹8,40,000</div>
          <div style={{fontSize:11,color:C.mid,fontWeight:600}}>vs ₹7,98,240 last month +5.2%</div>
        </div>
        <Div/>
        <div style={{display:"flex",justifyContent:"space-around"}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:C.red}}>₹1,85,000</div><div style={{fontSize:10,color:C.text3}}>Feed Cost</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:C.mid}}>₹6,55,000</div><div style={{fontSize:10,color:C.text3}}>Gross Margin</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:C.blue}}>₹7.71</div><div style={{fontSize:10,color:C.text3}}>CPL</div></div>
        </div>
      </Card>
      <SecLabel label="Per-Cow Revenue" action="See all →"/>
      <Card style={{marginBottom:13}}>
        {[["Kamdhenu","14.8L","₹518","₹373 profit"],["Nandini","12.2L","₹427","₹282 profit"]].map(([n,l,r,p]) => (
          <div key={n} style={{display:"flex",gap:7,marginBottom:8}}>
            <span style={{fontSize:13}}>🐄</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600}}>{n} — {l}/day</div>
              <div style={{fontSize:10,color:C.text3}}>₹145 feed • <span style={{color:C.mid,fontWeight:600}}>{p}</span></div>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:C.gold}}>{r}/day</span>
          </div>
        ))}
        <div style={{background:C.redL,borderRadius:7,padding:9}}>
          <div style={{fontSize:11,color:C.red,fontWeight:700}}>⚠ Meera (COW-091): 3.8L — -₹12/day (loss)</div>
        </div>
      </Card>
      <SecLabel label="April Revenue Calendar"/>
      <Card style={{marginBottom:13,padding:11}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {["M","T","W","T","F","S","S"].map(d => <div key={d} style={{textAlign:"center",fontSize:9,color:C.text3,fontWeight:600,marginBottom:1}}>{d}</div>)}
          {[null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30].map((d,i) => (
            <div key={i} style={{height:24,borderRadius:3,background:d&&d<=29?C.light:"transparent",display:"flex",alignItems:"center",justifyContent:"center",border:d===29?`1.5px solid ${C.mid}`:"none"}}>
              <span style={{fontSize:9,fontWeight:d===29?800:400,color:d&&d<=29?C.mid:"transparent"}}>{d||""}</span>
            </div>
          ))}
        </div>
      </Card>
      <Btn label="📄 Export Monthly PDF" size="md" full variant="outline" color={C.gold} style={{border:`1.5px solid ${C.gold}`}}/>
      {gap(20)}
    </Scrl>
  </div>
);

const MilkPredScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.teal}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 13px",display:"flex",gap:11,alignItems:"center"}}>
        <ChevronLeft size={21} color="#fff"/>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>Milk Yield Prediction</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>Laxmi (COW-112) • High Confidence</div>
        </div>
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <div style={{display:"flex",gap:9,marginBottom:13}}>
        <Card style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:11,color:C.text3,marginBottom:3}}>Today Logged</div>
          <div style={{fontSize:26,fontWeight:900,color:C.mid}}>12.4<span style={{fontSize:12,fontWeight:400}}>L</span></div>
          <div style={{fontSize:10,color:C.text3}}>Actual</div>
        </Card>
        <Card style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:11,color:C.text3,marginBottom:3}}>AI Prediction</div>
          <div style={{fontSize:26,fontWeight:900,color:C.teal}}>12.8<span style={{fontSize:12,fontWeight:400}}>L</span></div>
          <div style={{fontSize:10,color:C.mid}}>±0.6L confidence</div>
        </Card>
      </div>
      <SecLabel label="Lactation Curve — Wood Model"/>
      <Card style={{marginBottom:13,padding:13}}>
        <svg width="100%" height="80" viewBox="0 0 270 80">
          <polyline points="0,70 25,48 50,28 75,18 105,20 135,30" fill="none" stroke={C.mid} strokeWidth="2.5"/>
          <polyline points="135,30 165,36 195,44 225,54" fill="none" stroke={C.mid} strokeWidth="2" strokeDasharray="4,3" opacity=".6"/>
          <polyline points="0,68 25,46 50,26 75,16 105,18 135,28 165,38 195,46 225,56 270,66" fill="none" stroke={C.teal} strokeWidth="1.5" strokeDasharray="3,3" opacity=".6"/>
          <circle cx="135" cy="30" r="5" fill={C.mid}/>
          <text x="140" y="25" fontSize="8" fill={C.mid} fontWeight="bold">DIM 62</text>
        </svg>
        <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:4}}>
          <div style={{display:"flex",gap:3,alignItems:"center"}}><div style={{width:14,height:2,background:C.mid}}/><span style={{fontSize:9,color:C.text3}}>Actual</span></div>
          <div style={{display:"flex",gap:3,alignItems:"center"}}><div style={{width:14,height:2,background:C.teal}}/><span style={{fontSize:9,color:C.text3}}>Wood curve</span></div>
        </div>
      </Card>
      <SecLabel label="Forecast"/>
      <Card style={{marginBottom:13}}>
        {[["7 days","12.4–13.1 L/day","High","₹45,500"],["30 days","11.8–12.8 L/day","High","₹1,78,000"],["305-day","~3,400 L projected","Medium","₹1,19,000"]].map(([p,v,c,r]) => (
          <div key={p} style={{display:"flex",justifyContent:"space-between",marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
            <div>
              <div style={{fontSize:12,fontWeight:700}}>{p}</div>
              <div style={{fontSize:11,color:C.text2}}>{v}</div>
              <Badge label={c} color={C.teal} bg={C.tealL}/>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:C.gold}}>{r}</div>
          </div>
        ))}
      </Card>
      <SecLabel label="Buyer ROI Calculator"/>
      <Card style={{marginBottom:13}}>
        <Input label="Asking Price (₹)" value="62,000" icon={DollarSign}/>
        <Input label="Your Milk Price (₹/L)" value="35"/>
        <div style={{background:C.light,borderRadius:7,padding:11}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:12,color:C.text2}}>Breakeven point</span>
            <span style={{fontSize:13,fontWeight:800,color:C.mid}}>4.3 months</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:12,color:C.text2}}>Year 1 net surplus</span>
            <span style={{fontSize:13,fontWeight:800,color:C.mid}}>₹1,12,905</span>
          </div>
        </div>
      </Card>
      {gap(8)}
    </Scrl>
  </div>
);

const MarketScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>CattleCare Market</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>342 verified listings • All India</div>
        </div>
        <div style={{display:"flex",gap:8}}><Search size={19} color="#fff"/><Filter size={19} color="#fff"/></div>
      </div>
      <div style={{paddingLeft:13,paddingBottom:10,display:"flex",gap:7,overflowX:"auto"}}>
        {["All","Grade S ⭐","Grade A","HF Cross","Gir (A2)","Murrah","< ₹50K"].map((f,i) => (
          <div key={f} style={{background:i===0?"#fff":"rgba(255,255,255,.2)",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:600,color:i===0?C.mid:"#fff",flexShrink:0}}>{f}</div>
        ))}
      </div>
    </div>
    <Scrl style={{padding:11}}>
      <Card style={{marginBottom:11,border:`2px solid ${C.gold}`,background:"#fff"}}>
        <div style={{display:"flex",gap:3,marginBottom:7}}>
          <Badge label="⭐ Grade S" color={C.gold} bg={C.goldL}/>
          <Badge label="M5 Elite" color={C.teal} bg={C.tealL}/>
          <Badge label="P4 Lineage" color={C.blue} bg={C.blueL}/>
        </div>
        <div style={{display:"flex",gap:11,marginBottom:9}}>
          <div style={{width:58,height:58,borderRadius:9,background:C.light,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:28}}>🐄</span></div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700}}>Kamdhenu — COW-033</div>
            <div style={{fontSize:11,color:C.text3}}>HF Cross • 4yr • Lac.3 • DIM 62 (Peak)</div>
            <div style={{fontSize:11,color:C.text2,marginTop:3}}>📍 Nashik, MH • 2 days ago</div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
          <div><div style={{fontSize:22,fontWeight:900,color:C.primary}}>₹74,000</div><div style={{fontSize:10,color:C.mid}}>Grade S premium verified</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:C.teal}}>14.8 L/day avg</div><div style={{fontSize:10,color:C.text3}}>90d verified</div></div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <Btn label="View Passport" size="sm" variant="outline" color={C.primary} style={{flex:1,border:`1.5px solid ${C.primary}`}}/>
          <Btn label="Contact Seller" size="sm" style={{flex:1,background:C.mid}}/>
        </div>
      </Card>
      {[["Nandini","Jersey Cross","3yr","A","12.2L","₹58,000"],["Surabhi","Gir (A2)","5yr","A","9.8L","₹68,000"],["Kaveri","Murrah","4yr","B","15.2L","₹85,000"]].map(([name,breed,age,g,y,price]) => (
        <Card key={name} style={{marginBottom:9}}>
          <div style={{display:"flex",gap:9}}>
            <div style={{width:50,height:50,borderRadius:7,background:C.light,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:24}}>🐄</span></div>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2}}><span style={{fontSize:13,fontWeight:700}}>{name}</span><GradeTag g={g}/></div>
              <div style={{fontSize:10,color:C.text3}}>{breed} • {age} • 🥛 {y}/day</div>
            </div>
            <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:800,color:C.primary}}>{price}</div><ChevronRight size={15} color={C.text3}/></div>
          </div>
        </Card>
      ))}
      {gap(8)}
    </Scrl>
    <div style={{position:"absolute",bottom:74,right:14}}>
      <div style={{background:C.mid,borderRadius:13,padding:"9px 14px",display:"flex",gap:7,alignItems:"center",boxShadow:"0 3px 12px rgba(46,94,46,.4)"}}>
        <Plus size={17} color="#fff"/><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>List Cattle</span>
      </div>
    </div>
    <BottomNav active="market" phase={4}/>
  </div>
);

const CreateListScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <TopBar title="Create Listing" sub="Health Passport auto-generated" back bg="#fff" tc={C.primary}/>
    <Scrl style={{padding:16}}>
      <SecLabel label="Select Cow to List"/>
      {[["Kamdhenu","COW-033","Grade S • 90 days • Eligible ✓","14.8L/day","S",true],["Nandini","COW-078","Grade A • 75 days • Eligible ✓","12.2L/day","A",false]].map(([n,id,s,y,g,sel]) => (
        <div key={id} style={{background:sel?C.light:C.gray1,borderRadius:11,padding:11,marginBottom:10,border:sel?`2px solid ${C.mid}`:`1.5px solid ${C.border}`}}>
          <div style={{display:"flex",gap:9,alignItems:"center"}}>
            <div style={{width:38,height:38,borderRadius:19,background:C.mid,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:18}}>🐄</span></div>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:5,alignItems:"center"}}><span style={{fontSize:13,fontWeight:700}}>{n}</span><GradeTag g={g}/></div>
              <div style={{fontSize:10,color:C.text3}}>{s} • {y}</div>
            </div>
            {sel && <CheckCircle size={18} color={C.mid}/>}
          </div>
        </div>
      ))}
      <div style={{marginBottom:13}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text2,marginBottom:7}}>Listing Type</div>
        <div style={{display:"flex",gap:9}}>
          {[["₹ Fixed Price","Set asking price",true],["⏱ Auction","48h timed bidding",false]].map(([t,d,sel]) => (
            <div key={t} style={{flex:1,padding:11,background:sel?C.light:C.gray1,borderRadius:9,border:sel?`1.5px solid ${C.mid}`:`1.5px solid ${C.border}`}}>
              <div style={{fontSize:13,fontWeight:700,color:sel?C.mid:C.text2}}>{t}</div>
              <div style={{fontSize:10,color:C.text3}}>{d}</div>
            </div>
          ))}
        </div>
      </div>
      <Input label="Asking Price (₹)" value="74,000" icon={DollarSign} hint="💡 Similar Grade S sold for ₹68,000–78,000 in Nashik last month"/>
      <Input label="Description" placeholder="Additional details for buyer..."/>
      <div style={{background:C.goldL,borderRadius:9,padding:11,marginBottom:14,border:`1.5px solid ${C.gold}`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:12,fontWeight:700,color:C.gold}}>Listing Verification Fee</span>
          <span style={{fontSize:14,fontWeight:900,color:C.gold}}>₹299</span>
        </div>
        <div style={{fontSize:11,color:C.text2}}>Generates Health Passport PDF + QR + Grade badge. No commission on sale.</div>
      </div>
      <Btn label="Generate Health Passport & Publish (₹299)" size="lg" full/>
      {gap(20)}
    </Scrl>
  </div>
);

const PassportScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.primary}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 12px",display:"flex",gap:11,alignItems:"center"}}>
        <ChevronLeft size={21} color="#fff"/>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>Health Passport</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>Kamdhenu — COW-033</div>
        </div>
        <FileText size={17} color="#fff"/>
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <Card style={{marginBottom:13,background:C.goldL,border:`2px solid ${C.gold}`,padding:15}}>
        <div style={{textAlign:"center",marginBottom:10}}>
          <div style={{fontSize:44,fontWeight:900,color:C.gold,lineHeight:1}}>S</div>
          <div style={{fontSize:16,fontWeight:700,color:C.gold}}>PREMIUM GOLD</div>
          <div style={{fontSize:10,color:C.text3}}>Score: 94/100 • Top 5% of platform</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7}}>
          {[["Health","A"],["Milk","M5"],["Feed","F4"],["Pedigree","P4"]].map(([l,v]) => (
            <div key={l} style={{textAlign:"center",background:"rgba(184,134,11,.12)",borderRadius:7,padding:7}}>
              <div style={{fontSize:17,fontWeight:900,color:C.gold}}>{v}</div>
              <div style={{fontSize:9,color:C.text3}}>{l}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{marginBottom:13,background:C.tealL}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:44,height:44,background:"#fff",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:22}}>🔲</span></div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:C.teal}}>✓ Verified — Scan QR to confirm</div>
            <div style={{fontSize:10,color:C.text2}}>SHA-256 signed • Device MAC-bound • Tamper-proof</div>
          </div>
        </div>
      </Card>
      <SecLabel label="90-Day Verified Data"/>
      <Card style={{marginBottom:13}}>
        {[["Average daily yield","14.8 litres/day",C.mid],["Peak yield","16.6L (DIM 48)",C.gold],["Health alerts (90d)","ZERO — Clean record",C.mid],["Consistency score","95% — Very stable",C.mid]].map(([l,v,c]) => (
          <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <span style={{fontSize:12,color:C.text2}}>{l}</span>
            <span style={{fontSize:12,fontWeight:700,color:c}}>{v}</span>
          </div>
        ))}
      </Card>
      <SecLabel label="Maternal Lineage"/>
      <Card style={{marginBottom:13}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Dam: Kamla (✓ Verified on platform)</div>
        <div style={{fontSize:11,color:C.text2,marginBottom:7}}>21,840 litres across 4 lactations • Grade A active</div>
        <Div/>
        <div style={{fontSize:12,fontWeight:700,marginTop:7,marginBottom:5}}>Sire: AI Bull HF-2281</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <Badge label="DYD +980kg" color={C.mid} bg={C.light}/>
          <Badge label="SCS -0.3" color={C.blue} bg={C.blueL}/>
          <Badge label="PL +2.1mo" color={C.teal} bg={C.tealL}/>
        </div>
      </Card>
      <Card style={{marginBottom:13,background:C.light}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:12,fontWeight:700,color:C.text2}}>Breakeven @ ₹74,000</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:C.text2}}>Breakeven</span>
          <span style={{fontSize:13,fontWeight:800,color:C.mid}}>4.3 months</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:C.text2}}>Year 1 surplus</span>
          <span style={{fontSize:13,fontWeight:800,color:C.mid}}>₹1,12,905</span>
        </div>
      </Card>
      <Btn label="💬 Contact Seller" size="lg" full/>
      {gap(20)}
    </Scrl>
  </div>
);

const FarmStoreScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
    <div style={{background:C.blue}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 11px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>Farm Store</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>Smart suggestions for your farm</div>
        </div>
        <div style={{display:"flex",gap:9,alignItems:"center"}}>
          <Search size={19} color="#fff"/>
          <div style={{position:"relative"}}>
            <ShoppingCart size={19} color="#fff"/>
            <div style={{position:"absolute",top:-5,right:-5,width:13,height:13,background:C.red,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:7,color:"#fff",fontWeight:800}}>3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Scrl style={{padding:11}}>
      <SecLabel label="🧠 Smart Suggestions — For Your Farm"/>
      {[["🔄","REORDER: Concentrate","Running out in ~4 days. 25 bags.",C.red,"₹31,250"],["💊","FOR LAXMI: Fever Treatment","Melonex + ORS — post fever alert",C.amber,"₹350"],["🐄","CALVING PREP KIT","8 calvings expected soon.",C.mid,"₹2,840 bundle"],["👥","GROUP ORDER AVAILABLE","14 farms joining. ₹1,250/bag.",C.teal,"Save ₹170/bag"]].map(([icon,title,msg,col,price]) => (
        <Card key={title} style={{marginBottom:9,borderLeft:`4px solid ${col}`}}>
          <div style={{display:"flex",gap:9,alignItems:"center"}}>
            <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:800,color:col,marginBottom:1}}>{title}</div>
              <div style={{fontSize:11,color:C.text2}}>{msg}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:12,fontWeight:800,color:col}}>{price}</div>
              <div style={{width:26,height:26,borderRadius:13,background:col,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:"auto",marginTop:3}}><ShoppingCart size={13} color="#fff"/></div>
            </div>
          </div>
        </Card>
      ))}
      <SecLabel label="Browse Categories"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:13}}>
        {[["🌾","Feed"],["💊","Medicines"],["🥛","Dairy Equip"],["🔬","Minerals"],["📡","Collar Parts"],["🧤","Daily Use"]].map(([e,n]) => (
          <Card key={n} style={{padding:11,textAlign:"center"}}>
            <span style={{fontSize:26}}>{e}</span>
            <div style={{fontSize:12,fontWeight:700,color:C.text1,marginTop:3}}>{n}</div>
          </Card>
        ))}
      </div>
      {gap(8)}
    </Scrl>
    <BottomNav active="market" phase={4}/>
  </div>
);

const ProductScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <StatusBar light/>
    <TopBar title="Product Detail" back bg="#fff" tc={C.primary}/>
    <Scrl style={{padding:15}}>
      <div style={{background:C.light,borderRadius:11,padding:18,marginBottom:14,textAlign:"center"}}>
        <span style={{fontSize:48}}>🌾</span>
        <div style={{display:"flex",gap:5,justifyContent:"center",marginTop:7}}>
          <Badge label="✓ BIS Certified" color={C.mid} bg={C.light}/>
          <Badge label="FSSAI" color={C.teal} bg={C.tealL}/>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:18,fontWeight:800,color:C.text1}}>HindustanFeeds Gold — Concentrate</div>
        <div style={{fontSize:12,color:C.text3}}>50kg bag • Suitable for HF Cross, Jersey Cross</div>
        <div style={{display:"flex",alignItems:"center",gap:3,marginTop:3}}>
          {[1,2,3,4,5].map(i => <Star key={i} size={13} color={C.gold} fill={C.gold}/>)}
          <span style={{fontSize:11,color:C.text3}}>4.7 (238 reviews)</span>
        </div>
      </div>
      <Card style={{marginBottom:13,background:C.light}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:26,fontWeight:900,color:C.primary}}>₹1,420</div><div style={{fontSize:10,color:C.text3}}>per 50kg bag</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.amber}}>District avg: ₹1,380/bag</div><div style={{fontSize:10,color:C.text3}}>3% above average</div></div>
        </div>
        <div style={{background:C.tealL,borderRadius:7,padding:8,marginTop:9}}>
          <span style={{fontSize:11,color:C.teal,fontWeight:700}}>👥 Group order: ₹1,250/bag (-12%)</span>
          <div style={{fontSize:10,color:C.text2}}>14 farms joining • closes in 36h</div>
        </div>
      </Card>
      <SecLabel label="📊 Herd Calculator (118 cows at 6.2kg/day)"/>
      <Card style={{marginBottom:13}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:C.text2}}>Recommended order</span><span style={{fontSize:12,fontWeight:700,color:C.mid}}>25 bags (17 days)</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:C.text2}}>Total order</span><span style={{fontSize:13,fontWeight:800,color:C.primary}}>₹35,500</span></div>
      </Card>
      <div style={{display:"flex",gap:11,alignItems:"center",marginBottom:13}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text2}}>Qty (bags):</div>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:32,height:32,borderRadius:16,background:C.light,display:"flex",alignItems:"center",justifyContent:"center"}}><Minus size={13} color={C.mid}/></div>
          <span style={{fontSize:17,fontWeight:800,color:C.text1}}>25</span>
          <div style={{width:32,height:32,borderRadius:16,background:C.mid,display:"flex",alignItems:"center",justifyContent:"center"}}><Plus size={13} color="#fff"/></div>
        </div>
      </div>
      <Btn label="🛒 Add to Cart — ₹35,500" size="lg" full/>
      {gap(7)}
      <Btn label="👥 Join Group Order (₹31,250)" size="lg" full variant="outline" color={C.teal} style={{border:`1.5px solid ${C.teal}`}}/>
      {gap(20)}
    </Scrl>
  </div>
);

const VetScreen = () => (
  <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#fff"}}>
    <div style={{background:C.teal}}>
      <StatusBar/>
      <div style={{padding:"8px 16px 13px",display:"flex",gap:11,alignItems:"center"}}>
        <ChevronLeft size={21} color="#fff"/>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>Vet Consultation</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>For Laxmi (COW-112) — Fever Alert</div>
        </div>
      </div>
    </div>
    <Scrl style={{padding:13}}>
      <Card style={{marginBottom:13,border:`1.5px solid ${C.teal}`,background:C.tealL}}>
        <div style={{fontSize:12,fontWeight:700,color:C.teal,marginBottom:7}}>📊 Collar data shared with vet:</div>
        {[["Risk Score","71/100 — HIGH"],["Body Temp","39.8°C (↑ trending 6h)"],["Heart Rate","94 bpm (elevated)"],["Rumination","312/hr (-22% from baseline)"]].map(([k,v]) => (
          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,color:C.text2}}>{k}</span>
            <span style={{fontSize:11,fontWeight:700,color:C.teal}}>{v}</span>
          </div>
        ))}
      </Card>
      <SecLabel label="Consultation Type"/>
      <div style={{display:"flex",gap:9,marginBottom:14}}>
        {[["💬","Text Chat","₹99","2hr response",false],["📹","Video Call","₹299","15min, now",true]].map(([e,t,p,d,sel]) => (
          <div key={t} style={{flex:1,padding:13,background:sel?C.teal:C.gray1,borderRadius:11,textAlign:"center",border:sel?`2px solid ${C.teal}`:`1.5px solid ${C.border}`}}>
            <span style={{fontSize:26}}>{e}</span>
            <div style={{fontSize:13,fontWeight:700,color:sel?"#fff":C.text1,marginTop:3}}>{t}</div>
            <div style={{fontSize:10,color:sel?"rgba(255,255,255,.7)":C.text3}}>{d}</div>
            <div style={{fontSize:15,fontWeight:900,color:sel?"#fff":C.gold,marginTop:3}}>{p}</div>
          </div>
        ))}
      </div>
      <SecLabel label="Available Vets Now"/>
      {[["Dr. Ramesh Patil","BVSc, 8yr","Nashik, MH","Hindi, Marathi","4.9","15m"],["Dr. Priya Shah","BVSc + MVSc","Pune, MH","Hindi, English","4.8","Now"]].map(([name,qual,loc,lang,rating,wait]) => (
        <Card key={name} style={{marginBottom:9}}>
          <div style={{display:"flex",gap:9,alignItems:"center"}}>
            <div style={{width:42,height:42,borderRadius:21,background:C.tealL,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:20}}>👨‍⚕️</span></div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700}}>{name}</div>
              <div style={{fontSize:10,color:C.text3}}>{qual} • {loc} • {lang}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{display:"flex",gap:2,alignItems:"center",justifyContent:"flex-end"}}><Star size={11} color={C.gold} fill={C.gold}/><span style={{fontSize:11,fontWeight:700}}>{rating}</span></div>
              <div style={{fontSize:10,color:C.teal,fontWeight:600}}>{wait}</div>
            </div>
          </div>
        </Card>
      ))}
      <Btn label="📹 Book Video Consult — ₹299" size="lg" full style={{background:C.teal}}/>
      {gap(7)}
      <div style={{textAlign:"center",fontSize:10,color:C.text3}}>Vet sees collar data. Issues digital prescription for medicines.</div>
      {gap(20)}
    </Scrl>
  </div>
);

// ── Screen Component Map ──────────────────────────────────────
const COMPONENTS = {
  language:LanguageScreen, login:LoginScreen, farm_setup:FarmSetupScreen, add_cow:AddCowScreen,
  home:HomeScreen, herd_list:HerdListScreen, cow_detail:CowDetailScreen, milk_log:MilkLogScreen,
  voice_log:VoiceLogScreen, feed_log:FeedLogScreen, health_evt:HealthEvtScreen, profile:ProfileScreen,
  ble_setup:BLESetupScreen, live_dash:LiveDashScreen, alert_list:AlertListScreen,
  alert_det:AlertDetScreen, cow_vitals:CowVitalsScreen,
  risk_score:RiskScoreScreen, herd_dash:HerdDashScreen, rankings:RankingsScreen,
  revenue:RevenueScreen, milk_pred:MilkPredScreen,
  market:MarketScreen, create_lst:CreateListScreen, passport:PassportScreen,
  farm_store:FarmStoreScreen, product:ProductScreen, vet:VetScreen,
};

// ── Main App with Collapsible Sidebar ────────────────────────
export default function App() {
  const [active,  setActive]  = useState("home");
  const [sideOpen, setSideOpen] = useState(true);
  const [notesOpen,setNotesOpen]= useState(true);

  const cur  = SCREENS.find(s => s.id === active);
  const note = NOTES[active] || {};
  const Comp = COMPONENTS[active] || HomeScreen;
  const cats = [...new Set(SCREENS.map(s => s.cat))];

  return (
    <div style={{display:"flex",height:"100vh",background:"#111827",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",overflow:"hidden",position:"relative"}}>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: sideOpen ? 210 : 0,
        minWidth: sideOpen ? 210 : 0,
        transition:"all .25s ease",
        overflow:"hidden",
        background:"#0d1117",
        borderRight:"1px solid rgba(255,255,255,.07)",
        flexShrink:0,
        display:"flex",
        flexDirection:"column",
      }}>
        <div style={{padding:"14px 12px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>🐄 CattleCare</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>29 Screens</div>
          </div>
          <div onClick={() => setSideOpen(false)} style={{cursor:"pointer",padding:4,borderRadius:6,background:"rgba(255,255,255,.08)"}}>
            <X size={14} color="rgba(255,255,255,.5)"/>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {cats.map(cat => {
            const cs = SCREENS.filter(s => s.cat === cat);
            const p = cs[0].phase;
            const col = PC[p-1];
            return (
              <div key={cat}>
                <div style={{padding:"7px 12px",fontSize:9,fontWeight:700,color:col,textTransform:"uppercase",letterSpacing:.8,background:`${col}18`}}>{`P${p} — ${cat}`}</div>
                {cs.map(s => (
                  <div key={s.id} onClick={() => setActive(s.id)} style={{
                    padding:"8px 12px",cursor:"pointer",fontSize:11.5,fontWeight:active===s.id?700:400,
                    color:active===s.id?"#fff":"rgba(255,255,255,.5)",
                    background:active===s.id?`${col}20`:"transparent",
                    borderLeft:`3px solid ${active===s.id?col:"transparent"}`,
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
                  }}>{s.label}</div>
                ))}
              </div>
            );
          })}
          <div style={{height:16}}/>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Top toolbar */}
        <div style={{height:44,background:"#1a1f2e",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",paddingLeft:10,paddingRight:14,gap:10,flexShrink:0}}>
          {/* Sidebar toggle */}
          <div onClick={() => setSideOpen(v => !v)} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            <Menu size={16} color="rgba(255,255,255,.6)"/>
          </div>

          {/* Phase dots */}
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {[1,2,3,4].map(p => (
              <div key={p} onClick={() => {
                const first = SCREENS.find(s => s.phase === p);
                if (first) setActive(first.id);
              }} style={{width:20,height:20,borderRadius:10,background:cur?.phase===p?PC[p-1]:`${PC[p-1]}44`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:9,fontWeight:800,color:cur?.phase===p?"#fff":"rgba(255,255,255,.5)"}}>
                {p}
              </div>
            ))}
          </div>

          {/* Screen title */}
          <div style={{flex:1,display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{cur?.cat}</span>
            <span style={{color:"rgba(255,255,255,.2)"}}>›</span>
            <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{cur?.label}</span>
          </div>

          {/* Notes toggle */}
          <div onClick={() => setNotesOpen(v => !v)} style={{width:30,height:30,borderRadius:8,background:notesOpen?"rgba(255,255,255,.15)":"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <Info size={15} color={notesOpen?"#fff":"rgba(255,255,255,.4)"}/>
          </div>
        </div>

        {/* Content row */}
        <div style={{flex:1,display:"flex",gap:0,overflow:"hidden",padding:"16px",background:"#111827"}}>

          {/* Phone frame */}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minWidth:0}}>

            {/* Phase quick-jump */}
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",justifyContent:"center"}}>
              {SCREENS.filter(s => s.phase===cur?.phase).map(s => (
                <div key={s.id} onClick={() => setActive(s.id)} style={{
                  padding:"3px 9px",borderRadius:20,cursor:"pointer",fontSize:10,fontWeight:600,
                  background:s.id===active?PC[(cur?.phase||1)-1]:"rgba(255,255,255,.08)",
                  color:s.id===active?"#fff":"rgba(255,255,255,.4)",
                  transition:"all .15s",
                }}>{s.label}</div>
              ))}
            </div>

            {/* Phone */}
            <div style={{
              width:320,height:693,background:"#000",borderRadius:40,padding:10,
              boxShadow:"0 25px 70px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.08)",
              flexShrink:0,
            }}>
              {/* Dynamic island */}
              <div style={{position:"relative",zIndex:5,display:"flex",justifyContent:"center",marginBottom:-4}}>
                <div style={{width:100,height:28,background:"#000",borderRadius:18,marginTop:4}}/>
              </div>
              {/* Screen */}
              <div style={{width:"100%",height:"100%",borderRadius:32,overflow:"hidden",background:"#fff",display:"flex",flexDirection:"column",position:"relative"}}>
                <Comp/>
              </div>
            </div>

            {/* Arrow nav */}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <div onClick={() => {
                const idx = SCREENS.findIndex(s => s.id===active);
                if (idx>0) setActive(SCREENS[idx-1].id);
              }} style={{width:34,height:34,borderRadius:17,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <ChevronLeft size={18} color="rgba(255,255,255,.5)"/>
              </div>
              <div style={{display:"flex",alignItems:"center",fontSize:11,color:"rgba(255,255,255,.3)"}}>
                {SCREENS.findIndex(s => s.id===active)+1} / {SCREENS.length}
              </div>
              <div onClick={() => {
                const idx = SCREENS.findIndex(s => s.id===active);
                if (idx<SCREENS.length-1) setActive(SCREENS[idx+1].id);
              }} style={{width:34,height:34,borderRadius:17,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <ChevronRight size={18} color="rgba(255,255,255,.5)"/>
              </div>
            </div>
          </div>

          {/* Dev annotations panel */}
          {notesOpen && (
            <div style={{width:280,flexShrink:0,marginLeft:16,display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>
              {/* Component */}
              <div style={{background:"rgba(255,255,255,.04)",borderRadius:12,border:"1px solid rgba(255,255,255,.08)",overflow:"hidden"}}>
                <div style={{padding:"9px 12px",background:`${PC[(cur?.phase||1)-1]}22`,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#fff"}}>Developer Notes</div>
                </div>
                <div style={{padding:12}}>
                  <div style={{marginBottom:9}}>
                    <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>Component</div>
                    <div style={{fontSize:11,fontFamily:"monospace",color:"#7dd3fc",background:"rgba(0,0,0,.3)",padding:"4px 8px",borderRadius:5}}>{note.comp}</div>
                  </div>
                  <div style={{marginBottom:9}}>
                    <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>API Calls</div>
                    <pre style={{fontSize:10,fontFamily:"monospace",color:"#86efac",background:"rgba(0,0,0,.3)",padding:"6px 8px",borderRadius:5,margin:0,whiteSpace:"pre-wrap"}}>{note.api}</pre>
                  </div>
                  <div style={{marginBottom:9}}>
                    <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>State Variables</div>
                    <div style={{fontSize:10,fontFamily:"monospace",color:"#fbbf24",background:"rgba(0,0,0,.3)",padding:"5px 8px",borderRadius:5}}>{note.state}</div>
                  </div>
                  <div style={{marginBottom:9}}>
                    <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>Navigation</div>
                    <div style={{fontSize:10,fontFamily:"monospace",color:"#c4b5fd",background:"rgba(0,0,0,.3)",padding:"5px 8px",borderRadius:5}}>{note.nav}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>Dev Notes</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.65)",lineHeight:1.6}}>{note.note}</div>
                  </div>
                </div>
              </div>

              {/* Design system */}
              <div style={{background:"rgba(255,255,255,.04)",borderRadius:12,border:"1px solid rgba(255,255,255,.08)",padding:12}}>
                <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",marginBottom:9,textTransform:"uppercase",letterSpacing:.5}}>Design System</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                  {[["Primary","#1a3a1a"],["Green","#2e5e2e"],["Gold","#b8860b"],["Blue","#1a3a5c"],["Red","#c0392b"],["Teal","#1a5c52"],["Amber","#c97d20"],["Border","#d8e8d8"]].map(([n,v]) => (
                    <div key={n} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:13,height:13,borderRadius:3,background:v,flexShrink:0,border:"1px solid rgba(255,255,255,.1)"}}/>
                      <div>
                        <div style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.65)"}}>{n}</div>
                        <div style={{fontSize:8,color:"rgba(255,255,255,.3)",fontFamily:"monospace"}}>{v}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{borderTop:"1px solid rgba(255,255,255,.07)",paddingTop:9}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.35)",marginBottom:5}}>Typography Scale</div>
                  {[["Screen Title","24/800"],["Section H2","18/700"],["Body","14/400"],["Caption","11/400"],["Touch Target","44px min"],["Card Radius","12px"],["Border","1px #d8e8d8"]].map(([n,v]) => (
                    <div key={n} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>{n}</span>
                      <span style={{fontSize:9,fontFamily:"monospace",color:"#fbbf24"}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
