# IQZodiac — Delivery TODO

## Landing page in English
- [x] Display the site name “IQZodiac” in the center of the page as a clear, immediately identifiable text logo.
- [x] Provide a visible “Log In” button leading to the sign-in flow placeholder.
- [x] Provide a visible “Create Account” button leading to the account-creation flow placeholder.
- [x] Keep the layout polished and fully responsive on phone and desktop.

## User profile and privacy controls
- [x] Provide a Profile page with a profile photo, username, and phone number.
- [x] Let the user choose whether their phone number is shown to other people; keep it hidden by default.
- [x] Provide a Gallery for photos and videos.
- [x] Let the user choose whether their gallery is public or hidden; keep it private by default.

## Direct media upload and privacy preview
- [x] Let the user select multiple image and video files directly from the Gallery interface.
- [x] Show an immediate preview tile for each selected image or video with its media type and file size.
- [x] Update the Gallery item count after files are added and provide a clear upload confirmation.
- [x] Explain the current phone and gallery audience state inline: hidden/private by default, or visible/public when enabled.

## Social profile activity
- [x] Show Followers, Following, and Likes counters in the user profile.
- [x] Add interactive Follow back and Like profile actions with updated counters and labels.
- [x] Add a Notifications section with unread count, recent activity, and Mark all as read.
- [x] Persist social interaction states locally and keep the interface responsive on mobile and desktop.

## Home feed after login
- [x] Provide a Home page intended to appear after the user logs in.
- [x] Let users publish a text paragraph, photo, or video from the feed composer.
- [x] Let other users like, comment on, and share feed posts through interactive controls.
- [x] Show a responsive feed with suggested people and trending topics.

## Pinned and persistent comments
- [x] Let the author of a post or Reel pin one top-level comment so it appears first in that content's comment list, and allow the author to unpin or replace it.
- [x] Preserve pinned state in the database for both post comments and Reel comments; only the owner of the matching post or Reel can change it.
- [x] Ensure replies saved in the comments table remain visible after reloading even when their author has no profile row.

## Gallery and reply fixes
- [x] Upload multiple supported photos and videos from the Profile Gallery, store each item's correct media type, and show a photo preview or playable video after upload and reload.
- [x] Show each pending file's media type and size, update counts and upload status, and list only media belonging to the signed-in profile owner.
- [x] Keep replies attached to a valid parent comment on the same Post or Reel, and keep reply controls consistent with the database's supported depth.
- [x] Save, reload, and display text and image/video/audio attachments for replies on Posts and Reels, with correct media permissions and reply notifications.
- [x] Allow reply authors to edit or delete their own replies without corrupting parent threads or comment counts.

## AI assistant placeholder
- [x] Show a small robot icon and an “AI assistant — coming soon” placeholder above the login and account creation actions.
- [x] Keep the placeholder visual-only with no assistant connection or interaction yet.

## Post-signup AI onboarding assistant
- [x] Redirect a newly created account directly to the IQZodiac onboarding assistant after successful signup validation.
- [x] Ask discovery questions one at a time, accept suggested or written answers, and continue through interests and birth date.
- [x] Persist onboarding status, answers, interests, and birth date under the current IQZodiac profile for the rest of the prototype experience.
- [x] Restore the selected personality element after reload and remove stale discovery answers when the member starts over.
- [x] Add a scoped conversational assistant for site help, YouTube search, and film/character search without admin or private-data permissions.
- [x] Create `assistant_conversation_logs` with user-scoped RLS and deploy the JWT-verified `assistant-chat` Supabase Edge Function.
- [ ] Add the server-only OpenAI, YouTube, and optional TMDB secrets in Supabase Edge Function settings, then run live assistant searches.

## Voice-guided onboarding assistant
- [x] Automatically read the active onboarding prompt aloud in the selected Arabic or English language at startup and after each answer when browser speech is available.
- [x] Provide explicit voice enable/mute and repeat controls; use a calm, slightly slower delivery and prefer a matching warm browser voice when available.
- [x] Keep speech on-device, disclose that the assistant is a local demo, and disable controls gracefully when browser speech is unavailable.
- [x] Keep the signup welcome message temporary so it does not reappear after reloading saved onboarding progress.

