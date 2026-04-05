import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  try {
    const { email, reg, days } = req.body;

    console.log("Incoming:", email, reg, days);

    // 🔒 HARD VALIDATION (fixes your exact error)
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Missing email" });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    console.log("Sending to:", cleanEmail);

    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to:  [cleanEmail], // ✅ MUST be array
      subject: `MOT Reminder for ${reg}`,
      html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>FleetSignal Alert</h2>
          <p>Your vehicle <strong>${reg}</strong> MOT expires in <strong>${days} days</strong>.</p>
          <p>Please arrange your MOT to stay road legal.</p>
          <br/>
          <small>FleetSignal</small>
        </div>
      `
    });

    console.log("SUCCESS:", response);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("FULL ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}