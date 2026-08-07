// Supabase client configuration variables
window.DEFAULT_SUPABASE_URL = "";
window.DEFAULT_SUPABASE_ANON_KEY = "";

window.SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || window.DEFAULT_SUPABASE_URL;
window.SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || window.DEFAULT_SUPABASE_ANON_KEY;

