-- ============================================================
-- A private bucket for identity-verification documents.
--
-- Until now verification documents were uploaded to the public
-- 'uiunest' bucket, next to listing and avatar photos, and the app
-- stored a public URL for each one. Anyone holding that URL could open
-- a national ID or passport with no login at all, and a public bucket
-- cannot be made to hide individual folders.
--
-- This creates a separate, PRIVATE bucket just for those documents.
-- It deliberately has no storage policies: with RLS on and no policy,
-- the public anon key and signed-in users cannot read or write it. Only
-- the server (service-role key) can, and the admin screen asks the server
-- for a short-lived signed link each time a document is opened.
--
-- Safe to apply before deploying the app change. Documents already in
-- the public bucket keep working until scripts/migrate-verification-docs.mjs
-- moves them across.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verifications',
  'verifications',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- After applying, confirm in the Supabase dashboard (Storage) that the
-- 'verifications' bucket exists and is NOT marked Public.
