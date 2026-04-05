import { createClient } from "@supabase/supabase-js";

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  const { data: vehicles } = await client
    .from("vehicles")
    .select("*");

  for (const v of vehicles) {

    const response = await fetch(`https://yourdomain.com/api/mot?reg=${v.reg}`);
    const data = await response.json();

    if (!data.motExpiryDate) continue;

    const motExpiry = new Date(data.motExpiryDate);
    const today = new Date();
    const days = Math.ceil((motExpiry - today) / (1000 * 60 * 60 * 24));

    let message = null;

    if (days < 7) {
      message = `🚨 MOT expires in ${days} days`;
    } else if (days < 30) {
      message = `⚠️ MOT expires soon (${days} days)`;
    }

    if (data.taxStatus !== "Taxed") {
      message = `🔴 Vehicle is not taxed`;
    }

    if (message) {

      const { data: user } = await client.auth.admin.getUserById(v.user_id);

      await fetch("https://yourdomain.com/api/sendAlert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.user.email,
          reg: v.reg,
          message
        })
      });
    }
  }

  res.status(200).json({ success: true });
}