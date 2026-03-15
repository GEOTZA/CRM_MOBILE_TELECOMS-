// Netlify Serverless Function: Send Email via Resend
// Environment variable needed: RESEND_API_KEY

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.error("RESEND_API_KEY not set in environment variables");
    return { statusCode: 500, body: JSON.stringify({ error: "RESEND_API_KEY not configured" }) };
  }

  try {
    const { to, subject, html } = JSON.parse(event.body);
    
    if (!to || !subject || !html) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing: to, subject, html" }) };
    }

    console.log("Sending email to:", to, "subject:", subject);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "CRM Electrigon <onboarding@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      })
    });

    const data = await res.json();
    console.log("Resend response:", res.status, JSON.stringify(data));

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify(data) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: data.id })
    };
  } catch (e) {
    console.error("Email error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
