#!/bin/bash
# Setup script for creating the Homebrew tap for promptmatch

set -e

echo "🚀 Setting up Homebrew tap for promptmatch..."
echo ""

# Check if tap repository exists
TAP_REPO="homebrew-promptmatch"
GITHUB_USER="TheRichArcher"
TAP_FULL_NAME="${GITHUB_USER}/${TAP_REPO}"

echo "Checking if tap repository exists..."
if curl -s -o /dev/null -w "%{http_code}" "https://github.com/${TAP_FULL_NAME}" | grep -q "200"; then
    echo "✅ Tap repository already exists!"
else
    echo "❌ Tap repository not found: ${TAP_FULL_NAME}"
    echo ""
    echo "To create the tap:"
    echo "1. Go to https://github.com/new"
    echo "2. Create a repository named: ${TAP_REPO}"
    echo "3. Make it public (or private if you prefer)"
    echo "4. Don't initialize with README, .gitignore, or license"
    echo "5. Then run this script again"
    echo ""
    exit 1
fi

# Clone the tap repository
TAP_DIR="/tmp/${TAP_REPO}"
if [ -d "${TAP_DIR}" ]; then
    echo "Cleaning up existing tap directory..."
    rm -rf "${TAP_DIR}"
fi

echo "Cloning tap repository..."
git clone "https://github.com/${TAP_FULL_NAME}.git" "${TAP_DIR}"
cd "${TAP_DIR}"

# Create Formula directory if it doesn't exist
mkdir -p Formula

# Copy the formula
echo "Copying formula..."
cp "${OLDPWD}/Formula/promptmatch.rb" Formula/

# Commit and push
echo "Committing formula..."
git add Formula/promptmatch.rb
git commit -m "Add promptmatch formula" || echo "No changes to commit"
git push origin main || echo "Push failed - you may need to push manually"

echo ""
echo "✅ Tap setup complete!"
echo ""
echo "Users can now install with:"
echo "  brew tap ${GITHUB_USER}/${TAP_REPO}"
echo "  brew install promptmatch"
echo ""

