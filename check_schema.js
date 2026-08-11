require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const email = `test_${Date.now()}@example.com`;
  const password = "password123";

  // 1. Sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });
  if (signUpError) {
    console.error('Sign up error:', signUpError.message);
    return;
  }
  console.log('Signed up successfully');

  // 2. Query student_responses
  const { data, error } = await supabase.from('student_responses').select('*').limit(1);
  if (error) {
    console.error('Error fetching student_responses:', error);
  } else {
    console.log('student_responses row:', data);
  }

  // Clean up user
  await supabase.auth.signOut();
}
check();
