#!/bin/bash

echo "🏗️  Restructuring Study Planner Project for Frontend Development"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Please run this script from the root of your Study Planner project"
    exit 1
fi

print_info "Starting project restructure..."

# 1. Create backend directory structure
print_info "Creating backend directory..."
mkdir -p backend

# 2. Move backend files to backend directory
print_info "Moving backend files..."

# Move main backend files
mv src backend/ 2>/dev/null || true
mv package.json backend/ 2>/dev/null || true
mv package-lock.json backend/ 2>/dev/null || true
mv .env backend/ 2>/dev/null || true
mv .env.example backend/ 2>/dev/null || true
mv railway.json backend/ 2>/dev/null || true
mv setup.sh backend/ 2>/dev/null || true
mv update-to-production.sh backend/ 2>/dev/null || true

# Move documentation files
mv README.md backend/ 2>/dev/null || true
mv MIGRATION_INSTRUCTIONS.md backend/ 2>/dev/null || true

print_status "Backend files moved to ./backend/"

# 3. Clean up irrelevant files
print_info "Cleaning up irrelevant files..."

# Remove test files and artifacts
rm -f paste.txt 2>/dev/null || true
rm -f *.log 2>/dev/null || true
rm -f .DS_Store 2>/dev/null || true
rm -rf .cache 2>/dev/null || true
rm -rf dist 2>/dev/null || true
rm -rf build 2>/dev/null || true

# Remove temporary files
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name "*.temp" -delete 2>/dev/null || true
find . -name ".env.local" -delete 2>/dev/null || true

print_status "Cleaned up temporary and irrelevant files"

# 4. Handle frontend-test directory
if [ -d "frontend-test" ]; then
    print_info "Removing old frontend-test directory..."
    rm -rf frontend-test
    print_status "Removed frontend-test directory"
fi

# 5. Create new frontend directory structure
print_info "Creating frontend directory structure..."
mkdir -p frontend
mkdir -p frontend/src
mkdir -p frontend/src/components
mkdir -p frontend/src/pages
mkdir -p frontend/src/hooks
mkdir -p frontend/src/utils
mkdir -p frontend/src/services
mkdir -p frontend/src/styles
mkdir -p frontend/public

print_status "Frontend directory structure created"

# 6. Create frontend package.json
print_info "Creating frontend package.json..."
cat > frontend/package.json << 'EOF'
{
  "name": "study-planner-frontend",
  "version": "1.0.0",
  "private": true,
  "description": "Study Planner Frontend - Smart PDF Reader & Progress Tracker",
  "keywords": ["study", "pdf", "reading", "progress", "education", "react"],
  "author": "Study Planner Team",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx,ts,tsx",
    "lint:fix": "eslint src --ext js,jsx,ts,tsx --fix",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "axios": "^1.6.0",
    "lucide-react": "^0.263.1",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.14",
    "eslint": "^8.45.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.3",
    "postcss": "^8.4.24",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.2",
    "vite": "^4.4.5"
  }
}
EOF

print_status "Created frontend package.json with modern React setup"

# 7. Create Vite config
print_info "Creating Vite configuration..."
cat > frontend/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
EOF

# 8. Create TypeScript config
print_info "Creating TypeScript configuration..."
cat > frontend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

cat > frontend/tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF

# 9. Create Tailwind CSS config
print_info "Creating Tailwind CSS configuration..."
cat > frontend/tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d8ff',
          300: '#a5bfff',
          400: '#8199ff',
          500: '#667eea',
          600: '#5a67d8',
          700: '#4c51bf',
          800: '#434190',
          900: '#3c366b',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#764ba2',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
EOF

cat > frontend/postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# 10. Create basic index.html
print_info "Creating index.html..."
cat > frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Study Planner - Smart PDF Reader & Progress Tracker</title>
    <meta name="description" content="Intelligent PDF study management with progress tracking, analytics, and personalized learning insights." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# 11. Create basic React files
print_info "Creating basic React application structure..."

# Main entry point
cat > frontend/src/main.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# Main App component
cat > frontend/src/App.tsx << 'EOF'
import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Login from './pages/Login'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  )
}

export default App
EOF

# Basic CSS
cat > frontend/src/styles/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background;
  }
  
  .btn-primary {
    @apply bg-primary-500 text-white hover:bg-primary-600;
  }
  
  .btn-secondary {
    @apply bg-secondary-100 text-secondary-900 hover:bg-secondary-200;
  }
  
  .card {
    @apply bg-white rounded-lg border shadow-sm;
  }
  
  .input {
    @apply flex w-full rounded-md border border-gray-300 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50;
  }
}
EOF

# Placeholder components and pages
mkdir -p frontend/src/components
cat > frontend/src/components/Layout.tsx << 'EOF'
import React from 'react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              📚 Study Planner
            </h1>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

export default Layout
EOF

mkdir -p frontend/src/pages
cat > frontend/src/pages/Dashboard.tsx << 'EOF'
import React from 'react'

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to Study Planner! 🚀
        </h2>
        <p className="text-gray-600">
          Your intelligent PDF study management system is ready.
          Start by uploading your first PDF document.
        </p>
      </div>
    </div>
  )
}

export default Dashboard
EOF

cat > frontend/src/pages/Documents.tsx << 'EOF'
import React from 'react'

const Documents: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          📚 Documents
        </h2>
        <p className="text-gray-600">
          Upload and manage your PDF documents here.
        </p>
      </div>
    </div>
  )
}

export default Documents
EOF

cat > frontend/src/pages/Login.tsx << 'EOF'
import React from 'react'

