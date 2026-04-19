
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      line_items: [
        {
          price: "price_1TLL9FLXIECaxPL5gOZ531dA",
          quantity: 1,
        },
      ],

      success_url: "https://getfleetsignal.com/app.html?success=true",
      cancel_url: "https://getfleetsignal.com/app.html",

      metadata: {
        userId: userId,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe error" });
  }
}