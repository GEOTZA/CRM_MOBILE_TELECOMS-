import { useState, useEffect, useRef } from "react";

/* ═══ SUPABASE CONFIG ═══
   Set USE_SUPA=true and fill in your project URL + anon key to connect.
   Run the SQL below in Supabase SQL Editor to create tables. */
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || "";
const USE_SUPA = !!(SUPA_URL && SUPA_KEY);
console.log("🔌 CRM Config:", {USE_SUPA, SUPA_URL: SUPA_URL ? SUPA_URL.substring(0,30)+"..." : "EMPTY", SUPA_KEY: SUPA_KEY ? "SET("+SUPA_KEY.length+"chars)" : "EMPTY"});

const supa = { from: t => ({
  select: async (c="*") => { if(!USE_SUPA) return {data:null}; const r=await fetch(`${SUPA_URL}/rest/v1/${t}?select=${c}`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}}); return {data:await r.json()}; },
  insert: async d => { if(!USE_SUPA) return {data:d}; const r=await fetch(`${SUPA_URL}/rest/v1/${t}`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(d)}); return {data:await r.json()}; },
  update: v => ({eq: async (c,val) => { if(!USE_SUPA) return {data:v}; await fetch(`${SUPA_URL}/rest/v1/${t}?${c}=eq.${val}`,{method:"PATCH",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(v)}); return {data:v}; }}),
  delete: () => ({eq: async (c,val) => { if(!USE_SUPA) return {}; await fetch(`${SUPA_URL}/rest/v1/${t}?${c}=eq.${val}`,{method:"DELETE",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}}); return {}; }}),
})};
// SHA-256 hash for password encryption
const hashPW = async (pw) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
};

// Audit log helper
const auditLog = async (userId, action, entity, entityId, details) => {
  if(!USE_SUPA) return;
  try { await supa.from('audit_log').insert({user_id:userId,action,entity,entity_id:entityId,details:JSON.stringify(details)}); } catch(e) { console.warn('Audit log error:',e); }
};



/*
SUPABASE SQL SCHEMA — Run in SQL Editor:

CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password TEXT, name TEXT, email TEXT, role TEXT DEFAULT 'agent', partner TEXT, active BOOL DEFAULT true, paused BOOL DEFAULT false, can_create BOOL DEFAULT true);
CREATE TABLE requests (id TEXT PRIMARY KEY, provider TEXT, ln TEXT, fn TEXT, fat TEXT, bd TEXT, adt TEXT, ph TEXT, mob TEXT, em TEXT, afm TEXT, doy TEXT, tk TEXT, addr TEXT, city TEXT, partner TEXT, agent_id TEXT, agent_name TEXT, svc TEXT, prog TEXT, lt TEXT, nlp TEXT, price TEXT, status TEXT DEFAULT 'active', pend_r TEXT, can_r TEXT, courier TEXT, c_addr TEXT, c_city TEXT, c_tk TEXT, notes TEXT, sig TEXT, created TEXT);
CREATE TABLE comments (id TEXT PRIMARY KEY, request_id TEXT, user_id TEXT, user_name TEXT, user_role TEXT, text TEXT, ts TEXT);
CREATE TABLE tickets (id TEXT PRIMARY KEY, afm TEXT, cname TEXT, reason TEXT, req_id TEXT, created_by TEXT, by_name TEXT, by_role TEXT, status TEXT DEFAULT 'open', created_at TEXT);
CREATE TABLE ticket_msgs (id SERIAL PRIMARY KEY, ticket_id TEXT, user_id TEXT, user_name TEXT, user_role TEXT, text TEXT, ts TEXT);
CREATE TABLE afm_db (afm TEXT PRIMARY KEY, ln TEXT, fn TEXT, fat TEXT, bd TEXT, adt TEXT, ph TEXT, mob TEXT, em TEXT, doy TEXT, tk TEXT, addr TEXT, city TEXT);
CREATE TABLE custom_fields (id SERIAL PRIMARY KEY, label TEXT, type TEXT DEFAULT 'text', max_chars INT DEFAULT 50, required BOOL DEFAULT false, active BOOL DEFAULT true);
CREATE TABLE dropdown_lists (id SERIAL PRIMARY KEY, name TEXT, items JSONB DEFAULT '[]');
*/


const PROVIDERS = {
  vodafone: { name:"VODAFONE", color:"#E60000", grad:"linear-gradient(135deg,#E60000,#990000)", icon:"📡",
    programs:{ mobile:["Red 1","Red 2","Red 3","Unlimited","CU","CU Max","Business Unlimited","Business Pro"],
      landline:["Home Double Play","Home Triple Play","Fiber 100","Fiber 200","Fiber 300","Business Office"] },
    services:["Νέα Σύνδεση","Φορητότητα","Ανανέωση","Αλλαγή Προγράμματος","Win Back"],
    lineTypes:["Καρτοκινητό","Συμβόλαιο","Επαγγελματικό"] },
  cosmote: { name:"COSMOTE", color:"#00A651", grad:"linear-gradient(135deg,#00A651,#006633)", icon:"🌐",
    programs:{ mobile:["Unlimited 3GB","Unlimited 7GB","Unlimited 15GB","Unlimited 30GB","Unlimited MAX","Business Essential","What's Up"],
      landline:["Double Play 50","Double Play 100","Double Play 200","Triple Play","Fiber 300","Business One"] },
    services:["Νέα Σύνδεση","Φορητότητα","Ανανέωση","Αλλαγή Προγράμματος","Win Back"],
    lineTypes:["Καρτοκινητό","Συμβόλαιο","Επαγγελματικό"] },
  nova: { name:"NOVA", color:"#FF6B00", grad:"linear-gradient(135deg,#FF6B00,#CC5500)", icon:"📶",
    programs:{ mobile:["Mobile 3GB","Mobile 7GB","Mobile 15GB","Mobile Unlimited","Business Mobile","Business Plus"],
      landline:["Home Double Play","Home Triple Play","Fiber 100","Fiber 200","Fiber 300","Business Office"] },
    services:["Νέα Σύνδεση","Φορητότητα","Ανανέωση","Αλλαγή Προγράμματος","Win Back"],
    lineTypes:["Καρτοκινητό","Συμβόλαιο","Επαγγελματικό"] },
};

const ST = {
  active:{ l:"Ενεργή",c:"#00A651",bg:"#E6F9EE",i:"✅" },pending:{ l:"Εκκρεμότητα",c:"#FF9800",bg:"#FFF3E0",i:"⏳" },
  cancelled:{ l:"Ακυρωμένη",c:"#E60000",bg:"#FFE6E6",i:"❌" },winback:{ l:"Win Back",c:"#9C27B0",bg:"#F3E5F5",i:"🔄" },
  counteroffer:{ l:"Αντιπρόταση",c:"#2196F3",bg:"#E3F2FD",i:"💬" },credit_check:{ l:"Πιστωτικός Έλεγχος",c:"#FF5722",bg:"#FBE9E7",i:"🔍" },
  credited:{ l:"Πιστωθείσες",c:"#009688",bg:"#E0F2F1",i:"💳" },
};

const ROLES = { admin:{l:"Admin",c:"#E91E63",i:"👑"}, director:{l:"Director",c:"#9C27B0",i:"🎯"}, supervisor:{l:"Supervisor",c:"#2196F3",i:"📋"}, backoffice:{l:"BackOffice",c:"#FF9800",i:"🏢"}, partner:{l:"Partner",c:"#4CAF50",i:"🤝"}, agent:{l:"Agent",c:"#607D8B",i:"👤"} };

const PERMS = {
  admin:{create:1,edit:1,del:1,viewAll:1,users:1,delUsers:1,pause:1,fields:1,exp:1,tickets:1,status:1,comment:1,adminPanel:1},
  director:{create:0,edit:1,del:1,viewAll:1,users:1,delUsers:0,pause:0,fields:0,exp:1,tickets:1,status:1,comment:1,needsCode:1},
  supervisor:{create:0,edit:1,del:0,viewAll:1,users:0,delUsers:0,pause:0,fields:0,exp:1,tickets:1,status:1,comment:1},
  backoffice:{create:0,edit:1,del:0,viewAll:1,users:0,delUsers:0,pause:0,fields:0,exp:1,tickets:1,status:1,comment:1},
  partner:{create:1,edit:1,del:0,viewAll:0,users:0,delUsers:0,pause:0,fields:0,exp:0,tickets:1,status:0,comment:1,ownAgents:1},
  agent:{create:1,edit:1,del:0,viewAll:0,users:0,delUsers:0,pause:0,fields:0,exp:0,tickets:1,status:0,comment:1,ownOnly:1},
};

const PARTNERS_LIST=["Electrigon","Partner Alpha","Partner Beta","Partner Gamma"];
const COURIERS=["ACS","Speedex","ΕΛΤΑ Courier","DHL","Γενική Ταχυδρομική"];
const CANCEL_R=["Δεν απάντησε","Άλλαξε γνώμη","Πιστοληπτική","Ελλιπή δικ.","Άλλος πάροχος","Τεχνικό","Άλλο"];
const PEND_R=["Αναμονή δικ.","Αναμονή υπογραφής","Πιστοληπτικός","Αναμονή ενεργ.","Αναμονή courier","Αναμονή φορητ.","Άλλο"];
const TICKET_R=["Λογαριασμός","Καθυστέρηση αίτησης","Πιστωτικός","Καταβολή εγγύησης","Αντιπρόταση","Άλλη προσφορά","Ακύρωση κινητής","Ακύρωση σταθερής","Λοιπές ερωτήσεις"];
const DOCS=[{id:"id",l:"Ταυτότητα",r:1,i:"🪪"},{id:"tax",l:"Εκκαθαριστικό",r:1,i:"📋"},{id:"addr",l:"Αποδ.Διεύθυνσης",r:1,i:"🏠"},{id:"bill",l:"Λογ.Παρόχου",r:0,i:"📄"}];

const USERS_INIT=[
  {id:"U01",un:"admin",pw:"admin123",name:"System Admin",email:"admin@crm.gr",role:"admin",partner:null,active:1,paused:0,cc:1},
  {id:"U02",un:"director",pw:"dir123",name:"Νίκος Director",email:"dir@crm.gr",role:"director",partner:null,active:1,paused:0,cc:0},
  {id:"U03",un:"spv1",pw:"spv123",name:"Μαρία Supervisor",email:"spv@crm.gr",role:"supervisor",partner:null,active:1,paused:0,cc:0},
  {id:"U04",un:"bo1",pw:"bo123",name:"Γιώργος BackOffice",email:"bo@crm.gr",role:"backoffice",partner:null,active:1,paused:0,cc:0},
  {id:"U05",un:"partner1",pw:"p123",name:"Electrigon",email:"p@electrigon.gr",role:"partner",partner:"Electrigon",active:1,paused:0,cc:1},
  {id:"U06",un:"agent1",pw:"a123",name:"Πέτρος Agent",email:"a1@crm.gr",role:"agent",partner:"Electrigon",active:1,paused:0,cc:1},
  {id:"U07",un:"agent2",pw:"a123",name:"Ελένη Agent",email:"a2@crm.gr",role:"agent",partner:"Electrigon",active:1,paused:0,cc:1},
  {id:"U08",un:"agent3",pw:"a123",name:"Δημ. Agent",email:"a3@crm.gr",role:"agent",partner:"Partner Alpha",active:1,paused:0,cc:1},
];

const AFM_DB=[
  {afm:"123456789",ln:"Παπαδόπουλος",fn:"Γιώργος",fat:"Κων/νος",bd:"1985-03-15",adt:"ΑΚ123456",ph:"2101234567",mob:"6971234567",em:"gp@email.gr",doy:"Α' Αθηνών",tk:"10564",addr:"Σταδίου 25",city:"Αθήνα"},
  {afm:"987654321",ln:"Κωνσταντίνου",fn:"Μαρία",fat:"Δημήτριος",bd:"1990-07-22",adt:"ΑΒ654321",ph:"2310567890",mob:"6945678901",em:"mk@email.gr",doy:"Β' Θεσ/νίκης",tk:"54624",addr:"Τσιμισκή 100",city:"Θεσ/νίκη"},
  {afm:"456789123",ln:"Αλεξίου",fn:"Δημήτρης",fat:"Αλέξανδρος",bd:"1988-11-03",adt:"ΑΕ789123",ph:"2610234567",mob:"6932345678",em:"da@email.gr",doy:"Α' Πάτρας",tk:"26221",addr:"Κορίνθου 50",city:"Πάτρα"},
];

const ts=()=>{const d=new Date();return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;};
const td=()=>{const d=new Date();return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;};
const iS={padding:"8px 10px",border:"1.5px solid #E0E0E0",borderRadius:8,fontSize:"0.84rem",fontFamily:"'DM Sans',sans-serif",background:"white",width:"100%",outline:"none"};
const B=(bg,c,x)=>({padding:"7px 16px",borderRadius:8,border:"none",background:bg,color:c,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:"0.8rem",...x});
const bg=(b,c)=>({display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:5,fontSize:"0.7rem",fontWeight:600,background:b,color:c,whiteSpace:"nowrap"});

const genReqs=()=>{const ps=["vodafone","cosmote","nova"];const sk=Object.keys(ST);return AFM_DB.map((c,i)=>{const p=ps[i%3],pd=PROVIDERS[p],al=[...pd.programs.mobile,...pd.programs.landline];const st=sk[i%sk.length];return{id:`REQ-${String(1000+i).padStart(5,"0")}`,prov:p,ln:c.ln,fn:c.fn,fat:c.fat,bd:c.bd,adt:c.adt,ph:c.ph,mob:c.mob,em:c.em,afm:c.afm,doy:c.doy,tk:c.tk,addr:c.addr,city:c.city,partner:"Electrigon",agentId:"U06",agentName:"Πέτρος Agent",svc:pd.services[i%pd.services.length],prog:al[i%al.length],lt:pd.lineTypes[i%pd.lineTypes.length],nlp:i%2?"Νέα Γραμμή":"Φορητότητα",price:`${(15+i*5).toFixed(2)}`,status:st,pendR:st==="pending"?PEND_R[0]:"",canR:st==="cancelled"?CANCEL_R[0]:"",cour:COURIERS[i%COURIERS.length],cAddr:c.addr,cCity:c.city,cTk:c.tk,notes:"",created:td(),actDate:st==="active"?td():"",sig:null,comments:[{id:"C1",uid:"U04",uname:"Γιώργος BackOffice",role:"backoffice",text:"Αίτηση σε επεξεργασία",ts:ts()}]};});};

