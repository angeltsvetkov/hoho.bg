import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Map price IDs to your Stripe payment link prices
// TODO: Replace these with your actual Stripe Price IDs
const PRICE_IDS = {
  1: 'price_1',   // 1 персонализация - 1 лв
  3: 'price_3',   // 3 персонализации - 2 лв
  10: 'price_10', // 10 персонализации - 3 лв
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customizations, userId } = body;

    if (!customizations || !userId) {
      return NextResponse.json(
        { error: 'Missing customizations or userId' },
        { status: 400 }
      );
    }

    // Get the price ID for the requested customization amount
    const priceId = PRICE_IDS[customizations as keyof typeof PRICE_IDS];
    
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid customization amount' },
        { status: 400 }
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/?success=true&customizations=${customizations}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/?canceled=true`,
      metadata: {
        userId,
        customizations: customizations.toString(),
      },
      client_reference_id: userId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
