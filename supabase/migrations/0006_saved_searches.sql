-- ============================================================
-- Saved searches + new-listing alerts.
--
-- A saved search stores the canonical /listings query string (see
-- lib/savedSearch.ts → canonicalSearch), so the same filters in a different
-- order or with pagination can never be saved twice.
--
-- saved_search_alerts records which listings have already been announced
-- for which search. Its primary key is what guarantees a user is told about
-- a given listing once, however many times the matcher runs.
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_searches (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    query       TEXT NOT NULL,
    label       TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, query)
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);

CREATE TABLE IF NOT EXISTS saved_search_alerts (
    saved_search_id BIGINT NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
    listing_id      INT    NOT NULL REFERENCES listings(listing_id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (saved_search_id, listing_id)
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own saved searches." ON saved_searches;
CREATE POLICY "Users manage their own saved searches." ON saved_searches
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Alerts are written and read only by the server (service role), so RLS is
-- enabled with no policies: no client can read or forge alert history.
ALTER TABLE saved_search_alerts ENABLE ROW LEVEL SECURITY;
