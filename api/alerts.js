export default async function handler(req, res) {

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TABLE = "Fleet";

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  // 1. Get fleet from Airtable
  const airtableRes = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE}`,
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`
      }
    }
  );

  const data = await airtableRes.json();

  const alerts = [];

  // 2. Check MOT status
  data.records.forEach(v => {

    if (!v.fields.motExpiry) return;

    const days = (new Date(v.fields.motExpiry) - new Date()) / (1000*60*60*24);

    if (days < 0) {
      alerts.push(`🚨 ${v.fields.reg} MOT EXPIRED`);
    }
    else if (days < 14) {
      alerts.push(`⚠️ ${v.fields.reg} MOT due in ${Math.round(days)} days`);
    }

  });

  if (alerts.length === 0) {
    return res.json({ message: "No alerts" });
  }

  // 3. Send email via Resend
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "FleetSignal <onboarding@resend.dev>",
      to: ["wsfireservices@gmail.com"],   // 👈 CHANGE THIS
      subject: "Fleet Alerts 🚗",
      html: `<pre>${alerts.join("\n")}</pre>`
    })
  });

  res.json({ sent: alerts.length });

}