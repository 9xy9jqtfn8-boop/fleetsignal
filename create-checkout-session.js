import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      line_items: [
        {
          price: "price_1TLL9FLXIECaxPL5gOZ531dA",
          quantity: 1,
        },
      ],

      // ✅ CRITICAL FIX: pass session_id back to app
      success_url: `https://getfleetsignal.com/app.html?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: "https://getfleetsignal.com/app.html",

      // ✅ CRITICAL FIX: match verifySession.js
      metadata: {
        user_id: userId,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Stripe error" });
  }
}