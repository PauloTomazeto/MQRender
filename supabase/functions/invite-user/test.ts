import 'dotenv/config';

async function test() {
  const url = 'https://vfldjkyofziplbjhrgjr.supabase.co/functions/v1/invite-user';
  console.log('Sending payload to invite-user...');
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test_timeout123@test.com',
      name: 'Test Timeout',
      plan: 'basic',
      role: 'user',
      addon_credits: 0
    })
  });
  console.log('POST full payload status:', res.status);
  console.log('POST full payload text:', await res.text());
}

test();
