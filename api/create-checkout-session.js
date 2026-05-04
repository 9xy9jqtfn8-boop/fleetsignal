import Stripe from "stripe";

export default async function handler(req, res) {
 try {
   // 🔥 INIT STRIPE INSIDE HANDLER (important for Vercel)
   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

   const { userId } = req.body || {};

   if (!userId) {
     return res.status(400).json({ error: "Missing userId" });
   }
    
   console.log("STRIPE DEBUG:", {
  key: process.env.STRIPE_SECRET_KEY ? "OK" : "MISSING",
  price: process.env.STRIPE_PRICE_ID,
});

   const session = await stripe.checkout.sessions.create({
     mode: "subscription",
     line_items: [
       {
         price: process.env.STRIPE_PRICE_ID,
         quantity: 1,
       },
     ],
     success_url:
       "https://www.getfleetsignal.com/app.html?session_id={CHECKOUT_SESSION_ID}",
     cancel_url:
       "https://www.getfleetsignal.com/app.html",
     metadata: {
       user_id: userId,
     },
   });

   return res.status(200).json({ url: session.url });

 } catch (err) {
   console.error("🔥 FULL STRIPE ERROR:", err);
   return res.status(500).json({ error: err.message });
 }
}