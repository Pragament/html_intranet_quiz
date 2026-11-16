// Supabase client configuration variables for Smart School Automation
window.DEFAULT_SUPABASE_URL = "https://blqnzrhiatvfydmswprb.supabase.co";
window.DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscW56cmhpYXR2ZnlkbXN3cHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2NjM3ODYsImV4cCI6MjExMDIzOTc4Nn0.9PytkMfnlmr909cEy5-J3-3Gzuxh81rSKLvz0pnJQGU";

// Synchronize with localStorage
if (window.DEFAULT_SUPABASE_URL && window.DEFAULT_SUPABASE_ANON_KEY) {
  try {
    localStorage.setItem('SUPABASE_URL', window.DEFAULT_SUPABASE_URL);
    localStorage.setItem('SUPABASE_ANON_KEY', window.DEFAULT_SUPABASE_ANON_KEY);
  } catch (e) {}
  window.SUPABASE_URL = window.DEFAULT_SUPABASE_URL;
  window.SUPABASE_ANON_KEY = window.DEFAULT_SUPABASE_ANON_KEY;
} else {
  window.SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || "";
  window.SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || "";
}
