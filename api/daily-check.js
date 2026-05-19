// api/daily-check.js

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const DAY_MS = 1000 * 60 * 60 * 24;

function daysUntilDate(dateValue) {
  if (!dateValue) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;

  target.setHours(0, 0, 0, 0);

  return Math.ceil((target - today) / DAY_MS);
}

function isDueSoon(days) {
  return typeof days === "number" && days >= 0 && days <= 30;
}

export default async function handler(req, res) {
  const secret = req.query.secret;

  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();

    // Get vehicles that belong to logged-in users
    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("*")
      .not("user_id", "is", null);

    if (vehiclesError) {
      console.error("Vehicle fetch error:", vehiclesError);
      return res.status(500).json({ error: vehiclesError.message });
    }

    if (!vehicles || vehicles.length === 0) {
      return res.status(200).json({
        success: true,
        sent: 0,
        checked: 0,
        message: "No vehicles found",
      });
    }

    // Get all linked user profile IDs
    const userIds = [...new Set(vehicles.map((v) => v.user_id).filter(Boolean))];

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, is_premium, alerts_enabled")
      .in("id", userIds);

    if (profilesError) {
      console.error("Profile fetch error:", profilesError);
      return res.status(500).json({ error: profilesError.message });
    }

    const profileById = new Map();
    for (const profile of profiles || []) {
      profileById.set(profile.id, profile);
    }

    let sent = 0;
    let checked = 0;
    let skippedFree = 0;
    let skippedAlertsOff = 0;
    let skippedCooldown = 0;
    let skippedNoTrigger = 0;

    for (const v of vehicles) {
      checked++;

      const profile = profileById.get(v.user_id);

      // Skip if no matching profile
      if (!profile) {
        continue;
      }

      // Premium protection: only premium users receive compliance emails
      if (profile.is_premium !== true) {
        skippedFree++;
        continue;
      }

      // Profile-level alerts switch
      if (profile.alerts_enabled === false) {
        skippedAlertsOff++;
        continue;
      }

      // Vehicle-level alerts switch
      if (v.alerts_enabled === false) {
        skippedAlertsOff++;
        continue;
      }

      const lastSent = v.last_alert_sent
        ? new Date(v.last_alert_sent)
        : null;

      const daysSinceLast = lastSent
        ? (now - lastSent) / DAY_MS
        : null;

      // 7 day cooldown per vehicle
      if (lastSent && daysSinceLast < 7) {
        skippedCooldown++;
        continue;
      }

      const reg = v.reg || "Unknown registration";
      const make = v.make || "Unknown vehicle";
      const taxStatus = v.tax_status || "Unknown";
      const motDays = Number(v.mot_days);

      const taxDays = daysUntilDate(v.tax_due_date);
      const insuranceDays = daysUntilDate(v.insurance_expiry);

      const dueItems = [];

      if (isDueSoon(motDays)) {
        dueItems.push({
          type: "MOT",
          label: "MOT Warning",
          value: `${motDays} days remaining`,
          detail: "Your MOT test is approaching expiry. Book early to avoid disruption or penalties.",
        });
      }

      if (isDueSoon(taxDays)) {
        dueItems.push({
          type: "Tax",
          label: "Tax Renewal",
          value: `${taxDays} days remaining`,
          detail: "Your vehicle tax renewal date is approaching. Check and renew in good time.",
        });
      }

      if (isDueSoon(insuranceDays)) {
        dueItems.push({
          type: "Insurance",
          label: "Insurance Alert",
          value: `${insuranceDays} days remaining`,
          detail: "Your insurance cover is approaching expiry. Renew in good time to avoid driving uninsured.",
        });
      }

      // Skip if nothing is due within 30 days
      if (dueItems.length === 0) {
        skippedNoTrigger++;
        continue;
      }

      const emailTo = profile.email || v.alert_email;

      if (!emailTo) {
        console.error("No email found for vehicle:", reg);
        continue;
      }

      const alertTypes = dueItems.map((item) => item.type).join(", ");

      const alertCardsHtml = dueItems
        .map(
          (item) => `
    <div style="background:#fff7ed;border:2px solid #fb923c;border-radius:14px;padding:16px 18px;margin-top:18px;margin-bottom:18px;">
      <div style="color:#c2410c;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">
        ${item.label}
      </div>

      <div style="color:#9a3412;font-size:22px;font-weight:800;line-height:1.25;margin-bottom:10px;">
        ${item.value}
      </div>

      <div style="color:#7c2d12;font-size:15px;line-height:1.5;">
        ${item.detail}
      </div>
    </div>
`
        )
        .join("");

      try {
        await resend.emails.send({
          from: "FleetSignal <alerts@getfleetsignal.com>",
          to: emailTo,
          subject: `Vehicle compliance alert for ${reg}`,
          html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;background:#f5f7fb;padding:30px;">

  <div style="max-width:520px;margin:auto;background:white;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

    <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:10px;">
      🚗 FleetSignal Alert
    </div>

    <div style="font-size:14px;color:#64748b;margin-bottom:20px;">
      ${alertTypes} reminder for your vehicle
    </div>

    <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="font-size:14px;opacity:0.9;">Vehicle</div>
      <div style="font-size:22px;font-weight:700;">${reg}</div>

      <div style="margin-top:16px;font-size:14px;line-height:1.8;color:white;">
        <div>
          <strong>Vehicle:</strong> ${make}
        </div>

        <div>
          <strong>MOT Days Left:</strong> ${
            Number.isFinite(motDays) ? motDays : "Unknown"
          }
        </div>

        <div>
          <strong>Tax Status:</strong> ${taxStatus}
        </div>

        <div>
          <strong>Tax Renewal:</strong> ${v.tax_due_date || "Not added"}
        </div>

        <div>
          <strong>Insurance:</strong> ${v.insurance_expiry || "Not added"}
        </div>
      </div>
    </div>

    ${alertCardsHtml}

    <div style="font-size:14px;color:#64748b;line-height:1.6;">
      FleetSignal is monitoring this vehicle for MOT, tax, and insurance compliance reminders.
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
        console.error("Email failed:", reg, err);
      }
    }

    return res.status(200).json({
      success: true,
      sent,
      checked,
      skippedFree,
      skippedAlertsOff,
      skippedCooldown,
      skippedNoTrigger,
    });
  } catch (err) {
    console.error("Daily check failed:", err);
    return res.status(500).json({ error: err.message });
  }
}