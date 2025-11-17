# Google Analytics Implementation

This project uses Firebase Analytics (Google Analytics 4) with full GDPR compliance and cookie consent management.

## Features

- ✅ Cookie consent banner with two options:
  - **Accept with Analytics**: Enables Google Analytics tracking
  - **Technical cookies only**: Uses only essential cookies
- ✅ Consent stored in localStorage
- ✅ Analytics only loaded and tracking only happens with user consent
- ✅ Full event tracking for user interactions

## Tracked Events

### Page Views
- Home page (`/`)
- Share pages (`/share/[id]`)

### User Interactions
- **Audio Play**: Tracks when users play audio (default or custom messages)
  - `message_type`: 'default' | 'custom'
  - `days_remaining`: number (for default messages)

- **Message Customization**: Tracks when users create custom messages
  - `characters_used`: number

- **Share Actions**: Tracks sharing via different methods
  - `method`: 'facebook' | 'native' | 'copy'

- **Purchase Intent**: Tracks when users click on purchase options
  - `package_size`: number of personalizations
  - `price`: package price in BGN

## Environment Variables

Make sure you have the following Firebase environment variables set:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

The `MEASUREMENT_ID` is required for Google Analytics to work.

## Files

- `/src/lib/analytics.ts` - Analytics utility functions and event tracking
- `/src/lib/firebase.ts` - Firebase initialization including Analytics
- `/src/app/page.tsx` - Main page with cookie banner and event tracking
- `/src/app/share/[id]/page.tsx` - Share page with event tracking

## Cookie Consent Flow

1. User visits the site
2. Cookie banner appears (if not previously accepted)
3. User chooses:
   - "Приемам с Analytics" → Analytics enabled, all events tracked
   - "Само технически бисквитки" → Analytics disabled, no tracking
4. Choice is saved in localStorage as `cookiesAccepted` and `analyticsConsent`
5. Analytics consent is set in Firebase Analytics

## Viewing Analytics Data

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Analytics → Events
4. View real-time and historical data

## Privacy Compliance

- Cookie consent is required before any analytics tracking
- Users can opt-out by choosing "Technical cookies only"
- Full transparency via Cookie Policy page (`/cookies`)
- Compliant with GDPR requirements
