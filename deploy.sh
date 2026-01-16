#!/bin/bash
# Deploy ocis-advanced-search extension to core-faure.ca

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="/data/owncloud/ocis/web/assets/apps/advanced-search"

echo "Building extension..."
cd "$SCRIPT_DIR"
pnpm build

echo "Creating deployment directory..."
sudo mkdir -p "$DEPLOY_PATH"

echo "Copying files..."
sudo cp dist/index.amd.js "$DEPLOY_PATH/index.js"
sudo cp dist/style.css "$DEPLOY_PATH/"
sudo cp public/manifest.json "$DEPLOY_PATH/"

echo "Setting permissions..."
sudo chown -R ocis:ocis "$DEPLOY_PATH"

echo ""
echo "✅ Deployment complete!"
echo "Extension deployed to: $DEPLOY_PATH"
echo ""
echo "No restart required - just refresh your browser."
echo ""
echo "To verify, check:"
echo "  curl -s http://127.0.0.1:9100/config.json | grep advanced-search"
