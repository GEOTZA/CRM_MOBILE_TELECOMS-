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
    console.error("APIFON credentials missing - TOKEN:", !!TOKEN, "SECRET:", !!SECRET);
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

    console.log("Sending SMS to:", phone, "text:", text.substring(0, 50));

    const d = new Date();
    const dateStr = d.toUTCString();
    
    const isSMS = type !== "viber";
    const uri = isSMS ? "/services/api/v1/sms/send" : "/services/api/v1/im/send";
    
    const bodyObj = {
      subscribers: [{ number: phone }],
      message: {
        text: text,
        dc: "0"
      },
      sender: sender || "electrigon1"
    };
    
    // Add SMS failover for Viber
    if (!isSMS) {
      bodyObj.sms_failover = { text: text };
    }
    
    const bodyStr = JSON.stringify(bodyObj);
    const signature = getApifonSignature(SECRET, "POST", uri, bodyStr, dateStr);
    
    console.log("Apifon request - URI:", uri);
    console.log("Apifon auth header:", "ApifonWS " + TOKEN.substring(0, 8) + "...");
    console.log("Apifon body:", bodyStr);
    
    const res = await fetch("https://ars.apifon.com" + uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "ApifonWS " + TOKEN + ":" + signature,
        "X-ApifonWS-Date": dateStr
      },
      body: bodyStr
    });
    
    // Handle response - may not be JSON!
    const responseText = await res.text();
    console.log("Apifon response status:", res.status);
    console.log("Apifon response body:", responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // Response is not JSON (e.g. "Unauthorized")
      data = { raw_response: responseText, status: res.status };
    }
    
    if (!res.ok) {
      console.error("Apifon error:", res.status, responseText);
      return { statusCode: res.status, body: JSON.stringify({ error: responseText, status: res.status }) };
    }
    
    return { statusCode: 200, body: JSON.stringify(data) };
    
  } catch (e) {
    console.error("Apifon error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
