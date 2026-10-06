// Supabase client configuration variables.
window.DEFAULT_SUPABASE_URL = "https://kvwjpzowmqhwlehrbxwx.supabase.co";
window.DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2d2pwem93bXFod2xlaHJieHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MDgxMzAsImV4cCI6MjEwMTQ4NDEzMH0.k26mTp7V8Hk6pVw1Nn2uhqZcsCUbufgs8EgiyOJ4pWo";

// Always prioritize explicitly configured project credentials and synchronize with localStorage
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
