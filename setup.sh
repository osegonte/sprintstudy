#!/bin/bash

echo "🚀 Setting up Study Planner Backend..."

# Create project structure
echo "📁 Creating directory structure..."
mkdir -p src/config
mkdir -p src/middleware
mkdir -p src/routes

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file from example
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file - please update with your Supabase credentials"
    echo "   SUPABASE_URL=your_project_url"
    echo "   SUPABASE_ANON_KEY=your_anon_key"
    echo "   SUPABASE_SERVICE_KEY=your_service_key"
else
    echo "✅ .env file already exists"
fi

# Test the setup
echo "🧪 Testing setup..."
if npm run dev &
then
    sleep 3
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "✅ Server is running successfully!"
        echo "🔗 Health check: http://localhost:3000/health"
    else
        echo "❌ Server health check failed"
    fi
    pkill -f "node src/server.js"
else
    echo "❌ Failed to start server"
    exit 1
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Update your .env file with Supabase credentials"
echo "2. Run 'npm run dev' to start development server"
echo "3. Test endpoints with your API client"
echo "4. Deploy to Railway when ready"
echo ""
echo "📚 Available Endpoints:"
echo "  POST /api/auth/signup - User registration"
echo "  POST /api/auth/login - User login"
echo "  POST /api/documents/upload - Upload PDF"
echo "  GET /api/documents - Get user documents"
echo "  POST /api/progress/page - Track reading progress"
echo "  GET /api/dashboard - Get dashboard stats"
echo "  POST /api/sprints/generate - Generate sprint"
echo ""
echo "Ready to build! 🚀"