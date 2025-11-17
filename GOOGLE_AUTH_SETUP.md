# Google Authentication Setup

## Overview
The app now supports Google Sign-In to reward new users with 3 free personalizations.

## Implementation Details

### Frontend Changes
1. **New Functions in `src/lib/firebase.ts`:**
   - `isAnonymousUser()`: Checks if current user is anonymous
   - `signInWithGoogle()`: Handles Google sign-in and awards 3 free customizations

2. **UI Updates in `src/app/page.tsx`:**
   - Added "Log in to get 3 personalizations" button in purchase modal
   - Only shown to anonymous users
   - Green gradient with "FREE!" badge to attract attention
   - Positioned above paid options

### Firebase Configuration Required

To enable Google authentication, you need to configure it in the Firebase Console:

1. **Go to Firebase Console:**
   - Open https://console.firebase.google.com/
   - Select your project

2. **Enable Google Sign-In:**
   - Navigate to "Authentication" → "Sign-in method"
   - Click on "Google" in the providers list
   - Toggle "Enable"
   - Set your support email
   - Click "Save"

3. **Configure Authorized Domains:**
   - In Authentication → Settings → Authorized domains
   - Add your domain: `hoho.bg`
   - `localhost` is already authorized for testing

4. **Test Locally:**
   ```bash
   npm run dev
   ```
   - Open the purchase modal
   - Click "Влез и вземи 3 персонализации"
   - Sign in with Google
   - Check that you receive 3 free customizations

### User Flow

1. **Anonymous User:**
   - Visits site → automatically signed in anonymously
   - Opens purchase modal → sees "Log in to get 3 personalizations" option
   - Clicks button → Google sign-in popup appears
   - Signs in → receives 3 free customizations
   - Success alert: "🎉 Добре дошли! Получихте 3 безплатни персонализации!"

2. **Returning Google User:**
   - Visits site → automatically signed in with Google account
   - Purchase modal does NOT show free login option (already a Google user)
   - Shows only paid options

### Database Structure

When a user signs in with Google:
```javascript
{
  customizationsUsed: 0,
  customizationsAllowed: 3,
  createdAt: Date,
  isGoogleUser: true
}
```

### Error Handling

- If sign-in fails: Alert "Неуспешен вход. Моля, опитайте отново."
- Error logged to console for debugging
- Modal closes before sign-in attempt for better UX

### Security Notes

- Only new Google users receive 3 free customizations
- Existing Google users don't get additional free customizations
- Anonymous users can only sign in once per device (unless they clear browser data)
- All authentication handled by Firebase Authentication

## Testing Checklist

- [ ] Enable Google Sign-In in Firebase Console
- [ ] Test sign-in flow with new Google account
- [ ] Verify 3 customizations are added
- [ ] Confirm modal doesn't show login option after signing in
- [ ] Test error handling (e.g., close popup without signing in)
- [ ] Verify analytics tracking (if implemented)

## Future Enhancements

- Link anonymous customizations to Google account when signing in
- Add Facebook/Apple sign-in options
- Implement referral system for additional free customizations
- Email verification for additional security
