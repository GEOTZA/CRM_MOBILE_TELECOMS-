export function recommendTariffs(data,kwh){

  const results=[]

  data.forEach(row=>{

    const price=parseFloat(row.price || 0)
    const fixed=parseFloat(row.fixed || 0)

    const monthly=(kwh*price)+fixed

    results.push({
      provider:row.provider,
      plan:row.plan,
      monthly:monthly,
      price:price
    })

  })

  results.sort((a,b)=>a.monthly-b.monthly)

  return results.slice(0,4)

}
