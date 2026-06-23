# PetWash Luxury Icons — drop-in folder

This is where the CEO's **cut-out** luxury icons live. Replace the basic emojis
across the whole app by dropping files here.

## How to add the icons (the "smart cut")

1. **Export each icon as its own file** from the master icon sheet, with a
   **transparent background** (cut tight around the artwork — no white box, so it
   sits cleanly on any colour background).
   - Format: **PNG** (or WEBP). Square. **≥256px** so it stays sharp on big screens
     and Retina phones.
   - Easiest tools: macOS Preview "Instant Alpha" to erase the white, or any
     background-remover, then File → Export as PNG.

2. **Name each file exactly** by its key (lowercase, hyphenated). The full list of
   keys is in `client/src/lib/petIconRegistry.ts`. Examples:

   ```
   dog.png   cat.png   rabbit.png   paw.png   shampoo.png   conditioner.png
   bubbles.png   water-droplet.png   grooming-brush.png   towel.png   treat.png
   sparkle.png   pet-safe.png   gift-box.png   heart.png   bone.png
   self-wash.png   dog-walking.png   pet-sitting.png   ...
   ```

3. **Flip the switch:** set `VITE_PET_ICONS_ENABLED='true'` in the web env.
   Every `<PetIcon name="…">` in the app instantly renders your artwork instead of
   the emoji. Until the flag is on, the app safely shows the emoji fallback, so
   nothing ever looks broken mid-migration.

## Why this approach

- **One source of truth** — swap or restyle an icon in one place, it updates everywhere.
- **No broken UI** — emoji fallback until the asset is present.
- **Sharp on every device** — transparent + `object-contain`, sized by the caller.
- **Matches any background** — transparent cut-outs, never a white square.

## Using an icon in code

```tsx
import { PetIcon } from '@/components/PetIcon';

<PetIcon name="dog" size={28} />
<PetIcon name="shampoo" size={20} className="opacity-90" />
```
