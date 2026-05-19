// api/daily-check.js

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

    // Get vehicles that have an alert email
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("*")
      .not("alert_email", "is", null);

    if (error) {
      console.error("Fetch error:", error);
      return res.status(500).json({ error: error.message });
    }

    let sent = 0;

    for (const v of vehicles) {
      const motDays = Number(v.mot_days) || 0;

      // Skip if alerts are switched off
      if (v.alerts_enabled === false) {
        continue;
      }

      // Only send MOT reminders if between 1 and 30 days
      if (motDays <= 0 || motDays > 30) {
        continue;
      }

      const lastSent = v.last_alert_sent
        ? new Date(v.last_alert_sent)
        : null;

      const daysSinceLast = lastSent
        ? (now - lastSent) / (1000 * 60 * 60 * 24)
        : null;

      // 7 day cooldown
      if (lastSent && daysSinceLast < 7) {
        continue;
      }

      const reg = v.reg || "Unknown registration";
      const make = v.make || "Unknown vehicle";
      const taxStatus = v.tax_status || "Unknown";
      const insuranceExpiry = v.insurance_expiry || "Not added";
      const alertType = "MOT";

      try {
        await resend.emails.send({
          from: "FleetSignal <alerts@getfleetsignal.com>",
          to: v.alert_email,
          subject: `Vehicle compliance alert for ${reg}`,
          html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;background:#f5f7fb;padding:30px;">

  <div style="max-width:520px;margin:auto;background:white;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

    <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:10px;">
      🚗 FleetSignal Alert
    </div>

    <div style="font-size:14px;color:#64748b;margin-bottom:20px;">
      ${alertType} reminder for your vehicle
    </div>

    <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="font-size:14px;opacity:0.9;">Vehicle</div>
      <div style="font-size:22px;font-weight:700;">${reg}</div>

      <div style="margin-top:16px;font-size:14px;line-height:1.8;color:white;">
        <div>
          <strong>Vehicle:</strong> ${make}
        </div>

        <div>
          <strong>MOT Days Left:</strong> ${motDays}
        </div>

        <div>
          <strong>Tax Status:</strong> ${taxStatus}
        </div>

        <div>
          <strong>Insurance:</strong> ${insuranceExpiry}
        </div>
      </div>
    </div>

    <div style="background:#fff7ed;border:2px solid #fb923c;border-radius:14px;padding:16px 18px;margin-top:18px;margin-bottom:18px;">
      <div style="color:#c2410c;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">
        MOT Warning
      </div>

      <div style="color:#9a3412;font-size:22px;font-weight:800;line-height:1.25;margin-bottom:10px;">
        ${motDays} days remaining
      </div>

      <div style="color:#7c2d12;font-size:15px;line-height:1.5;">
        Your MOT test is approaching expiry. Book early to avoid disruption or penalties.
      </div>
    </div>

    <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:14px;padding:18px;margin-top:18px;margin-bottom:18px;">
      <div style="color:#15803d;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">
        Tax Status
      </div>

      <div style="color:#166534;font-size:24px;font-weight:800;line-height:1.1;margin-bottom:10px;">
        ${taxStatus}
      </div>

      <div style="color:#166534;font-size:15px;line-height:1.5;">
        Vehicle tax monitoring is active through FleetSignal.
      </div>
    </div>

    <div style="background:#fff4f4;border:2px solid #ef4444;border-radius:14px;padding:16px 18px;margin-top:18px;margin-bottom:18px;">
      <div style="color:#b91c1c;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">
        Insurance
      </div>

      <div style="color:#7f1d1d;font-size:22px;font-weight:800;line-height:1.25;margin-bottom:10px;">
        ${insuranceExpiry}
      </div>

      <div style="color:#991b1b;font-size:15px;line-height:1.5;">
        If your insurance is approaching expiry, renew in good time to avoid driving uninsured.
      </div>
    </div>

    <div style="font-size:16px;color:#0f172a;margin-bottom:12px;">
      Your MOT expires in:
    </div>

    <div style="font-size:28px;font-weight:800;color:#ef4444;margin-bottom:20px;">
      ${motDays} days
    </div>

    <div style="font-size:14px;color:#64748b;line-height:1.6;">
      Don’t risk fines or invalid insurance. Book your MOT now to stay compliant.
    </div>

    <div style="margin-top:24px;">
      <a href="https://www.gov.uk/getting-an-mot"
         style="display:inline-block;background:#3b82f6;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">
        Book MOT
      </a>
    </div>

  </div>

  <div style="text-align:center;margin-top:20px;font-size:12px;color:#94a3b8;">
    FleetSignal • Smart vehicle compliance monitoring
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