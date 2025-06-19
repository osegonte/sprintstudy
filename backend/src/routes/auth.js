const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Enhanced signup with comprehensive debugging
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

    // User profile and stats will be created automatically by the database trigger
    // No need for manual insertion here

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
      cinestudy_ready: true
    });
  } catch (error) {
    console.error('💥 Signup catch error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      cinestudy_debug: true
    });
  }
});

// Enhanced login with debugging
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

    // Get user profile from our custom table
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
      cinestudy_ready: true
    });
  } catch (error) {
    console.error('💥 Login catch error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Fixed /me endpoint with proper error handling
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`👤 Fetching user info for: ${userId}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      // Create profile if it doesn't exist
      const { data: createdProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          username: req.user.email?.split('@')[0] || 'user',
          full_name: req.user.user_metadata?.full_name || '',
          email: req.user.email
        })
        .select()
        .single();

      if (createError) {
        console.error('Profile creation error:', createError);
        return res.status(500).json({ error: 'Failed to create user profile' });
      }
      
      console.log('✅ Created missing user profile');
    }

    // Get user stats
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsError) {
      console.error('Stats fetch error:', statsError);
      // Create stats if they don't exist
      const { data: createdStats, error: createStatsError } = await supabase
        .from('user_stats')
        .insert({
          user_id: userId,
          total_pages_read: 0,
          total_documents: 0,
          current_level: 1,
          total_xp_points: 0
        })
        .select()
        .single();

      if (createStatsError) {
        console.error('Stats creation error:', createStatsError);
        return res.status(500).json({ error: 'Failed to create user stats' });
      }
      
      console.log('✅ Created missing user stats');
    }

    const userData = {
      user: {
        id: req.user.id,
        email: req.user.email,
        username: profile?.username || req.user.email?.split('@')[0],
        full_name: profile?.full_name || req.user.user_metadata?.full_name,
        avatar_url: profile?.avatar_url,
        preferences: profile?.preferences || {},
        created_at: req.user.created_at
      },
      stats: stats || {
        total_pages_read: 0,
        total_documents: 0,
        current_level: 1,
        total_xp_points: 0,
        current_streak_days: 0,
        average_reading_speed_seconds: 120
      },
      cinestudy_ready: true
    };

    console.log(`✅ User info retrieved successfully for: ${req.user.email}`);
    res.json(userData);
    
  } catch (error) {
    console.error('💥 Get user error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user data',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
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

    console.log(`👋 User logged out: ${req.user.email}`);
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

// Test login endpoint for development
router.post('/test-login', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    // This creates a test user if it doesn't exist
    const testEmail = 'test@example.com';
    const testPassword = 'password123';

    console.log('🧪 Test login attempt...');

    let { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (error && error.message.includes('Invalid login credentials')) {
      console.log('🧪 Creating test user...');
      
      // Try to create the test user
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            username: 'testuser',
            full_name: 'Test User'
          }
        }
      });

      if (signupError) {
        console.error('Test user creation failed:', signupError);
        return res.status(500).json({ error: 'Failed to create test user' });
      }

      data = signupData;
      console.log('✅ Test user created');
    } else if (error) {
      console.error('Test login failed:', error);
      return res.status(500).json({ error: 'Test login failed' });
    }

    console.log('✅ Test login successful');
    
    res.json({
      message: 'Test login successful',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        username: 'testuser'
      },
      access_token: data.session?.access_token,
      test_mode: true
    });
  } catch (error) {
    console.error('Test login error:', error);
    res.status(500).json({ error: 'Test login failed' });
  }
});

module.exports = router;