const genTickets=()=>[{id:"TK-00001",afm:"123456789",cname:"Παπαδόπουλος Γιώργος",reason:"Καθυστέρηση αίτησης",reqId:"REQ-01000",by:"U06",byName:"Πέτρος Agent",byRole:"agent",at:ts(),status:"open",msgs:[{uid:"U06",uname:"Πέτρος Agent",role:"agent",text:"Η αίτηση καθυστερεί 5+ μέρες",ts:ts()}]}];

// Signature Pad
const SigPad=({onSave,ex})=>{const ref=useRef(null);const[dr,setDr]=useState(false);const[has,setHas]=useState(!!ex);
useEffect(()=>{const c=ref.current;if(!c)return;const x=c.getContext("2d");c.width=c.offsetWidth*2;c.height=c.offsetHeight*2;x.scale(2,2);x.strokeStyle="#1A1A2E";x.lineWidth=2;x.lineCap="round";if(ex){const img=new Image();img.onload=()=>x.drawImage(img,0,0,c.offsetWidth,c.offsetHeight);img.src=ex;}},[]);
const pos=e=>{const r=ref.current.getBoundingClientRect();return{x:(e.touches?e.touches[0].clientX:e.clientX)-r.left,y:(e.touches?e.touches[0].clientY:e.clientY)-r.top}};
const start=e=>{e.preventDefault();setDr(true);setHas(true);const x=ref.current.getContext("2d");const p=pos(e);x.beginPath();x.moveTo(p.x,p.y)};
const move=e=>{e.preventDefault();if(!dr)return;const x=ref.current.getContext("2d");const p=pos(e);x.lineTo(p.x,p.y);x.stroke()};
return(<div><div style={{border:"2px solid #CCC",borderRadius:10,overflow:"hidden",background:"#FAFAFA",position:"relative"}}>
<canvas ref={ref} style={{width:"100%",height:140,cursor:"crosshair",touchAction:"none"}} onMouseDown={start} onMouseMove={move} onMouseUp={()=>setDr(false)} onMouseLeave={()=>setDr(false)} onTouchStart={start} onTouchMove={move} onTouchEnd={()=>setDr(false)}/>
{!has&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"#CCC",fontSize:"0.85rem",fontWeight:600,pointerEvents:"none"}}>✍️ Υπογράψτε εδώ</div>}
</div><div style={{display:"flex",gap:6,marginTop:6}}>
<button onClick={()=>{ref.current.getContext("2d").clearRect(0,0,ref.current.width,ref.current.height);setHas(false)}} style={B("#FFF","#333",{border:"1px solid #DDD"})}>🗑</button>
<button onClick={()=>onSave(ref.current.toDataURL("image/png"))} style={B("#4CAF50","#FFF",{})}>💾 Αποθήκευση</button>
</div></div>);};

