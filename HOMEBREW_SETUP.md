# Homebrew Tap Setup for PromptMatch

## The Problem

Homebrew was getting a 500 error when trying to clone the repository via HTTPS. This typically happens when:
- The repository is private (GitHub returns 500 instead of 403 to avoid leaking info)
- There's a temporary GitHub issue
- Repository access permissions are misconfigured

## The Solution

The formula has been updated to use GitHub's archive download endpoint instead of git clone, which is more reliable and works even with some access restrictions.

## Setting Up the Homebrew Tap

To make this installable via Homebrew, you need to create a tap repository:

### Option 1: Create a Tap Repository (Recommended)

1. Create a new repository on GitHub: `homebrew-promptmatch`
   ```bash
   # On GitHub, create a new repository named "homebrew-promptmatch"
   ```

2. Clone it locally:
   ```bash
   git clone https://github.com/TheRichArcher/homebrew-promptmatch.git
   cd homebrew-promptmatch
   ```

3. Copy the formula:
   ```bash
   cp /path/to/PromptMatch/Formula/promptmatch.rb Formula/
   ```

4. Commit and push:
   ```bash
   git add Formula/promptmatch.rb
   git commit -m "Add promptmatch formula"
   git push origin main
   ```

5. Users can then install with:
   ```bash
   brew tap thericharcher/promptmatch
   brew install promptmatch
   ```

### Option 2: Install from Local Formula

If you just want to test or install locally:

```bash
brew install --build-from-source /path/to/PromptMatch/Formula/promptmatch.rb
```

## Making the Repository Public (If Needed)

If you want the repository to be publicly installable via Homebrew:

1. Go to https://github.com/TheRichArcher/promptmatch/settings
2. Scroll down to "Danger Zone"
3. Click "Change visibility" → "Make public"

**Note:** The archive download method should work even if the repo is private, as long as the user has access.

## Testing the Formula

```bash
# Test the formula syntax
brew audit --strict Formula/promptmatch.rb

# Test installation
brew install --build-from-source Formula/promptmatch.rb

# Test running
promptmatch
```

## Troubleshooting

If you still get 500 errors:
1. Check GitHub status: https://www.githubstatus.com/
2. Verify repository exists and is accessible
3. Try the archive URL directly: `curl -I https://github.com/TheRichArcher/promptmatch/archive/refs/heads/main.tar.gz`
4. Check repository visibility settings

