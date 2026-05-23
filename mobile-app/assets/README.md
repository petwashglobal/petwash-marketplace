# Mobile App Assets — required for store submission

Drop the following PNG files into this directory before running `eas build`.
File names must match exactly — `app.json` references them by path.

## Required

| File | Size | Notes |
|---|---|---|
| `icon.png` | 1024 × 1024 | iOS App Store icon. **PNG, no alpha channel, no transparency, no rounded corners** — Apple applies its own mask. Pure white or brand background. |
| `adaptive-icon.png` | 1024 × 1024 | Android adaptive icon foreground. Safe zone is the centre 660 × 660. Background is set to `#ffffff` in `app.json`. |
| `splash.png` | 1284 × 2778 (recommended) | Centered logo on white. `resizeMode: contain` in `app.json`. |
| `favicon.png` | 48 × 48 | Web favicon (only if running Expo web build). |

## Brand guidance (see `petwash-platform` skill §6)

- Pure white background, no muddy off-whites.
- Premium, restrained. Apple / Tesla / Hermès level discipline.
- No cheap startup energy. No clutter. No exaggerated claims.
- Lead with easy + safe. Eco is supporting evidence, not the icon's message.

## App Store screenshot sizes (for the listing, not the binary)

You'll upload these in App Store Connect, not via the build:

- iPhone 6.7" (1290 × 2796) — required, at least 3
- iPhone 6.5" (1242 × 2688 or 1284 × 2778) — required, at least 3
- iPad 12.9" (2048 × 2732) — required if `supportsTablet: true` in `app.json`

## Play Store assets (for the listing)

- App icon 512 × 512
- Feature graphic 1024 × 500
- Phone screenshots: at least 2, between 320 px and 3840 px on each side
