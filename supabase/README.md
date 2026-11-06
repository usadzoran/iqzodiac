# IQZodiac VIP / Live safe scaffold

## Current state

The additive migration `migrations/20261025124200_vip_live_wallet_scaffold.sql` has been applied to the existing Supabase project. The site reads only the public `vip_feature_status` row using the publishable key in `../public/supabase-public-config.json`. The row reports schema `vip_scaffold_v1`; live streaming, coin purchases, gift sending, and payouts are all disabled.

The migration does not seed users, wallets, coin packages, gifts, payment orders, ledger entries, sessions, messages, viewers, or transactions. It adds versionable VIP roles, live-session and moderation tables, wallet/payment/gift/earnings/payout ledgers, audit/settings structures, and row-level security. The browser has no write policy to financial tables. The initial 90/10 creator/platform row is a configuration rule only; it does not calculate, collect, or pay money.

The signup flow is still a local prototype. It does not create a Supabase Auth session, so no local profile role can unlock VIP. The Vercel-compatible `/api/vip/live` endpoint requires a verified Supabase Auth bearer token and a database-verified VIP/admin role, then fails closed while no real streaming provider is integrated.

## Deployment steps still required

1. Deploy this repository to Vercel so `api/vip/live.js` is available as a serverless function. The local `server.js` also exposes the route for development.
2. Set `apiBaseUrl` in `../public/supabase-public-config.json` to the deployed Vercel origin, for example `https://your-project.vercel.app` (origin only, without `/api/vip/live`).
3. In the Vercel project, set `IQZODIAC_ALLOWED_ORIGINS` to a comma-separated allowlist containing the actual GitHub Pages origin and any verified custom site origin. Redeploy after changing environment variables.
4. Integrate Supabase Auth into signup/login and assign VIP roles only through a trusted administrative workflow. The existing local prototype cannot provide this session.
5. Select and integrate a real WebRTC/HLS provider, signed playback, realtime chat/moderation, payment provider plus verified webhooks, and payout provider before enabling any feature flag.

Never place a Supabase Management API token, secret key, or `service_role` key in this repository, browser code, public config, or client storage. The publishable key is public by design and is restricted by RLS. Keep all feature flags false until their complete server-side workflows have been implemented and tested.

## Separate creator USD ledger and guarded RPCs
The source migration `migrations/20261106120232_wallet_financial_schema.sql` mirrors the additive financial objects currently present in the connected Supabase project, and `migrations/20261106122731_creator_usd_atomic_workflows.sql` adds a security-invoker balance view plus guarded RPCs. Creator USD entries are written only from verified cash revenue events; coin gifts remain coin-only and are never converted implicitly. Revenue posting is service-role-only and requires signature verification plus the relevant provider-readiness switches. Withdrawal requests reserve available USD atomically with per-user locking and idempotency, but fail closed unless payouts and payout-provider readiness are explicitly enabled. No provider API URL, secret, payment key, or payout credential is configured in this repository. Coin purchases, gift sending, and payouts remain disabled; the wallet shows USD balances and cash ledger rows separately from coin balances and coin history.
