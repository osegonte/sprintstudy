const { supabase } = require('./src/config/supabase');

async function debugAuth() {
  console.log('🔍 Debugging Authentication...');
  
  // Test 1: Create a test user
  console.log('\n1. Testing user creation...');
  const testEmail = 'debug@test.com';
  const testPassword = 'testpass123';
  
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        username: 'debuguser',
        full_name: 'Debug User'
      }
    }
  });
  
  if (signupError) {
    console.error('❌ Signup failed:', signupError);
    return;
  }
  
  console.log('✅ User created:', signupData.user?.id);
  console.log('📧 Email confirmed:', signupData.user?.email_confirmed_at ? 'Yes' : 'No');
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Try to login
  console.log('\n2. Testing login...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  
  if (loginError) {
    console.error('❌ Login failed:', loginError);
    
    // Check if user exists in auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(signupData.user.id);
    if (userError) {
      console.error('❌ User lookup failed:', userError);
    } else {
      console.log('✅ User exists in auth.users:', userData.user?.email);
      console.log('📧 Email confirmed:', userData.user?.email_confirmed_at ? 'Yes' : 'No');
    }
  } else {
    console.log('✅ Login successful:', loginData.user?.email);
  }
  
  // Cleanup
  if (signupData.user?.id) {
    await supabase.auth.admin.deleteUser(signupData.user.id);
    console.log('🧹 Cleanup: Test user deleted');
  }
}

debugAuth().catch(console.error);