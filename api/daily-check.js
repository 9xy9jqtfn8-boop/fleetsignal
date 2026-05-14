import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  const secret = req.query.secret;

  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();

    // Get ONLY vehicles that actually have emails
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("*")
      .not("alert_email", "is", null);

    if (error) {
      console.error("Fetch error:", error);
      return res.status(500).json({ error });
    }

    let sent = 0;

    for (const v of vehicles) {
      const motDays = Number(v.mot_days) || 0;

      // Only send if between 1–30 days
      if (typeof motDays !== "number" || motDays <= 0 || motDays > 30) {
        continue;
      }

      const lastSent = v.last_alert_sent
        ? new Date(v.last_alert_sent)
        : null;

      const daysSinceLast =
        lastSent ? (now - lastSent) / (1000 * 60 * 60 * 24) : null;

      // 7 day cooldown
      if (lastSent && daysSinceLast < 7) {
        continue;
      }

      try {
        await resend.emails.send({
          from: "FleetSignal <alerts@getfleetsignal.com>",
          to: v.alert_email,
          subject: `MOT Alert for ${v.reg}`,
          html: `
          <div style="
          font-family: Arial, sans-serif;
          background:#f4f7fb;
          padding:40px 20px;
        ">

          <div style="
           max-width:520px;
           margin:auto;
           background:white;
           border-radius:24px;
           padding:40px;
           box-shadow:0 10px 30px rgba(0,0,0,0.08);
        ">

    <h1 style="
      font-size:36px;
      margin:0 0 10px;
      color:#111827;
    ">
      🚗 FleetSignal Alert
    </h1>

    <p style="
      color:#6b7280;
      font-size:20px;
      margin-bottom:30px;
    ">
      MOT reminder for your vehicle
    </p>

    <div style="
      background:linear-gradient(135deg,#4f7df3,#315efb);
      color:white;
      padding:24px;
      border-radius:18px;
      margin-bottom:30px;
    ">
      <div style="font-size:18px; opacity:0.9;">
        Vehicle
      </div>

      <div style="
        font-size:42px;
        font-weight:700;
        letter-spacing:2px;
      ">
        ${v.reg}
      </div>
    </div>

    <p style="
      font-size:22px;
      color:#111827;
      margin-bottom:10px;
    ">
      Your MOT expires in:
    </p>

    <h2 style="
      font-size:56px;
      color:#ef4444;
      margin:0 0 30px;
    ">
      ${motDays} days
    </h2>

    <p style="
      color:#6b7280;
      font-size:18px;
      line-height:1.6;
      margin-bottom:40px;
    ">
      Don’t risk fines or invalid insurance.
      Book your MOT now to stay compliant.
    </p>

    <a href="https://www.getfleetsignal.com/app.html"
       style="
        display:inline-block;
        background:#4f7df3;
        color:white;
        text-decoration:none;
        padding:18px 32px;
        border-radius:14px;
        font-size:22px;
        font-weight:600;
      ">
      Open FleetSignal
    </a>

    <p style="
      margin-top:40px;
      font-size:14px;
      color:#9ca3af;
    ">
      FleetSignal • Smart vehicle reminders
    </p>

  </div>

</div>
`,
});

        await supabase
          .from("vehicles")
          .update({
            last_alert_sent: new Date().toISOString(),
          })
          .eq("id", v.id);

        sent++;
      } catch (err) {
        console.error("Email failed:", v.reg, err);
      }
    }

    return res.status(200).json({
      success: true,
      sent,
      checked: vehicles.length,
    });

  } catch (err) {
    console.error("Daily check failed:", err);
    return res.status(500).json({ error: err.message });
  }
}