import { useState, useEffect, useRef } from "react";


/* ═══ SHEETJS XLSX EXPORT ═══ */
const loadXLSX=()=>new Promise((res,rej)=>{
  if(window.XLSX)return res(window.XLSX);
  const s=document.createElement("script");
  s.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
  s.onload=()=>res(window.XLSX);
  s.onerror=()=>rej(new Error("Failed to load SheetJS"));
  document.head.appendChild(s);
});


const downloadDoc=async(path,name)=>{
  try{
    console.log("📥 Downloading:",path);
    // Use Supabase Storage authenticated endpoint
    const res=await fetch(`${SUPA_URL}/storage/v1/object/authenticated/documents/${path}`,{
      headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}
    });
    console.log("📥 Auth response:",res.status);
    if(res.ok){
      const blob=await res.blob();
      const url=URL.createObjectURL(blob);
      if(blob.type.startsWith("image/")||blob.type==="application/pdf"){window.open(url,"_blank");}
      else{const a=document.createElement("a");a.href=url;a.download=name||"document";document.body.appendChild(a);a.click();document.body.removeChild(a);}
      return;
    }
    // Fallback: try public endpoint
    console.log("📥 Trying public...");
    const pub=await fetch(`${SUPA_URL}/storage/v1/object/public/documents/${path}`);
    if(pub.ok){
      const blob=await pub.blob();
      const url=URL.createObjectURL(blob);
      window.open(url,"_blank");
      return;
    }
    // Fallback 2: render endpoint  
    console.log("📥 Trying render...");
    const render=await fetch(`${SUPA_URL}/storage/v1/render/image/authenticated/documents/${path}`,{
      headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}
    });
    if(render.ok){
      const blob=await render.blob();
      window.open(URL.createObjectURL(blob),"_blank");
      return;
    }
    const errText=await res.text();
    throw new Error(res.status+": "+errText);
  }catch(e){console.error("📥 Download error:",e);alert("Σφάλμα λήψης: "+e.message);}
};

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
  sent:{ l:"Απεστάλη",c:"#1565C0",bg:"#E3F2FD",i:"📤" },processing:{ l:"Σε Επεξεργασία",c:"#7B1FA2",bg:"#F3E5F5",i:"⚙️" },
  active:{ l:"Ενεργή",c:"#00A651",bg:"#E6F9EE",i:"✅" },pending:{ l:"Εκκρεμότητα",c:"#FF9800",bg:"#FFF3E0",i:"⏳" },
  cancelled:{ l:"Ακυρωμένη",c:"#E60000",bg:"#FFE6E6",i:"❌" },winback:{ l:"Win Back",c:"#9C27B0",bg:"#F3E5F5",i:"🔄" },
  counteroffer:{ l:"Αντιπρόταση",c:"#2196F3",bg:"#E3F2FD",i:"💬" },credit_check:{ l:"Πιστωτικός Έλεγχος",c:"#FF5722",bg:"#FBE9E7",i:"🔍" },
  credited:{ l:"Πιστωθείσες",c:"#009688",bg:"#E0F2F1",i:"💳" },
};

const ROLES = { admin:{l:"Admin",c:"#E91E63",i:"👑"}, director:{l:"Director",c:"#9C27B0",i:"🎯"}, supervisor:{l:"Supervisor",c:"#2196F3",i:"📋"}, backoffice:{l:"BackOffice",c:"#FF9800",i:"🏢"}, partner:{l:"Partner",c:"#4CAF50",i:"🤝"}, agent:{l:"Agent",c:"#607D8B",i:"👤"} };

const PERMS = {
  admin:{create:1,edit:1,del:1,viewAll:1,users:1,delUsers:1,pause:1,fields:1,exp:1,tickets:1,status:1,comment:1,adminPanel:1,reports:1},
  director:{create:0,edit:1,del:1,viewAll:1,users:1,delUsers:0,pause:0,fields:0,exp:1,tickets:1,status:1,comment:1,needsCode:1,reports:1},
  supervisor:{create:0,edit:1,del:0,viewAll:1,users:0,delUsers:0,pause:0,fields:0,exp:1,tickets:1,status:1,comment:1},
  backoffice:{create:0,edit:1,del:0,viewAll:1,users:0,delUsers:0,pause:0,fields:0,exp:1,tickets:1,status:1,comment:1,reports:1},
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
const fmtDate=(s)=>{if(!s)return"—";try{if(s.includes("/")){const p=s.split(" ")[0].split("/");return `${p[0].padStart(2,"0")}/${p[1].padStart(2,"0")}/${(p[2]||"").slice(-2)}`;}const d=new Date(s);if(isNaN(d))return s;return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(-2)}`;}catch(e){return s;}};
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

const expXLSX=async(data,filename,sheetName)=>{
  try{
    const XLSX=await loadXLSX();
    const h=["ID","Πάροχος","Επώνυμο","Όνομα","ΑΦΜ","Κινητό","Πρόγραμμα","Υπηρεσία","Κατάσταση","Partner","Agent","Ημ/νία","Πάγιο €","Γραμμές Κιν.","Γραμμές Σταθ.","Επιδότηση €"];
    const rows=data.map(r=>{
      const lns=r.lines||[];
      const mobLns=lns.filter(l=>l.type==="mobile");
      const landLns=lns.filter(l=>l.type==="landline");
      const subTotal=lns.filter(l=>l.mode==="subsidy").reduce((s,l)=>s+(parseFloat(l.subsidy)||0),0);
      return[r.id,PROVIDERS[r.prov]?.name||"",r.ln,r.fn,r.afm,r.mob,r.prog||lns.map(l=>l.prog).join(", "),r.svc||lns.map(l=>l.type==="mobile"?"Κινητή":"Σταθερή").join(", "),ST[r.status]?.l||"",r.partner,r.agentName,r.created,parseFloat(r.price)||0,mobLns.length,landLns.length,subTotal];
    });
    const ws=XLSX.utils.aoa_to_sheet([h,...rows]);
    // Auto-width columns
    const colW=h.map((h,i)=>({wch:Math.max(h.length,12,...rows.map(r=>String(r[i]||"").length))}));
    ws["!cols"]=colW;
    // Style header row (bold)
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,sheetName||"Αιτήσεις");
    XLSX.writeFile(wb,filename||`CRM_${new Date().toISOString().slice(0,10)}.xlsx`);
  }catch(e){console.error("Excel export error:",e);alert("Σφάλμα εξαγωγής Excel");}
};

const expReport=async(title,headers,rows,filename)=>{
  try{
    const XLSX=await loadXLSX();
    const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
    ws["!cols"]=headers.map((h,i)=>({wch:Math.max(h.length+2,...rows.map(r=>String(r[i]||"").length+2))}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,title.substring(0,31));
    XLSX.writeFile(wb,filename||`Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  }catch(e){console.error("Report export error:",e);alert("Σφάλμα εξαγωγής");}
};

// ═══ MAIN APP ═══
export default function App(){
const[loggedIn,setLI]=useState(false);const[cu,setCU]=useState(null);const[gdprOk,setGDPR]=useState(false);const[supaLoaded,setSupaLoaded]=useState(false);const[users,setUsers]=useState(USE_SUPA?[]:USERS_INIT);
const[reqs,setReqs]=useState(USE_SUPA?[]:genReqs);const[tix,setTix]=useState(USE_SUPA?[]:genTickets);const[notifs,setNotifs]=useState([]);const[tixEnabled,setTixEnabled]=useState(true);
const[offers,setOffers]=useState({vodafone:[{desc:"",path:""},{desc:"",path:""},{desc:"",path:""}],cosmote:[{desc:"",path:""},{desc:"",path:""},{desc:"",path:""}],nova:[{desc:"",path:""},{desc:"",path:""},{desc:"",path:""}]});
const[afmDb,setAfmDb]=useState(USE_SUPA?[]:AFM_DB);const[prov,setProv]=useState("vodafone");const[tab,setTab]=useState("dash");
const[sbOpen,setSbOpen]=useState(true);const[qSearch,setQSearch]=useState("");
const[srch,setSrch]=useState({afm:"",adt:"",reqId:"",phone:"",dateFrom:"",dateTo:"",partner:"",agent:"",status:"",prog:""});
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
          const cu={id:u.id,un:u.username,pw:u.password,name:u.name,email:u.email,role:u.role,partner:u.partner,active:1,paused:0,cc:u.can_create?1:0,mustChangePW:u.must_change_pw||false};
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
      setReqs(rData.map(r=>({...r,agentId:r.agent_id,agentName:r.agent_name,cour:r.courier,cAddr:r.c_addr,cCity:r.c_city,cTk:r.c_tk,pendR:r.pend_r,canR:r.can_r,prov:r.provider,startDate:r.start_date||"",duration:r.duration||"24",endDate:r.end_date||"",lines:r.lines?JSON.parse(r.lines):[],documents:r.documents?JSON.parse(r.documents):[],comments:[]})));
    }
    // Load tickets  
    const tRes=await fetch(`${SUPA_URL}/rest/v1/tickets?select=*&order=created_at.desc`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const tData=await tRes.json();
    if(tData&&Array.isArray(tData)){
      // Load messages for each ticket
      const mRes=await fetch(`${SUPA_URL}/rest/v1/ticket_messages?select=*&order=id.asc`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
      const mData=await mRes.json();
      const msgMap={};
      if(mData&&Array.isArray(mData)){mData.forEach(m=>{if(!msgMap[m.ticket_id])msgMap[m.ticket_id]=[];msgMap[m.ticket_id].push({uid:m.uid||m.user_id,uname:m.uname||m.user_name,role:m.role||m.user_role,text:m.text,ts:m.ts||m.created_at,attachments:m.attachments?JSON.parse(m.attachments):[]});});}
      setTix(tData.map(t=>({...t,by:t.created_by,byName:t.by_name,byRole:t.by_role,at:t.created_at,afm:t.afm,cname:t.cname,reason:t.reason,title:t.title||"",reqId:t.req_id,agentName:t.agent_name,agentId:t.agent_id,msgs:msgMap[t.id]||[]})));
    }
    // Load offers
    try{const oRes=await fetch(`${SUPA_URL}/rest/v1/offers?select=*`,{headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});const oData=await oRes.json();if(oData&&Array.isArray(oData)&&oData.length>0){const o={vodafone:[{desc:"",path:""},{desc:"",path:""},{desc:"",path:""}],cosmote:[{desc:"",path:""},{desc:"",path:""},{desc:"",path:""}],nova:[{desc:"",path:""},{desc:"",path:""},{desc:"",path:""}]};oData.forEach(r=>{if(o[r.provider]&&r.slot>=0&&r.slot<3)o[r.provider][r.slot]={desc:r.description||"",path:r.file_path||""};});setOffers(o);}}catch(e){console.warn("Offers load:",e);}
    console.log("✅ Data loaded from Supabase");
  }catch(e){console.error("Load error:",e);}
}

const addComment=(rid,txt)=>{const c={id:`C${Date.now()}`,uid:cu.id,uname:cu.name,role:cu.role,text:txt,ts:ts()};setReqs(p=>p.map(r=>r.id===rid?{...r,comments:[...r.comments,c]}:r));const req=reqs.find(r=>r.id===rid);if(req&&cu.role==="backoffice")addN(req.agentId,`💬 Σχόλιο ${rid} από BackOffice`);if(req&&cu.role==="agent")users.filter(u=>u.role==="backoffice").forEach(u=>addN(u.id,`💬 Σχόλιο ${rid} από ${cu.name}`));};

