export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { userId } = req.body;

  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        is_premium: true
      })
    }
  );

  if (!response.ok) {
    return res.status(500).json({ error: "Update failed" });
  }

  res.status(200).json({ success: true });
}