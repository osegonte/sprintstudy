const { supabase } = require('../config/supabase');
const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Enhanced debugging
    console.log(`🔒 Auth middleware check for ${req.method} ${req.path}`);
    console.log(`📋 Headers: Authorization present: ${!!authHeader}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid authorization header found');
      return res.status(401).json({ 
        error: 'No authorization token provided',
        details: 'Please include a valid Bearer token in the Authorization header'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log(`🎫 Token received: ${token.substring(0, 20)}...`);
    
    // Verify the JWT token with Supabase
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.log('❌ Supabase token verification failed:', error.message);
        
        // Try manual JWT verification as fallback
        if (process.env.SUPABASE_JWT_SECRET) {
          try {
            const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
            console.log('✅ Manual JWT verification successful');
            
            // Create a user object from JWT payload
            req.user = {
              id: decoded.sub,
              email: decoded.email,
              aud: decoded.aud,
              role: decoded.role || 'authenticated',
              aal: decoded.aal,
              ...decoded
            };
            
            return next();
          } catch (jwtError) {
            console.log('❌ Manual JWT verification failed:', jwtError.message);
          }
        }
        
        return res.status(401).json({ 
          error: 'Invalid or expired token',
          details: error.message
        });
      }

      if (!user) {
        console.log('❌ No user found for token');
        return res.status(401).json({ 
          error: 'User not found',
          details: 'Token is valid but user does not exist'
        });
      }

      console.log(`✅ User authenticated: ${user.email} (${user.id})`);
      req.user = user;
      next();
      
    } catch (authError) {
      console.error('🚨 Auth verification error:', authError);
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Unable to verify token'
      });
    }
    
  } catch (error) {
    console.error('💥 Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication system error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Optional middleware for routes that accept both authenticated and anonymous users
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue as anonymous
    req.user = null;
    return next();
  }

  // Token provided, try to authenticate
  try {
    await authMiddleware(req, res, next);
  } catch (error) {
    // If auth fails, continue as anonymous instead of erroring
    req.user = null;
    next();
  }
};

// Middleware to check if user has specific role
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (req.user.role !== role) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required_role: role,
        user_role: req.user.role
      });
    }
    
    next();
  };
};

// Middleware to check if user owns a resource
const requireOwnership = (getUserIdFromRequest) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const resourceUserId = getUserIdFromRequest(req);
    if (resourceUserId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied',
        details: 'You can only access your own resources'
      });
    }
    
    next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireOwnership
};