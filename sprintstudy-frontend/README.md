# 📚 SprintStudy Frontend Test App

A basic React frontend to test your SprintStudy backend API.

## 🚀 Quick Start

```bash
# Start the app
./start.sh
```

The app will be available at: http://localhost:5173

## 🧪 Testing Your Backend

### 1. API Health Test
Visit: http://localhost:5173/test

This page will test:
- ✅ Backend health check
- ✅ Authentication (if logged in)
- ✅ Dashboard data
- ✅ Documents list

### 2. Main App Testing
Visit: http://localhost:5173

**Test Flow:**
1. **Sign up/Login** with your email
2. **Upload a PDF** to test document management
3. **View Dashboard** to see analytics
4. **Test Sprint Features** (click "Sprint Test" in header)
5. **Copy Document ID** and use in sprint testing

### 3. Sprint Testing
1. Upload a PDF document first
2. Click "Sprint Test" in the dashboard header
3. Copy a document ID from the documents grid
4. Test sprint generation and speed feedback

## 🔗 API Integration

**Backend URL:** `https://sprintstudy-production.up.railway.app`

### Features Tested:
- ✅ User authentication (signup/login)
- ✅ PDF upload and storage
- ✅ Dashboard analytics
- ✅ Document management
- ✅ Sprint generation
- ✅ Real-time speed feedback
- ✅ Progress tracking

## 📱 Pages Available

- `/` - Redirects to login or dashboard
- `/login` - Authentication page
- `/dashboard` - Main dashboard with analytics
- `/test` - API testing page

## 🎯 What to Test

### Authentication
- Sign up with a new account
- Login with existing credentials
- Logout functionality

### Document Management
- Upload PDF files (drag & drop supported)
- View document list with progress
- Delete documents
- Copy document IDs for testing

### Sprint Features
- Generate sprint suggestions
- Test speed feedback with different times
- View real-time motivational messages

### Analytics
- View reading statistics
- Check study streaks
- See estimated completion times

## 🐛 Troubleshooting

### Common Issues:

1. **API Connection Failed**
   - Check if backend is running: https://sprintstudy-production.up.railway.app/health
   - Verify network connection

2. **Authentication Errors**
   - Clear browser localStorage: `localStorage.clear()`
   - Try signing up with a new email

3. **Upload Errors**
   - Ensure file is a PDF
   - Check file size (max 50MB)
   - Verify authentication token

### Debug Steps:
1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab for failed requests
4. Use the API test page for diagnostics

## 🔧 Development

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

## 📊 Backend Features Integrated

- **Authentication System** - JWT-based login/signup
- **Document Management** - PDF upload, storage, metadata
- **Progress Tracking** - Page-by-page reading progress
- **Sprint System** - Smart daily study goals
- **Analytics Dashboard** - Reading speed, streaks, completion
- **Real-time Feedback** - Motivational speed messages
- **Gamification** - Achievements and progress tracking

Ready to test your SprintStudy backend! 🚀
