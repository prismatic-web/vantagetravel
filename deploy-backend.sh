#!/bin/bash
# Backend Deployment Script
# This automates the entire Cloudflare Worker deployment

echo "🚀 VANTAGE TRAVEL - Backend Deployment"
echo "======================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Login to Cloudflare (if not already)
echo "🔐 Checking Cloudflare login..."
wrangler whoami || wrangler login

echo ""
echo "📋 STEP 1: Create D1 Database"
echo "-----------------------------"
echo "Run this command to create the database:"
echo "  wrangler d1 create vantagetravel_db"
echo ""
echo "Then copy the Database ID and update wrangler.toml"
echo ""
read -p "Press Enter after you've created the database and updated wrangler.toml..."

echo ""
echo "📋 STEP 2: Deploy Worker"
echo "------------------------"
wrangler deploy

echo ""
echo "📋 STEP 3: Set Secrets"
echo "----------------------"
echo "Setting up your secrets..."
echo ""

echo "Enter your GOOGLE_CLIENT_ID:"
wrangler secret put GOOGLE_CLIENT_ID

echo ""
echo "Enter your GOOGLE_CLIENT_SECRET:"
wrangler secret put GOOGLE_CLIENT_SECRET

echo ""
echo "Enter your JWT_SECRET:"
wrangler secret put JWT_SECRET

echo ""
echo "Skipping Stripe secrets for now (set later when ready)"
echo "  wrangler secret put STRIPE_SECRET_KEY"
echo "  wrangler secret put STRIPE_WEBHOOK_SECRET"
echo "  wrangler secret put STRIPE_PRICE_ID"

echo ""
echo "📋 STEP 4: Initialize Database"
echo "------------------------------"
echo "Run this to create tables:"
echo "  wrangler d1 execute vantagetravel_db --file=./backend/db-schema.sql"

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo "Your backend is live at: https://vantagetravel-api.yourname.workers.dev"
echo ""
echo "Test it:"
echo "  curl https://vantagetravel-api.yourname.workers.dev/api/health"
