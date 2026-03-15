const crypto = require('crypto');

function getApifonSignature(secretKey, method, uri, body, dateStr) {
  const toSign = method + "\n" + uri + "\n" + body + "\n" + dateStr;
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('base64');
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const TOKEN = process.env.APIFON_TOKEN;
  const SECRET = process.env.APIFON_SECRET;
  if (!TOKEN || !SECRET) {
    return { statusCode: 500, body: JSON.stringify({ error: "Credentials missing" }) };
  }
  try {
    const { to, text } = JSON.parse(event.body);
    if (!to || !text) return { statusCode: 400, body: JSON.stringify({ error: "Missing to/text" }) };
    let phone = to.replace(/\D/g, '');
    if (phone.startsWith('69')) phone = '30' + phone;
    if (!phone.startsWith('30')) phone = '30' + phone;
    const dateStr = new Date().toUTCString();
    const uri = "/services/api/v1/sms/send";
    const bodyObj = {
      subscribers: [{ number: phone }],
      message: { text: text, dc: "0" }
    };
    const bodyStr = JSON.stringify(bodyObj);
    const signature = getApifonSignature(SECRET, "POST", uri, bodyStr, dateStr);
    console.log("SMS to:", phone, "text:", text.substring(0, 50));
    const res = await fetch("https://ars.apifon.com" + uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "ApifonWS " + TOKEN + ":" + signature,
        "X-ApifonWS-Date": dateStr
      },
      body: bodyStr
    });
    const responseText = await res.text();
    console.log("Apifon status:", res.status, "body:", responseText);
    if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: responseText }) };
    return { statusCode: 200, body: responseText };
  } catch (e) {
    console.error("Error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
