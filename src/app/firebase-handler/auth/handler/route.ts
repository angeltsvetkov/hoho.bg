const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function GET() {
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
    return new Response('Missing Firebase configuration', { status: 500 });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Signing you in…</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 2rem; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8fafc; color: #0f172a; }
    .card { text-align: center; max-width: 420px; }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
    p { margin: 0.25rem 0; color: #475569; }
  </style>
  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
  <script>
    const config = ${JSON.stringify(firebaseConfig)};
    try {
      firebase.initializeApp(config);
      
      // Explicitly call getRedirectResult to ensure processing happens
      firebase.auth().getRedirectResult().then((result) => {
        // If we are here, the SDK should have handled the redirect.
        // If it didn't redirect automatically, we might need to help it.
        // But usually, for the handler page, the SDK redirects internally before resolving this promise.
      }).catch((error) => {
        console.error('Auth handler error', error);
        document.getElementById('status').innerText = 'Error: ' + error.message;
        document.getElementById('details').innerText = JSON.stringify(error, null, 2);
        
        // Surface the error so the parent page can read it from the URL if needed
        const params = new URLSearchParams({ error: error.code || 'unknown', message: error.message || 'Auth error' });
        // Don't redirect immediately on error so user can see it
        // window.location.replace('/?authError=' + params.toString());
      });
    } catch (e) {
      console.error('Initialization error', e);
      document.getElementById('status').innerText = 'Init Error: ' + e.message;
    }
  </script>
</head>
<body>
  <div class="card">
    <h1>Свързваме ви в Google…</h1>
    <p id="status">Моля, изчакайте няколко секунди.</p>
    <pre id="details" style="text-align: left; background: #eee; padding: 10px; border-radius: 4px; overflow: auto; display: none;"></pre>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
