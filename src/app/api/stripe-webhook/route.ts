import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCustomizationsToUser } from '@/lib/firebase';

// Force this route to be dynamic and not cached
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Mapping of Stripe price IDs to customization amounts
const PRICE_TO_CUSTOMIZATIONS: Record<string, number> = {
  // Payment link IDs (fallback - these might not be the actual price IDs)
  'plink_1SUBEk2KjEFg0ZKw36nBXRk4': 1,   // 1 персонализация за 1 лв
  'plink_1SUBJt2KjEFg0ZKwm0xmmUUY': 3,   // 3 персонализации за 2 лв
  'plink_1SUBfv2KjEFg0ZKw4L0zcrln': 10,  // 10 персонализации за 3 лв
  
  // TODO: Update these with actual price IDs from Stripe
  // Run a test purchase and check the webhook logs to find the real price IDs
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Get the user ID from client_reference_id (from payment link) or metadata
      const userId = session.client_reference_id || session.metadata?.userId;
      
      // If no userId, try to get it from customer details or session
      if (!userId) {
        console.warn('⚠️ No userId in client_reference_id or metadata');
        
        // As a fallback, we could use customer email or ID
        // But this is not ideal - user should be passed via client_reference_id
        console.error('❌ Cannot process payment without userId');
        return NextResponse.json(
          { error: 'No userId in session - payment succeeded but customizations not added. Contact support with session ID: ' + session.id },
          { status: 400 }
        );
      }
      
      // Check if we can determine customizations from payment_link
      const paymentLinkId = typeof session.payment_link === 'string' ? session.payment_link : null;
      if (paymentLinkId && PRICE_TO_CUSTOMIZATIONS[paymentLinkId]) {
        const customizations = PRICE_TO_CUSTOMIZATIONS[paymentLinkId];
        
        try {
          await addCustomizationsToUser(userId, customizations);
          return NextResponse.json({
            success: true,
            message: `Added ${customizations} customizations to user ${userId}`,
          });
        } catch (error) {
          console.error(`❌ Failed to add customizations to user ${userId}:`, error);
          return NextResponse.json(
            { error: 'Failed to update user customizations' },
            { status: 500 }
          );
        }
      }

      // Fallback: Get line items to determine what was purchased
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      
      let totalCustomizations = 0;
      
      for (const item of lineItems.data) {
        const priceId = item.price?.id;
        const amount = item.amount_total || 0; // Amount in cents
        
        if (priceId && PRICE_TO_CUSTOMIZATIONS[priceId]) {
          const quantity = item.quantity || 1;
          totalCustomizations += PRICE_TO_CUSTOMIZATIONS[priceId] * quantity;
        } else if (amount) {
          // Fallback: determine customizations by amount
          // 100 cents = 1 лв = 1 customization
          // 200 cents = 2 лв = 3 customizations
          // 300 cents = 3 лв = 10 customizations
          const customizationsByAmount: Record<number, number> = {
            100: 1,   // 1 лв
            200: 3,   // 2 лв
            300: 10,  // 3 лв
          };
          
          if (customizationsByAmount[amount]) {
            totalCustomizations += customizationsByAmount[amount];
          } else {
            console.warn(`Unknown price ID: ${priceId} and unknown amount: ${amount}`);
          }
        } else {
          console.warn(`Unknown price ID: ${priceId} - Please add this to PRICE_TO_CUSTOMIZATIONS mapping`);
        }
      }

      if (totalCustomizations > 0) {
        // Add customizations to the user's account
        try {
          await addCustomizationsToUser(userId, totalCustomizations);
        } catch (error) {
          console.error(`❌ Failed to add customizations to user ${userId}:`, error);
          return NextResponse.json(
            { error: 'Failed to update user customizations' },
            { status: 500 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: `Added ${totalCustomizations} customizations to user ${userId}`,
        });
      } else {
        console.error('No customizations calculated from line items');
        return NextResponse.json(
          { error: 'Could not determine customizations amount' },
          { status: 400 }
        );
      }
    }

    // Handle payment_intent.succeeded for alternative flows
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      const userId = paymentIntent.metadata?.userId;
      const customizations = paymentIntent.metadata?.customizations;

      if (userId && customizations) {
        const amount = parseInt(customizations, 10);
        if (!isNaN(amount) && amount > 0) {
          await addCustomizationsToUser(userId, amount);
          
          return NextResponse.json({
            success: true,
            message: `Added ${amount} customizations to user ${userId}`,
          });
        }
      }
    }

    // Return 200 for other event types
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
