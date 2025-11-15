# Firebase Setup Guide

This project uses Firebase for backend services. Follow these steps to set up Firebase:

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "hoho-bg")
4. Enable Google Analytics (optional)
5. Click "Create project"

## 2. Register Your Web App

1. In your Firebase project, click the web icon (</>)
2. Register app with a nickname (e.g., "Christmas Countdown")
3. Enable Firebase Hosting (optional)
4. Copy the Firebase configuration

## 3. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Replace the Firebase configuration values with your own from the Firebase Console:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

## 4. Enable Firebase Services

In the Firebase Console, enable the services you need:

### Firestore Database
1. Go to "Build" → "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode" or "Test mode"
4. Select a location (europe-west for Bulgaria)

### Storage
1. Go to "Build" → "Storage"
2. Click "Get started"
3. Set up security rules

### Analytics (Optional)
1. Go to "Build" → "Analytics"
2. Enable Google Analytics

## 5. Deploy to Vercel

When deploying to Vercel, add all environment variables in:
**Project Settings** → **Environment Variables**

## Available Firebase Services

The app has the following Firebase services initialized:

- **Firestore** (`db`) - NoSQL database
- **Storage** (`storage`) - File storage
- **Analytics** (`analytics`) - Analytics tracking (client-side only)

## Usage Example

```typescript
import { db, storage, analytics } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

// Add a document to Firestore
await addDoc(collection(db, 'messages'), {
  text: 'Хо хо хо!',
  createdAt: new Date(),
});
```