const saveReq=async(f)=>{
  const id=f.id||`REQ-${String(reqs.length+1).padStart(5,"0")}`;
  const lns=f.lines||[];
  // When editing, preserve original agent from existing request
  const existingReq=f.id?reqs.find(r=>r.id===f.id):null;
  const nr={...f,id,prov:f.prov||existingReq?.prov||prov,agentId:existingReq?.agentId||f.agentId||cu.id,agentName:existingReq?.agentName||f.agentName||cu.name,partner:f.partner||existingReq?.partner||cu.partner||"",created:f.created||existingReq?.created||ts(),comments:existingReq?.comments||f.comments||[],
    prog:lns.length>0?lns.map(l=>l.prog).filter(Boolean).join(", "):(f.prog||""),
    svc:lns.length>0?lns.map(l=>l.type==="mobile"?"Κινητή":"Σταθερή").join(", "):(f.svc||""),
    price:lns.length>0?String(lns.reduce((s,l)=>s+(parseFloat(l.price)||0),0).toFixed(2)):(f.price||"")
  };
  console.log("💾 saveReq:",{isEdit:!!f.id,id:nr.id,prov:nr.prov,formAgentId:f.agentId,finalAgentId:nr.agentId,status:nr.status,linesCount:lns.length});
  setReqs(p=>{const n=f.id?p.map(r=>r.id===f.id?nr:r):[nr,...p];console.log("📋 Reqs after save:",n.length);return n;});
  setVM("list");setSel(null);setSF("all");
  // Save to Supabase
  if(USE_SUPA){
    try{
      // Upload documents to Supabase Storage
      const docMeta=[];
      if(nr.docs&&nr.docs.length>0){
        for(const doc of nr.docs){
          if(doc.file&&doc.type){
            try{
              const ext=doc.name.split(".").pop()||"bin";
              const path=`${nr.id}/${Date.now()}.${ext}`;
              await fetch(`${SUPA_URL}/storage/v1/object/documents/${path}`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":doc.file.type},body:doc.file});
              docMeta.push({type:doc.type,name:doc.name,path,uploaded:new Date().toISOString()});
            }catch(e){console.error("Doc upload error:",e);}
          }else if(doc.path){docMeta.push(doc);}
        }
      }
      const dbRow={id:nr.id,provider:prov,ln:nr.ln,fn:nr.fn,fat:nr.fat,bd:nr.bd,adt:nr.adt,ph:nr.ph,mob:nr.mob,em:nr.em,afm:nr.afm,doy:nr.doy,tk:nr.tk,addr:nr.addr,city:nr.city,partner:nr.partner,agent_id:nr.agentId,agent_name:nr.agentName,svc:nr.svc,prog:nr.prog,lt:nr.lt,nlp:nr.nlp,price:nr.price,status:nr.status||"sent",pend_r:nr.pendR,can_r:nr.canR,courier:nr.cour,c_addr:nr.cAddr,c_city:nr.cCity,c_tk:nr.cTk,notes:nr.notes,sig:nr.sig,created:nr.created,start_date:nr.startDate||"",duration:nr.duration||"24",end_date:nr.endDate||"",lines:JSON.stringify(nr.lines||[]),documents:JSON.stringify(docMeta)};
      // Also set summary fields from first line for backwards compatibility
      if(nr.lines&&nr.lines.length>0){dbRow.prog=nr.lines[0].prog;dbRow.price=String(nr.lines.reduce((s,l)=>s+(parseFloat(l.price)||0),0).toFixed(2));dbRow.nlp=nr.lines[0].nlp==="port"?"Φορητότητα":"Νέα Γραμμή";}
      if(f.id){
        await supa.from("requests").update(dbRow).eq("id",f.id);
        auditLog(cu.id,"update","requests",f.id,{fields:"updated"});
      }else{
        await supa.from("requests").insert(dbRow);
        auditLog(cu.id,"create","requests",nr.id,{provider:prov,afm:nr.afm});
        // Notify backoffice & director on new request
        users.filter(u=>u.role==="backoffice"||u.role==="director").forEach(u=>addN(u.id,`📨 Νέα αίτηση ${nr.id} από ${cu.name}`));
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

// FORCE CHANGE PASSWORD SCREEN
const[changePW,setChangePW]=useState({newPW:"",confirm:""});
if(cu&&cu.mustChangePW)return(
<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1A1A2E,#16213E)",fontFamily:"'DM Sans',sans-serif"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
<div style={{background:"white",borderRadius:16,padding:32,width:380,boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
<div style={{textAlign:"center",marginBottom:20}}>
<div style={{fontSize:"2.5rem",marginBottom:8}}>🔑</div>
<h2 style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.3rem",marginBottom:4}}>Αλλαγή Password</h2>
<p style={{fontSize:"0.82rem",color:"#888"}}>Πρέπει να αλλάξετε τον κωδικό σας</p>
</div>
<div style={{display:"grid",gap:12,marginBottom:16}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600,display:"block",marginBottom:4}}>Νέο Password *</label><input value={changePW.newPW} onChange={e=>setChangePW(p=>({...p,newPW:e.target.value}))} type="password" placeholder="Τουλάχιστον 6 χαρακτήρες" style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #DDD",fontSize:"0.85rem"}}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600,display:"block",marginBottom:4}}>Επιβεβαίωση *</label><input value={changePW.confirm} onChange={e=>setChangePW(p=>({...p,confirm:e.target.value}))} type="password" placeholder="Ξανά το password" style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #DDD",fontSize:"0.85rem"}}/></div>
{changePW.newPW&&changePW.newPW.length<6&&<p style={{fontSize:"0.72rem",color:"#E60000",margin:0}}>⚠️ Τουλάχιστον 6 χαρακτήρες</p>}
{changePW.confirm&&changePW.newPW!==changePW.confirm&&<p style={{fontSize:"0.72rem",color:"#E60000",margin:0}}>⚠️ Δεν ταιριάζουν</p>}
</div>
<button onClick={async()=>{if(!changePW.newPW||changePW.newPW.length<6){alert("Τουλάχιστον 6 χαρακτήρες");return;}if(changePW.newPW!==changePW.confirm){alert("Τα passwords δεν ταιριάζουν");return;}const hashed=await hashPW(changePW.newPW);setCU(p=>({...p,pw:hashed,mustChangePW:false}));if(USE_SUPA){try{await fetch(`${SUPA_URL}/rest/v1/users?id=eq.${cu.id}`,{method:"PATCH",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({password:hashed,must_change_pw:false})});console.log("✅ Password changed");}catch(e){console.error(e);}}setChangePW({newPW:"",confirm:""});alert("✅ Ο κωδικός αλλάχθηκε επιτυχώς!");}} style={{width:"100%",padding:12,borderRadius:8,border:"none",background:"linear-gradient(135deg,#E65100,#FF9800)",color:"white",fontWeight:700,fontSize:"0.9rem",cursor:"pointer"}}>🔐 Αλλαγή Password</button>
</div></div>);

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
<style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
@media(max-width:768px){.crm-sb{position:fixed!important;z-index:99!important;height:100vh!important;top:0!important;left:0!important;}.crm-main{margin-left:0!important;}}`}</style>

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
</div></div>
{/* PROVIDERS in header */}
<div style={{display:"flex",justifyContent:"center",gap:6,padding:"6px 20px",background:"rgba(0,0,0,0.15)"}}>
{Object.entries(PROVIDERS).map(([k,p])=><button key={k} onClick={()=>{setProv(k);setSF("all");setVM("list");setTab("dash");}} style={{padding:"5px 16px",borderRadius:6,border:"none",background:prov===k?"rgba(255,255,255,0.25)":"transparent",color:"white",cursor:"pointer",fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.75rem",opacity:prov===k?1:0.7}}>{p.icon} {p.name}</button>)}
</div>
</div>

{/* ═══ SIDEBAR + CONTENT LAYOUT ═══ */}
<div style={{display:"flex",minHeight:"calc(100vh - 90px)"}}>

{/* SIDEBAR */}
<div style={{width:sbOpen?220:50,minWidth:sbOpen?220:50,background:"#1A1A2E",transition:"all 0.3s",overflow:"hidden",position:"sticky",top:90,height:"calc(100vh - 90px)"}}>
<div style={{padding:"8px 0"}}>
<button onClick={()=>setSbOpen(!sbOpen)} style={{width:"100%",padding:"10px 14px",background:"none",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",textAlign:sbOpen?"right":"center",fontSize:"0.9rem"}}>{sbOpen?"◀":"▶"}</button>

{/* Quick Search */}
{sbOpen?<div style={{padding:"4px 12px 10px"}}>
<div style={{position:"relative"}}>
<input value={qSearch} onChange={e=>setQSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&qSearch.trim()){setTab("dash");setVM("list");setSF("all");}}} placeholder="🔍 Αναζήτηση..." style={{width:"100%",padding:"7px 10px 7px 8px",borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",color:"white",fontSize:"0.76rem",outline:"none"}}/>
{qSearch&&<span onClick={()=>setQSearch("")} style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:"0.8rem"}}>✕</span>}
</div>
{qSearch.trim().length>=2&&(()=>{
  const q=qSearch.toLowerCase();
  const mReqs=reqs.filter(r=>[r.id,r.ln,r.fn,r.afm,r.mob,r.ph,r.agentName,r.partner,r.prog].some(v=>(v||"").toLowerCase().includes(q))).slice(0,5);
  const mTix=tix.filter(t=>[t.id,t.cname,t.afm,t.reason].some(v=>(v||"").toLowerCase().includes(q))).slice(0,3);
  return(mReqs.length>0||mTix.length>0)?<div style={{position:"absolute",left:12,right:12,background:"#2A2A3E",borderRadius:8,padding:6,zIndex:100,maxHeight:250,overflowY:"auto",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>
  {mReqs.length>0&&<div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.4)",padding:"2px 6px",fontWeight:600}}>📊 ΑΙΤΗΣΕΙΣ</div>}
  {mReqs.map(r=><div key={r.id} onClick={()=>{setSel(r);setTab("dash");setVM("detail");setQSearch("");}} style={{padding:"6px 8px",borderRadius:4,cursor:"pointer",fontSize:"0.74rem",color:"white",display:"flex",justifyContent:"space-between"}} onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseOut={e=>e.currentTarget.style.background=""}>
    <span><strong style={{color:pr.color}}>{r.id}</strong> {r.ln} {r.fn}</span>
    <span style={{padding:"1px 6px",borderRadius:3,fontSize:"0.6rem",background:ST[r.status]?.bg,color:ST[r.status]?.c}}>{ST[r.status]?.i}</span>
  </div>)}
  {mTix.length>0&&<div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.4)",padding:"2px 6px",fontWeight:600,marginTop:4}}>🎫 ΑΙΤΗΜΑΤΑ</div>}
  {mTix.map(t=><div key={t.id} onClick={()=>{setSelTix(t);setTab("tix");setQSearch("");}} style={{padding:"6px 8px",borderRadius:4,cursor:"pointer",fontSize:"0.74rem",color:"white"}} onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"} onMouseOut={e=>e.currentTarget.style.background=""}>
    <strong style={{color:"#FF9800"}}>{t.id}</strong> {t.cname} — {t.reason}
  </div>)}
  </div>:null;})()}
</div>
:<div onClick={()=>setSbOpen(true)} style={{padding:"8px 0",textAlign:"center",cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:"1rem"}}>🔍</div>}

{[["dash","📊","Αιτήσεις",true],
["search","🔍","Αναζήτηση",true],
["tix","🎫","Αιτήματα",tixEnabled||cu?.role==="admin"],
["offers","🏷️","Προσφορές",true],
["reports","📈","Reports",P.reports],
["users","👥","Χρήστες",P.users],
["admin","👑","Admin",P.adminPanel]
].filter(x=>x[3]).map(([k,ic,l])=>
<div key={k} onClick={()=>{setTab(k);setVM("list");setSelTix(null);}} style={{padding:sbOpen?"10px 18px":"10px 0",cursor:"pointer",display:"flex",alignItems:"center",gap:10,background:tab===k?"rgba(255,255,255,0.1)":"transparent",borderLeft:tab===k?`3px solid ${pr.color}`:"3px solid transparent",color:tab===k?"white":"rgba(255,255,255,0.55)",transition:"all 0.2s"}}>
<span style={{fontSize:"1rem",minWidth:20,textAlign:"center"}}>{ic}</span>
{sbOpen&&<span style={{fontFamily:"'Outfit'",fontWeight:tab===k?700:500,fontSize:"0.82rem",whiteSpace:"nowrap"}}>{l}</span>}
</div>)}
</div></div>

{/* MAIN CONTENT */}
<div style={{flex:1,padding:20,maxWidth:1200,margin:"0 auto",overflow:"auto"}}>

{/* ═══ DASHBOARD ═══ */}
{tab==="dash"&&vm==="list"&&(<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16}}>
<div><h1 style={{fontFamily:"'Outfit'",fontSize:"1.8rem",fontWeight:900,letterSpacing:-1}}>{pr.name}</h1><p style={{color:"#888",fontSize:"0.82rem"}}>{rl.i} {rl.l}</p></div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{(cu.role==="admin"||cu.cc&&P.create)?<button onClick={()=>setVM("form")} style={B(pr.grad,"white",{padding:"9px 20px"})}>➕ Νέα Αίτηση</button>:null}
{P.exp?<button onClick={()=>expXLSX(fr)} style={B("#FFF","#333",{border:"1px solid #DDD",padding:"9px 16px"})}>📊 Excel</button>:null}
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
{tab==="dash"&&vm==="detail"&&sel&&<Detail r={sel} pr={pr} prov={prov} P={P} cu={cu} onBack={()=>{setVM("list");setSF("all");}} onEdit={()=>setVM("edit")} onComment={t=>addComment(sel.id,t)} onSC={async(s)=>{console.log("📝 Status change:",sel.id,"→",s);const updatedReq={...sel,status:s};setReqs(p=>{const n=p.map(r=>r.id===sel.id?{...r,status:s}:r);console.log("📋 Reqs after update:",n.length,"found:",n.some(r=>r.id===sel.id));return n;});setSel(updatedReq);setSF("all");if(sel.agentId&&sel.agentId!==cu.id)addN(sel.agentId,`📋 Αλλαγή κατάστασης ${sel.id} → ${ST[s]?.l||s}`);if(USE_SUPA){try{await supa.from("requests").update({status:s}).eq("id",sel.id);auditLog(cu.id,"update","requests",sel.id,{status:s});console.log("✅ Saved to Supabase");}catch(e){console.error("❌ Status update error:",e);}}}}/>}

{/* TICKETS */}
{/* ═══ SEARCH ═══ */}
{tab==="search"&&(()=>{
const ss=v=>e=>setSrch(p=>({...p,[v]:e.target.value}));
const clear=()=>setSrch({afm:"",adt:"",reqId:"",phone:"",dateFrom:"",dateTo:"",partner:"",agent:"",status:"",prog:""});
const allR=P.viewAll?reqs.filter(x=>x.prov===prov):P.ownAgents?reqs.filter(x=>x.prov===prov&&x.partner===cu.partner):reqs.filter(x=>x.prov===prov&&x.agentId===cu.id);
let res=allR;
if(srch.afm)res=res.filter(r=>(r.afm||"").includes(srch.afm));
if(srch.adt)res=res.filter(r=>(r.adt||"").toLowerCase().includes(srch.adt.toLowerCase()));
if(srch.reqId)res=res.filter(r=>(r.id||"").toLowerCase().includes(srch.reqId.toLowerCase()));
if(srch.phone)res=res.filter(r=>(r.mob||"").includes(srch.phone)||(r.ph||"").includes(srch.phone));
if(srch.partner)res=res.filter(r=>r.partner===srch.partner);
if(srch.agent)res=res.filter(r=>r.agentName===srch.agent);
if(srch.status)res=res.filter(r=>r.status===srch.status);
if(srch.prog)res=res.filter(r=>{const lns=r.lines||[];return r.prog?.includes(srch.prog)||lns.some(l=>l.prog?.includes(srch.prog));});
if(srch.dateFrom)res=res.filter(r=>r.created>=srch.dateFrom);
if(srch.dateTo)res=res.filter(r=>r.created<=srch.dateTo+"T23:59");
const uniqAgents=[...new Set(allR.map(r=>r.agentName).filter(Boolean))];
const uniqPartners=[...new Set(allR.map(r=>r.partner).filter(Boolean))];
const sIS={...iS,fontSize:"0.78rem"};
const fL={fontSize:"0.7rem",color:"#888",fontWeight:600,marginBottom:2};
return(<div>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:900,marginBottom:16}}>🔍 Αναζήτηση Αιτήσεων — {pr.name}</h1>
<div style={{display:"flex",gap:16,flexWrap:"wrap"}}>

{/* FILTERS PANEL */}
<div style={{width:260,background:"white",borderRadius:12,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",flexShrink:0}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem",marginBottom:12}}>Φίλτρα</div>
<div style={{display:"flex",flexDirection:"column",gap:10}}>
<div><div style={fL}>ΑΦΜ</div><input value={srch.afm} onChange={ss("afm")} placeholder="ΑΦΜ..." style={sIS}/></div>
<div><div style={fL}>Αριθμός Ταυτότητας</div><input value={srch.adt} onChange={ss("adt")} placeholder="ΑΔΤ..." style={sIS}/></div>
<div><div style={fL}>Κωδικός Αίτησης</div><input value={srch.reqId} onChange={ss("reqId")} placeholder="REQ-..." style={sIS}/></div>
<div><div style={fL}>Αριθμός Τηλεφώνου</div><input value={srch.phone} onChange={ss("phone")} placeholder="69..." style={sIS}/></div>
<div><div style={fL}>Πρόγραμμα</div><input value={srch.prog} onChange={ss("prog")} placeholder="Πρόγραμμα..." style={sIS}/></div>
<div><div style={fL}>Ημ/νία Από</div><input type="date" value={srch.dateFrom} onChange={ss("dateFrom")} style={sIS}/></div>
<div><div style={fL}>Ημ/νία Έως</div><input type="date" value={srch.dateTo} onChange={ss("dateTo")} style={sIS}/></div>
<div><div style={fL}>Συνεργάτης</div><select value={srch.partner} onChange={ss("partner")} style={sIS}><option value="">Όλοι</option>{uniqPartners.map(p=><option key={p}>{p}</option>)}</select></div>
<div><div style={fL}>Agent</div><select value={srch.agent} onChange={ss("agent")} style={sIS}><option value="">Όλοι</option>{uniqAgents.map(a=><option key={a}>{a}</option>)}</select></div>
<div><div style={fL}>Κατάσταση</div><select value={srch.status} onChange={ss("status")} style={sIS}><option value="">Όλες</option>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></div>
<div style={{display:"flex",gap:6,marginTop:4}}>
<button onClick={clear} style={{flex:1,padding:"8px",borderRadius:6,border:"1px solid #DDD",background:"white",cursor:"pointer",fontSize:"0.78rem",fontWeight:600}}>✖ Καθαρισμός</button>
</div>
</div></div>

{/* RESULTS */}
<div style={{flex:1,minWidth:0}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
<span style={{fontSize:"0.82rem",color:"#666",fontWeight:600}}>Εγγραφές: {res.length}</span>
<button onClick={()=>expXLSX(res,`Search_${new Date().toISOString().slice(0,10)}.xlsx`,"Αναζήτηση")} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #4CAF50",background:"#E8F5E9",color:"#2E7D32",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>📥 Excel</button>
</div>
<div style={{background:"white",borderRadius:10,overflow:"auto",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
<table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.75rem"}}>
<thead><tr style={{background:"#FAFAFA"}}>
{["ID","Επώνυμο","Όνομα","ΑΦΜ","Κινητό","Πρόγραμμα","Κατάσταση","Agent","Ημ/νία","Τιμή"].map(h=><th key={h} style={{padding:"8px 8px",textAlign:"left",fontWeight:700,color:"#666",borderBottom:"2px solid #E0E0E0",whiteSpace:"nowrap"}}>{h}</th>)}
</tr></thead>
<tbody>{res.length===0?<tr><td colSpan={10} style={{padding:30,textAlign:"center",color:"#999"}}>Δεν βρέθηκαν αποτελέσματα</td></tr>:
res.map(r=><tr key={r.id} style={{cursor:"pointer"}} onClick={()=>{setSel(r);setTab("dash");setVM("detail");}}>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0",fontWeight:600,color:pr.color}}>{r.id}</td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0"}}>{r.ln}</td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0"}}>{r.fn}</td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0"}}>{r.afm}</td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0"}}>{r.mob}</td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0"}}>{r.prog}</td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0"}}><span style={{padding:"2px 8px",borderRadius:4,fontSize:"0.68rem",fontWeight:700,background:ST[r.status]?.bg,color:ST[r.status]?.c}}>{ST[r.status]?.i} {ST[r.status]?.l}</span></td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0"}}>{r.agentName}</td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0"}}>{fmtDate(r.created)}</td>
<td style={{padding:"7px 8px",borderBottom:"1px solid #F0F0F0",fontWeight:700,color:"#2E7D32"}}>€{r.price}</td>
</tr>)}
</tbody></table>
</div></div>
</div></div>);})()}

{tab==="tix"&&!selTix&&<TixList tix={tix} cu={cu} P={P} pr={pr} reqs={reqs} afmDb={afmDb} onSel={setSelTix} onCreate={async(t)=>{
  try{
  const tkId=`TK-${String(Math.max(0,...tix.map(t=>parseInt(t.id?.replace("TK-",""))||0))+1).padStart(5,"0")}`;
  // Upload ticket files
  const attachments=[];
  if(t.files&&t.files.length>0){
    for(const f of t.files){
      if(f){try{const ext=f.name.split(".").pop()||"bin";const path=`tickets/${tkId}/${Date.now()}.${ext}`;if(USE_SUPA)await fetch(`${SUPA_URL}/storage/v1/object/documents/${path}`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":f.type},body:f});attachments.push({name:f.name,path});}catch(e){console.error("File upload error:",e);}}
    }
  }
  // IMPORTANT: exclude files and custInfo from ticket state (File objects crash Safari)
  const{files,custInfo,...ticketData}=t;
  const now=ts();
  const firstMsg={uid:cu.id,uname:cu.name,role:cu.role,text:t.msg,ts:now,attachments};
  const nt={...ticketData,id:tkId,by:cu.id,byName:cu.name,byRole:cu.role,at:now,status:"open",msgs:[firstMsg]};
  setTix(p=>[nt,...p]);
  users.filter(u=>u.role==="backoffice"||u.role==="supervisor").forEach(u=>addN(u.id,`🎫 Νέο αίτημα ${tkId}: ${t.reason} — ${t.cname}`));
  if(t.agentId&&t.agentId!==cu.id)addN(t.agentId,`🎫 Αίτημα ${tkId}: ${t.reason} — Πελάτης: ${t.cname}`);
  // Save to Supabase
  if(USE_SUPA){
    try{
      await fetch(`${SUPA_URL}/rest/v1/tickets`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({id:tkId,afm:t.afm,cname:t.cname,reason:t.reason,title:t.title||"",req_id:t.reqId,msg:t.msg,agent_name:t.agentName||"",agent_id:t.agentId||"",created_by:cu.id,by_name:cu.name,by_role:cu.role,status:"open",created_at:now,attachments:JSON.stringify(attachments)})});
      await fetch(`${SUPA_URL}/rest/v1/ticket_messages`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({ticket_id:tkId,uid:cu.id,uname:cu.name,role:cu.role,text:t.msg,attachments:JSON.stringify(attachments),ts:now})});
      auditLog(cu.id,"create","tickets",tkId,{reason:t.reason,cname:t.cname});
      console.log("✅ Ticket saved to Supabase:",tkId);
    }catch(e){console.error("Ticket save error:",e);}
  }
  }catch(e){console.error("Ticket creation error:",e);}
}}/>}
{tab==="tix"&&selTix&&<TixDetail t={selTix} cu={cu} pr={pr} onBack={()=>setSelTix(null)} onReply={async(txt,files)=>{
  // Upload attachments
  const attachments=[];
  if(files&&files.length>0){
    for(const f of files){
      try{
        const ext=f.name.split(".").pop()||"bin";
        const path=`tickets/${selTix.id}/${Date.now()}.${ext}`;
        if(USE_SUPA)await fetch(`${SUPA_URL}/storage/v1/object/documents/${path}`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":f.type},body:f});
        attachments.push({name:f.name,path});
      }catch(e){console.error("File upload error:",e);}
    }
  }
  const now=ts();const m={uid:cu.id,uname:cu.name,role:cu.role,text:txt,ts:now,attachments};setTix(p=>p.map(t=>t.id===selTix.id?{...t,msgs:[...t.msgs,m]}:t));setSelTix(p=>({...p,msgs:[...p.msgs,m]}));if(cu.role==="backoffice")addN(selTix.by,`💬 Απάντηση αιτήματος ${selTix.id} από ${cu.name}`);else users.filter(u=>u.role==="backoffice").forEach(u=>addN(u.id,`💬 Απάντηση αιτήματος ${selTix.id} από ${cu.name}`));
  // Save message to Supabase
  if(USE_SUPA){try{await fetch(`${SUPA_URL}/rest/v1/ticket_messages`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({ticket_id:selTix.id,uid:cu.id,uname:cu.name,role:cu.role,text:txt,attachments:JSON.stringify(attachments),ts:now})});console.log("✅ Reply saved");}catch(e){console.error("Reply save error:",e);}}
}} onDelete={async()=>{if(!confirm("Διαγραφή αιτήματος "+selTix.id+";")){return;}setTix(p=>p.filter(t=>t.id!==selTix.id));setSelTix(null);
  if(USE_SUPA){try{await fetch(`${SUPA_URL}/rest/v1/ticket_messages?ticket_id=eq.${selTix.id}`,{method:"DELETE",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});await fetch(`${SUPA_URL}/rest/v1/tickets?id=eq.${selTix.id}`,{method:"DELETE",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});auditLog(cu.id,"delete","tickets",selTix.id,{});console.log("✅ Ticket deleted");}catch(e){console.error("Delete error:",e);}}
}} onClose={async()=>{setTix(p=>p.map(t=>t.id===selTix.id?{...t,status:"closed"}:t));setSelTix(p=>({...p,status:"closed"}));
  if(USE_SUPA){try{await fetch(`${SUPA_URL}/rest/v1/tickets?id=eq.${selTix.id}`,{method:"PATCH",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({status:"closed"})});console.log("✅ Ticket closed in DB");}catch(e){console.error("Close error:",e);}}
}}/>}

{/* USERS */}
{tab==="users"&&P.users&&<UserMgmt users={users} setUsers={setUsers} cu={cu} P={P} pr={pr}/>}

{/* FIELDS */}
{tab==="fields"&&P.fields&&<FieldMgmt pr={pr}/>}

{/* ═══ REPORTS ═══ */}
{tab==="offers"&&<OffersPanel offers={offers} setOffers={setOffers} cu={cu} pr={pr}/>}
{tab==="reports"&&P.reports&&<ReportsPanel reqs={reqs} users={users} pr={pr} prov={prov} PROVIDERS={PROVIDERS} ST={ST} expReport={expReport} expXLSX={expXLSX}/>}

{/* SYSTEM */}

{tab==="admin"&&P.adminPanel&&<AdminPanel users={users} setUsers={setUsers} reqs={reqs} setReqs={setReqs} afmDb={afmDb} setAfmDb={setAfmDb} cu={cu} pr={pr} sysPaused={sysPaused} setSysPaused={setSysPaused} tixEnabled={tixEnabled} setTixEnabled={setTixEnabled} tix={tix} setTix={setTix}/>}

{tab==="sys"&&P.pause&&<SysMgmt sp={sysPaused} setSP={setSysPaused} users={users} setUsers={setUsers} pr={pr}/>}

</div>{/* end MAIN CONTENT */}
</div>{/* end SIDEBAR+CONTENT flex */}
</div>);}

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
const[form,setForm]=useState(()=>{
  const today=new Date().toISOString().slice(0,10);
  const base={ln:"",fn:"",fat:"",bd:"",adt:"",ph:"",mob:"",em:"",afm:"",doy:"",tk:"",addr:"",city:"",partner:cu.partner||"",cour:"",cAddr:"",cCity:"",cTk:"",notes:"",pendR:"",canR:"",status:"sent",sig:null,lines:[emptyLine()],agentId:"",agentName:"",prov:"",startDate:today,duration:"24",endDate:""};
  return ed?{...base,...ed}:base;
});
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

{/* ═══ ΗΜΕΡΟΜΗΝΙΕΣ ΣΥΜΒΟΛΑΙΟΥ ═══ */}
<div style={{padding:"14px 20px",background:"#E8F5E9",borderLeft:"4px solid #2E7D32",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem",marginBottom:10}}>📅 Διάρκεια Συμβολαίου</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>
<FL l="Ημ/νία Έναρξης"><input type="date" value={form.startDate||""} onChange={e=>{const sd=e.target.value;s("startDate",sd);if(sd&&form.duration){const d=new Date(sd);d.setMonth(d.getMonth()+parseInt(form.duration));s("endDate",d.toISOString().slice(0,10));}}} style={iS}/></FL>
<FL l="Διάρκεια (μήνες)"><select value={form.duration||"24"} onChange={e=>{const dur=e.target.value;s("duration",dur);if(form.startDate&&dur){const d=new Date(form.startDate);d.setMonth(d.getMonth()+parseInt(dur));s("endDate",d.toISOString().slice(0,10));}}} style={iS}><option value="12">12 μήνες</option><option value="18">18 μήνες</option><option value="24">24 μήνες</option></select></FL>
<FL l="Ημ/νία Λήξης"><input type="date" value={form.endDate||""} disabled style={{...iS,background:"#F5F5F5",fontWeight:700,color:"#C62828"}}/></FL>
</div>
{form.endDate&&<div style={{marginTop:6,fontSize:"0.76rem",color:"#2E7D32",fontWeight:600}}>📌 Λήξη συμβολαίου: {fmtDate(form.endDate)}</div>}
</div>

{/* ═══ ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ═══ */}
<div style={{padding:"14px 20px",background:"#FFF8E1",borderLeft:"4px solid #FF6F00",borderBottom:"1px solid #F0F0F0"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.9rem"}}>📎 Δικαιολογητικά <span style={{fontSize:"0.72rem",color:"#888",fontWeight:400}}>({(form.docs||[]).length}/6)</span></div>
{(form.docs||[]).length<6&&<button onClick={()=>{if((form.docs||[]).length<6)s("docs",[...(form.docs||[]),{type:"",file:null,name:"",uploading:false}]);}} style={B("#FF6F00","white",{padding:"5px 12px",fontSize:"0.76rem"})}>➕ Προσθήκη</button>}
</div>
{!(form.docs||[]).some(d=>d.type==="id")&&<div style={{background:"#FFEBEE",borderRadius:6,padding:8,marginBottom:8,fontSize:"0.76rem",color:"#C62828",fontWeight:600}}>⚠️ Η Ταυτότητα είναι υποχρεωτική</div>}
{(form.docs||[]).map((doc,i)=>(
<div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,background:"white",padding:8,borderRadius:8,border:"1px solid #E0E0E0"}}>
<select value={doc.type} onChange={e=>{const nd=[...(form.docs||[])];nd[i]={...nd[i],type:e.target.value};s("docs",nd);}} style={{...iS,width:220,fontSize:"0.78rem"}}>
<option value="">— Τύπος —</option>
<option value="id">🪪 Ταυτότητα</option>
<option value="provider_bill">📄 Λογαριασμός Παρόχου</option>
<option value="address_proof">🏠 Αποδεικτικό Διεύθυνσης</option>
<option value="bank_proof">🏦 Αποδεικτικό Λογαριασμού</option>
<option value="business_proof">💼 Αποδ. Επαγγελματικής Ιδιότητας</option>
<option value="other">📁 Λοιπά Έγγραφα</option>
</select>
<input type="file" accept="image/*,.pdf" onChange={e=>{const f=e.target.files[0];if(f){const nd=[...(form.docs||[])];nd[i]={...nd[i],file:f,name:f.name};s("docs",nd);}}} style={{flex:1,fontSize:"0.76rem"}}/>
{doc.name&&<span style={{fontSize:"0.7rem",color:"#4CAF50",fontWeight:600,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✅ {doc.name}</span>}
<button onClick={()=>{const nd=[...(form.docs||[])];nd.splice(i,1);s("docs",nd);}} style={{background:"#FFEBEE",color:"#C62828",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>🗑️</button>
</div>))}
{(form.docs||[]).length===0&&<div style={{textAlign:"center",padding:12,color:"#999",fontSize:"0.8rem"}}>Πατήστε "➕ Προσθήκη" για να επισυνάψετε δικαιολογητικά</div>}
<div style={{fontSize:"0.68rem",color:"#888",marginTop:6,fontStyle:"italic"}}>* Αρχεία: εικόνες ή PDF, μέχρι 6 συνημμένα. Διατηρούνται στη βάση για 60 ημέρες.</div>
</div>

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

{/* CONTRACT DATES */}
{(r.startDate||r.endDate)&&<div style={{padding:"12px 20px",background:"#E8F5E9",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.88rem",marginBottom:8}}>📅 Διάρκεια Συμβολαίου</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:6}}>
<DF l="Ημ/νία Έναρξης" v={fmtDate(r.startDate)}/>
<DF l="Διάρκεια" v={r.duration?r.duration+" μήνες":"—"}/>
<DF l="Ημ/νία Λήξης" v={fmtDate(r.endDate)}/>
</div></div>}

{/* DOCUMENTS */}
{(()=>{const docs=r.documents?typeof r.documents==="string"?JSON.parse(r.documents):r.documents:[];return docs.length>0?
<div style={{padding:"12px 20px",background:"#FFF8E1",borderBottom:"1px solid #F0F0F0"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.88rem",marginBottom:8}}>📎 Δικαιολογητικά ({docs.length})</div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{docs.map((d,i)=>{const labels={id:"🪪 Ταυτότητα",provider_bill:"📄 Λογ.Παρόχου",address_proof:"🏠 Αποδ.Διεύθυνσης",bank_proof:"🏦 Αποδ.Λογαριασμού",business_proof:"💼 Επαγγ.Ιδιότητα",other:"📁 Λοιπά"};
return <button key={i} onClick={()=>downloadDoc(d.path,d.name)} style={{padding:"6px 12px",borderRadius:6,background:"white",border:"1px solid #E0E0E0",fontSize:"0.76rem",fontWeight:600,color:"#1565C0",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>{labels[d.type]||d.type} <span style={{fontSize:"0.65rem",color:"#888"}}>{d.name}</span></button>;})}
</div>
<div style={{fontSize:"0.65rem",color:"#999",marginTop:6}}>* Τα αρχεία διατηρούνται για 60 ημέρες</div>
</div>:null;})()}

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
{r.sig?<div><img src={r.sig} style={{maxWidth:260,maxHeight:100,border:"1px solid #DDD",borderRadius:6,padding:4}} alt="sig"/>
<button onClick={()=>{const a=document.createElement("a");a.href=r.sig;a.download=`Υπογραφή_${r.id}.png`;document.body.appendChild(a);a.click();document.body.removeChild(a);}} style={{display:"block",marginTop:4,padding:"4px 12px",borderRadius:4,border:"1px solid #DDD",background:"#F5F5F5",color:"#333",cursor:"pointer",fontSize:"0.7rem",fontWeight:600}}>📥 Λήψη υπογραφής PNG</button></div>:<p style={{color:"#999"}}>—</p>}
</div></div>);}

// ═══ TICKETS ═══
function TixList({tix,cu,P,pr,onSel,onCreate,reqs,afmDb}){
const[show,setShow]=useState(false);const[nt,setNT]=useState({afm:"",cname:"",reason:"",title:"",reqId:"",msg:"",agentName:"",agentId:"",custInfo:null});
const[custReqs,setCustReqs]=useState([]);
const vis=P.viewAll?tix:tix.filter(t=>t.by===cu.id);

// Customer search by AFM
const searchCust=(afm)=>{
  const q=afm.trim();if(!q)return;
  // Find customer in AFM database
  const cust=afmDb.find(x=>x.afm===q);
  // Find all requests for this AFM
  const cReqs=reqs.filter(r=>r.afm===q);
  if(cust||cReqs.length>0){
    const name=cust?`${cust.ln} ${cust.fn}`:(cReqs[0]?`${cReqs[0].ln} ${cReqs[0].fn}`:"");
    const lastReq=cReqs[0];
    setNT(p=>({...p,cname:name,agentName:lastReq?.agentName||"",agentId:lastReq?.agentId||"",custInfo:cust||null}));
    setCustReqs(cReqs);
  }else{setNT(p=>({...p,cname:"",agentName:"",agentId:"",custInfo:null}));setCustReqs([]);alert("Δεν βρέθηκε πελάτης με ΑΦΜ: "+q);}
};

return(<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:900}}>🎫 Αιτήματα</h1>
<button onClick={()=>setShow(!show)} style={B(pr.grad,"white",{padding:"9px 20px"})}>➕ Νέο</button></div>

{show&&<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<h3 style={{fontFamily:"'Outfit'",fontWeight:700,marginBottom:10,fontSize:"0.95rem"}}>Νέο Αίτημα</h3>

{/* Step 1: Customer Search */}
<div style={{background:"#FFFDE7",borderLeft:"4px solid #FFC107",borderRadius:6,padding:12,marginBottom:12}}>
<div style={{fontWeight:700,fontSize:"0.82rem",marginBottom:8}}>🔍 Αναζήτηση Πελάτη</div>
<div style={{display:"flex",gap:6}}>
<input value={nt.afm} onChange={e=>setNT(p=>({...p,afm:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&searchCust(nt.afm)} placeholder="Πληκτρολογήστε ΑΦΜ..." style={{...iS,flex:1}}/>
<button onClick={()=>searchCust(nt.afm)} style={B("#2196F3","white",{})}>🔍</button>
</div></div>

{/* Customer Info Card */}
{(nt.custInfo||nt.cname)&&<div style={{background:"#E8F5E9",borderLeft:"4px solid #4CAF50",borderRadius:6,padding:12,marginBottom:12}}>
<div style={{fontWeight:700,fontSize:"0.82rem",marginBottom:6}}>👤 Στοιχεία Πελάτη</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:6,fontSize:"0.8rem"}}>
<div><span style={{color:"#888",fontSize:"0.7rem"}}>Ονοματεπώνυμο</span><br/><strong>{nt.cname}</strong></div>
{nt.custInfo&&<><div><span style={{color:"#888",fontSize:"0.7rem"}}>Τηλέφωνο</span><br/><strong>{nt.custInfo.mob||nt.custInfo.ph||"—"}</strong></div>
<div><span style={{color:"#888",fontSize:"0.7rem"}}>Email</span><br/><strong>{nt.custInfo.em||"—"}</strong></div>
<div><span style={{color:"#888",fontSize:"0.7rem"}}>Πόλη</span><br/><strong>{nt.custInfo.city||"—"}</strong></div></>}
{nt.agentName&&<div><span style={{color:"#888",fontSize:"0.7rem"}}>Agent</span><br/><strong style={{color:"#1565C0"}}>{nt.agentName}</strong></div>}
</div>
{custReqs.length>0&&<div style={{marginTop:8}}>
<div style={{fontSize:"0.72rem",color:"#666",fontWeight:600,marginBottom:4}}>Αιτήσεις πελάτη ({custReqs.length}):</div>
<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
{custReqs.map(r=><span key={r.id} onClick={()=>setNT(p=>({...p,reqId:r.id}))} style={{padding:"3px 8px",borderRadius:4,fontSize:"0.7rem",fontWeight:600,background:ST[r.status]?.bg||"#F5F5F5",color:ST[r.status]?.c||"#666",cursor:"pointer",border:nt.reqId===r.id?"2px solid #1565C0":"2px solid transparent"}}>{r.id} {ST[r.status]?.i}</span>)}
</div></div>}
</div>}

{/* Ticket Form */}
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8,marginBottom:8}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ονοματεπώνυμο *</label><input value={nt.cname} onChange={e=>setNT(p=>({...p,cname:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Λόγος *</label><select value={nt.reason} onChange={e=>setNT(p=>({...p,reason:e.target.value}))} style={iS}><option value="">Επιλέξτε...</option>{TICKET_R.map(r=><option key={r}>{r}</option>)}</select></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Τίτλος</label><input value={nt.title||""} onChange={e=>setNT(p=>({...p,title:e.target.value.slice(0,40)}))} maxLength={40} placeholder="Σύντομη περιγραφή (max 40)" style={iS}/><span style={{fontSize:"0.6rem",color:"#999"}}>{(nt.title||"").length}/40</span></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Αρ.Αίτησης</label><input value={nt.reqId} onChange={e=>setNT(p=>({...p,reqId:e.target.value}))} placeholder="REQ-..." style={iS}/></div></div>
<div style={{marginBottom:8}}><label style={{fontSize:"0.74rem",fontWeight:600}}>Μήνυμα *</label><textarea value={nt.msg} onChange={e=>setNT(p=>({...p,msg:e.target.value}))} rows={2} style={{...iS,minHeight:50,resize:"vertical"}}/></div>
<div style={{marginBottom:8}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
<label style={{fontSize:"0.74rem",fontWeight:600}}>📎 Συνημμένα ({(nt.files||[]).length}/3)</label>
{(nt.files||[]).length<3&&<button onClick={()=>setNT(p=>({...p,files:[...(p.files||[]),null]}))} style={{fontSize:"0.7rem",padding:"2px 8px",borderRadius:4,border:"1px solid #DDD",background:"#F5F5F5",cursor:"pointer",fontWeight:600}}>➕</button>}
</div>
{(nt.files||[]).map((f,i)=>(
<div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
<input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e=>{const fl=e.target.files[0];if(fl){const nf=[...(nt.files||[])];nf[i]=fl;setNT(p=>({...p,files:nf}));}}} style={{flex:1,fontSize:"0.74rem"}}/>
<button onClick={()=>{const nf=[...(nt.files||[])];nf.splice(i,1);setNT(p=>({...p,files:nf}));}} style={{background:"#FFEBEE",color:"#C62828",border:"none",borderRadius:4,padding:"3px 6px",cursor:"pointer",fontSize:"0.7rem"}}>✕</button>
</div>))}
</div>
<button onClick={()=>{if(nt.afm&&nt.cname&&nt.reason&&nt.msg){onCreate({...nt});setNT({afm:"",cname:"",reason:"",title:"",reqId:"",msg:"",agentName:"",agentId:"",custInfo:null,files:[]});setCustReqs([]);setShow(false);}else alert("Συμπληρώστε ΑΦΜ, Όνομα, Λόγο και Μήνυμα");}} style={B("#4CAF50","white",{padding:"8px 24px"})}>📤 Δημιουργία</button>
</div>}

<div style={{background:"white",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",overflow:"hidden"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>
{["ID","Πελάτης","ΑΦΜ","Λόγος","Τίτλος","Ημ/νία","Από","Status","💬"].map(h=><th key={h} style={{padding:"8px 10px",fontFamily:"'Outfit'",fontWeight:600,fontSize:"0.68rem",color:"#888",textAlign:"left"}}>{h}</th>)}
</tr></thead><tbody>
{vis.map(t=><tr key={t.id} style={{borderBottom:"1px solid #F5F5F5",cursor:"pointer"}} onClick={()=>onSel(t)}>
<td style={{padding:"8px 10px",fontWeight:700,color:pr.color,fontSize:"0.78rem"}}>{t.id}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{t.cname}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{t.afm}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{t.reason}</td>
<td style={{padding:"8px 10px",fontSize:"0.74rem",color:"#555",fontStyle:"italic",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title||"—"}</td>
<td style={{padding:"8px 10px",fontSize:"0.74rem"}}>{t.at}</td>
<td style={{padding:"8px 10px",fontSize:"0.76rem"}}>{t.byName}</td>
<td style={{padding:"8px 10px"}}><span style={bg(t.status==="open"?"#E8F5E9":"#F5F5F5",t.status==="open"?"#2E7D32":"#999")}>{t.status==="open"?"🟢 Ανοικτό":"⚫ Κλειστό"}</span></td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>💬 {t.msgs.length}</td>
</tr>)}
{!vis.length&&<tr><td colSpan={9} style={{textAlign:"center",padding:24,color:"#999"}}>Δεν υπάρχουν αιτήματα</td></tr>}
</tbody></table></div></div>);}

function TixDetail({t,cu,pr,onBack,onReply,onClose,onDelete}){
const[rp,setRP]=useState("");const[rpFiles,setRPFiles]=useState([]);
return(
<div style={{background:"white",borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.08)",overflow:"hidden"}}>
<div style={{background:pr.grad,padding:"14px 20px",color:"white",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
<div><h2 style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.1rem"}}>🎫 {t.id}</h2><div style={{opacity:0.85,fontSize:"0.8rem"}}>{t.cname} • {t.reason}{t.title&&<span style={{fontStyle:"italic"}}> — {t.title}</span>}{t.agentName&&<span> • 👤 {t.agentName}</span>}</div></div>
<div style={{display:"flex",gap:5}}>
<span style={bg(t.status==="open"?"#E8F5E9":"#F5F5F5",t.status==="open"?"#2E7D32":"#999")}>{t.status==="open"?"🟢 Ανοικτό":"⚫ Κλειστό"}</span>
{t.status==="open"&&(cu.role==="backoffice"||cu.role==="supervisor"||cu.role==="admin")&&<button onClick={onClose} style={B("rgba(255,255,255,0.2)","white",{})}>🔒 Κλείσιμο</button>}
{cu.role==="admin"&&<button onClick={onDelete} style={B("rgba(255,0,0,0.3)","white",{})}>🗑 Διαγραφή</button>}
<button onClick={onBack} style={B("rgba(255,255,255,0.2)","white",{})}>← Πίσω</button></div></div>

<div style={{padding:"10px 20px",background:"#F5F5F5",borderBottom:"1px solid #E8E8E8",display:"flex",gap:16,fontSize:"0.8rem",flexWrap:"wrap"}}>
<span><strong>ΑΦΜ:</strong> {t.afm}</span><span><strong>Πελάτης:</strong> {t.cname}</span><span><strong>Αίτηση:</strong> {t.reqId||"—"}</span>{t.agentName&&<span><strong>Agent:</strong> <span style={{color:"#1565C0"}}>{t.agentName}</span></span>}<span><strong>Δημ:</strong> {t.at}</span></div>

<div style={{padding:"14px 20px",maxHeight:400,overflowY:"auto"}}>
{t.msgs.map((m,i)=>(
<div key={i} style={{background:m.uid===cu.id?"#E3F2FD":"#F5F5F5",borderRadius:10,padding:10,marginBottom:8,marginLeft:m.uid===cu.id?40:0,marginRight:m.uid===cu.id?0:40,borderLeft:`3px solid ${ROLES[m.role]?.c||"#999"}`}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
<span style={{fontWeight:700,fontSize:"0.8rem"}}>{ROLES[m.role]?.i} {m.uname}</span>
<span style={{fontSize:"0.7rem",color:"#999"}}>{m.ts}</span></div>
<p style={{fontSize:"0.84rem"}}>{m.text}</p>
{m.attachments&&m.attachments.length>0&&<div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
{m.attachments&&m.attachments.length>0&&<div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4}}>{m.attachments.map((a,j)=><button key={j} onClick={()=>downloadDoc(a.path,a.name)} style={{padding:"4px 10px",borderRadius:4,background:"#E3F2FD",color:"#1565C0",fontSize:"0.7rem",fontWeight:600,border:"none",cursor:"pointer",textAlign:"left",display:"block"}}>📎 {a.name}</button>)}</div>}
</div>}
</div>))}
</div>

{t.status==="open"&&<div style={{padding:"12px 20px",borderTop:"1px solid #E8E8E8"}}>
{rpFiles.length>0&&<div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap"}}>
{rpFiles.map((f,i)=><span key={i} style={{padding:"3px 8px",borderRadius:4,background:"#E8F5E9",fontSize:"0.68rem",fontWeight:600,display:"inline-flex",alignItems:"center",gap:4}}>📎 {f.name} <span onClick={()=>setRPFiles(p=>p.filter((_,j)=>j!==i))} style={{cursor:"pointer",color:"#C62828"}}>✕</span></span>)}
</div>}
<div style={{display:"flex",gap:6}}>
<input placeholder="Απάντηση..." value={rp} onChange={e=>setRP(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&rp.trim()){onReply(rp,rpFiles);setRP("");setRPFiles([]);}}} style={{...iS,flex:1}}/>
{rpFiles.length<3&&<label style={{padding:"6px 10px",borderRadius:6,background:"#F5F5F5",border:"1px solid #DDD",cursor:"pointer",fontSize:"0.78rem",display:"flex",alignItems:"center"}}>📎<input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e=>{const f=e.target.files[0];if(f&&rpFiles.length<3)setRPFiles(p=>[...p,f]);e.target.value="";}} style={{display:"none"}}/></label>}
<button onClick={()=>{if(rp.trim()){onReply(rp,rpFiles);setRP("");setRPFiles([]);}}} style={B(pr.color,"white",{})}>📤</button></div></div>}
</div>);}

// ═══ USER MANAGEMENT ═══
function UserMgmt({users,setUsers,cu,P,pr}){
const[show,setShow]=useState(false);const[nu,setNU]=useState({un:"",pw:"",fname:"",lname:"",email:"",mobile:"",userCode:"",role:"agent",partner:"",supervisor:""});
const[delCode,setDelCode]=useState("");const[delTarget,setDelTarget]=useState(null);
const[editUser,setEditUser]=useState(null);const[resetPW,setResetPW]=useState({show:false,uid:null,uname:"",newPW:"",confirm:""});
return(<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:900}}>👥 Χρήστες</h1>
<button onClick={()=>setShow(!show)} style={B(pr.grad,"white",{padding:"9px 20px"})}>➕ Νέος</button></div>

{show&&<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:8}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Username *</label><input value={nu.un} onChange={e=>setNU(p=>({...p,un:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Password *</label><input value={nu.pw} onChange={e=>setNU(p=>({...p,pw:e.target.value}))} type="password" style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Όνομα *</label><input value={nu.fname} onChange={e=>setNU(p=>({...p,fname:e.target.value}))} placeholder="Όνομα" style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Επώνυμο *</label><input value={nu.lname} onChange={e=>setNU(p=>({...p,lname:e.target.value}))} placeholder="Επώνυμο" style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Email</label><input value={nu.email} onChange={e=>setNU(p=>({...p,email:e.target.value}))} type="email" style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Κινητό</label><input value={nu.mobile} onChange={e=>setNU(p=>({...p,mobile:e.target.value.replace(/\D/g,"").slice(0,10)}))} placeholder="69xxxxxxxx" maxLength={10} style={iS}/></div>
{(cu.role==="admin"||cu.role==="director")&&<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Κωδικός Χρήστη</label><input value={nu.userCode} onChange={e=>setNU(p=>({...p,userCode:e.target.value}))} placeholder="Μοναδικός κωδικός" style={iS}/></div>}
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ρόλος *</label><select value={nu.role} onChange={e=>setNU(p=>({...p,role:e.target.value,supervisor:"",partner:""}))} style={iS}>{Object.entries(ROLES).filter(([k])=>cu.role==="admin"||k!=="admin").map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></div>
{nu.role==="partner"&&<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ανήκει σε Supervisor</label><select value={nu.supervisor} onChange={e=>setNU(p=>({...p,supervisor:e.target.value}))} style={iS}><option value="">— Επιλέξτε —</option>{users.filter(u=>u.role==="supervisor").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
{nu.role==="agent"&&<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ανήκει σε Partner *</label><select value={nu.partner} onChange={e=>setNU(p=>({...p,partner:e.target.value}))} style={iS}><option value="">— Επιλέξτε —</option>{users.filter(u=>u.role==="partner").map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>}
{(nu.role!=="agent"&&nu.role!=="partner")&&<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Partner (προαιρ.)</label><select value={nu.partner} onChange={e=>setNU(p=>({...p,partner:e.target.value}))} style={iS}><option value="">—</option>{PARTNERS_LIST.map(p=><option key={p}>{p}</option>)}</select></div>}
</div>
<button onClick={async()=>{if(nu.un&&nu.pw&&nu.fname&&nu.lname){const name=`${nu.fname} ${nu.lname}`;const newUser={un:nu.un,pw:nu.pw,name,email:nu.email,mobile:nu.mobile||"",userCode:nu.userCode||"",role:nu.role,partner:nu.partner||"",supervisor:nu.supervisor||"",active:1,paused:0,tixOff:0,id:`U${String(users.length+10).padStart(3,"0")}`};setUsers(p=>[...p,newUser]);setNU({un:"",pw:"",fname:"",lname:"",email:"",mobile:"",userCode:"",role:"agent",partner:"",supervisor:""});setShow(false);}else alert("Συμπληρώστε Username, Password, Όνομα, Επώνυμο");}} style={B("#4CAF50","white",{padding:"8px 24px"})}>✅ Δημιουργία</button>
</div>}

{/* Delete modal for Director */}
{delTarget&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
<div style={{background:"white",borderRadius:12,padding:24,width:360}}>
<h3 style={{fontFamily:"'Outfit'",fontWeight:700,marginBottom:12}}>🔑 Κωδικός Διαγραφής</h3>
<p style={{fontSize:"0.82rem",marginBottom:10}}>Διαγραφή: <strong>{delTarget.name}</strong></p>

{cu.role==="admin"&&<div style={{display:"flex",gap:6}}>
<button onClick={()=>{setUsers(p=>p.filter(x=>x.id!==delTarget.id));setDelTarget(null);}} style={B("#E60000","white",{})}>🗑 Διαγραφή</button>
<button onClick={()=>setDelTarget(null)} style={B("#999","white",{})}>Ακύρωση</button></div>}
</div></div>}

<div style={{background:"white",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",overflow:"hidden"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>
{["ID","Username","Όνομα","Email","Κινητό","Ρόλος","Partner","Status","Ενέργειες"].map(h=><th key={h} style={{padding:"8px 10px",fontFamily:"'Outfit'",fontWeight:600,fontSize:"0.68rem",color:"#888",textAlign:"left"}}>{h}</th>)}
</tr></thead><tbody>
{users.map(u=><tr key={u.id} style={{borderBottom:"1px solid #F5F5F5"}}>
<td style={{padding:"8px 10px",fontSize:"0.78rem",fontWeight:600}}>{u.id}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{u.un}</td>
<td style={{padding:"8px 10px",fontSize:"0.8rem"}}>{u.name}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{u.email}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{u.mobile||"—"}</td>
<td style={{padding:"8px 10px"}}><span style={bg(ROLES[u.role]?.c+"20",ROLES[u.role]?.c)}>{ROLES[u.role]?.i} {ROLES[u.role]?.l}</span></td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{u.partner||"—"}</td>
<td style={{padding:"8px 10px"}}><span style={bg(u.paused?"#FFE6E6":u.active?"#E6F9EE":"#F5F5F5",u.paused?"#E60000":u.active?"#00A651":"#999")}>{u.paused?"⏸ Παύση":u.active?"🟢 Ενεργός":"⚫ Off"}</span></td>
<td style={{padding:"8px 10px"}}><div style={{display:"flex",gap:3}}>
{!(cu.role==="director"&&u.role==="admin")&&<button onClick={()=>setUsers(p=>p.map(x=>x.id===u.id?{...x,paused:x.paused?0:1}:x))} title={u.paused?"Ενεργοποίηση":"Παύση"} style={{padding:"2px 7px",borderRadius:4,border:"none",background:u.paused?"#E8F5E9":"#FFF3E0",color:u.paused?"#2E7D32":"#E65100",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>{u.paused?"▶️":"⏸"}</button>}

{!(cu.role==="director"&&u.role==="admin")&&<button onClick={()=>setUsers(p=>p.map(x=>x.id===u.id?{...x,active:x.active?0:1}:x))} title={u.active?"Απενεργοποίηση":"Ενεργοποίηση"} style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#E3F2FD",color:"#1976D2",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>{u.active?"🔒":"🔓"}</button>}
{!(cu.role==="director"&&u.role==="admin")&&<button onClick={()=>setEditUser({...u,fname:u.name?.split(" ")[0]||"",lname:u.name?.split(" ").slice(1).join(" ")||"",mobile:u.mobile||"",userCode:u.userCode||"",newPW:"",confirmPW:""})} title="Επεξεργασία" style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#E3F2FD",color:"#1565C0",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>✏️</button>}
{!(cu.role==="director"&&u.role==="admin")&&<button onClick={()=>setResetPW({show:true,uid:u.id,uname:u.name,newPW:"",confirm:""})} title="Reset Password" style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#FFF3E0",color:"#E65100",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>🔑</button>}
{cu.role==="admin"&&u.role!=="admin"&&<button onClick={()=>setDelTarget(u)} style={{padding:"2px 7px",borderRadius:4,border:"none",background:"#FFE6E6",color:"#E60000",cursor:"pointer",fontSize:"0.68rem",fontWeight:600}}>🗑</button>}
</div></td></tr>)}
</tbody></table></div>

{/* EDIT USER MODAL */}
{editUser&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
<div style={{background:"white",borderRadius:12,padding:24,width:440,maxHeight:"90vh",overflow:"auto"}}>
<h3 style={{fontFamily:"'Outfit'",fontWeight:700,marginBottom:14}}>✏️ Επεξεργασία: {editUser.name}</h3>
<div style={{display:"grid",gap:10,marginBottom:14}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Username</label><input value={editUser.un} onChange={e=>setEditUser(p=>({...p,un:e.target.value}))} style={iS}/></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Όνομα</label><input value={editUser.fname} onChange={e=>setEditUser(p=>({...p,fname:e.target.value}))} style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Επώνυμο</label><input value={editUser.lname} onChange={e=>setEditUser(p=>({...p,lname:e.target.value}))} style={iS}/></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Email</label><input value={editUser.email||""} onChange={e=>setEditUser(p=>({...p,email:e.target.value}))} type="email" style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Κινητό</label><input value={editUser.mobile||""} onChange={e=>setEditUser(p=>({...p,mobile:e.target.value.replace(/\D/g,"").slice(0,10)}))} placeholder="69xxxxxxxx" maxLength={10} style={iS}/></div>
</div>
{(cu.role==="admin"||cu.role==="director")&&<div style={{background:"#FFF8E1",borderRadius:8,padding:10,border:"1px solid #FFE0B2"}}>
<label style={{fontSize:"0.74rem",fontWeight:600,color:"#E65100"}}>🔐 Κωδικός Χρήστη (μόνο Admin/Director)</label>
<input value={editUser.userCode||""} onChange={e=>setEditUser(p=>({...p,userCode:e.target.value}))} style={{...iS,borderColor:"#FFE0B2"}}/></div>}
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ρόλος</label><select value={editUser.role} onChange={e=>setEditUser(p=>({...p,role:e.target.value}))} style={iS} disabled={cu.role==="director"&&editUser.role==="admin"}>{Object.entries(ROLES).filter(([k])=>cu.role==="admin"||k!=="admin").map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></div>
{editUser.role==="partner"&&<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ανήκει σε Supervisor</label><select value={editUser.supervisor||""} onChange={e=>setEditUser(p=>({...p,supervisor:e.target.value}))} style={iS}><option value="">—</option>{users.filter(u=>u.role==="supervisor").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
{editUser.role==="agent"&&<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Ανήκει σε Partner</label><select value={editUser.partner||""} onChange={e=>setEditUser(p=>({...p,partner:e.target.value}))} style={iS}><option value="">—</option>{users.filter(u=>u.role==="partner").map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>}
{(editUser.role!=="agent"&&editUser.role!=="partner")&&<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Partner</label><select value={editUser.partner||""} onChange={e=>setEditUser(p=>({...p,partner:e.target.value}))} style={iS}><option value="">—</option>{PARTNERS_LIST.map(p=><option key={p}>{p}</option>)}</select></div>}
{(cu.role==="admin"||cu.role==="director")&&<div style={{background:"#FFEBEE",borderRadius:8,padding:10,border:"1px solid #FFCDD2"}}>
<label style={{fontSize:"0.74rem",fontWeight:600,color:"#C62828"}}>🔑 Νέος Κωδικός Πρόσβασης (αφήστε κενό αν δεν αλλάζει)</label>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
<input value={editUser.newPW||""} onChange={e=>setEditUser(p=>({...p,newPW:e.target.value}))} type="password" placeholder="Νέο password" style={iS}/>
<input value={editUser.confirmPW||""} onChange={e=>setEditUser(p=>({...p,confirmPW:e.target.value}))} type="password" placeholder="Επιβεβαίωση" style={iS}/>
</div>
{editUser.newPW&&editUser.newPW.length<6&&<p style={{fontSize:"0.68rem",color:"#C62828",margin:"4px 0 0"}}>⚠️ Min 6 χαρακτήρες</p>}
{editUser.confirmPW&&editUser.newPW!==editUser.confirmPW&&<p style={{fontSize:"0.68rem",color:"#C62828",margin:"4px 0 0"}}>⚠️ Δεν ταιριάζουν</p>}
</div>}
</div>
<div style={{display:"flex",gap:8}}>
<button onClick={async()=>{const name=`${editUser.fname} ${editUser.lname}`.trim()||editUser.name;
const updates={un:editUser.un,name,email:editUser.email,mobile:editUser.mobile||"",userCode:editUser.userCode||"",role:editUser.role,partner:editUser.partner||"",supervisor:editUser.supervisor||""};
// Check if password change requested
if(editUser.newPW){if(editUser.newPW.length<6){alert("Password: min 6 χαρακτήρες");return;}if(editUser.newPW!==editUser.confirmPW){alert("Τα passwords δεν ταιριάζουν");return;}updates.pw=await hashPW(editUser.newPW);updates.mustChangePW=1;}
// If admin/director changed userCode, force password change
if(editUser.userCode!==(users.find(u=>u.id===editUser.id)?.userCode||"")){updates.mustChangePW=1;}
setUsers(p=>p.map(u=>u.id===editUser.id?{...u,...updates}:u));
if(USE_SUPA){try{const dbUp={username:updates.un,name:updates.name,email:updates.email,mobile:updates.mobile,user_code:updates.userCode,role:updates.role,partner:updates.partner};if(updates.pw)dbUp.password=updates.pw;if(updates.mustChangePW)dbUp.must_change_pw=true;console.log("📝 Updating user:",editUser.id,dbUp);const patchRes=await fetch(`${SUPA_URL}/rest/v1/users?id=eq.${editUser.id}`,{method:"PATCH",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(dbUp)});if(!patchRes.ok){const errTxt=await patchRes.text();console.error("❌ PATCH failed:",patchRes.status,errTxt);alert("Σφάλμα αποθήκευσης: "+errTxt);}else{console.log("✅ User updated:",editUser.id);if(updates.pw)alert("✅ Κωδικός αλλάχθηκε! Ο χρήστης θα πρέπει να αλλάξει password στο επόμενο login.");}}catch(e){console.error(e);}}
setEditUser(null);}} style={B("#4CAF50","white",{padding:"8px 20px"})}>💾 Αποθήκευση</button>
<button onClick={()=>setEditUser(null)} style={B("#999","white",{padding:"8px 20px"})}>Ακύρωση</button>
</div>
</div></div>}

{/* RESET PASSWORD MODAL */}
{resetPW.show&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
<div style={{background:"white",borderRadius:12,padding:24,width:380}}>
<h3 style={{fontFamily:"'Outfit'",fontWeight:700,marginBottom:6}}>🔑 Reset Password</h3>
<p style={{fontSize:"0.82rem",color:"#666",marginBottom:14}}>Χρήστης: <strong>{resetPW.uname}</strong></p>
<div style={{display:"grid",gap:10,marginBottom:14}}>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Νέο Password *</label><input value={resetPW.newPW} onChange={e=>setResetPW(p=>({...p,newPW:e.target.value}))} type="password" style={iS}/></div>
<div><label style={{fontSize:"0.74rem",fontWeight:600}}>Επιβεβαίωση *</label><input value={resetPW.confirm} onChange={e=>setResetPW(p=>({...p,confirm:e.target.value}))} type="password" style={iS}/></div>
{resetPW.newPW&&resetPW.newPW.length<6&&<p style={{fontSize:"0.72rem",color:"#E60000"}}>⚠️ Τουλάχιστον 6 χαρακτήρες</p>}
{resetPW.confirm&&resetPW.newPW!==resetPW.confirm&&<p style={{fontSize:"0.72rem",color:"#E60000"}}>⚠️ Τα passwords δεν ταιριάζουν</p>}
</div>
<div style={{display:"flex",gap:8}}>
<button onClick={async()=>{if(!resetPW.newPW||resetPW.newPW.length<6){alert("Τουλάχιστον 6 χαρακτήρες");return;}if(resetPW.newPW!==resetPW.confirm){alert("Τα passwords δεν ταιριάζουν");return;}const hashed=await hashPW(resetPW.newPW);setUsers(p=>p.map(u=>u.id===resetPW.uid?{...u,pw:hashed,mustChangePW:1}:u));if(USE_SUPA){try{await fetch(`${SUPA_URL}/rest/v1/users?id=eq.${resetPW.uid}`,{method:"PATCH",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({pw:hashed,must_change_pw:true})});console.log("✅ Password reset for",resetPW.uname);}catch(e){console.error(e);}}setResetPW({show:false,uid:null,uname:"",newPW:"",confirm:""});alert("✅ Password αλλάχθηκε! Ο χρήστης θα πρέπει να το αλλάξει στο πρώτο login.");}} style={B("#E65100","white",{padding:"8px 20px"})}>🔑 Reset</button>
<button onClick={()=>setResetPW({show:false,uid:null,uname:"",newPW:"",confirm:""})} style={B("#999","white",{padding:"8px 20px"})}>Ακύρωση</button>
</div>
</div></div>}

</div>);}

// ═══ OFFERS PANEL ═══
function OffersPanel({offers,setOffers,cu,pr}){
const canEdit=["admin","director","backoffice"].includes(cu.role);
const provs=[
  {key:"vodafone",name:"Vodafone",color:"#E60000",icon:"📡"},
  {key:"cosmote",name:"Cosmote",color:"#00A651",icon:"🟢"},
  {key:"nova",name:"Nova",color:"#1565C0",icon:"🔵"}
];

const uploadOffer=async(provKey,slot,file,desc)=>{
  try{
    const ext=file.name.split(".").pop()||"pdf";
    const path=`offers/${provKey}_slot${slot}.${ext}`;
    // Upload to storage (overwrites existing)
    const upRes=await fetch(`${SUPA_URL}/storage/v1/object/documents/${path}`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":file.type,"x-upsert":"true"},body:file});
    if(!upRes.ok){
      // Try update if exists
      await fetch(`${SUPA_URL}/storage/v1/object/documents/${path}`,{method:"PUT",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":file.type},body:file});
    }
    // Save to DB (upsert)
    await fetch(`${SUPA_URL}/rest/v1/offers`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({provider:provKey,slot,description:desc,file_path:path,updated_by:cu.id,updated_at:new Date().toISOString()})});
    setOffers(p=>({...p,[provKey]:p[provKey].map((o,i)=>i===slot?{desc,path}:o)}));
    console.log("✅ Offer uploaded:",provKey,slot);
  }catch(e){console.error("Offer upload error:",e);alert("Σφάλμα upload");}
};

return(<div>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:900,marginBottom:4}}>🏷️ Προσφορές Παρόχων</h1>
<p style={{color:"#888",fontSize:"0.82rem",marginBottom:20}}>Τρέχουσες προσφορές ανά πάροχο</p>

{provs.map(pv=><div key={pv.key} style={{background:"white",borderRadius:12,padding:18,marginBottom:16,borderLeft:`4px solid ${pv.color}`,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:800,fontSize:"1.1rem",color:pv.color,marginBottom:14}}>{pv.icon} {pv.name}</h2>
<div style={{display:"grid",gap:12}}>
{offers[pv.key]?.map((offer,idx)=><OfferSlot key={idx} offer={offer} idx={idx} pv={pv} canEdit={canEdit} onUpload={uploadOffer}/>)}
</div>
</div>)}
</div>);
}

function OfferSlot({offer,idx,pv,canEdit,onUpload}){
const[desc,setDesc]=useState(offer.desc||"");
const[file,setFile]=useState(null);
const[editing,setEditing]=useState(false);

return(<div style={{background:"#FAFAFA",borderRadius:8,padding:12,border:"1px solid #F0F0F0"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
<span style={{fontWeight:700,fontSize:"0.82rem",color:"#444"}}>📄 Προσφορά #{idx+1}</span>
{canEdit&&!editing&&<button onClick={()=>setEditing(true)} style={{padding:"3px 10px",borderRadius:4,border:"none",background:"#E3F2FD",color:"#1565C0",cursor:"pointer",fontSize:"0.7rem",fontWeight:600}}>✏️ Επεξεργασία</button>}
</div>

{editing?<div style={{display:"grid",gap:8}}>
<div><label style={{fontSize:"0.7rem",fontWeight:600}}>Περιγραφή</label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Περιγραφή προσφοράς..." style={{width:"100%",padding:8,borderRadius:6,border:"1px solid #DDD",fontSize:"0.82rem"}}/></div>
<div><label style={{fontSize:"0.7rem",fontWeight:600}}>PDF αρχείο {offer.path&&"(αντικαθιστά το υπάρχον)"}</label><input type="file" accept=".pdf" onChange={e=>setFile(e.target.files[0]||null)} style={{fontSize:"0.78rem"}}/></div>
<div style={{display:"flex",gap:6}}>
<button onClick={async()=>{if(file){await onUpload(pv.key,idx,file,desc);setFile(null);setEditing(false);}else if(desc!==offer.desc){await fetch(`${SUPA_URL}/rest/v1/offers`,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({provider:pv.key,slot:idx,description:desc,file_path:offer.path,updated_at:new Date().toISOString()})});setEditing(false);}else setEditing(false);}} style={{padding:"6px 16px",borderRadius:6,border:"none",background:"#4CAF50",color:"white",cursor:"pointer",fontSize:"0.78rem",fontWeight:600}}>💾 Αποθήκευση</button>
<button onClick={()=>{setDesc(offer.desc||"");setFile(null);setEditing(false);}} style={{padding:"6px 16px",borderRadius:6,border:"none",background:"#999",color:"white",cursor:"pointer",fontSize:"0.78rem",fontWeight:600}}>Ακύρωση</button>
</div>
</div>

:<div>
{offer.desc?<p style={{fontSize:"0.82rem",color:"#444",margin:"0 0 6px"}}>{offer.desc}</p>:<p style={{fontSize:"0.78rem",color:"#BBB",fontStyle:"italic",margin:"0 0 6px"}}>Χωρίς περιγραφή</p>}
{offer.path?<button onClick={()=>downloadDoc(offer.path,`${pv.name}_Προσφορά_${idx+1}.pdf`)} style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+pv.color,background:"white",color:pv.color,cursor:"pointer",fontSize:"0.76rem",fontWeight:600}}>📥 Λήψη PDF</button>
:<span style={{fontSize:"0.74rem",color:"#CCC"}}>— Δεν υπάρχει αρχείο —</span>}
</div>}
</div>);
}

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
// ═══ REPORTS PANEL ═══
function ReportsPanel({reqs,users,pr,prov,PROVIDERS,ST,expReport,expXLSX}){
const[rTab,setRTab]=useState("overview");const[rProv,setRProv]=useState("all");
const[srch,setSrch]=useState({afm:"",adt:"",reqId:"",phone:"",svc:"",dateFrom:"",dateTo:"",partner:"",provider:"",agent:"",status:"",name:""});
const[srchRes,setSrchRes]=useState(null);
const allReqs=rProv==="all"?reqs:reqs.filter(r=>r.prov===rProv);

// Search function
const doSearch=()=>{
  let res=[...reqs];
  if(srch.afm) res=res.filter(r=>(r.afm||"").includes(srch.afm));
  if(srch.adt) res=res.filter(r=>(r.adt||"").includes(srch.adt));
  if(srch.reqId) res=res.filter(r=>(r.id||"").toLowerCase().includes(srch.reqId.toLowerCase()));
  if(srch.phone) res=res.filter(r=>(r.mob||"").includes(srch.phone)||(r.ph||"").includes(srch.phone)||(r.lines||[]).some(l=>(l.mobNum||"").includes(srch.phone)||(l.landNum||"").includes(srch.phone)));
  if(srch.svc) res=res.filter(r=>srch.svc==="mobile"?(r.lines||[]).some(l=>l.type==="mobile"):srch.svc==="landline"?(r.lines||[]).some(l=>l.type==="landline"):true);
  if(srch.dateFrom) res=res.filter(r=>(r.created||"")>=srch.dateFrom);
  if(srch.dateTo) res=res.filter(r=>(r.created||"").slice(0,10)<=srch.dateTo);
  if(srch.partner) res=res.filter(r=>(r.partner||"")===srch.partner);
  if(srch.provider) res=res.filter(r=>(r.prov||"")===srch.provider);
  if(srch.agent) res=res.filter(r=>(r.agentName||"")===srch.agent);
  if(srch.status) res=res.filter(r=>(r.status||"")===srch.status);
  if(srch.name) res=res.filter(r=>`${r.ln} ${r.fn}`.toLowerCase().includes(srch.name.toLowerCase()));
  setSrchRes(res);
};
const clearSearch=()=>{setSrch({afm:"",adt:"",reqId:"",phone:"",svc:"",dateFrom:"",dateTo:"",partner:"",provider:"",agent:"",status:"",name:""});setSrchRes(null);};
const ss=(k,v)=>setSrch(p=>({...p,[k]:v}));
const uniqueAgents=[...new Set(reqs.map(r=>r.agentName).filter(Boolean))].sort();
const uniquePartners=[...new Set(reqs.map(r=>r.partner).filter(Boolean))].sort();
const activeReqs=allReqs.filter(r=>r.status==="active"||r.status==="credited");

// ─── AGGREGATIONS ───
const byProvider=Object.entries(PROVIDERS).map(([k,p])=>{
  const pr=reqs.filter(r=>r.prov===k);const act=pr.filter(r=>r.status==="active"||r.status==="credited");
  const rev=act.reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const lns=act.flatMap(r=>r.lines||[]);
  return{key:k,name:p.name,icon:p.icon,color:p.color,total:pr.length,active:act.length,revenue:rev,mobLines:lns.filter(l=>l.type==="mobile").length,landLines:lns.filter(l=>l.type==="landline").length};
});

const byAgent=()=>{const m={};allReqs.forEach(r=>{const k=r.agentName||"Άγνωστος";if(!m[k])m[k]={name:k,agentId:r.agentId,total:0,active:0,revenue:0,mob:0,land:0,sub:0};m[k].total++;if(r.status==="active"||r.status==="credited"){m[k].active++;m[k].revenue+=(parseFloat(r.price)||0);(r.lines||[]).forEach(l=>{if(l.type==="mobile")m[k].mob++;else m[k].land++;if(l.mode==="subsidy")m[k].sub+=(parseFloat(l.subsidy)||0);});}});return Object.values(m).sort((a,b)=>b.revenue-a.revenue);};

const byPartner=()=>{const m={};allReqs.forEach(r=>{const k=r.partner||"—";if(!m[k])m[k]={name:k,total:0,active:0,revenue:0,agents:new Set()};m[k].total++;m[k].agents.add(r.agentName);if(r.status==="active"||r.status==="credited"){m[k].active++;m[k].revenue+=(parseFloat(r.price)||0);}});return Object.values(m).map(p=>({...p,agents:p.agents.size})).sort((a,b)=>b.revenue-a.revenue);};

const byProgram=()=>{const m={};allReqs.forEach(r=>{const lns=r.lines||[];if(lns.length>0){lns.forEach(l=>{const k=l.prog||"—";if(!m[k])m[k]={name:k,type:l.type,total:0,revenue:0,simo:0,subsidy:0,subAmt:0};m[k].total++;m[k].revenue+=(parseFloat(l.price)||0);if(l.mode==="simo")m[k].simo++;else{m[k].subsidy++;m[k].subAmt+=(parseFloat(l.subsidy)||0);}});}else{const k=r.prog||"—";if(!m[k])m[k]={name:k,type:"—",total:0,revenue:0,simo:0,subsidy:0,subAmt:0};m[k].total++;m[k].revenue+=(parseFloat(r.price)||0);}});return Object.values(m).sort((a,b)=>b.revenue-a.revenue);};

const byStatus=()=>{const m={};allReqs.forEach(r=>{const s=ST[r.status]||{l:"—"};const k=r.status;if(!m[k])m[k]={key:k,label:s.l,icon:s.i,color:s.c,bg:s.bg,total:0,revenue:0};m[k].total++;m[k].revenue+=(parseFloat(r.price)||0);});return Object.values(m).sort((a,b)=>b.total-a.total);};

const totalRev=activeReqs.reduce((s,r)=>s+(parseFloat(r.price)||0),0);
const totalLines=activeReqs.flatMap(r=>r.lines||[]);
const totalMob=totalLines.filter(l=>l.type==="mobile").length;
const totalLand=totalLines.filter(l=>l.type==="landline").length;
const totalSub=totalLines.filter(l=>l.mode==="subsidy").reduce((s,l)=>s+(parseFloat(l.subsidy)||0),0);

const cardS={textAlign:"center",padding:14,borderRadius:10,background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"};
const thS={padding:"8px 10px",textAlign:"left",fontSize:"0.72rem",fontWeight:700,color:"#666",borderBottom:"2px solid #E0E0E0",whiteSpace:"nowrap"};
const tdS={padding:"8px 10px",fontSize:"0.78rem",borderBottom:"1px solid #F0F0F0"};

return(
<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16}}>
<div><h1 style={{fontFamily:"'Outfit'",fontSize:"1.8rem",fontWeight:900,letterSpacing:-1}}>📊 Reports</h1></div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
<select value={rProv} onChange={e=>setRProv(e.target.value)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid #DDD",fontSize:"0.8rem",fontWeight:600}}>
<option value="all">Όλοι οι πάροχοι</option>
{Object.entries(PROVIDERS).map(([k,p])=><option key={k} value={k}>{p.icon} {p.name}</option>)}
</select>
</div></div>

{/* Report Tabs */}
<div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
{[["search","🔍 Αναζήτηση"],["overview","📊 Επισκόπηση"],["provider","🏢 Ανά Πάροχο"],["program","📱 Ανά Πρόγραμμα"],["agent","👤 Ανά Agent"],["partner","🤝 Ανά Partner"],["status","📋 Ανά Κατάσταση"]].map(([k,l])=>
<button key={k} onClick={()=>setRTab(k)} style={{padding:"7px 16px",borderRadius:8,border:"none",background:rTab===k?pr.color:"#E8E8E8",color:rTab===k?"white":"#666",cursor:"pointer",fontWeight:700,fontSize:"0.78rem"}}>{l}</button>)}
</div>

{/* ─── SEARCH ─── */}
{rTab==="search"&&<div>
<div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
{/* Filter Panel */}
<div style={{background:"white",borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",minWidth:280,flex:"0 0 300px"}}>
<div style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"0.95rem",marginBottom:14,borderBottom:`2px solid ${pr.color}`,paddingBottom:6}}>🔍 Φίλτρα Αναζήτησης</div>
<div style={{display:"flex",flexDirection:"column",gap:10}}>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>ΑΦΜ</label><input value={srch.afm} onChange={e=>ss("afm",e.target.value)} placeholder="ΑΦΜ..." style={iS}/></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Ονοματεπώνυμο</label><input value={srch.name} onChange={e=>ss("name",e.target.value)} placeholder="Επώνυμο ή Όνομα..." style={iS}/></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Αριθμός Ταυτότητας</label><input value={srch.adt} onChange={e=>ss("adt",e.target.value)} placeholder="ΑΔΤ..." style={iS}/></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Κωδικός Αίτησης</label><input value={srch.reqId} onChange={e=>ss("reqId",e.target.value)} placeholder="REQ-..." style={iS}/></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Αριθμός Τηλεφώνου</label><input value={srch.phone} onChange={e=>ss("phone",e.target.value)} placeholder="69xxxxxxxx..." style={iS}/></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Είδος Αίτησης</label><select value={srch.svc} onChange={e=>ss("svc",e.target.value)} style={iS}><option value="">— Όλα —</option><option value="mobile">📱 Κινητή</option><option value="landline">📞 Σταθερή</option></select></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Εισαγωγή Από</label><input type="date" value={srch.dateFrom} onChange={e=>ss("dateFrom",e.target.value)} style={iS}/></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Εισαγωγή Έως</label><input type="date" value={srch.dateTo} onChange={e=>ss("dateTo",e.target.value)} style={iS}/></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Πάροχος</label><select value={srch.provider} onChange={e=>ss("provider",e.target.value)} style={iS}><option value="">— Όλοι —</option>{Object.entries(PROVIDERS).map(([k,p])=><option key={k} value={k}>{p.icon} {p.name}</option>)}</select></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Partner / Κατάστημα</label><select value={srch.partner} onChange={e=>ss("partner",e.target.value)} style={iS}><option value="">— Όλοι —</option>{uniquePartners.map(p=><option key={p}>{p}</option>)}</select></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Agent / Πωλητής</label><select value={srch.agent} onChange={e=>ss("agent",e.target.value)} style={iS}><option value="">— Όλοι —</option>{uniqueAgents.map(a=><option key={a}>{a}</option>)}</select></div>
<div><label style={{fontSize:"0.72rem",color:"#666",fontWeight:600,display:"block",marginBottom:3}}>Κατάσταση</label><select value={srch.status} onChange={e=>ss("status",e.target.value)} style={iS}><option value="">— Όλες —</option>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.i} {v.l}</option>)}</select></div>
<button onClick={doSearch} style={{padding:"10px",borderRadius:8,border:"none",background:pr.color,color:"white",cursor:"pointer",fontWeight:700,fontSize:"0.88rem",marginTop:4}}>🔍 Αναζήτηση</button>
<div style={{display:"flex",gap:8}}>
<button onClick={clearSearch} style={{flex:1,padding:"8px",borderRadius:6,border:"1px solid #DDD",background:"white",color:"#666",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>✕ Καθαρισμός</button>
<button onClick={()=>{setSrchRes(null);doSearch();}} style={{flex:1,padding:"8px",borderRadius:6,border:"1px solid #DDD",background:"white",color:"#666",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>↻ Ανανέωση</button>
</div>
</div></div>

{/* Results */}
<div style={{flex:1,minWidth:0}}>
{srchRes===null?<div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:"3rem",marginBottom:10}}>🔍</div><div style={{color:"#888",fontSize:"0.9rem"}}>Συμπληρώστε τα φίλτρα και πατήστε <strong>Αναζήτηση</strong></div></div>
:srchRes.length===0?<div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:"3rem",marginBottom:10}}>📭</div><div style={{color:"#888",fontSize:"0.9rem"}}>Δεν βρέθηκαν αποτελέσματα</div></div>
:<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
<span style={{fontWeight:700,fontSize:"0.85rem"}}>Εγγραφές: {srchRes.length}</span>
<button onClick={()=>expXLSX(srchRes,"Αναζήτηση_"+new Date().toISOString().slice(0,10)+".xlsx","Αποτελέσματα")} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #4CAF50",background:"#E8F5E9",color:"#2E7D32",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>📥 Excel</button>
</div>
<div style={{background:"white",borderRadius:10,overflow:"auto",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
<table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}><thead><tr>
{["ID","Πάροχος","Επώνυμο","Όνομα","ΑΦΜ","Κινητό","Πρόγραμμα","Κατάσταση","Partner","Agent","Ημ/νία","Πάγιο €"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:"0.7rem",fontWeight:700,color:"#666",borderBottom:"2px solid #E0E0E0",whiteSpace:"nowrap",position:"sticky",top:0,background:"white"}}>{h}</th>)}
</tr></thead><tbody>
{srchRes.map(r=><tr key={r.id} style={{cursor:"pointer"}} onMouseOver={e=>e.currentTarget.style.background="#F5F5F5"} onMouseOut={e=>e.currentTarget.style.background=""}>
<td style={{padding:"7px 10px",fontSize:"0.75rem",fontWeight:700,color:pr.color,borderBottom:"1px solid #F0F0F0"}}>{r.id}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}>{PROVIDERS[r.prov]?.icon} {PROVIDERS[r.prov]?.name}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",fontWeight:600,borderBottom:"1px solid #F0F0F0"}}>{r.ln}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}>{r.fn}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}>{r.afm}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}>{r.mob}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}>{r.prog||(r.lines||[]).map(l=>l.prog).join(", ")}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}><span style={{padding:"2px 8px",borderRadius:4,fontSize:"0.68rem",fontWeight:600,background:ST[r.status]?.bg,color:ST[r.status]?.c}}>{ST[r.status]?.i} {ST[r.status]?.l}</span></td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}>{r.partner}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}>{r.agentName}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",borderBottom:"1px solid #F0F0F0"}}>{r.created}</td>
<td style={{padding:"7px 10px",fontSize:"0.75rem",fontWeight:700,color:"#2E7D32",borderBottom:"1px solid #F0F0F0"}}>€{parseFloat(r.price||0).toFixed(2)}</td>
</tr>)}
</tbody></table></div></div>}
</div></div></div>}

{/* ─── OVERVIEW ─── */}
{rTab==="overview"&&<div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
<div style={{...cardS,borderTop:`4px solid ${pr.color}`}}><div style={{fontSize:"0.7rem",color:"#888"}}>Συνολικές Αιτήσεις</div><div style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:800,color:pr.color}}>{allReqs.length}</div></div>
<div style={{...cardS,borderTop:"4px solid #4CAF50"}}><div style={{fontSize:"0.7rem",color:"#888"}}>Ενεργές</div><div style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:800,color:"#4CAF50"}}>{activeReqs.length}</div></div>
<div style={{...cardS,borderTop:"4px solid #2196F3"}}><div style={{fontSize:"0.7rem",color:"#888"}}>Πάγιο €</div><div style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:800,color:"#2196F3"}}>€{totalRev.toFixed(2)}</div></div>
<div style={{...cardS,borderTop:"4px solid #FF9800"}}><div style={{fontSize:"0.7rem",color:"#888"}}>Γραμμές Κινητής</div><div style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:800,color:"#FF9800"}}>{totalMob}</div></div>
<div style={{...cardS,borderTop:"4px solid #9C27B0"}}><div style={{fontSize:"0.7rem",color:"#888"}}>Γραμμές Σταθερής</div><div style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:800,color:"#9C27B0"}}>{totalLand}</div></div>
<div style={{...cardS,borderTop:"4px solid #E91E63"}}><div style={{fontSize:"0.7rem",color:"#888"}}>Επιδοτήσεις €</div><div style={{fontFamily:"'Outfit'",fontSize:"1.6rem",fontWeight:800,color:"#E91E63"}}>€{totalSub.toFixed(2)}</div></div>
</div>
</div>}

{/* ─── BY PROVIDER ─── */}
{rTab==="provider"&&<div>
<div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
<button onClick={()=>expReport("Ανά Πάροχο",["Πάροχος","Αιτήσεις","Ενεργές","Πάγιο €","Κινητές","Σταθερές"],byProvider.map(p=>[p.name,p.total,p.active,p.revenue.toFixed(2),p.mobLines,p.landLines]),"Report_Provider.xlsx")} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #4CAF50",background:"#E8F5E9",color:"#2E7D32",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>📥 Excel</button>
</div>
<div style={{background:"white",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>
{["Πάροχος","Αιτήσεις","Ενεργές","Πάγιο €","Κινητές","Σταθερές"].map(h=><th key={h} style={thS}>{h}</th>)}
</tr></thead><tbody>
{byProvider.map(p=><tr key={p.key}><td style={{...tdS,fontWeight:700}}><span style={{color:p.color}}>{p.icon}</span> {p.name}</td><td style={tdS}>{p.total}</td><td style={tdS}>{p.active}</td><td style={{...tdS,fontWeight:700,color:"#2E7D32"}}>€{p.revenue.toFixed(2)}</td><td style={tdS}>{p.mobLines}</td><td style={tdS}>{p.landLines}</td></tr>)}
</tbody></table></div></div>}

{/* ─── BY PROGRAM ─── */}
{rTab==="program"&&<div>
<div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
<button onClick={()=>{const d=byProgram();expReport("Ανά Πρόγραμμα",["Πρόγραμμα","Τύπος","Γραμμές","Πάγιο €","SIM Only","Επιδότηση","Ποσό Επιδ. €"],d.map(p=>[p.name,p.type==="mobile"?"Κινητή":"Σταθερή",p.total,p.revenue.toFixed(2),p.simo,p.subsidy,p.subAmt.toFixed(2)]),"Report_Program.xlsx");}} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #4CAF50",background:"#E8F5E9",color:"#2E7D32",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>📥 Excel</button>
</div>
<div style={{background:"white",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>
{["Πρόγραμμα","Τύπος","Γραμμές","Πάγιο €","SIM Only","Επιδότηση","Ποσό Επιδ. €"].map(h=><th key={h} style={thS}>{h}</th>)}
</tr></thead><tbody>
{byProgram().map((p,i)=><tr key={i}><td style={{...tdS,fontWeight:700}}>{p.name}</td><td style={tdS}><span style={{padding:"2px 8px",borderRadius:4,fontSize:"0.68rem",fontWeight:600,background:p.type==="mobile"?"#E3F2FD":"#FFF3E0",color:p.type==="mobile"?"#1565C0":"#E65100"}}>{p.type==="mobile"?"📱 Κινητή":"📞 Σταθερή"}</span></td><td style={tdS}>{p.total}</td><td style={{...tdS,fontWeight:700,color:"#2E7D32"}}>€{p.revenue.toFixed(2)}</td><td style={tdS}>{p.simo}</td><td style={tdS}>{p.subsidy}</td><td style={{...tdS,color:"#AD1457"}}>€{p.subAmt.toFixed(2)}</td></tr>)}
</tbody></table></div></div>}

{/* ─── BY AGENT ─── */}
{rTab==="agent"&&<div>
<div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
<button onClick={()=>{const d=byAgent();expReport("Ανά Agent",["Agent","Αιτήσεις","Ενεργές","Πάγιο €","Κινητές","Σταθερές","Επιδοτήσεις €"],d.map(a=>[a.name,a.total,a.active,a.revenue.toFixed(2),a.mob,a.land,a.sub.toFixed(2)]),"Report_Agent.xlsx");}} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #4CAF50",background:"#E8F5E9",color:"#2E7D32",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>📥 Excel</button>
</div>
<div style={{background:"white",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>
{["Agent","Αιτήσεις","Ενεργές","Πάγιο €","Κινητές","Σταθερές","Επιδοτήσεις €"].map(h=><th key={h} style={thS}>{h}</th>)}
</tr></thead><tbody>
{byAgent().map((a,i)=><tr key={i}><td style={{...tdS,fontWeight:700}}>{a.name}</td><td style={tdS}>{a.total}</td><td style={tdS}>{a.active}</td><td style={{...tdS,fontWeight:700,color:"#2E7D32"}}>€{a.revenue.toFixed(2)}</td><td style={tdS}>{a.mob}</td><td style={tdS}>{a.land}</td><td style={{...tdS,color:"#AD1457"}}>€{a.sub.toFixed(2)}</td></tr>)}
</tbody></table></div></div>}

{/* ─── BY PARTNER ─── */}
{rTab==="partner"&&<div>
<div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
<button onClick={()=>{const d=byPartner();expReport("Ανά Partner",["Partner","Agents","Αιτήσεις","Ενεργές","Πάγιο €"],d.map(p=>[p.name,p.agents,p.total,p.active,p.revenue.toFixed(2)]),"Report_Partner.xlsx");}} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #4CAF50",background:"#E8F5E9",color:"#2E7D32",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>📥 Excel</button>
</div>
<div style={{background:"white",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>
{["Partner","Agents","Αιτήσεις","Ενεργές","Πάγιο €"].map(h=><th key={h} style={thS}>{h}</th>)}
</tr></thead><tbody>
{byPartner().map((p,i)=><tr key={i}><td style={{...tdS,fontWeight:700}}>{p.name}</td><td style={tdS}>{p.agents}</td><td style={tdS}>{p.total}</td><td style={tdS}>{p.active}</td><td style={{...tdS,fontWeight:700,color:"#2E7D32"}}>€{p.revenue.toFixed(2)}</td></tr>)}
</tbody></table></div></div>}

{/* ─── BY STATUS ─── */}
{rTab==="status"&&<div>
<div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
<button onClick={()=>{const d=byStatus();expReport("Ανά Κατάσταση",["Κατάσταση","Αιτήσεις","Πάγιο €"],d.map(s=>[s.label,s.total,s.revenue.toFixed(2)]),"Report_Status.xlsx");}} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #4CAF50",background:"#E8F5E9",color:"#2E7D32",cursor:"pointer",fontWeight:600,fontSize:"0.78rem"}}>📥 Excel</button>
</div>
<div style={{background:"white",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>
{["Κατάσταση","Αιτήσεις","Πάγιο €"].map(h=><th key={h} style={thS}>{h}</th>)}
</tr></thead><tbody>
{byStatus().map((s,i)=><tr key={i}><td style={tdS}><span style={{padding:"3px 10px",borderRadius:6,fontSize:"0.75rem",fontWeight:700,background:s.bg,color:s.color}}>{s.icon} {s.label}</span></td><td style={tdS}>{s.total}</td><td style={{...tdS,fontWeight:700,color:"#2E7D32"}}>€{s.revenue.toFixed(2)}</td></tr>)}
</tbody></table></div></div>}

</div>);}

function AdminPanel({users,setUsers,reqs,setReqs,afmDb,setAfmDb,cu,pr,sysPaused,setSysPaused,tixEnabled,setTixEnabled,tix,setTix}){
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
<AdmCd ic="🎫" ti="Αιτήματα" ds="Διαχείριση tickets" ct={tix?.length||0} cl="#9C27B0" onClick={()=>setSec("tk")}/>
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
if(sec==="tk")return(<div><AdmBk onClick={()=>setSec("ov")}/>
<h1 style={{fontFamily:"'Outfit'",fontSize:"1.5rem",fontWeight:900,marginBottom:14}}>🎫 Διαχείριση Αιτημάτων</h1>
<div style={{background:"white",borderRadius:12,padding:18,marginBottom:16}}>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
<div><span style={{fontWeight:700,fontSize:"0.9rem"}}>Υπηρεσία Αιτημάτων</span><br/><span style={{fontSize:"0.75rem",color:"#888"}}>Ενεργοποίηση/Απενεργοποίηση για όλους τους χρήστες</span></div>
<button onClick={()=>setTixEnabled(p=>!p)} style={{padding:"10px 24px",borderRadius:8,border:"none",background:tixEnabled?"#4CAF50":"#E60000",color:"white",cursor:"pointer",fontSize:"0.85rem",fontWeight:700,minWidth:140}}>{tixEnabled?"✅ Ενεργό":"❌ Απενεργοποιημένο"}</button>
</div>
{!tixEnabled&&<div style={{padding:10,background:"#FFF3E0",borderRadius:8,fontSize:"0.78rem",color:"#E65100",marginBottom:12}}>⚠️ Τα Αιτήματα είναι κρυμμένα για όλους τους χρήστες εκτός Admin</div>}
</div>
<div style={{background:"white",borderRadius:12,padding:18}}>
<h2 style={{fontFamily:"'Outfit'",fontWeight:700,fontSize:"1.1rem",marginBottom:12}}>📋 Λίστα Αιτημάτων ({tix?.length||0})</h2>
{tix&&tix.length>0?<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#FAFAFA"}}>
{["ID","Πελάτης","ΑΦΜ","Λόγος","Status","Ημ/νία","Ενέργειες"].map(h=><th key={h} style={{padding:"8px 10px",fontFamily:"'Outfit'",fontWeight:600,fontSize:"0.7rem",color:"#888",textAlign:"left"}}>{h}</th>)}
</tr></thead><tbody>
{tix.map(t=><tr key={t.id} style={{borderBottom:"1px solid #F0F0F0"}}>
<td style={{padding:"8px 10px",fontSize:"0.78rem",fontWeight:600,color:"#E65100"}}>{t.id}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{t.cname}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{t.afm}</td>
<td style={{padding:"8px 10px",fontSize:"0.78rem"}}>{t.reason}</td>
<td style={{padding:"8px 10px"}}><span style={{padding:"2px 8px",borderRadius:4,fontSize:"0.68rem",fontWeight:600,background:t.status==="open"?"#E8F5E9":"#F5F5F5",color:t.status==="open"?"#2E7D32":"#999"}}>{t.status==="open"?"🟢 Ανοιχτό":"🔒 Κλειστό"}</span></td>
<td style={{padding:"8px 10px",fontSize:"0.72rem",color:"#888"}}>{t.at}</td>
<td style={{padding:"8px 10px"}}><button onClick={async()=>{if(!confirm("Διαγραφή "+t.id+";")){return;}setTix(p=>p.filter(x=>x.id!==t.id));if(USE_SUPA){try{await fetch(`${SUPA_URL}/rest/v1/ticket_messages?ticket_id=eq.${t.id}`,{method:"DELETE",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});await fetch(`${SUPA_URL}/rest/v1/tickets?id=eq.${t.id}`,{method:"DELETE",headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});console.log("✅ Ticket deleted:",t.id);}catch(e){console.error(e);}}}} style={{padding:"3px 8px",borderRadius:4,border:"none",background:"#FFE6E6",color:"#E60000",cursor:"pointer",fontSize:"0.7rem",fontWeight:600}}>🗑</button></td>
</tr>)}
</tbody></table>:<p style={{color:"#999",fontSize:"0.85rem"}}>Δεν υπάρχουν αιτήματα</p>}
</div></div>);

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
