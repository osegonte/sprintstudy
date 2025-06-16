const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Enhanced signup for Lovable frontend
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username, full_name } = req.body;

    // Enhanced validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required',
        details: 'Please provide both email and password to create an account'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format',
        details: 'Please provide a valid email address'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password too short',
        details: 'Password must be at least 6 characters long'
      });
    }

    console.log(`🔐 User signup attempt: ${email}`);

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0],
          full_name: full_name || username || email.split('@')[0]
        }
      }
    });

    if (error) {
      console.error('Signup error:', error);
      
      // Handle specific Supabase errors
      if (error.message.includes('already registered')) {
        return res.status(409).json({ 
          error: 'Email already registered',
          details: 'An account with this email already exists. Try logging in instead.',
          suggestion: 'login'
        });
      }
      
      return res.status(400).json({ 
        error: error.message,
        code: 'SIGNUP_FAILED'
      });
    }

    // Create user profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          username: username || email.split('@')[0],
          full_name: full_name || username || email.split('@')[0],
          email: email
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Don't fail signup if profile creation fails
      }

      // Initialize user stats
      const { error: statsError } = await supabase
        .from('user_stats')
        .insert({
          user_id: data.user.id,
          total_pages_read: 0,
          total_time_spent_seconds: 0,
          average_reading_speed_seconds: 120, // Default 2 minutes per page
          total_documents: 0,
          current_streak_days: 0,
          longest_streak_days: 0,
          total_xp_points: 0,
          current_level: 1
        });

      if (statsError) {
        console.error('Error creating user stats:', statsError);
        // Don't fail signup if stats creation fails
      }

      console.log(`✅ User created successfully: ${email}`);
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
      next_steps: data.user?.email_confirmed_at ? 
        ['You can now start using the app'] : 
        ['Please check your email to confirm your account']
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Something went wrong during account creation. Please try again.'
    });
  }
});

// Enhanced login for Lovable frontend
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required',
        details: 'Please provide both email and password to log in'
      });
    }

    console.log(`🔐 Login attempt: ${email}`);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      
      // Handle specific errors
      if (error.message.includes('Invalid login credentials')) {
        return res.status(401).json({ 
          error: 'Invalid credentials',
          details: 'Email or password is incorrect. Please check and try again.',
          suggestion: 'reset_password'
        });
      }
      
      if (error.message.includes('Email not confirmed')) {
        return res.status(401).json({ 
          error: 'Email not confirmed',
          details: 'Please check your email and click the confirmation link.',
          suggestion: 'resend_confirmation'
        });
      }
      
      return res.status(400).json({ 
        error: error.message,
        code: 'LOGIN_FAILED'
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
        email_confirmed: data.user.email_confirmed_at ? true : false,
        last_sign_in: data.user.last_sign_in_at
      },
      session: data.session
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Something went wrong during login. Please try again.'
    });
  }
});

// Get current user with enhanced profile data
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Get user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Profile fetch error:', error);
    }

    // Get user stats
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    // Get recent activity
    const { data: recentSessions } = await supabase
      .from('study_sessions')
      .select('started_at, total_duration_seconds, pages_covered')
      .eq('user_id', req.user.id)
      .order('started_at', { ascending: false })
      .limit(5);

    res.json({ 
      user: {
        id: req.user.id,
        email: req.user.email,
        username: profile?.username || req.user.user_metadata?.username,
        full_name: profile?.full_name || req.user.user_metadata?.full_name,
        email_confirmed: req.user.email_confirmed_at ? true : false,
        created_at: req.user.created_at,
        last_sign_in: req.user.last_sign_in_at,
        profile_complete: !!(profile?.username && profile?.full_name)
      },
      stats: stats || {
        total_pages_read: 0,
        total_time_spent_seconds: 0,
        average_reading_speed_seconds: 120,
        total_documents: 0,
        current_streak_days: 0,
        current_level: 1,
        total_xp_points: 0
      },
      recent_activity: recentSessions || []
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user data',
      details: 'Could not retrieve user information. Please try again.'
    });
  }
});

