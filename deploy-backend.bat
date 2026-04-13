@echo off
REM Backend Deployment Script for Windows
REM This automates the entire Cloudflare Worker deployment

echo 🚀 VANTAGE TRAVEL - Backend Deployment
echo ======================================
echo.

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Wrangler CLI not found. Installing...
    npm install -g wrangler
)

REM Login to Cloudflare (if not already)
echo 🔐 Checking Cloudflare login...
wrangler whoami >nul 2>nul
if %errorlevel% neq 0 (
    wrangler login
)

echo.
echo 📋 STEP 1: Create D1 Database
echo ------------------------------
echo Run this command to create the database:
echo   wrangler d1 create vantagetravel_db
echo.
echo Then copy the Database ID and update wrangler.toml
echo.
pause

echo.
echo 📋 STEP 2: Deploy Worker
echo ------------------------
wrangler deploy

echo.
echo 📋 STEP 3: Set Secrets
echo ----------------------
echo You'll now enter your secrets one by one...
echo.

echo Enter your GOOGLE_CLIENT_ID (856516687206-8hag0vnvsdpk68rh5oqs7o998icj5ndq.apps.googleusercontent.com):
wrangler secret put GOOGLE_CLIENT_ID

echo.
echo Enter your GOOGLE_CLIENT_SECRET:
wrangler secret put GOOGLE_CLIENT_SECRET

echo.
echo Enter your JWT_SECRET (41a4a21c5102c10acf5b68b9c70bb5b85327d5437c4076770dea3dc807cac95c):
wrangler secret put JWT_SECRET

echo.
echo Skipping Stripe secrets for now (set later when ready)
echo   wrangler secret put STRIPE_SECRET_KEY
echo   wrangler secret put STRIPE_WEBHOOK_SECRET
echo   wrangler secret put STRIPE_PRICE_ID

echo.
echo 📋 STEP 4: Initialize Database
echo ------------------------------
echo Run this to create tables:
echo   wrangler d1 execute vantagetravel_db --file=./backend/db-schema.sql

echo.
echo ✅ Deployment Complete!
echo ========================
echo Your backend is live!
echo.
echo Test it:
echo   curl https://vantagetravel-api.yourname.workers.dev/api/health

echo.
pause
