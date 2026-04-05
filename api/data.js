import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (!user || error) {
    return res.status(401).json({ error: "Invalid user" });
  }

  // GET vehicles
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id);

    if (error) return res.status(500).json({ error });

    return res.status(200).json(data);
  }

  // SAVE vehicle
  if (req.method === "POST") {
    const { reg, make, colour } = req.body;

    const { data, error } = await supabase.from("vehicles").insert([
      {
        reg,
        make,
        colour,
        user_id: user.id,
      },
    ]);

    if (error) return res.status(500).json({ error });

    return res.status(200).json(data);
  }

  res.status(405).json({ error: "Method not allowed" });
}