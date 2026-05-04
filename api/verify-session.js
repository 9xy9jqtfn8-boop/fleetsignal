import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
 process.env.SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
 const { session_id } = req.query;

 if (!session_id) {
   return res.status(400).json({ success: false });
 }

 try {
   const session = await stripe.checkout.sessions.retrieve(session_id);

   const userId = session.metadata?.user_id;

   if (!userId) {
     return res.status(400).json({ success: false });
   }

   const { error } = await supabase
     .from("profiles")
     .update({ is_premium: true })
     .eq("id", userId);

   if (error) {
     console.error("Supabase update error:", error);
     return res.status(500).json({ success: false });
   }

   return res.status(200).json({ success: true });

 } catch (err) {
   console.error("Verify error:", err);
   return res.status(500).json({ success: false });
 }
}