import Stripe from "stripe";

export default async function handler(req, res) {
  try {
    console.log("STRIPE KEY EXISTS:", !!process.env.STRIPE_SECRET_KEY);
    console.log("STRIPE PRICE ID:", process.env.STRIPE_PRICE_ID);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const userId = body?.userId;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    if (!process.env.STRIPE_PRICE_ID) {
      return res.status(500).json({ error: "Missing STRIPE_PRICE_ID" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url:
        "https://www.getfleetsignal.com/app.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://www.getfleetsignal.com/app.html",
      metadata: {
        user_id: userId,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("FULL STRIPE ERROR:", err);

    return res.status(500).json({
      error: err.message || "Stripe checkout failed",
    });
  }
}