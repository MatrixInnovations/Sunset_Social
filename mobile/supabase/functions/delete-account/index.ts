import { createClient } from 'npm:@supabase/supabase-js@2';

import { json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return json({ error: 'Sign in required.' }, 401);
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const removed = await admin.auth.admin.deleteUser(data.user.id);
  if (removed.error) {
    return json({ error: removed.error.message }, 500);
  }
  return json({ ok: true });
});
