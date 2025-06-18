// Debug script to test environment variable loading
// Run with: node debug-env.js

const path = require('path');
const fs = require('fs');

console.log('🔍 Environment Debug Script');
console.log('================================');

// Check current working directory
console.log('Current working directory:', process.cwd());
console.log('Script location:', __dirname);

// Check for .env file in different locations
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
];

console.log('\n📁 Checking for .env file:');
possibleEnvPaths.forEach(envPath => {
  const exists = fs.existsSync(envPath);
  console.log(`${exists ? '✅' : '❌'} ${envPath}`);
  
  if (exists) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      console.log(`   File size: ${content.length} characters`);
      console.log(`   Lines: ${content.split('\n').length}`);
      
      // Check for Supabase variables without exposing values
      const hasSupabaseUrl = content.includes('SUPABASE_URL=');
      const hasSupabaseAnon = content.includes('SUPABASE_ANON_KEY=');
      const hasSupabaseService = content.includes('SUPABASE_SERVICE_KEY=');
      
      console.log(`   Contains SUPABASE_URL: ${hasSupabaseUrl ? '✅' : '❌'}`);
      console.log(`   Contains SUPABASE_ANON_KEY: ${hasSupabaseAnon ? '✅' : '❌'}`);
      console.log(`   Contains SUPABASE_SERVICE_KEY: ${hasSupabaseService ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   Error reading file: ${error.message}`);
    }
  }
});

// Test dotenv loading
console.log('\n🔧 Testing dotenv loading:');

// Method 1: Default dotenv
try {
  require('dotenv').config();
  console.log('✅ Default dotenv.config() - SUCCESS');
} catch (error) {
  console.log('❌ Default dotenv.config() - ERROR:', error.message);
}

console.log('Environment after default config:');
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('SUPABASE_SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_KEY);

// Method 2: Explicit path
const explicitEnvPath = path.join(process.cwd(), '.env');
try {
  require('dotenv').config({ path: explicitEnvPath });
  console.log('✅ Explicit path dotenv.config() - SUCCESS');
} catch (error) {
  console.log('❌ Explicit path dotenv.config() - ERROR:', error.message);
}

console.log('\nEnvironment after explicit path config:');
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('SUPABASE_SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_KEY);

// Show all environment variables starting with SUPABASE
console.log('\n🔍 All SUPABASE environment variables:');
const supabaseEnvs = Object.keys(process.env).filter(key => key.startsWith('SUPABASE'));
if (supabaseEnvs.length === 0) {
  console.log('❌ No SUPABASE environment variables found');
} else {
  supabaseEnvs.forEach(key => {
    const value = process.env[key];
    console.log(`${key}: ${value ? `${value.substring(0, 20)}...` : 'NOT SET'}`);
  });
}

// Manual file reading test
console.log('\n📖 Manual .env file reading test:');
const mainEnvPath = path.join(process.cwd(), '.env');
if (fs.existsSync(mainEnvPath)) {
  try {
    const envContent = fs.readFileSync(mainEnvPath, 'utf8');
    const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    console.log(`Found ${lines.length} non-empty, non-comment lines`);
    
    lines.forEach(line => {
      if (line.includes('SUPABASE')) {
        const [key] = line.split('=');
        console.log(`Found: ${key.trim()}`);
      }
    });
    
    // Try manual parsing
    console.log('\n🔧 Manual environment parsing:');
    lines.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      
      if (key && key.startsWith('SUPABASE')) {
        // Don't set in actual process.env, just test parsing
        console.log(`Parsed ${key.trim()}: ${value ? 'HAS_VALUE' : 'NO_VALUE'}`);
      }
    });
    
  } catch (error) {
    console.log('❌ Error reading .env file manually:', error.message);
  }
} else {
  console.log('❌ No .env file found at expected location');
}

console.log('\n================================');
console.log('Debug complete. Check the output above for issues.');