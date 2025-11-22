# WaveSpeedAI Setup Guide

## 1. Get Your API Key

1. Visit https://wavespeed.ai/accesskey
2. Sign up or log in
3. Copy your API key

## 2. Add API Key to Environment

Create or edit `.env.local` in your project root:

```bash
# WaveSpeedAI API Key
WAVESPEED_API_KEY=your_api_key_here

# (Keep your other environment variables)
```

## 3. Restart the Development Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## 4. Test the Integration

1. Open http://localhost:3000
2. Click on the "Персонализирай" button
3. Enter a custom message
4. Click "Генерирай"
5. Wait ~30 seconds for video generation
6. Watch Santa speak with realistic lip sync!

## What Happens

1. ✅ Generate audio with ElevenLabs (existing)
2. ✅ Upload audio to Firebase
3. ✅ Upload santa-talking.svg to Firebase
4. ✅ Call WaveSpeedAI API to generate lip-synced video
5. ✅ Poll for completion (~10-30 seconds)
6. ✅ Play generated video

## Fallback Behavior

If WaveSpeedAI fails for any reason:
- **Without API key**: Falls back to PixiJS lip sync (displacement filter)
- **API error**: Falls back to PixiJS lip sync
- **Timeout**: Falls back to PixiJS lip sync

The user always gets *some* form of lip sync!

## Cost Information

- **480p**: ~$0.15-0.30 per custom message (5-10s videos)
- Minimum charge: 5 seconds
- Generation time: 10-30 seconds

## Troubleshooting

**"API key not configured" error:**
- Make sure you added `WAVESPEED_API_KEY` to `.env.local`
- Restart the dev server after adding the key

**Video generation timeout:**
- Normal for longer messages
- Will fall back to PixiJS lip sync automatically

**Console shows video errors:**
- Check the API key is correct
- Verify you have credits in your WaveSpeedAI account
- Check browser console for detailed error messages
