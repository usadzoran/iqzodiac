# YouTube search setup

The IQZodiac website is currently published from the `main` branch root on GitHub Pages. GitHub Pages serves the static page but cannot run a protected API route. The repository therefore includes a small Vercel-compatible function at `api/youtube/search.js`, sharing its implementation with the local Node route. Keep the frontend on GitHub Pages; deploy the function to a Vercel project connected to this repository (or deploy the same `api` folder to a compatible Node serverless host).

## Required configuration

1. In Google Cloud Console, create/select a project, enable **YouTube Data API v3**, and create an API key. Restrict the key to YouTube Data API v3. Keep it private.
2. In the Vercel project settings, add `YOUTUBE_API_KEY` as an encrypted environment variable for Production (and Preview/Development if needed). Never add it to `youtube-config.js`, HTML, browser JavaScript, GitHub Pages settings, or a committed `.env` file.
3. Add `YOUTUBE_ALLOWED_ORIGINS=https://usadzoran.github.io` to the Vercel environment. If the site uses a custom domain, include that exact origin as well, comma-separated. Redeploy the function after changing environment variables.
4. After deploying, set the public (non-secret) function URL in `youtube-config.js`:

   ```js
   window.IQZodiacYoutubeConfig = Object.freeze({
     apiBase: 'https://YOUR-VERCEL-PROJECT.vercel.app/api/youtube/search',
   });
   ```

5. Commit and push that public endpoint URL to `main` so GitHub Pages can call the function. The frontend sends only the query and pagination token; the YouTube API key stays on the server.
6. When changing the endpoint in `youtube-config.js`, bump the `youtube-config.js?v=...` query string in `youtube.html` so browsers do not reuse a cached endpoint URL.
7. Before public launch, configure a distributed or platform-level rate limit for `/api/youtube/search` (for example at the Vercel edge or with a shared rate-limit store), keyed to the provider's trusted client IP. The handler also rejects missing/disallowed production origins and applies a best-effort limit of 30 requests per minute per warm instance (tunable with `YOUTUBE_RATE_LIMIT_PER_MINUTE`), but serverless instances do not share that in-memory counter and CORS is not authentication. Its local fallback uses the first `x-forwarded-for` value and is not authoritative unless the hosting proxy overwrites that header.

For local Node testing, set `YOUTUBE_API_KEY` in the shell environment before `npm start`. The local route is `/api/youtube/search`. Do not place the key in a command saved to shell history; use your host's secret/environment-variable interface.

## Quota and playback notes

The API calls `search.list` with `type=video` and 12 results per page. Each page token requires another YouTube API request. Google's current default search quota is 100 `search.list` calls per day, with one quota unit per call; short-lived caching reduces repeated queries. Monitor quota in Google Cloud Console and request a quota increase there if needed.

Search results are real YouTube Data API responses. Playback is handled by YouTube's official IFrame Player. A video owner can disable embedding, and a video may be private, deleted, or unavailable; the page reports the player error and only then offers an optional YouTube link. The application does not bypass those restrictions.

Official references: [Search: list](https://developers.google.com/youtube/v3/docs/search/list), [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost), and [API key restrictions](https://docs.cloud.google.com/docs/authentication/api-keys).
