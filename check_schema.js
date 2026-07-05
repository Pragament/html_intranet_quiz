const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://fkheqnnazjsgxebziwjn.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraGVxbm5hempzZ3hlYnppd2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTYwODIsImV4cCI6MjA5Nzc5MjA4Mn0.1crSgKS1A3-6ZIzx0gRiV1r-ZShlg_Z0LjIo24rvOcY";
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
