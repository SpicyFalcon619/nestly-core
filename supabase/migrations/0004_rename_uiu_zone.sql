-- ============================================================
-- Rename the "UIU Campus Area" zone to a university-neutral name
-- as part of dropping the UIU-only branding. Same real location
-- (Badda, Dhaka) — only the name/description changes.
-- ============================================================
UPDATE zones
SET zone_name = 'Badda Campus Area',
    description = 'Immediate surroundings of the Badda university campuses'
WHERE zone_name = 'UIU Campus Area';