## Animated onboarding assistant avatar
- [x] Create a photorealistic portrait of a fictional adult woman as the IQZodiac assistant avatar.
- [x] Keep assistant questions spoken rather than shown in chat bubbles; display only the user's chosen or written answers.
- [x] Align the mouth-motion video timeline with real browser speech boundary elapsed times when supported; stop it when speech ends or is muted.
- [x] Use a large, unframed seated portrait as the base, with the silent mouth-motion clip overlaid only while speech is active.
- [x] Use an optimized WebP portrait and serve WebP/MP4 with the correct MIME types.

## Account creation and identity check
- [x] Provide a Create Account page with first name, last name, age, email address, and phone number fields.
- [x] Require the user to be at least 18 years old.
- [x] Provide separate image capture/upload controls for a government ID photo and a face photo.
- [x] Show local previews and require confirmation that the photos belong to the user.
- [x] Keep the prototype local-only: no personal data or identity photos are uploaded yet.

## Discover and fixed user menu
- [x] Add a distinct Discover hub for people, rooms, and new paths around IQZodiac.
- [x] Add a fixed bottom user menu on Home, Profile, and Discover.
- [x] Keep Home, Discover, Rooms, and Profile reachable from the shared menu.

## Shared menu language
- [x] Keep the menu language consistent across Home, Profile, and Discover instead of changing with the page.
- [x] Automatically choose Arabic or English from the browser locale on first visit.
- [x] Provide a manual EN / العربية toggle and persist the selected language between pages.

## Audio rooms
- [x] Add a “Audio rooms / غرف صوتية” section to the fixed user menu.
- [x] Provide the supplied NEBULA room interface with host, speakers, listeners, talk requests, room chat, and room controls.
- [x] Keep room controls as a front-end prototype only: hand raising, microphone/sound state, chat messages, and leave-room state are local and not connected to real audio or a server.
- [x] Show rooms as closed directory cards by default with each room name and visitor count visible.
- [x] Add a second experimental room card, “نبض المدينة”, with its own visitor count.
- [x] Open the selected room only after the user presses its join button, and return to the card directory when leaving.

## Face privacy and Match
- [x] Add a Match section to the existing navigation and route system without removing existing sections.
- [x] Show protected profile previews with personality information and interests, while keeping original face asset references out of the browser-facing candidate data.
- [x] Persist likes, skips, mutual matches, reveal requests, consent state, and conversation data behind a shared repository-shaped adapter that can later be replaced by authenticated database/API calls.
- [x] Keep faces hidden in private conversations until both sides have explicit consent; expose the second-party control only as a clearly labelled demo bridge until a real backend exists.
- [x] Persist account metadata from signup with a protected-preview/original-asset reference boundary rather than storing original image bytes in the UI layer.

## New site navigation and daily briefing
- [x] Replace the old user menu with a unified site navigation that keeps Home, Match, Discover, Rooms, and Profile reachable and adds Daily.
- [x] Add a Daily page with live weather and news panels that follows the current IQZodiac visual language and supports English/Arabic menu labels.
- [x] Fetch current news titles, summaries, and image thumbnails through a JWT-verified Supabase Edge Function so the feed works on GitHub Pages; cache fetched stories in the existing news tables for fallback.
- [x] Mark the daily feed as `no-store`, refresh it on demand, and reload the page when the calendar day changes so the previous day’s items leave the view.

