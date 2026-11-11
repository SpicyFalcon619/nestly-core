-- ============================================================
-- Contact details: stage 2 of 2 (the lock). READ BEFORE APPLYING.
--
-- Apply this only after:
--   1. migration 0010 is applied, and
--   2. the app version that reads contacts through get_my_profile() and
--      get_contact_details() is deployed and tested.
-- Older app code that does select('*') on profiles, or selects email, phone
-- or university_id from it, will fail once this runs.
--
-- What it does: the public and signed-in API roles (anon, authenticated)
-- lose the right to read three columns of profiles: email, phone and
-- university_id. Every other column stays readable exactly as before, so
-- names, photos, bios and profile links keep working everywhere. Row level
-- security is unchanged. The server (service role) and the SQL editor are
-- not affected, and the SECURITY DEFINER functions from 0010 still work.
--
-- Note for the future: after this, a NEW column added to profiles is not
-- readable by the API until you grant it, for example:
--   grant select (new_column) on public.profiles to anon, authenticated;
--
-- To undo this migration completely:
--   grant select on public.profiles to anon, authenticated;
-- ============================================================

DO $$
DECLARE
  readable_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO readable_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name NOT IN ('email', 'phone', 'university_id');

  EXECUTE 'REVOKE SELECT ON public.profiles FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon, authenticated', readable_cols);
END
$$;

-- ============================================================
-- Verify (run these by hand after applying; each should return false,
-- then true):
--
--   select has_column_privilege('anon',          'public.profiles', 'email', 'select') as anon_email,
--          has_column_privilege('authenticated', 'public.profiles', 'phone', 'select') as authed_phone,
--          has_column_privilege('authenticated', 'public.profiles', 'name',  'select') as authed_name;
--   -- expected: false, false, true
-- ============================================================
