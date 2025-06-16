const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Enhanced signup with comprehensive debugging for Lovable
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username, full_name } = req.body;
    const origin = req.get('Origin');

    console.log(`🔐 Signup attempt from ${origin}: ${email}`);

    // Enhanced validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required',
        debug_info: { email_provided: !!email, password_provided: !!password }
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    console.log('📝 Creating user with Supabase Auth...');

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Disable email confirmation for development
        data: {
          username: username || email.split('@')[0],
          full_name: full_name || username || email.split('@')[0]
        }
      }
    });

    if (error) {
      console.error('❌ Supabase signup error:', error);
      return res.status(400).json({ 
        error: error.message,
        code: 'SIGNUP_FAILED',
        supabase_error: error
      });
    }

    console.log('✅ User created in Supabase Auth:', data.user?.id);

    // Create user profile with admin client to bypass RLS
    if (data.user) {
      try {
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: data.user.id,
            username: username || email.split('@')[0],
            full_name: full_name || username || email.split('@')[0],
            email: email
          });

        if (profileError) {
          console.error('⚠️ Profile creation error:', profileError);
          // Don't fail signup, but log the issue
        } else {
          console.log('✅ User profile created');
        }
      } catch (profileErr) {
        console.error('⚠️ Profile creation exception:', profileErr);
      }

      // Initialize user stats with admin client
      try {
        const { error: statsError } = await supabaseAdmin
          .from('user_stats')
          .insert({
            user_id: data.user.id,
            total_pages_read: 0,
            total_time_spent_seconds: 0,
            average_reading_speed_seconds: 120,
            total_documents: 0,
            current_streak_days: 0,
            longest_streak_days: 0,
            total_xp_points: 0,
            current_level: 1
          });

        if (statsError) {
          console.error('⚠️ Stats initialization error:', statsError);
        } else {
          console.log('✅ User stats initialized');
        }
      } catch (statsErr) {
        console.error('⚠️ Stats initialization exception:', statsErr);
      }
    }

    console.log('🎉 Signup completed successfully');

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        username: username || email.split('@')[0],
        email_confirmed: data.user?.email_confirmed_at ? true : false
      },
      session: data.session,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      lovable_ready: true
    });
  } catch (error) {
    console.error('💥 Signup catch error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      lovable_debug: true
    });
  }
});

// Enhanced login with debugging for Lovable
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const origin = req.get('Origin');

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required'
      });
    }

    console.log(`🔐 Login attempt from ${origin}: ${email}`);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('❌ Login error:', error);
      
      // Enhanced error debugging for common issues
      if (error.message.includes('Invalid login credentials')) {
        console.log('🔍 Checking if user exists...');
        
        try {
          const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (!listError) {
            const userExists = users.users.find(u => u.email === email);
            console.log('👤 User exists in auth.users:', !!userExists);
            
            if (userExists) {
              console.log('📧 User email confirmed:', !!userExists.email_confirmed_at);
              console.log('📅 User created at:', userExists.created_at);
              
              // If user exists but login fails, it's likely a password issue
              return res.status(401).json({ 
                error: 'Invalid password',
                user_exists: true,
                email_confirmed: !!userExists.email_confirmed_at
              });
            } else {
              return res.status(401).json({ 
                error: 'User not found',
                user_exists: false,
                suggestion: 'Please sign up first'
              });
            }
          }
        } catch (debugError) {
          console.error('🔍 User lookup error:', debugError);
        }
      }
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        supabase_error: error.message
      });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username, full_name')
      .eq('id', data.user.id)
      .single();

    console.log(`✅ User logged in successfully: ${email}`);

    res.json({ 
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || data.user.user_metadata?.username,
        full_name: profile?.full_name || data.user.user_metadata?.full_name,
        email_confirmed: data.user.email_confirmed_at ? true : false
      },
      session: data.session,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_at: data.session?.expires_at,
      lovable_ready: true
    });
  } catch (error) {
    console.error('💥 Login catch error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Get current user info
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Get user stats
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        username: profile?.username,
        full_name: profile?.full_name,
        avatar_url: profile?.avatar_url,
        preferences: profile?.preferences,
        created_at: req.user.created_at
      },
      stats: stats || {
        total_pages_read: 0,
        total_documents: 0,
        current_level: 1,
        total_xp_points: 0
      },
      lovable_ready: true
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Logout endpoint
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ error: 'Failed to logout' });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error) {
      console.error('Refresh token error:', error);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    res.json({
      session: data.session,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_at: data.session?.expires_at
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;