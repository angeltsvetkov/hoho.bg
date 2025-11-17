import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCustomizationsToUser } from '@/lib/firebase';

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

      console.log('Checkout completed:', {
        sessionId: session.id,
        customerId: session.customer,
        clientReferenceId: session.client_reference_id,
        metadata: session.metadata,
      });

      // Get the user ID from client_reference_id (from payment link) or metadata
      const userId = session.client_reference_id || session.metadata?.userId;
      
      if (!userId) {
        console.error('No userId found in session');
        return NextResponse.json(
          { error: 'No userId in session' },
          { status: 400 }
        );
      }

      // Get line items to determine what was purchased
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      
      console.log('Line items:', JSON.stringify(lineItems.data, null, 2));
      
      let totalCustomizations = 0;
      
      for (const item of lineItems.data) {
        const priceId = item.price?.id;
        const amount = item.amount_total || 0; // Amount in cents
        console.log(`Processing item with price ID: ${priceId}, amount: ${amount}`);
        
        if (priceId && PRICE_TO_CUSTOMIZATIONS[priceId]) {
          const quantity = item.quantity || 1;
          totalCustomizations += PRICE_TO_CUSTOMIZATIONS[priceId] * quantity;
          console.log(`Matched by price ID! Adding ${PRICE_TO_CUSTOMIZATIONS[priceId] * quantity} customizations`);
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
            console.log(`Matched by amount (${amount})! Adding ${customizationsByAmount[amount]} customizations`);
            console.log(`Note: Add price ID "${priceId}" to PRICE_TO_CUSTOMIZATIONS mapping`);
          } else {
            console.warn(`Unknown price ID: ${priceId} and unknown amount: ${amount}`);
          }
        } else {
          console.warn(`Unknown price ID: ${priceId} - Please add this to PRICE_TO_CUSTOMIZATIONS mapping`);
        }
      }

      if (totalCustomizations > 0) {
        // Add customizations to the user's account
        await addCustomizationsToUser(userId, totalCustomizations);
        
        console.log(`Added ${totalCustomizations} customizations to user ${userId}`);
        
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
      
      console.log('Payment succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        metadata: paymentIntent.metadata,
      });

      const userId = paymentIntent.metadata?.userId;
      const customizations = paymentIntent.metadata?.customizations;

      if (userId && customizations) {
        const amount = parseInt(customizations, 10);
        if (!isNaN(amount) && amount > 0) {
          await addCustomizationsToUser(userId, amount);
          
          console.log(`Added ${amount} customizations to user ${userId}`);
          
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
