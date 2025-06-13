#!/bin/bash

echo "🚀 Updating Study Planner Backend to Production v2.0.0..."

# Backup existing files
echo "📦 Creating backup..."
cp package.json package.json.backup
cp src/server.js src/server.js.backup

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create documentation files
echo "📝 Adding documentation..."
# You'll need to manually create DEPLOYMENT_GUIDE.md and VERIFICATION_CHECKLIST.md

# Test the setup
echo "🧪 Testing setup..."
npm run health

echo "✅ Update complete! Next steps:"
echo "1. Copy the new file contents from the artifacts"
echo "2. Run database migration in Supabase"
echo "3. Deploy to Railway"
echo "4. Run verification tests"