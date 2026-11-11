-- ============================================================
-- Close the administrator privilege escalation.
--
-- Two independent paths let any signed-up user become an admin:
--
--   A. handle_new_user() copied raw_user_meta_data->>'role' into
--      profiles.role. That metadata is supplied by the client at
--      sign-up, so anyone can sign up with role = 'admin'.
--
--   B. The "Users can update own profile." policy allows a user to
--      UPDATE any column of their own row, including role and status
--      (RLS limits rows, not columns). A user could promote themselves,
--      or reactivate their own suspended account.
--
-- The app treats profiles.role as the source of truth for admin access
-- (app/actions/admin.ts and proxy.ts), so both paths gave full admin.
--
-- This migration is safe to apply before or after deploying the app.
-- It changes nothing for normal use: the app never writes role or
-- status from a user session. The admin screens write status through
-- the service-role client, which is explicitly allowed below.
-- ============================================================

-- 1. Sign-up never grants admin. A client may choose student or landlord;
--    anything else (including 'admin') becomes student.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, gender)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'User'),
    CASE
      WHEN new.raw_user_meta_data->>'role' = 'landlord'
        THEN 'landlord'::public.user_role
      ELSE 'student'::public.user_role
    END,
    COALESCE((new.raw_user_meta_data->>'gender')::public.user_gender, 'male'::public.user_gender)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Only trusted callers may change role, status or id.
--    "Trusted" means anything that is not an end-user request: the
--    service-role client used by the admin server actions, and a person
--    running SQL in the Supabase dashboard (no JWT at all).
--    Requests made with the public anon key or a signed-in user's token
--    carry role 'anon' or 'authenticated' and are rejected.
CREATE OR REPLACE FUNCTION public.profiles_protect_privileged_columns()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') IN ('anon', 'authenticated') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profiles.role can only be changed by an administrator process'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'profiles.status can only be changed by an administrator process'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'profiles.id cannot be changed'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_profiles_protect_privileged_columns ON public.profiles;
CREATE TRIGGER trg_profiles_protect_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_privileged_columns();

-- 3. Defence in depth on the policies themselves.
--    UPDATE: add the missing WITH CHECK so a row cannot be handed to
--    someone else.
--    INSERT: the sign-up trigger creates the row, so a direct INSERT from a
--    user session is never needed. If one happens it must be a plain,
--    active student profile.
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND role = 'student'
    AND status = 'active'
  );

-- ============================================================
-- After applying (run these by hand in the Supabase SQL editor)
-- ============================================================
--
-- 1. Review every administrator. Anyone you do not recognise was
--    probably self-promoted and should be demoted:
--
--      select id, email, name, created_at
--      from public.profiles
--      where role = 'admin'
--      order by created_at;
--
--    To demote (the SQL editor runs without a JWT, so the guard allows it):
--
--      update public.profiles set role = 'student' where id = '<uuid>';
--
-- 2. Confirm the guard works. In the SQL editor, impersonate a normal
--    user and try to promote yourself. Replace <uuid> with any real
--    profile id. Expect: ERROR 42501 "profiles.role can only be changed
--    by an administrator process".
--
--      begin;
--      set local role authenticated;
--      select set_config('request.jwt.claims',
--        '{"sub":"<uuid>","role":"authenticated"}', true);
--      update public.profiles set role = 'admin' where id = '<uuid>';
--      rollback;
--
-- 3. Confirm sign-up ignores a client-supplied role. Sign up a throwaway
--    account with user metadata { role: 'admin' } and check that its
--    profile row has role = 'student'. Delete the throwaway account after.
-- ============================================================
