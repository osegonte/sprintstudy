const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔧 Supabase Config Check:');
console.log('URL:', supabaseUrl ? '✅' : '❌', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET');
console.log('Anon Key:', supabaseAnonKey ? '✅' : '❌', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'NOT SET');
console.log('Service Key:', supabaseServiceKey ? '✅' : '❌', supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : 'NOT SET');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error(`Missing Supabase environment variables. Found: URL=${!!supabaseUrl}, ANON=${!!supabaseAnonKey}, SERVICE=${!!supabaseServiceKey}`);
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error(`Invalid SUPABASE_URL format: ${supabaseUrl}`);
}

// Client for user operations (with RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    fetch: (...args) => {
      // Custom fetch with better error handling
      return fetch(...args).catch(error => {
        console.log('🌐 Supabase fetch error (this is normal during initial setup):', error.message);
        throw error;
      });
    }
  }
});

// Admin client for service operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    fetch: (...args) => {
      return fetch(...args).catch(error => {
        console.log('🌐 Supabase admin fetch error (this is normal during initial setup):', error.message);
        throw error;
      });
    }
  }
});

// Test connection with better error handling
async function testConnection() {
  try {
    console.log('🧪 Testing Supabase connection...');
    
    // Simple health check that doesn't require tables
    const { data, error } = await supabase
      .from('_supabase_migrations')
      .select('version')
      .limit(1);
    
    if (error) {
      // If migrations table doesn't exist, try a basic RPC call
      const { data: rpcData, error: rpcError } = await supabase.rpc('version');
      
      if (rpcError) {
        console.log('ℹ️ Supabase connection established but database may need setup');
        console.log('   Error details:', rpcError.message);
        console.log('   This is normal if you haven\'t run the database migration yet');
      } else {
        console.log('✅ Supabase connection successful (via RPC)');
      }
    } else {
      console.log('✅ Supabase connection successful');
    }
    
  } catch (e) {
    console.log('ℹ️ Supabase connection test info:', e.message);
    console.log('   This is often normal during initial setup');
    console.log('   Your API should still work for basic operations');
  }
}

// Test connection after a delay to allow server startup
setTimeout(testConnection, 2000);

module.exports = { supabase, supabaseAdmin };