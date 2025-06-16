const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Enhanced signup with comprehensive debugging
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username, full_name } = req.body;

    console.log(`🔐 Signup attempt: ${email}`);

    // Enhanced validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required',
        details: 'Please provide both email and password to create an account'
      });
    }

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Disable email confirmation for testing
        data: {
          username: username || email.split('@')[0],
          full_name: full_name || username || email.split('@')[0]
        }
      }
    });

    if (error) {
      console.error('Signup error:', error);
      return res.status(400).json({ 
        error: error.message,
        code: 'SIGNUP_FAILED',
        debug_info: {
          error_code: error.status,
          supabase_error: error.message
        }
      });
    }

    console.log('✅ User created in Supabase Auth:', data.user?.id);

    // Create user profile with admin client to bypass RLS
    if (data.user) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: data.user.id,
          username: username || email.split('@')[0],
          full_name: full_name || username || email.split('@')[0],
          email: email
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Don't fail signup, but log the issue
      } else {
        console.log('✅ User profile created');
      }

      // Initialize user stats with admin client
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
        console.error('Stats initialization error:', statsError);
      } else {
        console.log('✅ User stats initialized');
      }
    }

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        username: username || email.split('@')[0],
        email_confirmed: data.user?.email_confirmed_at ? true : false
      },
      session: data.session,
      debug_info: {
        signup_successful: true,
        user_id: data.user?.id,
        session_provided: !!data.session
      }
    });
  } catch (error) {
    console.error('Signup catch error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Something went wrong during account creation',
      debug_info: {
        catch_error: error.message
      }
    });
  }
});

// Enhanced login with debugging
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required'
      });
    }

    console.log(`🔐 Login attempt: ${email}`);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      
      // Enhanced error debugging
      if (error.message.includes('Invalid login credentials')) {
        // Check if user exists
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (!listError) {
          const userExists = users.users.find(u => u.email === email);
          console.log('User exists in auth.users:', !!userExists);
          
          if (userExists) {
            console.log('User email confirmed:', !!userExists.email_confirmed_at);
            console.log('User created at:', userExists.created_at);
          }
        }
      }
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        details: 'Email or password is incorrect',
        debug_info: {
          supabase_error: error.message,
          error_status: error.status
        }
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
      debug_info: {
        login_successful: true,
        profile_found: !!profile
      }
    });
  } catch (error) {
    console.error('Login catch error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      debug_info: {
        catch_error: error.message
      }
    });
  }
});

module.exports = router;