const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">
          🔐 Login
        </h2>
        <p className="text-gray-600 text-center">
          Login functionality will be implemented here.
        </p>
      </div>
    </div>
  )
}

export default Login
EOF

# Auth hook placeholder
mkdir -p frontend/src/hooks
cat > frontend/src/hooks/useAuth.tsx << 'EOF'
import React, { createContext, useContext, useState, ReactNode } from 'react'

interface AuthContextType {
  user: any | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    // TODO: Implement login logic
    setIsLoading(false)
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
EOF

# Services placeholder
mkdir -p frontend/src/services
cat > frontend/src/services/api.ts << 'EOF'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// TODO: Add request interceptors for auth tokens
// TODO: Add response interceptors for error handling

export default api
EOF

# 12. Create .gitignore for frontend
cat > frontend/.gitignore << 'EOF'
# Dependencies
node_modules
/.pnp
.pnp.js

# Production
/dist
/build

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime
*.tsbuildinfo

# Temporary
.tmp
.temp
EOF

# 13. Create .gitignore for backend
cat > backend/.gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporary files
.tmp
.temp
*.tmp
*.temp

# Build outputs
dist/
build/

# Database
*.db
*.sqlite
*.sqlite3
EOF

# 14. Create root-level project files
print_info "Creating root-level project files..."

cat > README.md << 'EOF'
# 📚 Study Planner - Smart PDF Reader & Progress Tracker

An intelligent PDF study management system with progress tracking, analytics, and personalized learning insights.

## 🏗️ Project Structure

```
study-planner/
├── backend/           # Node.js + Express API with Supabase
│   ├── src/          # API routes, services, middleware
│   ├── package.json  # Backend dependencies
│   └── .env          # Environment variables
├── frontend/         # React + TypeScript + Vite + Tailwind
│   ├── src/          # React components, pages, hooks
│   ├── package.json  # Frontend dependencies
│   └── vite.config.ts # Vite configuration
└── README.md         # This file
```

## 🚀 Quick Start

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env  # Configure your Supabase credentials
npm run dev          # Starts on http://localhost:3000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev         # Starts on http://localhost:5173
```

## ✨ Features

- 🧠 **Intelligent PDF Analysis** - Automatic difficulty assessment and time estimation
- 📊 **Progress Tracking** - Real-time reading progress with analytics
- 🎯 **Smart Sprint System** - AI-powered study session recommendations
- 🏆 **Achievement System** - Gamified learning with progress rewards
- 📈 **Performance Analytics** - Detailed insights into reading patterns
- ⏱️ **Session Tracking** - Focus monitoring and productivity feedback

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **PDF Processing**: pdf-parse with intelligent analysis
- **Authentication**: Supabase Auth (JWT)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Icons**: Lucide React

## 📖 API Documentation

Backend API runs on `http://localhost:3000` with endpoints:

- `POST /api/auth/login` - User authentication
- `POST /api/documents/upload` - PDF upload with analysis
- `GET /api/documents` - List user documents
- `GET /api/analytics/dashboard` - User analytics
- `POST /api/sprints/generate` - Generate study sprints

Full API documentation available at: `http://localhost:3000/api/docs`

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev     # Start with nodemon
npm run health  # Test backend health
```

### Frontend Development
```bash
cd frontend
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

## 📦 Deployment

### Backend (Railway)
```bash
cd backend
# Railway deployment is configured with railway.json
```

### Frontend (Vercel/Netlify)
```bash
cd frontend
npm run build
# Deploy the dist/ folder
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
EOF

cat > .gitignore << 'EOF'
# Dependencies
node_modules/

# Environment variables
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
*.temp
.tmp/
.temp/

# Build outputs
dist/
build/
coverage/

# Runtime
pids
*.pid
*.seed
*.pid.lock
EOF

# 15. Final cleanup and summary
print_info "Final cleanup..."

# Remove any remaining temporary files
find . -name "*.log" -not -path "./backend/*" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true

# Make sure backend npm scripts still work
cd backend
if [ -f "package.json" ]; then
    print_status "Backend package.json verified"
else
    print_error "Backend package.json missing!"
fi
cd ..

echo ""
echo "=================================================="
print_status "🎉 Project restructure completed successfully!"
echo "=================================================="
echo ""

echo -e "${BLUE}📁 New Project Structure:${NC}"
echo "study-planner/"
echo "├── backend/              # Your existing Node.js API"
echo "│   ├── src/             # API routes, services, middleware"
echo "│   ├── package.json     # Backend dependencies"
echo "│   └── .env             # Environment variables"
echo "├── frontend/            # New React + TypeScript app"
echo "│   ├── src/             # React components, pages, hooks"
echo "│   ├── package.json     # Frontend dependencies"
echo "│   └── vite.config.ts   # Vite configuration"
echo "└── README.md            # Project documentation"
echo ""

echo -e "${GREEN}🚀 Next Steps:${NC}"
echo "1. Backend (keep running):     cd backend && npm run dev"
echo "2. Frontend setup:             cd frontend && npm install && npm run dev"
echo "3. Open frontend:              http://localhost:5173"
echo "4. Backend API docs:           http://localhost:3000/api/docs"
echo ""

echo -e "${YELLOW}💡 Features Ready for Frontend:${NC}"
echo "• ✅ Modern React 18 + TypeScript setup"
echo "• ✅ Vite for fast development"
echo "• ✅ Tailwind CSS for styling"
echo "• ✅ React Router for navigation"
echo "• ✅ API proxy to backend configured"
echo "• ✅ Project structure organized"
echo ""

print_status "Your Study Planner is ready for frontend development! 🎨"