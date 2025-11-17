import { NextRequest, NextResponse } from 'next/server';

// Direct payment links with client_reference_id support
const PAYMENT_LINKS: Record<number, string> = {
  1: 'https://buy.stripe.com/8x2aEQ7Dg1A176u1Z3a7C00',   // 1 персонализация - 1 лв
  3: 'https://buy.stripe.com/eVq00c4r4diJ4YmdHLa7C01',   // 3 персонализации - 2 лв
  10: 'https://buy.stripe.com/6oU3cobTw3I9gH4avza7C02', // 10 персонализации - 3 лв
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

    // Get the payment link for the requested customization amount
    const paymentLink = PAYMENT_LINKS[customizations as keyof typeof PAYMENT_LINKS];
    
    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Invalid customization amount' },
        { status: 400 }
      );
    }

    // Append client_reference_id to the payment link
    const urlWithUserId = `${paymentLink}?client_reference_id=${encodeURIComponent(userId)}&prefilled_email=`;

    return NextResponse.json({ url: urlWithUserId });
  } catch (error) {
    console.error('Error creating checkout URL:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
