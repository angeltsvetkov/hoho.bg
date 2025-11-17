import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCustomizationsToUser } from '@/lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Mapping of Stripe price IDs to customization amounts
const PRICE_TO_CUSTOMIZATIONS: Record<string, number> = {
  // Replace these with your actual Stripe Price IDs from your payment links
  'price_1': 1,   // 1 персонализация за 1 лв
  'price_3': 3,   // 3 персонализации за 2 лв
  'price_10': 10, // 10 персонализации за 3 лв
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
        metadata: session.metadata,
      });

      // Get the user ID from metadata (you'll need to pass this when creating the payment link)
      const userId = session.metadata?.userId;
      
      if (!userId) {
        console.error('No userId found in session metadata');
        return NextResponse.json(
          { error: 'No userId in metadata' },
          { status: 400 }
        );
      }

      // Get line items to determine what was purchased
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      
      let totalCustomizations = 0;
      
      for (const item of lineItems.data) {
        const priceId = item.price?.id;
        if (priceId && PRICE_TO_CUSTOMIZATIONS[priceId]) {
          const quantity = item.quantity || 1;
          totalCustomizations += PRICE_TO_CUSTOMIZATIONS[priceId] * quantity;
        } else {
          console.warn(`Unknown price ID: ${priceId}`);
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