## User roles, compatibility matching, and VIP access
- [x] Keep a shared account-access interface; local browser storage never grants VIP access.
- [x] Store zodiac sign, personality element, interests, and personality-answer placeholders as Match inputs in the existing profile/account model.
- [x] Rank Match candidates by compatibility score using shared interests, zodiac alignment, and personality-element compatibility instead of presenting a fixed random order.
- [x] Add a VIP orbit and VIP Live scaffold; checkout, streaming, chat, and gifting are visibly disabled until real providers are connected.
- [ ] Connect signup/login to Supabase Auth and grant VIP roles only through an authorized server-side process.
- [ ] Select and integrate a real WebRTC/HLS provider, signed playback, moderation, and realtime chat.
- [ ] Connect verified payment webhooks and idempotent server-side coin/gift ledger operations.
- [ ] Connect a payout provider, financial policy, and server-side withdrawal review.
- [ ] Set the deployed backend URL in `public/supabase-public-config.json` and configure the exact allowed website origins.

## YouTube search and in-site playback
- [x] Add a responsive YouTube page and navigation item without removing or rebuilding any existing site section.
- [x] Accept video, song, and channel-name search terms and request real video results from YouTube Data API v3 through a protected server-side handler; never expose the API key in frontend code.
- [x] Show actual API thumbnails, titles, channel names, and publication dates where available, with loading, empty, network, API-configuration, and quota states.
- [x] Load additional results from `nextPageToken` and preserve the query/results when opening a player and returning to search.
- [x] Use the official YouTube IFrame Player and show an optional external link only when YouTube reports that a video cannot be embedded or is unavailable.
- [x] Preserve GitHub Pages for the frontend and add a minimal Vercel-compatible backend function plus local Node route.
- [ ] Configure the server-side `YOUTUBE_API_KEY` and public backend URL, then verify a live search against the user's Google Cloud project.
- [ ] Configure a shared or platform-level rate limit for the public serverless endpoint before launch; the included in-memory limit is per warm instance only.

## Match refresh, gift store, and wallet
- [x] Rebuilt Match layout from the broken compressed stylesheet into a structured responsive discovery experience.
- [x] Integrated the gift catalog into the Profile wallet card beside the coin balance; the old gift-store URL redirects to Profile, and no demo gifts, prices, recipients, or local coin deductions are shown.
- [x] Added the wallet status page; no local balance or transaction is presented as real, and purchases/payouts remain disabled.

## Supabase VIP database scaffold
- [x] Inspect the existing Supabase schema before changes and apply an additive migration only; existing tables were not modified.
- [x] Create VIP roles, live-session, wallet, ledger, gift, earnings, payout, chat, report, settings, and audit structures with RLS enabled and forced.
- [x] Add only explicit creator/platform revenue-rule and disabled feature-status rows; wallets, sessions, purchases, gifts, and transactions remain empty.
- [x] Connect the website to the public feature-status row using only the Supabase publishable key; never place the management token or service-role key in frontend code.
- [x] Make the live API fail closed: Supabase Auth and a server-verified VIP role are required; no local role can unlock it.
- [x] Deploy the assistant backend as a Supabase Edge Function with JWT verification; VIP backend and account production wiring remain separate.
- [ ] Integrate real streaming, realtime chat, payments, and payouts before enabling any feature flags.
- [x] Kept PayPal/Visa/Mastercard actions as server-side integration contracts only; no card data or real money is collected in the prototype.

## USD creator earnings and safe wallet reporting
- [x] Keep cash earnings in a dedicated USD ledger and balance view; do not convert gift Coins or coin-denominated revenue into USD implicitly.
- [x] Record creator USD earnings only from verified cash revenue events, atomically with the ledger row, share snapshot, and idempotency check; only a trusted service-role caller can invoke the function, and feature-readiness flags must be enabled.
- [x] Reserve withdrawal amounts atomically with per-user serialization, available-balance checks, and idempotency; reject the request unless payouts and a payout provider are marked ready.
- [x] Show available, lifetime, pending, reserved, and paid USD totals and recent USD entries separately from coin balance/history.
- [x] Leave payment/payout provider API URLs, secrets, and credentials unset; keep coin purchases, gift sending, and payouts disabled until real providers and server-side flows are configured.
- [ ] Integrate and verify payment and payout providers, moderation/review, and the production financial policy before enabling any feature flags.
