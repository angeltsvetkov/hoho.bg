# 🔒 Security & Privacy Guidelines

## Files That Should NEVER Be Committed

### Environment Variables
- ✅ `.env.local` - Contains all secrets (already in .gitignore)
- ✅ `.env.production` - Production secrets
- ✅ `.env` - Any environment files

### Stripe Documentation (Contains Payment Links)
- ✅ `STRIPE_INTEGRATION.md` - May contain actual configuration
- ✅ `STRIPE_WEBHOOK_SETUP.md` - Contains payment link examples
- ✅ `STRIPE_IMPLEMENTATION_SUMMARY.md` - Implementation details
- ✅ `scripts/get-stripe-price-ids.sh` - Contains payment links
- ✅ `stripe-config.local.sh` - Local stripe configuration

All of these are now in `.gitignore`.

## What's Safe to Commit

### API Routes (No Secrets)
- ✅ `src/app/api/stripe-webhook/route.ts` - Only references env variables
- ✅ `src/app/api/create-checkout/route.ts` - Only references env variables
- ✅ Frontend code that calls these APIs

These files are safe because they:
- Use `process.env.VARIABLE_NAME` instead of hardcoded values
- Don't expose actual keys, tokens, or payment links
- Use placeholder values like `'price_1'` that need to be configured

### Documentation Templates
- ✅ `stripe-config.example.sh` - Template with placeholders
- ✅ `.env.example` - Template with no actual values
- ✅ `README.md` - Public documentation

## Current Security Status

### ✅ Protected
- Environment variables (`.env.local`)
- Stripe secret keys
- Stripe webhook secrets
- Firebase configuration
- ElevenLabs API key
- Payment links

### ⚠️ Public (Intentionally)
- API route code (no secrets)
- Frontend code
- Public documentation
- Configuration templates

## Sensitive Data Locations

### In `.env.local` (Protected)
```bash
STRIPE_SECRET_KEY=sk_live_...          # NEVER commit
STRIPE_WEBHOOK_SECRET=whsec_...        # NEVER commit
ELEVENLABS_API_KEY=sk_...              # NEVER commit
NEXT_PUBLIC_FIREBASE_API_KEY=...       # Safe to commit (public)
```

### In Code (Safe)
```typescript
// ✅ Safe - uses environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ✅ Safe - placeholder that needs configuration
const PRICE_IDS = {
  1: 'price_1',   // Replace with actual
};

// ❌ NEVER do this
const stripe = new Stripe('sk_live_actual_key_here');
```

## Before Pushing to GitHub

### 1. Check for Secrets
```bash
# Search for potential secrets
git diff | grep -E "(sk_|whsec_|price_[a-zA-Z0-9]{20,})"

# Make sure .env.local is not staged
git status | grep .env
```

### 2. Verify .gitignore
```bash
# Make sure gitignore is working
git check-ignore .env.local
git check-ignore STRIPE_INTEGRATION.md
git check-ignore scripts/get-stripe-price-ids.sh
```

Should output the filenames if they're properly ignored.

### 3. Check Staged Files
```bash
# Review what you're about to commit
git status
git diff --cached
```

## If You Accidentally Committed Secrets

### 1. Don't Push Yet
If you haven't pushed to GitHub, simply:
```bash
git reset HEAD~1  # Undo last commit
```

### 2. Already Pushed
If secrets were pushed to GitHub:
1. **Immediately revoke** the exposed keys in Stripe/Firebase/ElevenLabs
2. Generate new keys
3. Update `.env.local` with new keys
4. Consider the repository compromised
5. Use `git filter-branch` or BFG Repo-Cleaner to remove from history
6. Force push (⚠️ dangerous for team repos)

### 3. Stripe Specific
If payment links were exposed:
- They're public-facing anyway (users see them when purchasing)
- But webhook secrets and secret keys must be rotated immediately

## Best Practices

1. **Never hardcode secrets** - Always use environment variables
2. **Use .env.example** - Commit templates, not actual values
3. **Review before commit** - Check `git diff` before committing
4. **Use .gitignore** - Add sensitive files immediately
5. **Rotate keys regularly** - Change API keys periodically
6. **Limit access** - Only give team members keys they need
7. **Use test keys** - Use Stripe test mode for development

## Current Configuration Required

To run this project, you need to create `.env.local` with:

```bash
# Firebase (some are public, some are secrets)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Secrets (NEVER commit these)
ELEVENLABS_API_KEY=sk_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_BASE_URL=https://hoho.bg
```

Then update the code files with your actual Stripe Price IDs.

## Monitoring

- Review GitHub security alerts regularly
- Check for exposed secrets: https://github.com/settings/security_analysis
- Use git-secrets or similar tools to prevent commits with secrets
- Enable GitHub secret scanning for your repository

---

✅ **Your secrets are now protected!**
