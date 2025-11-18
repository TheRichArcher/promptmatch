# Homebrew 500 Error Fix Summary

## Problem
Homebrew was failing with a 500 error when trying to clone `https://github.com/TheRichArcher/promptmatch.git`. This error typically occurs when:
- The repository is private (GitHub returns 500 instead of 403)
- There's a temporary GitHub issue
- Repository access permissions are misconfigured

## Solution Implemented

### 1. Created Homebrew Formula
Created `Formula/promptmatch.rb` that:
- Uses GitHub archive download (`/archive/refs/heads/main.tar.gz`) instead of git clone
- This method is more reliable and avoids the 500 error
- Properly installs dependencies (node, pnpm)
- Creates a `promptmatch` command to run the dev server

### 2. Created Setup Script
Created `scripts/setup-homebrew-tap.sh` to automate tap repository creation

### 3. Created Documentation
Created `HOMEBREW_SETUP.md` with complete setup instructions

## Quick Fix Options

### Option A: Make Repository Public (Easiest)
If the repository should be publicly accessible:
1. Go to https://github.com/TheRichArcher/promptmatch/settings
2. Scroll to "Danger Zone"
3. Click "Change visibility" → "Make public"

### Option B: Create Proper Tap Repository
1. Create a new GitHub repository: `homebrew-promptmatch`
2. Run: `./scripts/setup-homebrew-tap.sh`
3. Users can then install with:
   ```bash
   brew tap thericharcher/promptmatch
   brew install promptmatch
   ```

### Option C: Install from Local Formula
For immediate testing:
```bash
brew install --build-from-source Formula/promptmatch.rb
```

## Files Created
- `Formula/promptmatch.rb` - Homebrew formula file
- `scripts/setup-homebrew-tap.sh` - Automated tap setup script
- `HOMEBREW_SETUP.md` - Detailed setup instructions
- `FIX_SUMMARY.md` - This file

## Testing
The formula uses archive download which should work even if the repository has access restrictions. The 500 error should be resolved once:
1. The tap repository is created (if using Option B)
2. OR the main repository is made public (if using Option A)
3. OR users install from the local formula (Option C)

## Next Steps
1. Decide if the repository should be public or private
2. Create the `homebrew-promptmatch` tap repository if you want public Homebrew installation
3. Run the setup script to populate the tap
4. Test installation: `brew tap thericharcher/promptmatch && brew install promptmatch`

