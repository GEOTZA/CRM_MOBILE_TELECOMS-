export async function handler(event) {

  const type = event.queryStringParameters.type || "ρεύμα_οικιακό"

  const sources = {

    "ρεύμα_οικιακό":
      "https://energycost.gr/%CF%85%CF%80%CE%BF%CE%BB%CE%BF%CE%B3%CE%B9%CF%83%CE%BC%CF%8C%CF%82-%CF%84%CE%B9%CE%BC%CE%AE%CF%82-%CE%B2%CE%AC%CF%83%CE%B5%CE%B9-%CE%BA%CE%B1%CF%84%CE%B1%CE%BD%CE%AC%CE%BB%CF%89%CF%83%CE%B7%CF%82-2/",

    "ρεύμα_επαγγελματικό":
      "https://energycost.gr/%CE%BA%CE%B1%CF%84%CE%B1%CF%87%CF%89%CF%81%CE%B7%CE%BC%CE%AD%CE%BD%CE%B1-%CF%84%CE%B9%CE%BC%CE%BF%CE%BB%CF%8C%CE%B3%CE%B9%CE%B1-%CF%80%CF%81%CE%BF%CE%BC%CE%AE%CE%B8%CE%B5%CE%B9%CE%B1%CF%82-%CE%B7-2/",

    "αέριο_οικιακό":
      "https://energycost.gr/%CE%BA%CE%B1%CF%84%CE%B1%CF%87%CF%89%CF%81%CE%B7%CE%BC%CE%AD%CE%BD%CE%B1-%CF%84%CE%B9%CE%BC%CE%BF%CE%BB%CF%8C%CE%B3%CE%B9%CE%B1-%CF%80%CF%81%CE%BF%CE%BC%CE%AE%CE%B8%CE%B5%CE%B9%CE%B1%CF%82_gas/",

    "αέριο_επαγγελματικό":
      "https://energycost.gr/%CE%BA%CE%B1%CF%84%CE%B1%CF%87%CF%89%CF%81%CE%B7%CE%BC%CE%AD%CE%BD%CE%B1-%CF%84%CE%B9%CE%BC%CE%BF%CE%BB%CF%8C%CE%B3%CE%B9%CE%B1-%CF%80%CF%81%CE%BF%CE%BC%CE%AE%CE%B8%CE%B5%CE%B9%CE%B1%CF%82-%CE%B5_gas/"
  }

  const url = sources[type]

  const res = await fetch(url)
  const html = await res.text()

  return {
    statusCode: 200,
    body: JSON.stringify({
      source: url,
      length: html.length
    })
  }
}
