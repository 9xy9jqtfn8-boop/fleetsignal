export default async function handler(req, res) {
  // ===== GET REG FROM QUERY =====
  const reg = req.query.reg?.toUpperCase();

  if (!reg) {
    return res.status(400).json({ error: "No registration provided" });
  }

  try {
    // ===== CALL DVLA API =====
    const response = await fetch(
      "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.DVLA_API_KEY, // set this in Vercel
        },
        body: JSON.stringify({
          registrationNumber: reg,
        }),
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "DVLA API error",
      });
    }

    const data = await response.json();

    // ===== CLEAN RESPONSE =====
    res.status(200).json({
      reg: reg,
      make: data.make || "Unknown",
      colour: data.colour || "Unknown",
      motStatus: data.motStatus || "Unknown",
      motExpiryDate: data.motExpiryDate || null,
      taxStatus: data.taxStatus || "Unknown",
    });

  } catch (err) {
    console.error("DVLA ERROR:", err);

    res.status(500).json({
      error: "DVLA lookup failed",
    });
  }
}