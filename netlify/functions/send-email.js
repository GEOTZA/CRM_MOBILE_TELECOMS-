// Netlify Serverless Function: Send Email via Resend
// Deploy to: netlify/functions/send-email.js
// Environment variable needed: RESEND_API_KEY

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "RESEND_API_KEY not configured" }) };
  }

  try {
    const { to, subject, html, from } = JSON.parse(event.body);

    if (!to || !subject || !html) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing: to, subject, html" }) };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: from || "CRM Electrigon <notifications@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return { statusCode: res.status, body: JSON.stringify(data) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: data.id })
    };
  } catch (e) {
    console.error("Email function error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
