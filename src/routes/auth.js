// src/routes/auth.js
const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Initialize user stats
    if (data.user) {
      const { error: statsError } = await supabase
        .from('user_stats')
        .insert({
          user_id: data.user.id,
          average_reading_speed_seconds: 0,
          total_pages_read: 0,
          total_time_spent_seconds: 0
        });

      if (statsError) {
        console.error('Error creating user stats:', statsError);
      }
    }

    res.status(201).json({ 
      message: 'User created successfully', 
      user: data.user,
      session: data.session 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign in
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ 
      message: 'Login successful', 
      user: data.user,
      session: data.session 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/user', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// Sign out
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;