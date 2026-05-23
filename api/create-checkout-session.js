import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { userId, email, plan } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        error: "Missing userId or email",
      });
    }

    const selectedPlan = plan === "annual" ? "annual" : "monthly";

    const priceId =
      selectedPlan === "annual"
        ? process.env.STRIPE_ANNUAL_PRICE_ID
        : process.env.STRIPE_MONTHLY_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        error: `Missing Stripe price ID for ${selectedPlan} plan`,
      });
    }

    const baseUrl =
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://getfleetsignal.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        user_id: userId,
        plan: selectedPlan,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan: selectedPlan,
        },
      },
      success_url: `${baseUrl}/app.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/app.html?checkout=cancelled`,
    });

    return res.status(200).json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create checkout session",
    });
  }
}