-- ============================================================
-- Limits for the public 'uiunest' bucket (listing, avatar and exchange photos).
--
-- The bucket had no size limit beyond the project default and accepted any
-- file type. Anything uploaded here is served to the public from the
-- project's own storage domain, so only images are allowed, and each file is
-- capped at 10 MB. SVG is deliberately NOT allowed: it can carry script.
--
-- Photos are uploaded straight from the browser for listings and avatars, so
-- this bucket setting is the only server-side limit that applies to them.
--
-- Identity documents do not use this bucket (see 0009).
-- To undo:  update storage.buckets set file_size_limit = null,
--           allowed_mime_types = null where id = 'uiunest';
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 10485760,  -- 10 MB
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/avif', 'image/heic', 'image/heif'
    ]
WHERE id = 'uiunest';

-- After applying, upload a listing photo and an avatar in the app to confirm
-- both still work. A phone photo in an unusual format would now be refused.
