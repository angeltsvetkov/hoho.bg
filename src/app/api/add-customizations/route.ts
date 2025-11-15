import { NextRequest, NextResponse } from 'next/server';
import { addCustomizationsToUser } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, secret } = body;

    // Validate required fields
    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and amount' },
        { status: 400 }
      );
    }

    // Validate the secret key to prevent unauthorized access
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret || secret !== webhookSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate amount is a positive number
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Add customizations to the user
    await addCustomizationsToUser(userId, amount);

    return NextResponse.json({
      success: true,
      message: `Successfully added ${amount} customizations to user ${userId}`,
    });
  } catch (error) {
    console.error('Error adding customizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
