export default async function handler(req, res) {
  const { reg } = req.query;

  if (!reg) {
    return res.status(400).json({ error: "Missing registration" });
  }

  try {
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

    // 🔥 RETURN CLEAN DATA FOR FRONTEND
    res.status(200).json({
      make: data.make,
      colour: data.colour,
      taxStatus: data.taxStatus,
      motStatus: data.motStatus,
      motExpiryDate: data.motExpiryDate,
    });

  } catch (err) {
    console.error("DVLA ERROR:", err);
    res.status(500).json({ error: "DVLA fetch failed" });
  }
}