// PDF & A5 exports
const expPDF=(r,prov)=>{const p=PROVIDERS[prov],s=ST[r.status]||{l:"—",c:"#999",bg:"#F5F5F5",i:"?"};const f=(l,v)=>`<div style="margin-bottom:3px"><span style="font-size:0.65rem;color:#999;text-transform:uppercase;font-weight:600;display:block">${l}</span><span style="font-size:0.84rem;font-weight:500">${v||"—"}</span></div>`;const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${r.id}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:auto;color:#222}.h{background:${p.color};color:#fff;padding:14px;border-radius:6px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}.h h1{font-size:1.1rem}.bd{padding:3px 8px;border-radius:4px;font-size:0.76rem;font-weight:700;background:${s.bg};color:${s.c}}.sc{border:1px solid #E0E0E0;border-radius:5px;padding:12px;margin-bottom:10px}.st{font-weight:700;font-size:0.88rem;margin-bottom:8px;border-bottom:2px solid ${p.color};padding-bottom:3px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.sig{text-align:center;padding:10px;border:1px solid #DDD;border-radius:6px}.sig img{max-width:260px}@media print{@page{margin:1cm}}</style></head><body><div class="h"><h1>${p.icon} ${r.id} — ${p.name}</h1><span class="bd">${s.i} ${s.l}</span></div><div class="sc"><div class="st">👤 Πελάτης</div><div class="g">${[["Επώνυμο",r.ln],["Όνομα",r.fn],["ΑΔΤ",r.adt],["Κινητό",r.mob],["ΑΦΜ",r.afm],["Email",r.em],["Διεύθυνση",r.addr],["Πόλη",r.city],["ΤΚ",r.tk]].map(([a,b])=>f(a,b)).join("")}</div></div><div class="sc"><div class="st">📱 Πρόγραμμα</div><div class="g">${[["Υπηρεσία",r.svc],["Πρόγραμμα",r.prog],["Τύπος",r.lt],["Τιμή","€"+r.price],["Agent",r.agentName],["Partner",r.partner]].map(([a,b])=>f(a,b)).join("")}</div></div><div class="sc"><div class="st">🚚 Courier</div><div class="g">${[["Courier",r.cour],["Διεύθυνση",r.cAddr],["Πόλη",r.cCity],["ΤΚ",r.cTk]].map(([a,b])=>f(a,b)).join("")}</div></div>${r.comments?.length?`<div class="sc"><div class="st">💬 Σχόλια</div>${r.comments.map(c=>`<div style="padding:3px 0;border-bottom:1px solid #F0F0F0;font-size:0.78rem"><strong>${c.uname}</strong> <span style="color:#999;font-size:0.68rem">${c.ts}</span><br/>${c.text}</div>`).join("")}</div>`:""}<div class="sc"><div class="st">✍️ Υπογραφή</div><div class="sig">${r.sig?`<img src="${r.sig}"/>`:'—'}</div></div><script>window.onload=()=>window.print()</script></body></html>`;const w=window.open("","_blank");w.document.write(html);w.document.close();};

const expA5=(r,prov)=>{const p=PROVIDERS[prov];const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Courier ${r.id}</title><style>*{margin:0;padding:0;box-sizing:border-box}@page{size:A5;margin:10mm}body{font-family:Arial,sans-serif;width:148mm;padding:10mm;margin:auto}.h{background:${p.color};color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:10px;display:flex;justify-content:space-between;font-weight:800;font-size:0.9rem}.b{border:1.5px solid #333;border-radius:4px;padding:8px;margin-bottom:7px}.bt{font-weight:700;font-size:0.78rem;margin-bottom:5px;color:${p.color}}.r{display:flex;gap:6px;margin-bottom:2px;font-size:0.8rem}.lb{color:#666;font-weight:600;min-width:70px}.big{font-size:0.95rem;font-weight:700}</style></head><body><div class="h"><span>${p.icon} COURIER — ${p.name}</span><span>${r.id}</span></div><div class="b"><div class="bt">📦 Παραλήπτης</div><div class="r"><span class="lb">Ονομ:</span><span class="big">${r.ln} ${r.fn}</span></div><div class="r"><span class="lb">Κιν:</span><span class="big">${r.mob}</span></div><div class="r"><span class="lb">Τηλ:</span><span>${r.ph}</span></div></div><div class="b"><div class="bt">📍 Αποστολή</div><div class="r"><span class="lb">Διεύθ:</span><span class="big">${r.cAddr}</span></div><div class="r"><span class="lb">Πόλη:</span><span>${r.cCity}</span></div><div class="r"><span class="lb">ΤΚ:</span><span class="big">${r.cTk}</span></div></div><div class="b"><div class="bt">🚚 Στοιχεία</div><div class="r"><span class="lb">Courier:</span><span>${r.cour}</span></div><div class="r"><span class="lb">Πρόγρ:</span><span>${r.prog}</span></div></div><script>window.onload=()=>window.print()</script></body></html>`;const w=window.open("","_blank");w.document.write(html);w.document.close();};

const expCSV=data=>{const h=["ID","Πάροχος","Επώνυμο","Όνομα","ΑΦΜ","Κινητό","Πρόγραμμα","Υπηρεσία","Κατάσταση","Partner","Agent","Ημ/νία","Τιμή"];const rows=data.map(r=>[r.id,PROVIDERS[r.prov]?.name,r.ln,r.fn,r.afm,r.mob,r.prog,r.svc,ST[r.status]?.l,r.partner,r.agentName,r.created,r.price]);const csv="\uFEFF"+[h.join(","),...rows.map(r=>r.map(c=>`"${c||""}"`).join(","))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));a.download=`CRM_${new Date().toISOString().slice(0,10)}.csv`;a.click();};

// ═══ MAIN APP ═══
export default function App(){
const[loggedIn,setLI]=useState(false);const[cu,setCU]=useState(null);const[gdprOk,setGDPR]=useState(false);const[supaLoaded,setSupaLoaded]=useState(false);const[users,setUsers]=useState(USE_SUPA?[]:USERS_INIT);
const[reqs,setReqs]=useState(USE_SUPA?[]:genReqs);const[tix,setTix]=useState(USE_SUPA?[]:genTickets);const[notifs,setNotifs]=useState([]);
const[afmDb,setAfmDb]=useState(USE_SUPA?[]:AFM_DB);const[prov,setProv]=useState("vodafone");const[tab,setTab]=useState("dash");
const[sf,setSF]=useState("all");const[sel,setSel]=useState(null);const[vm,setVM]=useState("list");
const[selTix,setSelTix]=useState(null);const[sysPaused,setSysPaused]=useState(false);
const[lf,setLF]=useState({un:"",pw:""});

const P=cu?PERMS[cu.role]:{};const pr=PROVIDERS[prov];const rl=cu?ROLES[cu.role]:{};
const addN=(uid,txt)=>setNotifs(p=>[{id:`N${Date.now()}`,uid,txt,ts:ts(),read:0},...p]);
const myN=notifs.filter(n=>n.uid===cu?.id&&!n.read);

const visReqs=()=>{if(!cu)return[];let r=reqs.filter(x=>x.prov===prov);if(P.viewAll)return r;if(P.ownAgents)return r.filter(x=>x.partner===cu.partner);if(P.ownOnly)return r.filter(x=>x.agentId===cu.id);return r;};
const vr=visReqs();const fr=vr.filter(r=>sf==="all"||r.status===sf);
const stats={};Object.keys(ST).forEach(k=>{stats[k]=vr.filter(r=>r.status===k).length});stats.total=vr.length;

const doLogin=async()=>{
  console.log("🔑 Login attempt...");
  const {un,pw}=lf;
  if(!un||!pw){alert("Συμπληρώστε username & password");return;}
  
  if(USE_SUPA){
    // Online mode: check Supabase
    try{
      const hash=await hashPW(pw);
      const res=await fetch(`${SUPA_URL}/rest/v1/users?username=eq.${un}&select=*`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
      const data=await res.json();
      if(data&&data.length>0){
        const u=data[0];
        // Check hashed password OR plain text (for migration)
        console.log("🔐 Hash check:", {dbPW: u.password?.substring(0,20)+"...", inputHash: hash?.substring(0,20)+"...", match: u.password===hash});
        if(u.password===hash||u.password===pw){
          if(!u.active){alert("Ο λογαριασμός είναι απενεργοποιημένος");return;}
          if(u.paused){alert("Ο λογαριασμός είναι σε παύση");return;}
          const cu={id:u.id,un:u.username,pw:u.password,name:u.name,email:u.email,role:u.role,partner:u.partner,active:1,paused:0,cc:u.can_create?1:0};
          console.log("✅ LOGIN SUCCESS - setting cu and loggedIn=true", cu.name, cu.role);
          setCU(cu);
          setLI(true);
          setGDPR(u.gdpr_consent||false);
          auditLog(u.id,'login','users',u.id,{username:u.username});
          // Load all data from Supabase
          loadFromSupa();
          return;
        }
      }
      console.log("❌ No match. DB users found:", data?.length);
      alert("Λάθος στοιχεία");
    }catch(e){
      console.error("Login error:",e);
      alert("Σφάλμα σύνδεσης. Δοκιμάζω τοπικά...");
      loginLocal(un,pw);
    }
  }else{
    loginLocal(un,pw);
  }
};

const loginLocal=(un,pw)=>{
  const u=users.find(x=>x.un===un&&x.pw===pw);
  if(!u){alert("Λάθος στοιχεία");return;}
  if(sysPaused&&u.role!=="admin"){alert("🔴 Το σύστημα είναι σε παύση");return;}
  if(u.paused){alert("⏸ Ο λογαριασμός σας είναι σε παύση");return;}
  setCU(u);setLI(true);
};

const loadFromSupa=async()=>{
  if(!USE_SUPA||supaLoaded) return;
  setSupaLoaded(true);
  try{
    // Load users
    const uRes=await fetch(`${SUPA_URL}/rest/v1/users?select=*`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const uData=await uRes.json();
    if(uData&&Array.isArray(uData)){
      setUsers(uData.map(u=>({id:u.id,un:u.username,pw:u.password,name:u.name,email:u.email,role:u.role,partner:u.partner,active:u.active?1:0,paused:u.paused?1:0,cc:u.can_create?1:0})));
    }
    // Load AFM database
    const aRes=await fetch(`${SUPA_URL}/rest/v1/afm_database?select=*`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const aData=await aRes.json();
    if(aData&&Array.isArray(aData)) setAfmDb(aData);
    // Load requests
    const rRes=await fetch(`${SUPA_URL}/rest/v1/requests?select=*&order=created_at.desc`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const rData=await rRes.json();
    if(rData&&Array.isArray(rData)){
      setReqs(rData.map(r=>({...r,agentId:r.agent_id,agentName:r.agent_name,cour:r.courier,cAddr:r.c_addr,cCity:r.c_city,cTk:r.c_tk,pendR:r.pend_r,canR:r.can_r,prov:r.provider,lines:r.lines?JSON.parse(r.lines):[],comments:[]})));
    }
    // Load tickets  
    const tRes=await fetch(`${SUPA_URL}/rest/v1/tickets?select=*&order=created_at.desc`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const tData=await tRes.json();
    if(tData&&Array.isArray(tData)){
      setTix(tData.map(t=>({...t,by:t.created_by,byName:t.by_name,byRole:t.by_role,at:t.created_at,msgs:[]})));
    }
    console.log("✅ Data loaded from Supabase");
  }catch(e){console.error("Load error:",e);}
}

const addComment=(rid,txt)=>{const c={id:`C${Date.now()}`,uid:cu.id,uname:cu.name,role:cu.role,text:txt,ts:ts()};setReqs(p=>p.map(r=>r.id===rid?{...r,comments:[...r.comments,c]}:r));const req=reqs.find(r=>r.id===rid);if(req&&cu.role==="backoffice")addN(req.agentId,`💬 Σχόλιο ${rid} από BackOffice`);if(req&&cu.role==="agent")users.filter(u=>u.role==="backoffice").forEach(u=>addN(u.id,`💬 Σχόλιο ${rid} από ${cu.name}`));};

const saveReq=async(f)=>{
  const id=f.id||`REQ-${String(reqs.length+1).padStart(5,"0")}`;
  const lns=f.lines||[];
  const nr={...f,id,prov:f.prov||prov,agentId:f.agentId||cu.id,agentName:f.agentName||cu.name,partner:f.partner||cu.partner||"",created:f.created||ts(),comments:f.comments||[],
    prog:lns.length>0?lns.map(l=>l.prog).filter(Boolean).join(", "):(f.prog||""),
    svc:lns.length>0?lns.map(l=>l.type==="mobile"?"Κινητή":"Σταθερή").join(", "):(f.svc||""),
    price:lns.length>0?String(lns.reduce((s,l)=>s+(parseFloat(l.price)||0),0).toFixed(2)):(f.price||"")
  };
  console.log("💾 saveReq:",{isEdit:!!f.id,id:nr.id,prov:nr.prov,agentId:nr.agentId,status:nr.status,linesCount:lns.length});
  setReqs(p=>{const n=f.id?p.map(r=>r.id===f.id?nr:r):[nr,...p];console.log("📋 Reqs after save:",n.length);return n;});
  setVM("list");setSel(null);setSF("all");
  // Save to Supabase
  if(USE_SUPA){
    try{
      const dbRow={id:nr.id,provider:prov,ln:nr.ln,fn:nr.fn,fat:nr.fat,bd:nr.bd,adt:nr.adt,ph:nr.ph,mob:nr.mob,em:nr.em,afm:nr.afm,doy:nr.doy,tk:nr.tk,addr:nr.addr,city:nr.city,partner:nr.partner,agent_id:nr.agentId,agent_name:nr.agentName,svc:nr.svc,prog:nr.prog,lt:nr.lt,nlp:nr.nlp,price:nr.price,status:nr.status||"active",pend_r:nr.pendR,can_r:nr.canR,courier:nr.cour,c_addr:nr.cAddr,c_city:nr.cCity,c_tk:nr.cTk,notes:nr.notes,sig:nr.sig,created:nr.created,lines:JSON.stringify(nr.lines||[])};
      // Also set summary fields from first line for backwards compatibility
      if(nr.lines&&nr.lines.length>0){dbRow.prog=nr.lines[0].prog;dbRow.price=String(nr.lines.reduce((s,l)=>s+(parseFloat(l.price)||0),0).toFixed(2));dbRow.nlp=nr.lines[0].nlp==="port"?"Φορητότητα":"Νέα Γραμμή";}
      if(f.id){
        await supa.from("requests").update(dbRow).eq("id",f.id);
        auditLog(cu.id,"update","requests",f.id,{fields:"updated"});
      }else{
        await supa.from("requests").insert(dbRow);
        auditLog(cu.id,"create","requests",nr.id,{provider:prov,afm:nr.afm});
      }
      // Auto-save customer to AFM database (upsert)
      if(nr.afm){
        const afmRow={afm:nr.afm,ln:nr.ln,fn:nr.fn,fat:nr.fat,bd:nr.bd,adt:nr.adt,ph:nr.ph,mob:nr.mob,em:nr.em,doy:nr.doy,tk:nr.tk,addr:nr.addr,city:nr.city};
        await fetch(`${SUPA_URL}/rest/v1/afm_database`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(afmRow)});
        // Update local AFM db too
        setAfmDb(prev=>{const ex=prev.findIndex(x=>x.afm===nr.afm);if(ex>-1){const n=[...prev];n[ex]=afmRow;return n;}return[...prev,afmRow];});
        console.log("📋 Customer saved to AFM database:",nr.afm);
      }
    }catch(e){console.error("Save error:",e);}
  }
}

// LOGIN SCREEN
if(!cu)return(
<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1A1A2E,#16213E)",fontFamily:"'DM Sans',sans-serif"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
<div style={{background:"white",borderRadius:16,padding:36,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
<div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:"2.5rem",marginBottom:8}}>📡</div><h1 style={{fontFamily:"'Outfit'",fontWeight:900,fontSize:"1.5rem"}}>Telecom CRM</h1><p style={{color:"#888",fontSize:"0.85rem"}}>Vodafone • Cosmote • Nova</p></div>
<div style={{display:"flex",flexDirection:"column",gap:12}}>
<input placeholder="Username" value={lf.un} onChange={e=>setLF(f=>({...f,un:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={iS}/>
<input placeholder="Password" type="password" value={lf.pw} onChange={e=>setLF(f=>({...f,pw:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={iS}/>
<button onClick={doLogin} style={B("#1A1A2E","white",{width:"100%",padding:12,fontSize:"0.9rem"})}>🔐 Σύνδεση</button>
</div>
<div style={{marginTop:16,fontSize:"0.7rem",color:"#999",textAlign:"center"}}>admin/admin123 • director/dir123 • agent1/a123 • bo1/bo123</div>
</div></div>);

// MAIN UI
return(
<div style={{minHeight:"100vh",fontFamily:"'DM Sans',sans-serif",background:"#F0F2F5",color:"#1A1A2E"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

{/* HEADER */}
<div style={{background:pr.grad,position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",maxWidth:1400,margin:"0 auto",flexWrap:"wrap",gap:8}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<h1 style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.15rem",color:"white"}}>CRM System</h1>
<span style={{background:"rgba(255,255,255,0.25)",color:"white",padding:"2px 10px",borderRadius:14,fontSize:"0.7rem",fontWeight:700}}>{pr.name}</span>
<span style={{background:rl.c,color:"white",padding:"2px 10px",borderRadius:14,fontSize:"0.68rem",fontWeight:700}}>{rl.i} {rl.l}</span>
</div>
<div style={{display:"flex",alignItems:"center",gap:12}}>
<div style={{position:"relative",cursor:"pointer"}} onClick={()=>setNotifs(p=>p.map(n=>n.uid===cu.id?{...n,read:1}:n))}>
<span style={{fontSize:"1.15rem"}}>🔔</span>
{myN.length>0&&<span style={{position:"absolute",top:-5,right:-7,background:"#FFD700",color:"#1A1A2E",fontSize:"0.58rem",fontWeight:800,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{myN.length}</span>}
</div>
<span style={{color:"rgba(255,255,255,0.9)",fontSize:"0.8rem"}}>{cu.name}</span>
<button onClick={()=>{auditLog(cu?.id,"logout","users",cu?.id,{});setLI(false);setCU(null);setLF({un:"",pw:""});}} style={{background:"rgba(255,255,255,0.2)",color:"white",border:"1px solid rgba(255,255,255,0.3)",padding:"4px 12px",borderRadius:6,cursor:"pointer",fontSize:"0.75rem",fontWeight:600}}>Logout</button>
<span style={{fontSize:"0.65rem",padding:"2px 8px",borderRadius:4,background:USE_SUPA?"rgba(76,175,80,0.3)":"rgba(255,152,0,0.3)",color:"white",fontWeight:600}}>{USE_SUPA?"🟢 Online":"🟡 Local"}</span>
</div></div></div>

{/* PROVIDERS */}
<div style={{display:"flex",justifyContent:"center",gap:6,padding:"12px 20px",background:"white",borderBottom:"1px solid #E8E8E8"}}>
{Object.entries(PROVIDERS).map(([k,p])=><button key={k} onClick={()=>{setProv(k);setSF("all");setVM("list");setTab("dash");}} style={{padding:"8px 20px",borderRadius:8,border:prov===k?"none":"2px solid #E0E0E0",background:prov===k?p.grad:"white",color:prov===k?"white":"#666",cursor:"pointer",fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.8rem",boxShadow:prov===k?"0 3px 10px rgba(0,0,0,0.12)":"none"}}>{p.icon} {p.name}</button>)}
</div>

{/* MAIN TABS */}
<div style={{display:"flex",background:"white",borderBottom:"2px solid #E8E8E8",padding:"0 20px",overflowX:"auto"}}>
{[["dash","📊 Αιτήσεις"],["tix","🎫 Αιτήματα"],P.users&&["users","👥 Χρήστες"],P.adminPanel&&["admin","👑 Admin Panel"]].filter(Boolean).map(([k,l])=>
<div key={k} onClick={()=>{setTab(k);setVM("list");setSelTix(null);}} style={{padding:"11px 18px",cursor:"pointer",fontFamily:"'Outfit'",fontWeight:600,fontSize:"0.82rem",color:tab===k?pr.color:"#888",borderBottom:`3px solid ${tab===k?pr.color:"transparent"}`,whiteSpace:"nowrap"}}>{l}</div>
)}
</div>

<div style={{padding:20,maxWidth:1400,margin:"0 auto"}}>

{/* ═══ DASHBOARD ═══ */}
{tab==="dash"&&vm==="list"&&(<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16}}>
<div><h1 style={{fontFamily:"'Outfit'",fontSize:"1.8rem",fontWeight:900,letterSpacing:-1}}>{pr.name}</h1><p style={{color:"#888",fontSize:"0.82rem"}}>{rl.i} {rl.l}</p></div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{(cu.role==="admin"||cu.cc&&P.create)?<button onClick={()=>setVM("form")} style={B(pr.grad,"white",{padding:"9px 20px"})}>➕ Νέα Αίτηση</button>:null}
{P.exp?<button onClick={()=>expCSV(fr)} style={B("#FFF","#333",{border:"1px solid #DDD",padding:"9px 16px"})}>📊 Excel</button>:null}
</div></div>

{/* Stats */}
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:16}}>
{[["📊",stats.total,"Σύνολο",pr.color,"all"],["✅",stats.active,"Ενεργές","#00A651","active"],["⏳",stats.pending,"Εκκρεμείς","#FF9800","pending"],["❌",stats.cancelled,"Ακυρωμένες","#E60000","cancelled"],["🔄",stats.winback,"Win Back","#9C27B0","winback"],["💬",stats.counteroffer,"Αντιπρόταση","#2196F3","counteroffer"],["🔍",stats.credit_check,"Πιστ.Έλεγχος","#FF5722","credit_check"],["💳",stats.credited,"Πιστωθείσες","#009688","credited"]].map(([ic,val,lab,col,key])=>
<div key={key} onClick={()=>setSF(key)} style={{background:sf===key?"#FAFAFA":"white",borderRadius:10,padding:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",borderLeft:`4px solid ${col}`,cursor:"pointer",border:sf===key?`2px solid ${col}`:"2px solid transparent"}}>
<div style={{fontSize:"1.1rem"}}>{ic}</div><div style={{fontFamily:"'Outfit'",fontSize:"1.4rem",fontWeight:800,color:col}}>{val||0}</div><div style={{fontSize:"0.68rem",color:"#888"}}>{lab}</div></div>)}
</div>

{/* Table */}
<div style={{background:"white",borderRadius:10,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",overflow:"hidden"}}>
<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><tr style={{background:"#FAFAFA"}}>{["ID","Πελάτης","Κινητό","Πρόγραμμα","Υπηρεσία",cu.role!=="agent"?"Agent":"","Κατάσταση","Ημ/νία",""].filter(Boolean).map(h=><th key={h} style={{padding:"8px 10px",fontFamily:"'Outfit'",fontWeight:600,fontSize:"0.68rem",color:"#888",textAlign:"left",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
<tbody>{fr.map(r=><tr key={r.id} style={{borderBottom:"1px solid #F5F5F5"}}>
<td style={{padding:"8px 10px",fontWeight:700,color:pr.color,fontSize:"0.78rem"}}>{r.id}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{r.ln} {r.fn}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{r.mob}</td>
<td style={{padding:"8px 10px",fontSize:"0.74rem"}}>{r.prog}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{r.svc}</td>
{cu.role!=="agent"&&<td style={{padding:"8px 10px",fontSize:"0.76rem"}}>{r.agentName}</td>}
<td style={{padding:"8px 10px"}}><span style={bg(ST[r.status]?.bg||"#F5F5F5",ST[r.status]?.c)}>{ST[r.status]?.i} {ST[r.status]?.l}</span></td>
<td style={{padding:"8px 10px",fontSize:"0.76rem"}}>{r.created}</td>
<td style={{padding:"8px 10px"}}><div style={{display:"flex",gap:2}}>
<button onClick={()=>{setSel(r);setVM("detail")}} style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#E3F2FD",color:"#1976D2",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>👁</button>
{P.edit&&<button onClick={()=>{setSel(r);setVM("edit")}} style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#FFF3E0",color:"#E65100",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>✏️</button>}
<button onClick={()=>expPDF(r,prov)} style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#F3E5F5",color:"#7B1FA2",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>PDF</button>
<button onClick={()=>expA5(r,prov)} style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#E0F2F1",color:"#00695C",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>A5</button>
</div></td></tr>)}
{fr.length===0&&<tr><td colSpan={9} style={{textAlign:"center",padding:24,color:"#999"}}>Δεν βρέθηκαν</td></tr>}
</tbody></table></div></div>
</div>)}

{/* FORM */}
{tab==="dash"&&(vm==="form"||vm==="edit")&&<ReqForm pr={pr} prov={prov} onSave={saveReq} onCancel={()=>setVM("list")} ed={vm==="edit"?sel:null} db={afmDb} P={P} cu={cu}/>}

{/* DETAIL */}
{tab==="dash"&&vm==="detail"&&sel&&<Detail r={sel} pr={pr} prov={prov} P={P} cu={cu} onBack={()=>{setVM("list");setSF("all");}} onEdit={()=>setVM("edit")} onComment={t=>addComment(sel.id,t)} onSC={async(s)=>{console.log("📝 Status change:",sel.id,"→",s);const updatedReq={...sel,status:s};setReqs(p=>{const n=p.map(r=>r.id===sel.id?{...r,status:s}:r);console.log("📋 Reqs after update:",n.length,"found:",n.some(r=>r.id===sel.id));return n;});setSel(updatedReq);setSF("all");if(USE_SUPA){try{await supa.from("requests").update({status:s}).eq("id",sel.id);auditLog(cu.id,"update","requests",sel.id,{status:s});console.log("✅ Saved to Supabase");}catch(e){console.error("❌ Status update error:",e);}}}}/>}

{/* TICKETS */}
{tab==="tix"&&!selTix&&<TixList tix={tix} cu={cu} P={P} pr={pr} onSel={setSelTix} onCreate={t=>{const nt={...t,id:`TK-${String(tix.length+1).padStart(5,"0")}`,by:cu.id,byName:cu.name,byRole:cu.role,at:ts(),status:"open",msgs:[{uid:cu.id,uname:cu.name,role:cu.role,text:t.msg,ts:ts()}]};setTix(p=>[nt,...p]);users.filter(u=>u.role==="backoffice"||u.role==="supervisor").forEach(u=>addN(u.id,`🎫 Νέο αίτημα: ${t.reason}`));}}/>}
{tab==="tix"&&selTix&&<TixDetail t={selTix} cu={cu} pr={pr} onBack={()=>setSelTix(null)} onReply={txt=>{const m={uid:cu.id,uname:cu.name,role:cu.role,text:txt,ts:ts()};setTix(p=>p.map(t=>t.id===selTix.id?{...t,msgs:[...t.msgs,m]}:t));setSelTix(p=>({...p,msgs:[...p.msgs,m]}));if(cu.role==="backoffice")addN(selTix.by,`💬 Απάντηση ${selTix.id}`);else users.filter(u=>u.role==="backoffice").forEach(u=>addN(u.id,`💬 Απάντηση ${selTix.id}`));}} onClose={()=>{setTix(p=>p.map(t=>t.id===selTix.id?{...t,status:"closed"}:t));setSelTix(p=>({...p,status:"closed"}));}}/>}

{/* USERS */}
{tab==="users"&&P.users&&<UserMgmt users={users} setUsers={setUsers} cu={cu} P={P} pr={pr}/>}

{/* FIELDS */}
{tab==="fields"&&P.fields&&<FieldMgmt pr={pr}/>}

{/* SYSTEM */}

{tab==="admin"&&P.adminPanel&&<AdminPanel users={users} setUsers={setUsers} reqs={reqs} setReqs={setReqs} afmDb={afmDb} setAfmDb={setAfmDb} cu={cu} pr={pr} sysPaused={sysPaused} setSysPaused={setSysPaused}/>}

{tab==="sys"&&P.pause&&<SysMgmt sp={sysPaused} setSP={setSysPaused} users={users} setUsers={setUsers} pr={pr}/>}

</div></div>);}

// ═══ REQUEST FORM ═══
// Form field wrapper — defined outside to prevent focus loss on re-render
const FL=({l,req,children})=><div style={{display:"flex",flexDirection:"column",gap:2}}><label style={{fontSize:"0.74rem",fontWeight:600,color:"#555"}}>{l}{req&&<span style={{color:"#E60000"}}> *</span>}</label>{children}</div>;

// Detail field — read only
const DF=({l,v})=><div style={{marginBottom:3}}><div style={{fontSize:"0.66rem",color:"#999",textTransform:"uppercase",fontWeight:600}}>{l}</div><div style={{fontSize:"0.84rem",fontWeight:500}}>{v||"—"}</div></div>;

// Admin Panel cards — defined outside to prevent re-render issues
const AdmBk=({onClick})=><button onClick={onClick} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#F5F5F5",color:"#333",cursor:"pointer",fontWeight:600,marginBottom:14}}>← Πίσω</button>;
const AdmCd=({ic,ti,ds,ct,cl,onClick})=><div onClick={onClick} style={{background:"white",borderRadius:12,padding:16,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderLeft:"4px solid "+cl,transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";}}><div style={{fontSize:"1.5rem",marginBottom:4}}>{ic}</div><div style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1rem"}}>{ti}</div><p style={{fontSize:"0.76rem",color:"#888",marginTop:2}}>{ds}</p>{ct!==undefined&&<div style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.4rem",color:cl,marginTop:4}}>{ct}</div>}</div>;

function ReqForm({pr,prov,onSave,onCancel,ed,db,P,cu}){
const emptyLine=()=>({id:Date.now()+Math.random(),type:"mobile",prog:"",price:"",mode:"simo",subsidy:"",nlp:"new",fromProv:"",mobNum:"",landNum:""});
const[form,setForm]=useState(ed||{ln:"",fn:"",fat:"",bd:"",adt:"",ph:"",mob:"",em:"",afm:"",doy:"",tk:"",addr:"",city:"",partner:cu.partner||"",cour:"",cAddr:"",cCity:"",cTk:"",notes:"",pendR:"",canR:"",status:"active",sig:null,lines:[emptyLine()]});
const[afmQ,setAfmQ]=useState("");const[found,setFound]=useState(null);
const s=(f,v)=>setForm(p=>({...p,[f]:v}));
const search=async()=>{
  const q=afmQ.trim();if(!q)return;
  let r=db.find(x=>x.afm===q);
  if(!r&&USE_SUPA){
    try{
      const res=await fetch(`${SUPA_URL}/rest/v1/afm_database?afm=eq.${q}&select=*`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
      const data=await res.json();
      if(data&&data.length>0) r=data[0];
    }catch(e){console.error("AFM search error:",e);}
  }
  if(r){
    setFound(r);
    setForm(p=>({...p,ln:r.ln||p.ln,fn:r.fn||p.fn,fat:r.fat||p.fat,bd:r.bd||p.bd,adt:r.adt||p.adt,ph:r.ph||p.ph,mob:r.mob||p.mob,em:r.em||p.em,afm:r.afm||p.afm,doy:r.doy||p.doy,tk:r.tk||p.tk,addr:r.addr||p.addr,city:r.city||p.city}));
  }else{alert("Δεν βρέθηκε στη βάση");}
};

// Lines management
const lines=form.lines||[emptyLine()];
const setLines=nl=>setForm(p=>({...p,lines:nl}));
const addLine=()=>setLines([...lines,emptyLine()]);
const rmLine=i=>{if(lines.length>1)setLines(lines.filter((_,j)=>j!==i));};
const updLine=(i,k,v)=>setLines(lines.map((ln,j)=>j===i?{...ln,[k]:v}:ln));

// Totals
const mobTotal=lines.filter(l=>l.type==="mobile").reduce((s,l)=>s+(parseFloat(l.price)||0),0);
const landTotal=lines.filter(l=>l.type==="landline").reduce((s,l)=>s+(parseFloat(l.price)||0),0);
const grandTotal=mobTotal+landTotal;
const subTotal=lines.filter(l=>l.mode==="subsidy").reduce((s,l)=>s+(parseFloat(l.subsidy)||0),0);
const subCount=lines.filter(l=>l.mode==="subsidy").length;
const mobCount=lines.filter(l=>l.type==="mobile").length;
const landCount=lines.filter(l=>l.type==="landline").length;

const provOpts=["Vodafone","Cosmote","Nova"].filter(x=>x.toLowerCase()!==prov);

return(
<div style={{background:"white",borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.08)",overflow:"hidden"}}>
<div style={{background:pr.grad,padding:"14px 20px",color:"white",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.2rem"}}>{pr.icon} {ed?"Επεξεργασία":"Νέα Αίτηση"} — {pr.name}</h2>
<div style={{display:"flex",gap:5}}><button onClick={()=>onSave(form)} style={B("#4CAF50","white",{})}>💾</button><button onClick={onCancel} style={B("#FF5722","white",{})}>✖</button></div></div>

{/* AFM */}
<div style={{padding:"14px 20px",background:"#FFFDE7",borderLeft:"4px solid #FFC107",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem",marginBottom:10}}>🔍 Αναζήτηση ΑΦΜ</div>
<div style={{display:"flex",gap:6}}><input placeholder="ΑΦΜ..." value={afmQ} onChange={e=>setAfmQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} style={{...iS,flex:1}}/><button onClick={search} style={B("#2196F3","white",{})}>🔍</button></div>
{found&&<div style={{marginTop:6,padding:6,background:"#E8F5E9",borderRadius:6,fontSize:"0.78rem",color:"#2E7D32",fontWeight:600}}>✅ {found.ln} {found.fn}</div>}
</div>

{/* Customer */}
<div style={{padding:"14px 20px",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem",marginBottom:10}}>👤 Πελάτης</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
{[["ln","Επώνυμο",1],["fn","Όνομα",1],["fat","Πατρώνυμο"],["bd","Γέννηση",1,"date"],["adt","ΑΔΤ",1],["ph","Τηλέφωνο",1],["mob","Κινητό",1],["em","Email",0,"email"],["afm","ΑΦΜ",1],["doy","ΔΟΥ",1],["tk","ΤΚ",1],["addr","Διεύθυνση",1],["city","Πόλη",1]].map(([f,l,r,t])=>
<FL key={f} l={l} req={!!r}><input type={t||"text"} value={form[f]||""} onChange={e=>s(f,e.target.value)} style={iS}/></FL>)}
</div></div>

{/* Partner */}
<div style={{padding:"14px 20px",background:"#F3E5F5",borderLeft:"4px solid #9C27B0",borderBottom:"1px solid #F0F0F0"}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
<FL l="Συνεργάτης" req><select value={form.partner} onChange={e=>s("partner",e.target.value)} style={iS}><option value="">—</option>{PARTNERS_LIST.map(p=><option key={p}>{p}</option>)}</select></FL>
</div></div>

{/* ═══ ΓΡΑΜΜΕΣ ΠΡΟΪΟΝΤΩΝ ═══ */}
<div style={{padding:"14px 20px",background:"#E8F5E9",borderLeft:"4px solid #4CAF50",borderBottom:"1px solid #F0F0F0"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem"}}>📦 Γραμμές Προϊόντων <span style={{fontSize:"0.72rem",color:"#888",fontWeight:400}}>({mobCount} κινητ. + {landCount} σταθ.)</span></div>
<button onClick={addLine} style={B("#4CAF50","white",{padding:"6px 14px",fontSize:"0.78rem"})}>➕ Προσθήκη Γραμμής</button>
</div>

{lines.map((ln,i)=>{
const isMob=ln.type==="mobile";
const isPort=ln.nlp==="port";
const isSub=ln.mode==="subsidy";
const progs=isMob?pr.programs.mobile:pr.programs.landline;
return(
<div key={ln.id} style={{background:"white",border:"1px solid #E0E0E0",borderRadius:10,padding:12,marginBottom:10,borderLeft:`4px solid ${isMob?"#2196F3":"#FF9800"}`}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<span style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.82rem",color:isMob?"#1565C0":"#E65100"}}>{isMob?"📱":"📞"} Γραμμή {i+1} — {isMob?"Κινητή":"Σταθερή"}</span>
<button onClick={()=>rmLine(i)} style={{background:"#FFEBEE",color:"#C62828",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>🗑️</button>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>

<FL l="Τύπος" req><select value={ln.type} onChange={e=>updLine(i,"type",e.target.value)} style={iS}><option value="mobile">📱 Κινητή</option><option value="landline">📞 Σταθερή</option></select></FL>

<FL l="Πρόγραμμα" req><select value={ln.prog} onChange={e=>updLine(i,"prog",e.target.value)} style={iS}><option value="">—</option>{progs.map(x=><option key={x}>{x}</option>)}</select></FL>

<FL l="Τιμή (€)" req><input type="number" value={ln.price} onChange={e=>updLine(i,"price",e.target.value)} placeholder="0.00" style={iS}/></FL>

<FL l="Τρόπος" req><select value={ln.mode} onChange={e=>updLine(i,"mode",e.target.value)} style={iS}><option value="simo">SIM Only</option><option value="subsidy">Επιδότηση</option></select></FL>

{isSub&&<FL l="Ποσό Επιδότησης (€)"><input type="number" maxLength={4} value={ln.subsidy} onChange={e=>{if(e.target.value.length<=4)updLine(i,"subsidy",e.target.value)}} placeholder="0000" style={iS}/></FL>}

<FL l="Νέα/Φορητ." req><select value={ln.nlp} onChange={e=>updLine(i,"nlp",e.target.value)} style={iS}><option value="new">Νέα Γραμμή</option><option value="port">Φορητότητα</option></select></FL>

{isPort&&<FL l="Από Πάροχο"><select value={ln.fromProv} onChange={e=>updLine(i,"fromProv",e.target.value)} style={iS}><option value="">—</option>{provOpts.map(x=><option key={x}>{x}</option>)}</select></FL>}

{isMob&&<FL l="Αριθμός Κινητού"><input type="tel" maxLength={10} value={ln.mobNum} onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,10);updLine(i,"mobNum",v)}} placeholder="69xxxxxxxx" style={iS}/></FL>}

{!isMob&&<FL l="Αριθμός Σταθερού"><input type="tel" maxLength={10} value={ln.landNum} onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,10);updLine(i,"landNum",v)}} placeholder="21xxxxxxxx" style={iS}/></FL>}

</div></div>);})}

{/* TOTALS */}
<div style={{background:"#F5F5F5",borderRadius:10,padding:14,marginTop:8}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
<div style={{textAlign:"center",padding:10,background:"#E3F2FD",borderRadius:8}}>
<div style={{fontSize:"0.7rem",color:"#1565C0",fontWeight:600}}>📱 Κινητή ({mobCount})</div>
<div style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.3rem",color:"#1565C0"}}>€{mobTotal.toFixed(2)}</div>
</div>
<div style={{textAlign:"center",padding:10,background:"#FFF3E0",borderRadius:8}}>
<div style={{fontSize:"0.7rem",color:"#E65100",fontWeight:600}}>📞 Σταθερή ({landCount})</div>
<div style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.3rem",color:"#E65100"}}>€{landTotal.toFixed(2)}</div>
</div>
{subCount>0&&<div style={{textAlign:"center",padding:10,background:"#FCE4EC",borderRadius:8}}>
<div style={{fontSize:"0.7rem",color:"#AD1457",fontWeight:600}}>🎁 Επιδότηση ({subCount})</div>
<div style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.3rem",color:"#AD1457"}}>€{subTotal.toFixed(2)}</div>
</div>}
<div style={{textAlign:"center",padding:10,background:"#E8F5E9",borderRadius:8}}>
<div style={{fontSize:"0.7rem",color:"#2E7D32",fontWeight:600}}>💰 ΣΥΝΟΛΟ</div>
<div style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.5rem",color:"#2E7D32"}}>€{grandTotal.toFixed(2)}</div>
</div>
</div>
<div style={{textAlign:"center",marginTop:8,fontSize:"0.7rem",color:"#888",fontStyle:"italic"}}>* Όλα τα ποσά είναι τελικά και περιλαμβάνουν φόρους (ΦΠΑ)</div>
</div>
</div>

{/* Courier */}
<div style={{padding:"14px 20px",background:"#FFF8E1",borderLeft:"4px solid #FFB300",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem",marginBottom:10}}>🚚 Courier <button onClick={()=>setForm(p=>({...p,cAddr:p.addr,cCity:p.city,cTk:p.tk}))} style={B("#E3F2FD","#1976D2",{fontSize:"0.72rem",padding:"3px 10px",marginLeft:8})}>📋 Αντιγραφή</button></div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
<FL l="Courier"><select value={form.cour} onChange={e=>s("cour",e.target.value)} style={iS}><option value="">—</option>{COURIERS.map(x=><option key={x}>{x}</option>)}</select></FL>
<FL l="Διεύθυνση"><input value={form.cAddr} onChange={e=>s("cAddr",e.target.value)} style={iS}/></FL>
<FL l="Πόλη"><input value={form.cCity} onChange={e=>s("cCity",e.target.value)} style={iS}/></FL>
<FL l="ΤΚ"><input value={form.cTk} onChange={e=>s("cTk",e.target.value)} style={iS}/></FL>
</div></div>

{/* Status */}
<div style={{padding:"14px 20px",borderBottom:"1px solid #F0F0F0"}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
{P.status&&<FL l="Κατάσταση"><select value={form.status} onChange={e=>s("status",e.target.value)} style={{...iS,background:ST[form.status]?.bg,color:ST[form.status]?.c,fontWeight:700}}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></FL>}
<FL l="Εκκρεμότητα"><select value={form.pendR} onChange={e=>s("pendR",e.target.value)} style={iS}><option value="">—</option>{PEND_R.map(x=><option key={x}>{x}</option>)}</select></FL>
<FL l="Ακύρωση"><select value={form.canR} onChange={e=>s("canR",e.target.value)} style={iS}><option value="">—</option>{CANCEL_R.map(x=><option key={x}>{x}</option>)}</select></FL>
</div>
<div style={{marginTop:8}}><FL l="Σχόλια"><textarea value={form.notes||""} onChange={e=>s("notes",e.target.value)} rows={2} style={{...iS,minHeight:50,resize:"vertical"}}/></FL></div>
</div>

{/* Signature */}
<div style={{padding:"14px 20px",background:"#F3E5F5",borderLeft:"4px solid #9C27B0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem",marginBottom:10}}>✍️ Υπογραφή</div>
<SigPad onSave={d=>s("sig",d)} ex={form.sig}/></div>

<div style={{padding:16,display:"flex",gap:8,justifyContent:"center",background:"#FAFAFA"}}>
<button onClick={()=>onSave(form)} style={B("#4CAF50","white",{padding:"10px 32px",fontSize:"0.88rem"})}>💾 Αποθήκευση</button>
<button onClick={onCancel} style={B("#FF5722","white",{padding:"10px 32px",fontSize:"0.88rem"})}>✖ Ακύρωση</button>
</div></div>);}

// ═══ DETAIL VIEW ═══
function Detail({r,pr,prov,P,cu,onBack,onEdit,onComment,onSC}){
const[ct,setCT]=useState("");const s=ST[r.status]||{};

return(
<div style={{background:"white",borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.08)",overflow:"hidden"}}>
<div style={{background:pr.grad,padding:"14px 20px",color:"white",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
<div><h2 style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.15rem"}}>{pr.icon} {r.id}</h2><div style={{opacity:0.85,fontSize:"0.8rem"}}>{r.ln} {r.fn} • {r.created}</div></div>
<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
<span style={bg(s.bg,s.c)}>{s.i} {s.l}</span>
{P.edit&&<button onClick={onEdit} style={B("rgba(255,255,255,0.2)","white",{})}>✏️</button>}
<button onClick={()=>expPDF(r,prov)} style={B("rgba(255,255,255,0.2)","white",{})}>PDF</button>
<button onClick={()=>expA5(r,prov)} style={B("rgba(255,255,255,0.2)","white",{})}>A5</button>
<button onClick={onBack} style={B("rgba(255,255,255,0.2)","white",{})}>← Πίσω</button></div></div>

{P.status?<div style={{padding:"10px 20px",background:"#FFF8E1",borderBottom:"1px solid #F0F0F0",display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:700,fontSize:"0.82rem"}}>Κατάσταση:</span>
<select value={r.status} onChange={e=>onSC(e.target.value)} style={{...iS,width:220,background:ST[r.status]?.bg||"#F5F5F5",color:ST[r.status]?.c,fontWeight:700}}>
{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></div>
:<div style={{padding:"10px 20px",background:"#FFF8E1",borderBottom:"1px solid #F0F0F0",display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:700,fontSize:"0.82rem"}}>Κατάσταση:</span>
<span style={{...bg(s.bg,s.c),fontSize:"0.85rem",padding:"5px 14px"}}>{s.i} {s.l}</span></div>}

<div style={{padding:"12px 20px",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.88rem",marginBottom:8}}>👤 Πελάτης</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:6}}>
{[["Επώνυμο",r.ln],["Όνομα",r.fn],["ΑΔΤ",r.adt],["Κινητό",r.mob],["ΑΦΜ",r.afm],["Email",r.em],["Διεύθυνση",r.addr],["Πόλη",r.city]].map(([l,v])=><DF key={l} l={l} v={v}/>)}</div></div>

<div style={{padding:"12px 20px",background:"#E8F5E9",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.88rem",marginBottom:8}}>📦 Γραμμές Προϊόντων</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:6,marginBottom:8}}>
<DF l="Agent" v={r.agentName}/><DF l="Partner" v={r.partner}/></div>
{(r.lines&&r.lines.length>0)?r.lines.map((ln,i)=>(
<div key={i} style={{background:"white",border:"1px solid #E0E0E0",borderRadius:8,padding:10,marginBottom:6,borderLeft:`3px solid ${ln.type==="mobile"?"#2196F3":"#FF9800"}`}}>
<div style={{fontWeight:700,fontSize:"0.78rem",color:ln.type==="mobile"?"#1565C0":"#E65100",marginBottom:4}}>{ln.type==="mobile"?"📱 Κινητή":"📞 Σταθερή"} #{i+1}</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:4}}>
<DF l="Πρόγραμμα" v={ln.prog}/><DF l="Τιμή" v={ln.price?"€"+ln.price:"—"}/>
<DF l="Τρόπος" v={ln.mode==="simo"?"SIM Only":"Επιδότηση"+(ln.subsidy?" €"+ln.subsidy:"")}/>
<DF l="Τύπος" v={ln.nlp==="port"?"Φορητότητα"+(ln.fromProv?" από "+ln.fromProv:""):"Νέα Γραμμή"}/>
{ln.mobNum&&<DF l="Κινητό" v={ln.mobNum}/>}{ln.landNum&&<DF l="Σταθερό" v={ln.landNum}/>}
</div></div>))
:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:6}}>
{[["Πρόγραμμα",r.prog],["Τιμή",r.price?"€"+r.price:"—"],["Τύπος",r.lt]].map(([l,v])=><DF key={l} l={l} v={v}/>)}</div>}
{r.lines&&r.lines.length>0&&<div style={{background:"#F5F5F5",borderRadius:8,padding:10,marginTop:6,display:"flex",gap:16,justifyContent:"center",fontSize:"0.82rem",fontWeight:700}}>
<span style={{color:"#1565C0"}}>📱 €{r.lines.filter(l=>l.type==="mobile").reduce((s,l)=>s+(parseFloat(l.price)||0),0).toFixed(2)}</span>
<span style={{color:"#E65100"}}>📞 €{r.lines.filter(l=>l.type==="landline").reduce((s,l)=>s+(parseFloat(l.price)||0),0).toFixed(2)}</span>
<span style={{color:"#2E7D32"}}>💰 €{r.lines.reduce((s,l)=>s+(parseFloat(l.price)||0),0).toFixed(2)}</span>
<span style={{fontSize:"0.68rem",color:"#888",fontStyle:"italic"}}>* Συμπ. ΦΠΑ</span>
</div>}
</div>

<div style={{padding:"12px 20px",background:"#FFF8E1",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.88rem",marginBottom:8}}>🚚 Courier</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:6}}>
{[["Courier",r.cour],["Διεύθυνση",r.cAddr],["Πόλη",r.cCity],["ΤΚ",r.cTk]].map(([l,v])=><DF key={l} l={l} v={v}/>)}</div></div>

{/* COMMENTS */}
<div style={{padding:"14px 20px",background:"#F5F5F5"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem",marginBottom:10}}>💬 Σχόλια ({r.comments?.length||0})</div>
<div style={{maxHeight:280,overflowY:"auto",marginBottom:10}}>
{(r.comments||[]).map((c,i)=>(
<div key={i} style={{background:"white",borderRadius:8,padding:10,marginBottom:6,borderLeft:`3px solid ${ROLES[c.role]?.c||"#999"}`}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
<span style={{fontWeight:700,fontSize:"0.82rem"}}>{ROLES[c.role]?.i} {c.uname} <span style={{...bg(ROLES[c.role]?.c+"20",ROLES[c.role]?.c),fontSize:"0.64rem"}}>{ROLES[c.role]?.l}</span></span>
<span style={{fontSize:"0.72rem",color:"#999"}}>🕐 {c.ts}</span></div>
<p style={{fontSize:"0.84rem",color:"#333"}}>{c.text}</p></div>))}
{(!r.comments||!r.comments.length)&&<p style={{color:"#999",fontSize:"0.82rem",padding:8}}>Δεν υπάρχουν σχόλια</p>}
</div>
{P.comment&&<div style={{display:"flex",gap:6}}>
<input placeholder="Γράψτε σχόλιο..." value={ct} onChange={e=>setCT(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&ct.trim()){onComment(ct);setCT("");}}} style={{...iS,flex:1}}/>
<button onClick={()=>{if(ct.trim()){onComment(ct);setCT("");}}} style={B(pr.color,"white",{})}>📤</button></div>}
</div>

{/* Signature */}
<div style={{padding:"12px 20px",background:"#F3E5F5"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.88rem",marginBottom:8}}>✍️ Υπογραφή</div>
{r.sig?<img src={r.sig} style={{maxWidth:260,maxHeight:100,border:"1px solid #DDD",borderRadius:6,padding:4}} alt="sig"/>:<p style={{color:"#999"}}>—</p>}
</div></div>);}

// ═══ TICKETS ═══
function TixList({tix,cu,P,pr,onSel,onCreate}){
const[show,setShow]=useState(false);const[nt,setNT]=useState({afm:"",cname:"",reason:"",reqId:"",msg:""});
const vis=P.viewAll?tix:tix.filter(t=>t.by===cu.id);
return(<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:900}}>🎫 Αιτήματα</h1>
<button onClick={()=>setShow(!show)} style={B(pr.grad,"white",{padding:"9px 20px"})}>➕ Νέο</button></div>

{show&&<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<h3 style={{fontFamily:"'Outfit'",fontWeight:700,marginBottom:10,fontSize:"0.95rem"}}>Νέο Αίτημα</h3>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8,marginBottom:8}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>ΑΦΜ *</label><input value={nt.afm} onChange={e=>setNT(p=>({...p,afm:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ονοματεπώνυμο *</label><input value={nt.cname} onChange={e=>setNT(p=>({...p,cname:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Λόγος *</label><select value={nt.reason} onChange={e=>setNT(p=>({...p,reason:e.target.value}))} style={iS}><option value="">Επιλέξτε...</option>{TICKET_R.map(r=><option key={r}>{r}</option>)}</select></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Αρ.Αίτησης</label><input value={nt.reqId} onChange={e=>setNT(p=>({...p,reqId:e.target.value}))} placeholder="REQ-..." style={iS}/></div></div>
<div style={{marginBottom:8}}><label style={{fontSize:"0.74rem",fontWeight:600}}>Μήνυμα *</label><textarea value={nt.msg} onChange={e=>setNT(p=>({...p,msg:e.target.value}))} rows={2} style={{...iS,minHeight:50,resize:"vertical"}}/></div>
<button onClick={()=>{if(nt.afm&&nt.cname&&nt.reason&&nt.msg){onCreate(nt);setNT({afm:"",cname:"",reason:"",reqId:"",msg:""});setShow(false);}else alert("Συμπληρώστε τα * πεδία");}} style={B("#4CAF50","white",{padding:"8px 24px"})}>📤 Δημιουργία</button>
</div>}

<div style={{background:"white",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",overflow:"hidden"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>
{["ID","Πελάτης","ΑΦΜ","Λόγος","Ημ/νία","Από","Status","💬"].map(h=><th key={h} style={{padding:"8px 10px",fontFamily:"'Outfit'",fontWeight:600,fontSize:"0.68rem",color:"#888",textAlign:"left"}}>{h}</th>)}
</tr></thead><tbody>
{vis.map(t=><tr key={t.id} style={{borderBottom:"1px solid #F5F5F5",cursor:"pointer"}} onClick={()=>onSel(t)}>
<td style={{padding:"8px 10px",fontWeight:700,color:pr.color,fontSize:"0.78rem"}}>{t.id}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{t.cname}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{t.afm}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{t.reason}</td>
<td style={{padding:"8px 10px",fontSize:"0.74rem"}}>{t.at}</td>
<td style={{padding:"8px 10px",fontSize:"0.76rem"}}>{t.byName}</td>
<td style={{padding:"8px 10px"}}><span style={bg(t.status==="open"?"#E8F5E9":"#F5F5F5",t.status==="open"?"#2E7D32":"#999")}>{t.status==="open"?"🟢 Ανοικτό":"⚫ Κλειστό"}</span></td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>💬 {t.msgs.length}</td>
</tr>)}
{!vis.length&&<tr><td colSpan={8} style={{textAlign:"center",padding:24,color:"#999"}}>Δεν υπάρχουν αιτήματα</td></tr>}
</tbody></table></div></div>);}

function TixDetail({t,cu,pr,onBack,onReply,onClose}){
const[rp,setRP]=useState("");
return(
<div style={{background:"white",borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.08)",overflow:"hidden"}}>
<div style={{background:pr.grad,padding:"14px 20px",color:"white",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
<div><h2 style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.1rem"}}>🎫 {t.id}</h2><div style={{opacity:0.85,fontSize:"0.8rem"}}>{t.cname} • {t.reason}</div></div>
<div style={{display:"flex",gap:5}}>
<span style={bg(t.status==="open"?"#E8F5E9":"#F5F5F5",t.status==="open"?"#2E7D32":"#999")}>{t.status==="open"?"🟢 Ανοικτό":"⚫ Κλειστό"}</span>
{t.status==="open"&&(cu.role==="backoffice"||cu.role==="supervisor"||cu.role==="admin")&&<button onClick={onClose} style={B("rgba(255,255,255,0.2)","white",{})}>🔒 Κλείσιμο</button>}
<button onClick={onBack} style={B("rgba(255,255,255,0.2)","white",{})}>← Πίσω</button></div></div>

<div style={{padding:"10px 20px",background:"#F5F5F5",borderBottom:"1px solid #E8E8E8",display:"flex",gap:16,fontSize:"0.8rem",flexWrap:"wrap"}}>
<span><strong>ΑΦΜ:</strong> {t.afm}</span><span><strong>Αίτηση:</strong> {t.reqId||"—"}</span><span><strong>Δημ:</strong> {t.at}</span></div>

<div style={{padding:"14px 20px",maxHeight:400,overflowY:"auto"}}>
{t.msgs.map((m,i)=>(
<div key={i} style={{background:m.uid===cu.id?"#E3F2FD":"#F5F5F5",borderRadius:10,padding:10,marginBottom:8,marginLeft:m.uid===cu.id?40:0,marginRight:m.uid===cu.id?0:40,borderLeft:`3px solid ${ROLES[m.role]?.c||"#999"}`}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
<span style={{fontWeight:700,fontSize:"0.8rem"}}>{ROLES[m.role]?.i} {m.uname}</span>
<span style={{fontSize:"0.7rem",color:"#999"}}>{m.ts}</span></div>
<p style={{fontSize:"0.84rem"}}>{m.text}</p></div>))}
</div>

{t.status==="open"&&<div style={{padding:"12px 20px",borderTop:"1px solid #E8E8E8",display:"flex",gap:6}}>
<input placeholder="Απάντηση..." value={rp} onChange={e=>setRP(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&rp.trim()){onReply(rp);setRP("");}}} style={{...iS,flex:1}}/>
<button onClick={()=>{if(rp.trim()){onReply(rp);setRP("");}}} style={B(pr.color,"white",{})}>📤</button></div>}
</div>);}

// ═══ USER MANAGEMENT ═══
function UserMgmt({users,setUsers,cu,P,pr}){
const[show,setShow]=useState(false);const[nu,setNU]=useState({un:"",pw:"",name:"",email:"",role:"agent",partner:""});
const[delCode,setDelCode]=useState("");const[delTarget,setDelTarget]=useState(null);
return(<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:900}}>👥 Χρήστες</h1>
<button onClick={()=>setShow(!show)} style={B(pr.grad,"white",{padding:"9px 20px"})}>➕ Νέος</button></div>

{show&&<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:8}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Username</label><input value={nu.un} onChange={e=>setNU(p=>({...p,un:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Password</label><input value={nu.pw} onChange={e=>setNU(p=>({...p,pw:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ονοματεπώνυμο</label><input value={nu.name} onChange={e=>setNU(p=>({...p,name:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Email</label><input value={nu.email} onChange={e=>setNU(p=>({...p,email:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ρόλος</label><select value={nu.role} onChange={e=>setNU(p=>({...p,role:e.target.value}))} style={iS}>{Object.entries(ROLES).filter(([k])=>cu.role==="admin"||k!=="admin").map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Partner</label><select value={nu.partner} onChange={e=>setNU(p=>({...p,partner:e.target.value}))} style={iS}><option value="">—</option>{PARTNERS_LIST.map(p=><option key={p}>{p}</option>)}</select></div>
</div>
<button onClick={()=>{if(nu.un&&nu.pw&&nu.name){setUsers(p=>[...p,{...nu,id:`U${String(p.length+10).padStart(3,"0")}`,active:1,paused:0}]);setNU({un:"",pw:"",name:"",email:"",role:"agent",partner:""});setShow(false);}}} style={B("#4CAF50","white",{padding:"8px 24px"})}>✅ Δημιουργία</button>
</div>}

{/* Delete modal for Director */}
{delTarget&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
<div style={{background:"white",borderRadius:12,padding:24,width:360}}>
<h3 style={{fontFamily:"'Outfit'",fontWeight:700,marginBottom:12}}>🔑 Κωδικός Διαγραφής</h3>
<p style={{fontSize:"0.82rem",marginBottom:10}}>Διαγραφή: <strong>{delTarget.name}</strong></p>
{cu.role==="director"&&<><input placeholder="Κωδικός Admin..." value={delCode} onChange={e=>setDelCode(e.target.value)} style={{...iS,marginBottom:8}}/>
<div style={{display:"flex",gap:6}}>
<button onClick={()=>{if(delCode==="delete123"){setUsers(p=>p.filter(x=>x.id!==delTarget.id));setDelTarget(null);setDelCode("");}else alert("Λάθος κωδικός!");}} style={B("#E60000","white",{})}>🗑 Διαγραφή</button>
<button onClick={()=>{setDelTarget(null);setDelCode("");}} style={B("#999","white",{})}>Ακύρωση</button></div></>}
{cu.role==="admin"&&<div style={{display:"flex",gap:6}}>
<button onClick={()=>{setUsers(p=>p.filter(x=>x.id!==delTarget.id));setDelTarget(null);}} style={B("#E60000","white",{})}>🗑 Διαγραφή</button>
<button onClick={()=>setDelTarget(null)} style={B("#999","white",{})}>Ακύρωση</button></div>}
</div></div>}

<div style={{background:"white",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",overflow:"hidden"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>
{["ID","Username","Όνομα","Email","Ρόλος","Partner","Status","Ενέργειες"].map(h=><th key={h} style={{padding:"8px 10px",fontFamily:"'Outfit'",fontWeight:600,fontSize:"0.68rem",color:"#888",textAlign:"left"}}>{h}</th>)}
</tr></thead><tbody>
{users.map(u=><tr key={u.id} style={{borderBottom:"1px solid #F5F5F5"}}>
<td style={{padding:"8px 10px",fontSize:"0.78rem",fontWeight:600}}>{u.id}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{u.un}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{u.name}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{u.email}</td>
<td style={{padding:"8px 10px"}}><span style={bg(ROLES[u.role]?.c+"20",ROLES[u.role]?.c)}>{ROLES[u.role]?.i} {ROLES[u.role]?.l}</span></td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{u.partner||"—"}</td>
<td style={{padding:"8px 10px"}}><span style={bg(u.paused?"#FFE6E6":u.active?"#E6F9EE":"#F5F5F5",u.paused?"#E60000":u.active?"#00A651":"#999")}>{u.paused?"⏸ Παύση":u.active?"🟢 Ενεργός":"⚫ Off"}</span></td>
<td style={{padding:"8px 10px"}}><div style={{display:"flex",gap:3}}>
<button onClick={()=>setUsers(p=>p.map(x=>x.id===u.id?{...x,paused:x.paused?0:1}:x))} title={u.paused?"Ενεργοποίηση":"Παύση"} style={{padding:"2px 7px",borderRadius:4,border:"none",background:u.paused?"#E8F5E9":"#FFF3E0",color:u.paused?"#2E7D32":"#E65100",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>{u.paused?"▶️":"⏸"}</button>
<button onClick={()=>setUsers(p=>p.map(x=>x.id===u.id?{...x,active:x.active?0:1}:x))} title={u.active?"Απενεργοποίηση":"Ενεργοποίηση"} style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#E3F2FD",color:"#1976D2",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>{u.active?"🔒":"🔓"}</button>
{(P.delUsers||P.needsCode)&&u.role!=="admin"&&<button onClick={()=>setDelTarget(u)} style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#FFE6E6",color:"#E60000",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>🗑</button>}
</div></td></tr>)}
</tbody></table></div></div>);}

// ═══ FIELD MANAGEMENT ═══
function FieldMgmt({pr}){
const[fields,setFields]=useState([
{id:1,label:"Επώνυμο",type:"text",max:50,req:1,on:1},{id:2,label:"Όνομα",type:"text",max:50,req:1,on:1},
{id:3,label:"ΑΦΜ",type:"number",max:9,req:1,on:1},{id:4,label:"ΑΔΤ",type:"text",max:10,req:1,on:1},
{id:5,label:"Τηλέφωνο",type:"number",max:10,req:1,on:1},{id:6,label:"Κινητό",type:"number",max:10,req:1,on:1},
{id:7,label:"Email",type:"email",max:100,req:0,on:1},{id:8,label:"ΤΚ",type:"number",max:5,req:1,on:1},
{id:9,label:"Πόλη",type:"text",max:30,req:1,on:1},
]);
const[show,setShow]=useState(false);const[nf,setNF]=useState({label:"",type:"text",max:50,req:0});
const[ddLists,setDDL]=useState([
{name:"Προγράμματα Vodafone",items:["Red 1","Red 2","Red 3","Unlimited","CU","CU Max"]},
{name:"Couriers",items:["ACS","Speedex","ΕΛΤΑ Courier","DHL","Γενική Ταχ."]},
{name:"Προγράμματα Cosmote",items:["Unlimited 3GB","Unlimited 7GB","Unlimited 15GB","Unlimited MAX"]},
]);
const[editDD,setEditDD]=useState(null);const[ddItem,setDDItem]=useState("");const[ddName,setDDName]=useState("");

return(<div>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:900,marginBottom:16}}>⚙️ Πεδία & Dropdown</h1>

{/* Fields */}
<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"1rem"}}>📋 Πεδία Φόρμας</h2>
<button onClick={()=>setShow(!show)} style={B(pr.grad,"white",{})}>➕ Νέο</button></div>

{show&&<div style={{background:"#F5F5F5",borderRadius:8,padding:12,marginBottom:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
<div><label style={{fontSize:"0.72rem",fontWeight:600}}>Label</label><input value={nf.label} onChange={e=>setNF(p=>({...p,label:e.target.value}))} style={{...iS,width:150}}/></div>
<div><label style={{fontSize:"0.72rem",fontWeight:600}}>Τύπος</label><select value={nf.type} onChange={e=>setNF(p=>({...p,type:e.target.value}))} style={{...iS,width:120}}><option value="text">Κείμενο</option><option value="number">Αριθμός</option><option value="email">Email</option><option value="date">Ημ/νία</option><option value="select">Dropdown</option></select></div>
<div><label style={{fontSize:"0.72rem",fontWeight:600}}>Max χαρ.</label><input type="number" value={nf.max} onChange={e=>setNF(p=>({...p,max:+e.target.value}))} style={{...iS,width:80}}/></div>
<div style={{display:"flex",alignItems:"center",gap:4}}><input type="checkbox" checked={!!nf.req} onChange={e=>setNF(p=>({...p,req:e.target.checked?1:0}))}/><span style={{fontSize:"0.78rem",fontWeight:600}}>Υποχρ.</span></div>
<button onClick={()=>{if(nf.label){setFields(p=>[...p,{id:Date.now(),label:nf.label,type:nf.type,max:nf.max,req:nf.req,on:1}]);setNF({label:"",type:"text",max:50,req:0});setShow(false);}}} style={B("#4CAF50","white",{})}>✅</button>
</div>}

<table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.82rem"}}><thead><tr style={{background:"#FAFAFA"}}>
{["Label","Τύπος","Max","Υποχρ.","Ενεργό",""].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600,fontSize:"0.7rem",color:"#888"}}>{h}</th>)}
</tr></thead><tbody>
{fields.map(f=><tr key={f.id} style={{borderBottom:"1px solid #F0F0F0",opacity:f.on?1:0.5}}>
<td style={{padding:"6px 8px",fontWeight:600}}>{f.label}</td>
<td style={{padding:"6px 8px"}}>{f.type}</td>
<td style={{padding:"6px 8px"}}>{f.max}</td>
<td style={{padding:"6px 8px"}}>{f.req?"✅":"—"}</td>
<td style={{padding:"6px 8px"}}>{f.on?"🟢":"⚫"}</td>
<td style={{padding:"6px 8px"}}>
<button onClick={()=>setFields(p=>p.map(x=>x.id===f.id?{...x,on:x.on?0:1}:x))} style={{padding:"2px 6px",borderRadius:3,border:"none",background:"#E3F2FD",color:"#1976D2",cursor:"pointer",fontSize:"0.68rem"}}>{f.on?"🔒":"🔓"}</button>
<button onClick={()=>setFields(p=>p.filter(x=>x.id!==f.id))} style={{padding:"2px 6px",borderRadius:3,border:"none",background:"#FFE6E6",color:"#E60000",cursor:"pointer",fontSize:"0.68rem",marginLeft:3}}>🗑</button>
</td></tr>)}
</tbody></table></div>

{/* Dropdown Lists */}
<div style={{background:"white",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"1rem",marginBottom:12}}>📝 Dropdown Lists (χωρίς κώδικα)</h2>
<p style={{fontSize:"0.8rem",color:"#666",marginBottom:12}}>Προσθέστε/αφαιρέστε στοιχεία από τις λίστες χωρίς κώδικα — πχ αλλαγή οικονομικών προγραμμάτων, couriers κλπ.</p>

{ddLists.map((dd,i)=><div key={i} style={{background:"#F5F5F5",borderRadius:8,padding:12,marginBottom:8}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
<strong style={{fontSize:"0.85rem"}}>{dd.name} ({dd.items.length})</strong>
<button onClick={()=>setEditDD(editDD===i?null:i)} style={B("#E3F2FD","#1976D2",{fontSize:"0.72rem",padding:"3px 10px"})}>{editDD===i?"✖":"✏️"}</button></div>
<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
{dd.items.map((item,j)=><span key={j} style={{background:"white",padding:"3px 8px",borderRadius:4,fontSize:"0.76rem",display:"inline-flex",alignItems:"center",gap:4}}>
{item}{editDD===i&&<span onClick={()=>setDDL(p=>p.map((x,xi)=>xi===i?{...x,items:x.items.filter((_,ji)=>ji!==j)}:x))} style={{cursor:"pointer",color:"#E60000",fontSize:"0.7rem"}}>✕</span>}
</span>)}</div>
{editDD===i&&<div style={{display:"flex",gap:4,marginTop:6}}>
<input placeholder="Νέο στοιχείο..." value={ddItem} onChange={e=>setDDItem(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&ddItem.trim()){setDDL(p=>p.map((x,xi)=>xi===i?{...x,items:[...x.items,ddItem.trim()]}:x));setDDItem("");}}} style={{...iS,flex:1}}/>
<button onClick={()=>{if(ddItem.trim()){setDDL(p=>p.map((x,xi)=>xi===i?{...x,items:[...x.items,ddItem.trim()]}:x));setDDItem("");}}} style={B("#4CAF50","white",{})}>➕</button></div>}
</div>)}

<div style={{display:"flex",gap:6,marginTop:10}}>
<input placeholder="Νέα λίστα..." value={ddName} onChange={e=>setDDName(e.target.value)} style={{...iS,flex:1}}/>
<button onClick={()=>{if(ddName.trim()){setDDL(p=>[...p,{name:ddName.trim(),items:[]}]);setDDName("");}}} style={B(pr.color,"white",{})}>➕ Λίστα</button></div>
</div></div>);}

// ═══ SYSTEM PANEL ═══
function SysMgmt({sp,setSP,users,setUsers,pr}){
return(<div>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:900,marginBottom:16}}>🔧 Σύστημα</h1>

<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"1rem",marginBottom:12}}>⏸ Παύση Συστήματος</h2>
<div style={{display:"flex",gap:10,alignItems:"center"}}>
<button onClick={()=>setSP(!sp)} style={B(sp?"#4CAF50":"#E60000","white",{padding:"10px 24px",fontSize:"0.9rem"})}>
{sp?"▶️ Ενεργοποίηση":"⏸ Παύση Όλων"}</button>
<span style={{...bg(sp?"#FFE6E6":"#E6F9EE",sp?"#E60000":"#00A651"),fontSize:"0.82rem",padding:"4px 12px"}}>{sp?"🔴 Παύση":"🟢 Ενεργό"}</span>
</div></div>

<div style={{background:"white",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"1rem",marginBottom:12}}>👥 Παύση ανά Χρήστη</h2>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:8}}>
{users.filter(u=>u.role!=="admin").map(u=><div key={u.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:10,background:u.paused?"#FFE6E6":"#F5F5F5",borderRadius:8,border:`1px solid ${u.paused?"#E60000":"#E8E8E8"}`}}>
<div><div style={{fontWeight:700,fontSize:"0.82rem"}}>{ROLES[u.role]?.i} {u.name}</div><div style={{fontSize:"0.72rem",color:"#888"}}>{ROLES[u.role]?.l} • {u.un}</div></div>
<button onClick={()=>setUsers(p=>p.map(x=>x.id===u.id?{...x,paused:x.paused?0:1}:x))} style={B(u.paused?"#4CAF50":"#FF9800","white",{fontSize:"0.75rem",padding:"5px 12px"})}>
{u.paused?"▶️":"⏸"}</button></div>)}
</div></div></div>);}

// ═══════════════════════════════════════════════════════════
// ADMIN PANEL — Full control without code
// ═══════════════════════════════════════════════════════════

// ═══ ADMIN PANEL — All hooks at top level ═══
function AdminPanel({users,setUsers,reqs,setReqs,afmDb,setAfmDb,cu,pr,sysPaused,setSysPaused}){
// ALL hooks at top — never inside conditions
const[sec,setSec]=useState("ov");
const[showU,setShowU]=useState(false);
const[nu,setNu]=useState({un:"",pw:"",name:"",email:"",role:"agent",partner:"",cc:1});
const[showF,setShowF]=useState(false);
const[nf,setNf]=useState({l:"",t:"text",mx:50,rq:0});
const[flds,setFlds]=useState([{id:1,l:"Επώνυμο",t:"text",mx:50,rq:1,on:1},{id:2,l:"Όνομα",t:"text",mx:50,rq:1,on:1},{id:3,l:"ΑΦΜ",t:"number",mx:9,rq:1,on:1},{id:4,l:"ΑΔΤ",t:"text",mx:10,rq:1,on:1},{id:5,l:"Κινητό",t:"number",mx:10,rq:1,on:1},{id:6,l:"Email",t:"email",mx:100,rq:0,on:1},{id:7,l:"ΤΚ",t:"number",mx:5,rq:1,on:1},{id:8,l:"Πόλη",t:"text",mx:30,rq:1,on:1}]);
const[dds,setDds]=useState([{n:"Vodafone Mobile",it:["Red 1","Red 2","Red 3","Unlimited","CU","CU Max"]},{n:"Cosmote Mobile",it:["Unlimited 3GB","Unlimited 7GB","Unlimited 15GB","Unlimited MAX"]},{n:"Nova Mobile",it:["Mobile 3GB","Mobile 7GB","Mobile Unlimited"]},{n:"Couriers",it:["ACS","Speedex","ΕΛΤΑ Courier","DHL","Γενική Ταχ."]},{n:"Υπηρεσίες",it:["Νέα Σύνδεση","Φορητότητα","Ανανέωση","Win Back"]}]);
const[edDD,setEdDD]=useState(null);
const[ddItem,setDdItem]=useState("");
const[ddName,setDdName]=useState("");
const[showC,setShowC]=useState(false);
const[nc,setNc]=useState({afm:"",ln:"",fn:"",mob:"",city:""});


// ─── OVERVIEW ───
if(sec==="ov")return(<div>
<h1 style={{fontFamily:"'Outfit'",fontSize:"2rem",fontWeight:900,marginBottom:4}}>👑 Admin Panel</h1>
<p style={{color:"#888",fontSize:"0.85rem",marginBottom:20}}>Πλήρης διαχείριση χωρίς κώδικα</p>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10}}>
<AdmCd ic="👥" ti="Χρήστες & Partners" ds="Δημιουργία, παύση, διαγραφή, δικαιώματα" ct={users.length} cl="#E91E63" onClick={()=>setSec("us")}/>
<AdmCd ic="📋" ti="Πεδία Φόρμας" ds="Προσθήκη, αφαίρεση, validation" ct={flds.length} cl="#2196F3" onClick={()=>setSec("fl")}/>
<AdmCd ic="📝" ti="Dropdown Lists" ds="Προγράμματα, couriers, υπηρεσίες" ct={dds.length} cl="#FF9800" onClick={()=>setSec("dd")}/>
<AdmCd ic="👤" ti="Πελάτες ΑΦΜ" ds="Βάση δεδομένων, προσθήκη/διαγραφή" ct={afmDb.length} cl="#9C27B0" onClick={()=>setSec("cu")}/>
<AdmCd ic="📊" ti="Αιτήσεις" ds="Επεξεργασία, διαγραφή, status" ct={reqs.length} cl="#FF5722" onClick={()=>setSec("rq")}/>
<AdmCd ic="🔧" ti="Σύστημα" ds="Παύση συστήματος" cl="#607D8B" onClick={()=>setSec("sy")}/>
<AdmCd ic="🗃️" ti="Supabase" ds="SQL Schema & σύνδεση" cl="#3ECF8E" onClick={()=>setSec("db")}/>
</div></div>);

// ─── USERS ───
if(sec==="us")return(<div><AdmBk onClick={()=>setSec("ov")}/>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.5rem",fontWeight:900,marginBottom:14}}>👥 Χρήστες & Partners</h1>
<div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
{[["Partners",users.filter(u=>u.role==="partner").length,"#4CAF50"],["Agents",users.filter(u=>u.role==="agent").length,"#607D8B"],["Παύση",users.filter(u=>u.paused).length,"#E60000"],["Χωρίς καταχ.",users.filter(u=>!u.cc).length,"#FF9800"]].map(([l,v,c])=>
<div key={l} style={{background:"white",borderRadius:10,padding:12,flex:1,minWidth:120,borderLeft:`4px solid ${c}`}}><div style={{fontSize:"0.72rem",color:"#888"}}>{l}</div><div style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.3rem",color:c}}>{v}</div></div>)}</div>
<button onClick={()=>setShowU(!showU)} style={B(pr.grad,"white",{marginBottom:12})}>➕ Νέος</button>
{showU&&<div style={{background:"white",borderRadius:10,padding:14,marginBottom:12}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8,marginBottom:8}}>
{[["un","Username"],["pw","Password"],["name","Ονοματεπ."],["email","Email"]].map(([f,l])=><div key={f}><label style={{fontSize:"0.72rem",fontWeight:600}}>{l}</label><input value={nu[f]} onChange={e=>setNu(p=>({...p,[f]:e.target.value}))} style={iS}/></div>)}
<div><label style={{fontSize:"0.72rem",fontWeight:600}}>Ρόλος</label><select value={nu.role} onChange={e=>setNu(p=>({...p,role:e.target.value}))} style={iS}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></div>
<div><label style={{fontSize:"0.72rem",fontWeight:600}}>Partner</label><select value={nu.partner} onChange={e=>setNu(p=>({...p,partner:e.target.value}))} style={iS}><option value="">—</option>{PARTNERS_LIST.map(p=><option key={p}>{p}</option>)}</select></div>
<div style={{display:"flex",alignItems:"center",gap:4,paddingTop:14}}><input type="checkbox" checked={!!nu.cc} onChange={e=>setNu(p=>({...p,cc:e.target.checked?1:0}))}/><span style={{fontSize:"0.76rem",fontWeight:600}}>Καταχώρηση</span></div>
</div><button onClick={()=>{if(nu.un&&nu.pw&&nu.name){setUsers(p=>[...p,{...nu,id:"U"+String(p.length+10).padStart(3,"0"),active:1,paused:0}]);setNu({un:"",pw:"",name:"",email:"",role:"agent",partner:"",cc:1});setShowU(false);}}} style={B("#4CAF50","white",{})}>✅</button></div>}
<div style={{background:"white",borderRadius:10,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>{["","Χρήστης","Ρόλος","Partner","Καταχ.","Status",""].map(h=><th key={h} style={{padding:"7px 10px",fontFamily:"'Outfit'",fontWeight:600,fontSize:"0.68rem",color:"#888",textAlign:"left"}}>{h}</th>)}</tr></thead><tbody>
{users.map(u=><tr key={u.id} style={{borderBottom:"1px solid #F5F5F5",background:u.paused?"#FFF5F5":"white"}}>
<td style={{padding:"7px 10px",fontSize:"0.76rem",fontWeight:600}}>{u.id}</td>
<td style={{padding:"7px 10px"}}><div style={{fontWeight:600,fontSize:"0.82rem"}}>{u.name}</div><div style={{fontSize:"0.7rem",color:"#888"}}>{u.un}</div></td>
<td style={{padding:"7px 10px"}}><span style={bg(ROLES[u.role]?.c+"20",ROLES[u.role]?.c)}>{ROLES[u.role]?.i} {ROLES[u.role]?.l}</span></td>
<td style={{padding:"7px 10px",fontSize:"0.78rem"}}>{u.partner||"—"}</td>
<td style={{padding:"7px 10px"}}><button onClick={()=>setUsers(p=>p.map(x=>x.id===u.id?{...x,cc:x.cc?0:1}:x))} style={{padding:"3px 10px",borderRadius:5,border:"none",background:u.cc?"#E8F5E9":"#FFE6E6",color:u.cc?"#2E7D32":"#E60000",cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>{u.cc?"✅":"❌"}</button></td>
<td style={{padding:"7px 10px"}}><button onClick={()=>setUsers(p=>p.map(x=>x.id===u.id?{...x,paused:x.paused?0:1}:x))} style={{padding:"3px 10px",borderRadius:5,border:"none",background:u.paused?"#E8F5E9":"#FFF3E0",color:u.paused?"#2E7D32":"#E65100",cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>{u.paused?"▶ Ενεργοποίηση":"⏸ Παύση"}</button></td>
<td style={{padding:"7px 10px"}}>{u.role!=="admin"&&<button onClick={()=>{if(confirm("Διαγραφή "+u.name+"?"))setUsers(p=>p.filter(x=>x.id!==u.id));}} style={{padding:"2px 8px",borderRadius:4,border:"none",background:"#FFE6E6",color:"#E60000",cursor:"pointer",fontSize:"0.7rem",fontWeight:600}}>🗑</button>}</td></tr>)}</tbody></table></div></div>);

// ─── FIELDS ───
if(sec==="fl")return(<div><AdmBk onClick={()=>setSec("ov")}/>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.5rem",fontWeight:900,marginBottom:6}}>📋 Πεδία Φόρμας</h1>
<p style={{fontSize:"0.82rem",color:"#666",marginBottom:14}}>Προσθήκη/αφαίρεση πεδίων, τύπος, max χαρακτήρες</p>
<button onClick={()=>setShowF(!showF)} style={B(pr.grad,"white",{marginBottom:12})}>➕ Νέο Πεδίο</button>
{showF&&<div style={{background:"#F5F5F5",borderRadius:8,padding:12,marginBottom:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
<div><label style={{fontSize:"0.72rem",fontWeight:600}}>Label</label><input value={nf.l} onChange={e=>setNf(p=>({...p,l:e.target.value}))} style={{...iS,width:150}}/></div>
<div><label style={{fontSize:"0.72rem",fontWeight:600}}>Τύπος</label><select value={nf.t} onChange={e=>setNf(p=>({...p,t:e.target.value}))} style={{...iS,width:110}}><option value="text">Κείμενο</option><option value="number">Αριθμός</option><option value="email">Email</option><option value="date">Ημ/νία</option></select></div>
<div><label style={{fontSize:"0.72rem",fontWeight:600}}>Max</label><input type="number" value={nf.mx} onChange={e=>setNf(p=>({...p,mx:+e.target.value}))} style={{...iS,width:70}}/></div>
<div style={{display:"flex",alignItems:"center",gap:4}}><input type="checkbox" checked={!!nf.rq} onChange={e=>setNf(p=>({...p,rq:e.target.checked?1:0}))}/><span style={{fontSize:"0.76rem"}}>Υποχρ.</span></div>
<button onClick={()=>{if(nf.l){setFlds(p=>[...p,{id:Date.now(),...nf,on:1}]);setNf({l:"",t:"text",mx:50,rq:0});setShowF(false);}}} style={B("#4CAF50","white",{})}>✅</button></div>}
<div style={{background:"white",borderRadius:10,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>{["Πεδίο","Τύπος","Max","Υποχρ.","Status",""].map(h=><th key={h} style={{padding:"6px 10px",fontWeight:600,fontSize:"0.7rem",color:"#888",textAlign:"left"}}>{h}</th>)}</tr></thead><tbody>
{flds.map(f=><tr key={f.id} style={{borderBottom:"1px solid #F0F0F0",opacity:f.on?1:.5}}>
<td style={{padding:"6px 10px",fontWeight:600}}>{f.l}</td><td style={{padding:"6px 10px"}}>{f.t}</td><td style={{padding:"6px 10px"}}>{f.mx}</td>
<td style={{padding:"6px 10px"}}>{f.rq?"✅":"—"}</td><td style={{padding:"6px 10px"}}>{f.on?"🟢":"⚫"}</td>
<td style={{padding:"6px 10px"}}><div style={{display:"flex",gap:3}}>
<button onClick={()=>setFlds(p=>p.map(x=>x.id===f.id?{...x,on:x.on?0:1}:x))} style={{padding:"2px 6px",borderRadius:3,border:"none",background:"#E3F2FD",color:"#1976D2",cursor:"pointer",fontSize:"0.66rem"}}>{f.on?"🔒":"🔓"}</button>
<button onClick={()=>setFlds(p=>p.filter(x=>x.id!==f.id))} style={{padding:"2px 6px",borderRadius:3,border:"none",background:"#FFE6E6",color:"#E60000",cursor:"pointer",fontSize:"0.66rem"}}>🗑</button></div></td></tr>)}</tbody></table></div></div>);

// ─── DROPDOWNS ───
if(sec==="dd")return(<div><AdmBk onClick={()=>setSec("ov")}/>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.5rem",fontWeight:900,marginBottom:6}}>📝 Dropdown Lists</h1>
<p style={{fontSize:"0.82rem",color:"#666",marginBottom:14}}>Αλλαγή χωρίς κώδικα!</p>
{dds.map((d,i)=><div key={i} style={{background:"white",borderRadius:10,padding:14,marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><strong style={{fontSize:"0.88rem"}}>{d.n} ({d.it.length})</strong>
<button onClick={()=>setEdDD(edDD===i?null:i)} style={B(edDD===i?"#FF5722":"#E3F2FD",edDD===i?"white":"#1976D2",{fontSize:"0.72rem",padding:"4px 12px"})}>{edDD===i?"✖":"✏️"}</button></div>
<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{d.it.map((item,j)=><span key={j} style={{background:"#F5F5F5",padding:"4px 10px",borderRadius:6,fontSize:"0.78rem",display:"inline-flex",alignItems:"center",gap:4}}>{item}{edDD===i&&<span onClick={()=>setDds(p=>p.map((x,xi)=>xi===i?{...x,it:x.it.filter((_v,ji)=>ji!==j)}:x))} style={{cursor:"pointer",color:"#E60000",fontSize:"0.7rem"}}>✕</span>}</span>)}</div>
{edDD===i&&<div style={{display:"flex",gap:4,marginTop:6}}><input placeholder="Νέο..." value={ddItem} onChange={e=>setDdItem(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&ddItem.trim()){setDds(p=>p.map((x,xi)=>xi===i?{...x,it:[...x.it,ddItem.trim()]}:x));setDdItem("");}}} style={{...iS,flex:1}}/><button onClick={()=>{if(ddItem.trim()){setDds(p=>p.map((x,xi)=>xi===i?{...x,it:[...x.it,ddItem.trim()]}:x));setDdItem("");}}} style={B("#4CAF50","white",{})}>➕</button></div>}
</div>)}
<div style={{display:"flex",gap:6,marginTop:10}}><input placeholder="Νέα λίστα..." value={ddName} onChange={e=>setDdName(e.target.value)} style={{...iS,flex:1}}/><button onClick={()=>{if(ddName.trim()){setDds(p=>[...p,{n:ddName.trim(),it:[]}]);setDdName("");}}} style={B(pr.color,"white",{})}>➕</button></div></div>);

// ─── CUSTOMERS ───
if(sec==="cu")return(<div><AdmBk onClick={()=>setSec("ov")}/>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.5rem",fontWeight:900,marginBottom:14}}>👤 Πελάτες — ΑΦΜ</h1>
<button onClick={()=>setShowC(!showC)} style={B(pr.grad,"white",{marginBottom:12})}>➕ Νέος</button>
{showC&&<div style={{background:"white",borderRadius:10,padding:14,marginBottom:12}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8,marginBottom:8}}>
{[["afm","ΑΦΜ"],["ln","Επώνυμο"],["fn","Όνομα"],["mob","Κινητό"],["city","Πόλη"]].map(([f,l])=><div key={f}><label style={{fontSize:"0.72rem",fontWeight:600}}>{l}</label><input value={nc[f]} onChange={e=>setNc(p=>({...p,[f]:e.target.value}))} style={iS}/></div>)}</div>
<button onClick={()=>{if(nc.afm&&nc.ln){setAfmDb(p=>[...p,{...nc,fat:"",bd:"",adt:"",ph:"",em:"",doy:"",tk:"",addr:"",ct:nc.city}]);setNc({afm:"",ln:"",fn:"",mob:"",city:""});setShowC(false);}}} style={B("#4CAF50","white",{})}>✅</button></div>}
<div style={{background:"white",borderRadius:10,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>{["ΑΦΜ","Ονοματεπώνυμο","Κινητό","Πόλη",""].map(h=><th key={h} style={{padding:"7px 10px",fontWeight:600,fontSize:"0.7rem",color:"#888",textAlign:"left"}}>{h}</th>)}</tr></thead><tbody>
{afmDb.map(c=><tr key={c.afm} style={{borderBottom:"1px solid #F5F5F5"}}><td style={{padding:"7px 10px",fontWeight:600}}>{c.afm}</td><td style={{padding:"7px 10px"}}>{c.ln} {c.fn}</td><td style={{padding:"7px 10px"}}>{c.mob}</td><td style={{padding:"7px 10px"}}>{c.city||c.ct}</td>
<td style={{padding:"7px 10px"}}><button onClick={()=>{if(confirm("Διαγραφή;"))setAfmDb(p=>p.filter(x=>x.afm!==c.afm));}} style={{padding:"2px 8px",borderRadius:4,border:"none",background:"#FFE6E6",color:"#E60000",cursor:"pointer",fontSize:"0.7rem",fontWeight:600}}>🗑</button></td></tr>)}</tbody></table></div></div>);

// ─── REQUESTS ───
if(sec==="rq")return(<div><AdmBk onClick={()=>setSec("ov")}/>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.5rem",fontWeight:900,marginBottom:14}}>📊 Αιτήσεις ({reqs.length})</h1>
<div style={{background:"white",borderRadius:10,overflow:"hidden"}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>{["ID","Πελάτης","ΑΦΜ","Πρόγρ.","Status","Agent",""].map(h=><th key={h} style={{padding:"7px 10px",fontWeight:600,fontSize:"0.7rem",color:"#888",textAlign:"left"}}>{h}</th>)}</tr></thead><tbody>
{reqs.map(r=><tr key={r.id} style={{borderBottom:"1px solid #F5F5F5"}}>
<td style={{padding:"7px 10px",fontWeight:700,color:pr.color,fontSize:"0.78rem"}}>{r.id}</td>
<td style={{padding:"7px 10px"}}>{r.ln} {r.fn}</td>
<td style={{padding:"7px 10px",fontSize:"0.78rem"}}>{r.afm}</td>
<td style={{padding:"7px 10px",fontSize:"0.76rem"}}>{r.prog}</td>
<td style={{padding:"7px 10px"}}><select value={r.status} onChange={e=>setReqs(p=>p.map(x=>x.id===r.id?{...x,status:e.target.value}:x))} style={{...iS,width:155,padding:"3px 6px",fontSize:"0.72rem",background:ST[r.status]?.bg||"#F5F5F5",color:ST[r.status]?.c||"#333",fontWeight:700}}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></td>
<td style={{padding:"7px 10px",fontSize:"0.76rem"}}>{r.agentName}</td>
<td style={{padding:"7px 10px"}}><button onClick={()=>{if(confirm("Διαγραφή "+r.id+"?"))setReqs(p=>p.filter(x=>x.id!==r.id));}} style={{padding:"2px 8px",borderRadius:4,border:"none",background:"#FFE6E6",color:"#E60000",cursor:"pointer",fontSize:"0.7rem",fontWeight:600}}>🗑</button></td></tr>)}</tbody></table></div></div></div>);

// ─── SYSTEM ───
if(sec==="sy")return(<div><AdmBk onClick={()=>setSec("ov")}/>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.5rem",fontWeight:900,marginBottom:14}}>🔧 Σύστημα</h1>
<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"1rem",marginBottom:12}}>Παύση Συστήματος</h2>
<div style={{display:"flex",gap:10,alignItems:"center"}}><button onClick={()=>setSysPaused(!sysPaused)} style={B(sysPaused?"#4CAF50":"#E60000","white",{padding:"10px 24px",fontSize:"0.9rem"})}>{sysPaused?"▶️ ON":"⏸ OFF"}</button>
<span style={{...bg(sysPaused?"#FFE6E6":"#E6F9EE",sysPaused?"#E60000":"#00A651"),fontSize:"0.82rem",padding:"4px 12px"}}>{sysPaused?"🔴 Παύση":"🟢 Ενεργό"}</span></div></div>
<div style={{background:"white",borderRadius:12,padding:18}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"1rem",marginBottom:12}}>Παύση ανά Χρήστη</h2>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:8}}>
{users.filter(u=>u.role!=="admin").map(u=><div key={u.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:10,background:u.paused?"#FFE6E6":"#F5F5F5",borderRadius:8}}>
<div><div style={{fontWeight:700,fontSize:"0.82rem"}}>{ROLES[u.role]?.i} {u.name} <span style={{fontSize:"0.68rem",padding:"2px 6px",borderRadius:4,background:u.paused?"#FFE6E6":"#E6F9EE",color:u.paused?"#E60000":"#00A651",fontWeight:700}}>{u.paused?"🔴 ΣΕ ΠΑΥΣΗ":"🟢 ΕΝΕΡΓΟΣ"}</span></div><div style={{fontSize:"0.72rem",color:"#888"}}>{ROLES[u.role]?.l}</div></div>
<button onClick={()=>setUsers(p=>p.map(x=>x.id===u.id?{...x,paused:x.paused?0:1}:x))} style={B(u.paused?"#4CAF50":"#FF9800","white",{fontSize:"0.75rem",padding:"5px 12px"})}>{u.paused?"▶ Ενεργοποίηση":"⏸ Παύση"}</button></div>)}</div></div></div>);

// ─── SUPABASE ───
if(sec==="db")return(<div><AdmBk onClick={()=>setSec("ov")}/>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.5rem",fontWeight:900,marginBottom:14}}>🗃️ Supabase</h1>
<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{...bg(USE_SUPA?"#E8F5E9":"#FFF3E0",USE_SUPA?"#2E7D32":"#E65100"),fontSize:"0.82rem",padding:"4px 12px"}}>{USE_SUPA?"🟢 Connected":"🟡 Local Mode"}</span></div>
<div style={{fontSize:"0.82rem",color:"#555",lineHeight:1.8}}>
<p><strong>1.</strong> Δημιουργία project: supabase.com</p>
<p><strong>2.</strong> Αντιγραφή Project URL + anon key</p>
<p><strong>3.</strong> Αλλαγή SUPA_URL, SUPA_KEY στον κώδικα</p>
<p><strong>4.</strong> USE_SUPA = true</p>
<p><strong>5.</strong> SQL Schema στο SQL Editor</p>
</div></div>
<div style={{background:"#1A1A2E",borderRadius:12,padding:18,color:"#E0E0E0"}}>
<h3 style={{color:"#3ECF8E",marginBottom:8,fontFamily:"'Outfit'"}}>SQL</h3>
<pre style={{fontSize:"0.68rem",lineHeight:1.4,overflowX:"auto",whiteSpace:"pre-wrap",color:"#CCC"}}>{"CREATE TABLE users (id TEXT PK, username TEXT, password TEXT, name TEXT, email TEXT, role TEXT, partner TEXT, active BOOL, paused BOOL, can_create BOOL);\n\nCREATE TABLE requests (id TEXT PK, provider TEXT, ln TEXT, fn TEXT, afm TEXT, mob TEXT, program TEXT, service TEXT, status TEXT, partner TEXT, agent_id TEXT, price TEXT, created TEXT);\n\nCREATE TABLE comments (id TEXT PK, request_id TEXT, user_id TEXT, user_name TEXT, text TEXT, ts TEXT);\n\nCREATE TABLE tickets (id TEXT PK, afm TEXT, cname TEXT, reason TEXT, status TEXT, created_by TEXT);\n\nCREATE TABLE afm_db (afm TEXT PK, ln TEXT, fn TEXT, mob TEXT, city TEXT);\n\nCREATE TABLE custom_fields (id SERIAL, label TEXT, type TEXT, max_chars INT, required BOOL, active BOOL);\n\nCREATE TABLE dropdown_lists (id SERIAL, name TEXT, items JSONB);"}</pre></div></div>);

return <div style={{textAlign:"center",padding:40,color:"#999"}}>Επιλέξτε κατηγορία</div>;
}
