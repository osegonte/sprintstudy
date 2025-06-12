#!/bin/bash

echo "🚀 Starting SprintStudy Frontend Test App..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🌐 Starting development server..."
echo "📍 Your app will be available at: http://localhost:5173"
echo ""
echo "🧪 Test Pages Available:"
echo "  • http://localhost:5173 - Main app (login/dashboard)"
echo "  • http://localhost:5173/test - API test page"
echo ""
echo "🔗 Your Backend API: https://sprintstudy-production.up.railway.app"
echo ""

npm run dev
