import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function attemptDelete() {
  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error("List users error:", listError);
    return;
  }
  
  // Find a user named "mueller quadros" or similar as seen in the image, or just any test user
  const user = users.users.find(u => u.email === 'muellerquadrosplataforma@gmail.com');
  if (!user) {
    console.log("Test user not found, printing available users:", users.users.map(u => u.email));
    return;
  }

  console.log("Attempting to delete user:", user.email, user.id);
  const { data, error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  console.log("Delete result:", data, error);
}

attemptDelete();
