# Pearly Visual Redesign — Design Doc

**Date:** 2026-07-09
**Goal:** Give Pearly a distinctive, friendly & playful visual identity — a proper landing page plus a polished chat screen — so the site reads as a designed product suitable for a portfolio/college application.

## Direction

- **Aesthetic:** friendly & playful. Warm whites, sky blue, mint, and a coral accent in light mode; deep navy (keeping the existing dark-mode gradients) in dark mode. Generous rounded corners. Nunito (loaded via `next/font`) as the rounded display font for headings; keep the current body font.
- **Execution:** hand-crafted Tailwind/CSS with inline SVG doodles and CSS-only animations. No new runtime dependencies. Existing `public/pearly.jpg` mascot is the centerpiece.

## Site structure

- `/` — new landing page (`app/page.tsx` rewritten).
- `/chat` — the existing chat interface moves here (`app/chat/page.tsx`).
- All existing functionality (voice input/output, 12+ languages, Supabase auth, saved chat history, dark mode) is preserved unchanged.

## Landing page (top to bottom)

1. **Hero** — Pearly avatar with a gentle floating animation; headline "Meet Pearly — your friendly dental health guide"; one-line subhead; large rounded **Chat with Pearly** button linking to `/chat`. Background: soft sky-blue→mint gradient with slow-drifting sparkle and tiny-tooth SVG doodles (CSS keyframe animations, `prefers-reduced-motion` respected).
2. **Feature cards** — 4 rounded cards with playful icons: ask anything about dental health · voice conversation · 12+ languages · saved conversations. Slight bounce/lift on hover.
3. **Example questions strip** — existing suggested topics rendered as colorful pill buttons; clicking navigates to `/chat?q=<prompt>` and the chat auto-sends that question.
4. **Trust & safety note** — short section: Pearly is educational, not diagnostic; see a real dentist for medical concerns.
5. **Footer** — "Built by Will Ward" + GitHub repo link.

## Chat screen refresh

1. **Empty state** — Pearly avatar with a small bob animation and a speech bubble greeting ("Hi! I'm Pearly 🦷 What can I help you with today?"), suggested-topic pills below.
2. **Message bubbles** — Pearly replies in soft mint/blue bubbles with her small avatar alongside; user messages in the accent color. Larger radii, improved spacing/line-height for readability.
3. **Typing indicator** — three bouncing dots in a bubble beside Pearly's avatar while a response streams in.
4. **Header cleanup** — group language selector, theme toggle, and logout into a single settings popover; keep mic, volume, new chat, and history as visible icons.
5. **Shared design language** — same fonts, palette, and radii as the landing page.

## Code structure

- `components/chat-interface.tsx` (currently ~900 lines) is split: sidebar (history) and the new settings popover move into their own components under `components/`. Behavior is unchanged — this is a re-skin plus extraction.
- Landing page lives in `app/page.tsx` with any purely-presentational pieces (doodle SVGs, feature cards) as local components or a `components/landing/` folder.

## Error handling

No new data flows or APIs. The `?q=` query param on `/chat` must handle absent/empty values (normal load) and URL-encoded text. Reduced-motion users get static (non-animated) decorations.

## Testing / verification

Run the app locally and screenshot both pages in light and dark mode at mobile (~390px) and desktop widths. Verify: landing CTA reaches chat; topic pill pre-loads and sends its question; voice, language switcher, login, history save/restore, and dark-mode toggle all still work.
