# IQZodiac — Match & Face Privacy Plan

## Implementation approach

Extend the existing static HTML/JavaScript prototype without replacing its pages or visual system. Add a shared browser data layer (`privacy-core.js`) that exposes repository-shaped methods for profiles, likes, matches, reveal-consent state, and conversations. The current adapter uses `localStorage`; the method boundary is intentionally API-shaped so it can later be replaced by authenticated server calls without changing the UI.

Add `match.html`, `match.css`, and `match.js` as the new Match area. It uses the existing IQZodiac dark aurora, Manrope/DM Mono typography, cyan/lilac/orange palette, and fixed user menu. Match cards expose only protected preview metadata and never place an original face asset URL in the DOM. The demo previews are rendered as protected visual cards; a future upload service must generate/store the protected derivative server-side and keep the original behind authorization.

Extend `messages.html` and `messages.js` with a face reveal consent panel. Each side has an explicit consent flag; the face is revealed only when both flags are true. The prototype includes a clearly labelled demo control to represent the other participant's consent until a real authenticated backend exists.

Extend `signup.js` to persist account/profile metadata only, including a reference placeholder for the original face asset rather than the image bytes. This preserves the current local-only prototype while defining the fields needed for a secure upload service.

## Project structure

- `match.html`: new Match route and accessible card/match UI.
- `match.css`: Match-specific responsive presentation using existing design tokens.
- `match.js`: card navigation, like/skip persistence, mutual-match state, and reveal-safe rendering.
- `privacy-core.js`: shared repository adapter and privacy/reveal rules.
- `messages.html` / `messages.js` / `messages.css`: private conversation reveal-consent UI and state.
- `signup.js`: account metadata persistence boundary.
- `server.js`, `public/manus-routes.json`: route registration for `/match`.
- existing `home.html`, `profile.html`, `discover.html`, `rooms.html`: only navigation links are extended; existing sections remain intact.

## Design direction

Chosen style: **Celestial editorial minimalism**. Probability 0.07.

- **Design movement:** quiet luxury editorial interface with orbital science motifs.
- **Core principles:** privacy-first, spacious hierarchy, restrained glow, and purposeful motion.
- **Color philosophy:** deep night backgrounds make protected imagery feel intentional; cyan signals trust, lilac signals compatibility, and orange signals human warmth.
- **Layout paradigm:** a focused single-card discovery stage with a secondary trust rail, rather than a dense grid.
- **Signature elements:** orbit rings, protected-image veil, and match constellation pulse.
- **Interaction philosophy:** every reveal is an explicit consent action; likes are reversible and immediately visible.
- **Animation:** short lift/fade transitions, a restrained match pulse, and reduced-motion fallbacks.
- **Typography system:** Manrope for readable UI and DM Mono for labels/state metadata.
- **Brand essence:** discover the mind before the face; thoughtful, private, curious. Personality: curious, safe, intimate.
- **Brand voice:** calm, direct, consent-led. Examples: “Notice the person, not the reveal.” / “A face opens only when both people choose it.”
- **Wordmark & logo:** retain the existing IQZ orbit mark.
- **Signature brand color:** the existing cyan `#83e5e8`.

## Backend contract for later wiring

The adapter methods are `getCurrentProfile`, `listCandidates`, `recordLike`, `recordSkip`, `getMatches`, `getRevealState`, `requestReveal`, `setOwnRevealConsent`, `setPartnerRevealConsent` (demo-only), `canRevealFace`, and `getConversation`. A production implementation should replace the local adapter with authenticated endpoints, signed short-lived protected-preview URLs, server-side image redaction, and authorization checks on every original-image request. The browser must never decide reveal eligibility by itself.
