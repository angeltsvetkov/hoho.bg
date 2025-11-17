import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // For webhook routes, don't redirect - just pass through
  if (request.nextUrl.pathname === '/api/stripe-webhook') {
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/stripe-webhook',
};
