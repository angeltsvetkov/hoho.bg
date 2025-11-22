# WaveSpeedAI Diagnosis and Setup

## Issue Found

The WaveSpeedAI API is returning a 500 error. Based on the quick response time (83ms), this is likely because the API key is not configured.

## Fix: Add Your API Key

1. **Get your API key:**
   - Visit https://wavespeed.ai/accesskey
   - Sign up or log in
   - Copy your API key

2. **Add to `.env.local`:**

Open or create `/Users/atsvetkov/Documents/Projects/hoho.bg/.env.local` and add:

```bash
WAVESPEED_API_KEY=your_actual_api_key_here
```

3. **Restart the dev server:**
```bash
# In terminal, press Ctrl+C to stop
# Then run:
npm run dev
```

## Testing

After adding the API key and restarting:

1. Open http://localhost:3000
2. Click "Персонализирай"
3. Enter a custom message
4. Click "Генерирай"
5. Check the server console - you should see:
   ```
   🎬 Starting WaveSpeedAI lip sync generation...
   ✅ Santa image uploaded: https://...
   ✅ Audio URL: https://...
   ✅ Task submitted, requestId: ...
   ⏳ Polling for completion...
   ```

## Common Issues

**Still getting 500 error?**
- Make sure `.env.local` is in the project root
- Verify no typos in `WAVESPEED_API_KEY`
- Restart the dev server completely

**API key configured but still failing?**
- Check if you have credits in your WaveSpeedAI account
- Verify the API key hasn't expired
- Check browser console for detailed error messages
