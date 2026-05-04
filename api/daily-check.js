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
      const motDays = v.mot_days;

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
            <div style="font-family: Arial; padding:20px;">
              <h2>🚗 FleetSignal Alert</h2>
              <p><strong>${v.reg}</strong></p>
              <p>Your MOT expires in:</p>
              <h1 style="color:red;">${motDays} days</h1>
              <p>Book early to avoid fines.</p>
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