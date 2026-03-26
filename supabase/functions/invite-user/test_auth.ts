const SUPABASE_URL = 'https://vfldjkyofziplbjhrgjr.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbGRqa3lvZnppcGxiamhyZ2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTIxNTAsImV4cCI6MjA4OTYyODE1MH0.5b2UMKic386q8jGJuhK77wAtFky4Ndw7t_wH6dzorFk';

async function test() {
  const url = `${SUPABASE_URL}/functions/v1/invite-user`;

  console.log('Testing invite-user with anon auth...');
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({
      email: `test_verified_${Date.now()}@test.com`,
      name: 'Verificacao Teste',
      plan: 'basic',
      role: 'user',
      addon_credits: 0,
    }),
  });

  console.log('Response status:', res.status);
  const text = await res.text();
  console.log('Response body:', text);
}

test().catch(console.error);
