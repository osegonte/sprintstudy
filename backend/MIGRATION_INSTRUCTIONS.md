# 🗃️ Database Migration Instructions

## Step 1: Run SQL Migration
Copy and paste the SQL from `src/migrations/001_sprint_features.sql` into your Supabase SQL Editor and run it.

This will create:
- ✅ `sprints` table for sprint tracking
- ✅ `study_sessions` table for session management  
- ✅ `achievements` table for gamification
- ✅ Enhanced `user_stats` with streak tracking
- ✅ Database functions for sprint generation
- ✅ Proper indexes for performance

## Step 2: Verify Migration
Check that all new tables exist in your Supabase dashboard:
- sprints
- study_sessions  
- achievements

## Step 3: Test New Features
Use these new endpoints to test functionality:

### Sprint Management
```bash
# Generate daily sprint
curl -X POST https://sprintstudy-production.up.railway.app/api/sprints/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "your-doc-id"}'

# Get today's sprint
curl https://sprintstudy-production.up.railway.app/api/sprints/today \
  -H "Authorization: Bearer <token>"
```

### Analytics Dashboard
```bash
# Get dashboard stats
curl https://sprintstudy-production.up.railway.app/api/analytics/dashboard \
  -H "Authorization: Bearer <token>"
```

### Real-time Feedback
```bash
# Get reading speed feedback
curl -X POST https://sprintstudy-production.up.railway.app/api/progress/feedback \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"current_page_time": 90, "document_id": "your-doc-id"}'
```

## Features Added:
🎯 **Sprint Tracking** - Daily study goals with smart recommendations
📊 **Enhanced Analytics** - Reading speed trends and study habits  
🏆 **Gamification** - Achievements, streaks, and milestones
⚡ **Real-time Feedback** - Speed comparisons and encouragement
📖 **Session Management** - Detailed study session tracking