// Update user profile
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, full_name, bio, preferences } = req.body;
    const userId = req.user.id;

    // Validation
    if (username && (username.length < 3 || username.length > 20)) {
      return res.status(400).json({ 
        error: 'Invalid username',
        details: 'Username must be between 3 and 20 characters long'
      });
    }

    // Check if username is already taken
    if (username) {
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(409).json({
          error: 'Username already taken',
          details: 'Please choose a different username'
        });
      }
    }

    // Update profile
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (full_name !== undefined) updateData.full_name = full_name;
    if (bio !== undefined) updateData.bio = bio;
    if (preferences !== undefined) updateData.preferences = preferences;
    
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({ 
        error: 'Failed to update profile',
        details: error.message
      });
    }

    res.json({ 
      message: 'Profile updated successfully',
      profile: data
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to update profile. Please try again.'
    });
  }
});

// Password reset request
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required',
        details: 'Please provide your email address'
      });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (error) {
      console.error('Password reset error:', error);
      return res.status(400).json({ 
        error: error.message,
        code: 'RESET_FAILED'
      });
    }

    res.json({ 
      message: 'Password reset email sent',
      details: 'Please check your email for password reset instructions'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to send reset email. Please try again.'
    });
  }
});

// Update password
router.post('/update-password', authMiddleware, async (req, res) => {
  try {
    const { password, new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({ 
        error: 'New password is required',
        details: 'Please provide a new password'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ 
        error: 'Password too short',
        details: 'New password must be at least 6 characters long'
      });
    }

    const { error } = await supabase.auth.updateUser({
      password: new_password
    });

    if (error) {
      console.error('Password update error:', error);
      return res.status(400).json({ 
        error: error.message,
        code: 'UPDATE_FAILED'
      });
    }

    res.json({ 
      message: 'Password updated successfully',
      details: 'Your password has been changed'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to update password. Please try again.'
    });
  }
});

// Enhanced logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
      return res.status(400).json({ 
        error: error.message,
        code: 'LOGOUT_FAILED'
      });
    }

    console.log(`✅ User logged out: ${req.user.email}`);

    res.json({ 
      message: 'Logout successful',
      details: 'You have been logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to logout. Please try again.'
    });
  }
});

// Refresh session
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ 
        error: 'Refresh token is required',
        details: 'Please provide a valid refresh token'
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      console.error('Refresh session error:', error);
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        details: 'Please login again',
        suggestion: 'login'
      });
    }

    res.json({ 
      message: 'Session refreshed successfully',
      session: data.session,
      user: data.user
    });
  } catch (error) {
    console.error('Refresh session error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to refresh session. Please try again.'
    });
  }
});

// Get user preferences
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', req.user.id)
      .single();

    const defaultPreferences = {
      theme: 'light',
      notifications: {
        email: true,
        push: false,
        study_reminders: true,
        achievement_alerts: true
      },
      study: {
        default_session_duration: 30,
        preferred_difficulty: 'adaptive',
        break_reminders: true,
        focus_mode: false
      },
      privacy: {
        profile_public: false,
        show_progress: true,
        show_achievements: true
      }
    };

    res.json({ 
      preferences: profile?.preferences || defaultPreferences
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch preferences',
      details: 'Could not retrieve user preferences'
    });
  }
});

// Update user preferences
router.patch('/preferences', authMiddleware, async (req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid preferences',
        details: 'Preferences must be a valid object'
      });
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        preferences: preferences,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (error) {
      console.error('Update preferences error:', error);
      return res.status(500).json({ 
        error: 'Failed to update preferences',
        details: error.message
      });
    }

    res.json({ 
      message: 'Preferences updated successfully',
      preferences: preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to update preferences'
    });
  }
});

// Delete user account
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({ 
        error: 'Confirmation required',
        details: 'Please provide confirmation: "DELETE_MY_ACCOUNT"'
      });
    }

    const userId = req.user.id;

    // Delete user data (cascading will handle related data)
    const { error: deleteError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Delete user data error:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete user data',
        details: deleteError.message
      });
    }

    console.log(`🗑️ User account deleted: ${req.user.email}`);

    res.json({ 
      message: 'Account deleted successfully',
      details: 'Your account and all associated data have been permanently deleted'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to delete account'
    });
  }
});

module.exports = router;