// Netlify Serverless Function: Send SMS/Viber via Apifon
// Environment variables needed: APIFON_TOKEN, APIFON_SECRET

const crypto = require('crypto');

function getApifonSignature(secretKey, method, uri, body, dateStr) {
  const toSign = method + "\n" + uri + "\n" + body + "\n" + dateStr;
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('base64');
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const TOKEN = process.env.APIFON_TOKEN;
  const SECRET = process.env.APIFON_SECRET;
  
  if (!TOKEN || !SECRET) {
    console.error("APIFON_TOKEN or APIFON_SECRET not set");
    return { statusCode: 500, body: JSON.stringify({ error: "Apifon credentials not configured" }) };
  }

  try {
    const { type, to, text, sender } = JSON.parse(event.body);
    
    if (!to || !text) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing: to, text" }) };
    }

    // Format phone: ensure +30 prefix for Greek numbers
    let phone = to.replace(/\D/g, '');
    if (phone.startsWith('69')) phone = '30' + phone;
    if (!phone.startsWith('30')) phone = '30' + phone;

    const d = new Date();
    const dateStr = d.toUTCString();
    
    if (type === "viber") {
      // IM (Viber) message
      const uri = "/services/api/v1/im/send";
      const bodyObj = {
        subscribers: [{ number: phone }],
        message: {
          text: text,
          dc: "0"
        },
        sms_failover: {
          text: text
        },
        sender: sender || "CRMElect"
      };
      const bodyStr = JSON.stringify(bodyObj);
      const signature = getApifonSignature(SECRET, "POST", uri, bodyStr, dateStr);
      
      const res = await fetch("https://ars.apifon.com" + uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "ApifonWS " + TOKEN + ":" + signature,
          "X-ApifonWS-Date": dateStr
        },
        body: bodyStr
      });
      
      const data = await res.json();
      console.log("Apifon Viber response:", res.status, JSON.stringify(data));
      return { statusCode: res.ok ? 200 : res.status, body: JSON.stringify(data) };
      
    } else {
      // SMS message
      const uri = "/services/api/v1/sms/send";
      const bodyObj = {
        subscribers: [{ number: phone }],
        message: {
          text: text,
          dc: "0"
        },
        sender: sender || "CRMElect"
      };
      const bodyStr = JSON.stringify(bodyObj);
      const signature = getApifonSignature(SECRET, "POST", uri, bodyStr, dateStr);
      
      const res = await fetch("https://ars.apifon.com" + uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "ApifonWS " + TOKEN + ":" + signature,
          "X-ApifonWS-Date": dateStr
        },
        body: bodyStr
      });
      
      const data = await res.json();
      console.log("Apifon SMS response:", res.status, JSON.stringify(data));
      return { statusCode: res.ok ? 200 : res.status, body: JSON.stringify(data) };
    }
  } catch (e) {
    console.error("Apifon error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
