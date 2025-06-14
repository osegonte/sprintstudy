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
