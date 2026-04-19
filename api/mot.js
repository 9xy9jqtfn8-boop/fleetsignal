export default async function handler(req, res) {
  try {
    // 🔥 Bulletproof query handling
    const url = new URL(req.url, `http://${req.headers.host}`);
    const reg = url.searchParams.get("reg");

    if (!reg) {
      return res.status(400).json({ error: "Missing registration" });
    }

    console.log("🚗 API received reg:", reg);

    const response = await fetch(
      "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
      {
        method: "POST",
        headers: {
          "x-api-key": process.env.DVLA_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrationNumber: reg,
        }),
      }
    );

    const data = await response.json();

    console.log("📦 DVLA response:", data);

    return res.status(200).json({
      make: data.make,
      colour: data.colour,
      taxStatus: data.taxStatus,
      motStatus: data.motStatus,
      motExpiryDate: data.motExpiryDate,
      taxClass: data.taxClass,
    });

  } catch (err) {
    console.error("❌ DVLA ERROR:", err);
    return res.status(500).json({ error: "DVLA fetch failed" });
  }
}