import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, reg, motDays } = req.body;

    const response = await resend.emails.send({
      from: "FleetSignal <alerts@getfleetsignal.com>",
      to: email,
      subject: `MOT Alert for ${reg}`,
      html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;background:#f5f7fb;padding:30px;">

 <div style="max-width:520px;margin:auto;background:white;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

   <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:10px;">
     🚗 FleetSignal Alert
   </div>

   <div style="font-size:14px;color:#64748b;margin-bottom:20px;">
     MOT reminder for your vehicle
   </div>

   <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border-radius:12px;padding:20px;margin-bottom:20px;">
     <div style="font-size:14px;opacity:0.9;">Vehicle</div>
     <div style="font-size:22px;font-weight:700;">${reg}</div>
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
   FleetSignal • Smart vehicle reminders
 </div>

</div>
`
    });

    return res.status(200).json({ success: true, response });

  } catch (error) {
    console.error("EMAIL ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}