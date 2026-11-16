# LiveKit setup

The site keeps LiveKit credentials server-side. Never commit `LIVEKIT_API_SECRET` or place it in browser JavaScript.

Set these server environment variables on the backend that serves `/api/livekit/token`:

```text
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
LIVEKIT_ALLOWED_ORIGINS=https://usadzoran.github.io
```

Deploy the repository's `api/livekit/token.js` to the same Vercel/serverless project used by the site. Then set the public endpoint in `livekit-config.js`:

```js
window.IQZodiacLiveKitConfig = Object.freeze({
  tokenApiBase: 'https://YOUR-BACKEND.example.com',
});
```

The endpoint verifies the Supabase access token, checks the requested room through Supabase RLS, and signs a short-lived LiveKit JWT. Audio room membership is created through `iqzodiac_join_audio_room` before the token is requested. Rotate any LiveKit secret that has been exposed outside the server secret manager.
