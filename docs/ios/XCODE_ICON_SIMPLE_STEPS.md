# PetWash Xcode Icon - Simple Steps

The luxury black/gold paw-drop image is the app icon for the iPhone app shell.
It is separate from the PetWash wordmark/logo and separate from Apple Wallet.

Current Xcode project found:

```text
~/Desktop/PetWash/PetWash.xcodeproj
```

Current AppIcon set found:

```text
~/Desktop/PetWash/PetWash/Assets.xcassets/AppIcon.appiconset
```

Preferred icon source:

```text
~/Desktop/PetWash/PetWash/Assets.xcassets/AppIcon.appiconset.backup.20260529-065012/petwashappstoeicon.PNG
```

Install the icon:

```bash
cd ~/Documents/GitHub/petwash-marketplace
./scripts/ios/install-app-icon.sh \
  ~/Desktop/PetWash/PetWash/Assets.xcassets/AppIcon.appiconset.backup.20260529-065012/petwashappstoeicon.PNG \
  ~/Desktop/PetWash/PetWash/Assets.xcassets/AppIcon.appiconset
```

Then open Xcode:

```bash
open ~/Desktop/PetWash/PetWash.xcodeproj
```

Do not change signing, team, bundle ID, payments, SUMIT, bank, or production API settings from this icon step.
