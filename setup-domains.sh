#!/bin/bash

# Setup 27 dashtube.ai domains for Dashtube.ai
# Each subdomain = separate localStorage = separate 10 threads

PROJECT_ID="karen-os-chat"
BASE_DOMAIN="dashtube.ai"

echo "🚀 Setting up 27 domains for Dashtube.ai..."
echo ""

# Array of all subdomains (root + a-z)
DOMAINS=(
  "$BASE_DOMAIN"
  "a.$BASE_DOMAIN"
  "b.$BASE_DOMAIN"
  "c.$BASE_DOMAIN"
  "d.$BASE_DOMAIN"
  "e.$BASE_DOMAIN"
  "f.$BASE_DOMAIN"
  "g.$BASE_DOMAIN"
  "h.$BASE_DOMAIN"
  "i.$BASE_DOMAIN"
  "j.$BASE_DOMAIN"
  "k.$BASE_DOMAIN"
  "l.$BASE_DOMAIN"
  "m.$BASE_DOMAIN"
  "n.$BASE_DOMAIN"
  "o.$BASE_DOMAIN"
  "p.$BASE_DOMAIN"
  "q.$BASE_DOMAIN"
  "r.$BASE_DOMAIN"
  "s.$BASE_DOMAIN"
  "t.$BASE_DOMAIN"
  "u.$BASE_DOMAIN"
  "v.$BASE_DOMAIN"
  "w.$BASE_DOMAIN"
  "x.$BASE_DOMAIN"
  "y.$BASE_DOMAIN"
  "z.$BASE_DOMAIN"
)

echo "📝 Step 1: Add domains to Firebase Hosting"
echo "Run these commands one by one:"
echo ""

for domain in "${DOMAINS[@]}"; do
  echo "firebase hosting:channel:deploy $domain --project $PROJECT_ID"
done

echo ""
echo "OR add them all via Firebase Console:"
echo "https://console.firebase.google.com/project/$PROJECT_ID/hosting/main"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Step 2: DNS Configuration"
echo "Add these DNS records in your domain registrar:"
echo ""

echo "Root domain:"
echo "  Type: A"
echo "  Name: @"
echo "  Value: [Firebase IPs - shown in Firebase Console]"
echo ""

echo "All subdomains:"
for letter in {a..z}; do
  echo "  Type: CNAME"
  echo "  Name: $letter"
  echo "  Value: karen-os-chat.web.app"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Result:"
echo "  - dashtube.ai → 10 threads"
echo "  - a.dashtube.ai → 10 threads"
echo "  - b.dashtube.ai → 10 threads"
echo "  - ... (25 more)"
echo "  = 270 total threads across all domains!"
echo ""
echo "🔥 Single deployment updates all 27 domains instantly!"

