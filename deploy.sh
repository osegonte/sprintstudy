#!/bin/bash

echo "🚀 Deploying SprintStudy Backend v2.0..."

# Install any new dependencies
echo "📦 Installing dependencies..."
npm install

# Check if Railway is connected
if ! railway status > /dev/null 2>&1; then
    echo "❌ Railway not connected. Please run 'railway login' first."
    exit 1
fi

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment initiated!"
echo "📊 Check logs: railway logs"
echo "🔗 Your API: https://sprintstudy-production.up.railway.app"
echo ""
echo "🆕 New API Endpoints Available:"
echo "  • POST /api/sprints/generate - Generate daily sprint"
echo "  • GET /api/sprints/today - Get today's sprint"
echo "  • GET /api/analytics/dashboard - Dashboard analytics"
echo "  • POST /api/sessions/start - Start study session"
echo "  • POST /api/progress/feedback - Real-time feedback"
echo ""
echo "🎯 Don't forget to run the SQL migration in Supabase!"
