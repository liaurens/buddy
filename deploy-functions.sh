#!/bin/bash
# Deploy all Supabase Edge Functions
# Run: bash deploy-functions.sh
#
# Prerequisites:
#   npx supabase login   (one-time, uses your browser)

set -e

PROJECT_REF="kdwgznfszbrysepsltua"

echo "Linking project..."
npx supabase link --project-ref "$PROJECT_REF"

echo "Deploying functions..."
npx supabase functions deploy assistant --no-verify-jwt
npx supabase functions deploy quick-note --no-verify-jwt
npx supabase functions deploy calendar-proxy --no-verify-jwt
npx supabase functions deploy hr-agent --no-verify-jwt
npx supabase functions deploy trainer-agent --no-verify-jwt
npx supabase functions deploy schedule-notifications --no-verify-jwt
npx supabase functions deploy send-notification --no-verify-jwt
npx supabase functions deploy google-calendar-auth --no-verify-jwt
npx supabase functions deploy google-calendar-sync --no-verify-jwt

echo "Done. All functions deployed."
echo ""
echo "Next: set Supabase secrets for Google Calendar:"
echo "  npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... FRONTEND_URL=https://buddy4life.netlify.app"
