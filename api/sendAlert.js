import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, reg, days } = req.body;

    const response = await resend.emails.send({
      from: "FleetSignal <alerts@getfleetsignal.com>",
      to: email,
      subject: `MOT Alert for ${reg}`,
      html: `<p>Your vehicle <strong>${reg}</strong> has ${days} days left on MOT.</p>`
    });

    return res.status(200).json({ success: true, response });

  } catch (error) {
    console.error("EMAIL ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}