const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize Supabase Client (Service Role key used for admin operations if needed, or Anon key)
const supabaseUrl = process.env.SUPABASE_URL || 'https://fkheqnnazjsgxebziwjn.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Auth Middleware (Route Guard)
// ==========================================
// Protects backend endpoints by validating the Supabase JWT sent in the Authorization header
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    
    // Validate JWT and retrieve user profile details from Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.warn(`[Auth Guard] Token validation failed: ${error ? error.message : 'User not found'}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid token session' });
    }

    // Attach user metadata to request context
    req.user = user;
    next();
  } catch (err) {
    console.error(`[Auth Guard Error] Unexpected verification error: ${err.message}`);
    return res.status(500).json({ error: 'Internal server validation error' });
  }
};

// ==========================================
// Webhook Handlers
// ==========================================
// Endpoint to receive auth.users events (INSERT/DELETE) from Supabase webhooks
app.post('/api/webhooks/user', async (req, res) => {
  // Verify webhook signature/secret to secure the endpoint
  const webhookSecret = req.headers['x-webhook-secret'];
  if (webhookSecret !== process.env.WEBHOOK_SECRET) {
    console.warn(`[Webhook Warning] Unauthorized webhook attempt received.`);
    return res.status(401).json({ error: 'Unauthorized: Webhook secret mismatch' });
  }

  const { type, record, old_record } = req.body;

  try {
    if (type === 'INSERT') {
      const { id, email, raw_user_meta_data } = record;
      const displayName = raw_user_meta_data?.full_name || '';

      // Sync non-sensitive user metadata into the public profiles table
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: id,
          email: email,
          full_name: displayName,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      console.log(`[Webhook Event] Synchronized user metadata for: ${email} (${id})`);
    } 
    
    else if (type === 'DELETE') {
      const { id } = old_record;

      // Delete non-sensitive metadata from profiles when user is deleted
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log(`[Webhook Event] Deleted synced metadata profile for user ID: ${id}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[Webhook Error] User synchronization failed: ${err.message}`);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==========================================
// Protected Routes Example
// ==========================================
app.get('/api/teacher/dashboard', requireAuth, async (req, res) => {
  try {
    // Only non-sensitive context is accessed
    const teacherId = req.user.id;
    const email = req.user.email;

    // Fetch quiz data for the authenticated teacher
    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('teacher_id', teacherId);

    if (error) throw error;

    return res.status(200).json({
      message: `Welcome back, ${email}`,
      quizzes
    });
  } catch (err) {
    console.error(`[API Error] Failed to fetch dashboard data: ${err.message}`);
    return res.status(500).json({ error: 'Failed to retrieve dashboard data' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Supabase integrated auth server running on port ${PORT}`);
});
