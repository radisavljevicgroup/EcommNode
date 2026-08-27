-- Run this in Supabase → SQL Editor. Marks the test account as confirmed
-- directly in the database — no email gets sent, so the rate limit never
-- comes into play.

update auth.users
set email_confirmed_at = now()
where email = 'shopstack.settings.test@gmail.com';
