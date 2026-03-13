import { useState } from "react"
import { recommendTariffs } from "./energyEngine"

export default function EnergyCompare(){

const [kwh,setKwh]=useState(300)
const [type,setType]=useState("ρεύμα_οικιακό")
const [results,setResults]=useState([])

async function runComparison(){

const res=await fetch(`/api/energy?type=${type}`)
const data=await res.json()

const best=recommendTariffs(data,kwh)

setResults(best)

}

return (

<div style={{padding:20}}>

<h2>⚡ Σύγκριση Ρεύματος</h2>

<select onChange={e=>setType(e.target.value)}>

<option value="ρεύμα_οικιακό">Ρεύμα Οικιακό</option>
<option value="ρεύμα_επαγγελματικό">Ρεύμα Επαγγελματικό</option>
<option value="αέριο_οικιακό">Αέριο Οικιακό</option>
<option value="αέριο_επαγγελματικό">Αέριο Επαγγελματικό</option>

</select>

<input
type="number"
value={kwh}
onChange={e=>setKwh(e.target.value)}
placeholder="kWh"
/>

<button onClick={runComparison}>
Αναζήτηση
</button>

<div style={{marginTop:20}}>

{results.map((r,i)=>(
<div key={i}>

<b>{r.provider}</b>

<div>{r.plan}</div>

<div>{r.monthly.toFixed(2)} € / μήνα</div>

</div>
))}

</div>

</div>

)

}
