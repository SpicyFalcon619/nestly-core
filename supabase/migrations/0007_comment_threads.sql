-- ============================================================
-- 0007 — comment threads (replies) + @mentions
-- ============================================================
--
-- listing_comments / item_comments and their vote tables were created by hand
-- in the Supabase dashboard and were never captured in a migration. The
-- CREATE TABLE blocks below reproduce the LIVE shape — bigint ids, and no
-- foreign key from user_id to profiles — rather than an idealised one, so a
-- fresh project ends up with the same database the running one has. That
-- missing FK is why lib/comments.ts fetches authors in a second query instead
-- of using a PostgREST embed; don't "fix" one without the other.
--
-- On an existing project the CREATE TABLE blocks are skipped and only the
-- ALTERs at the bottom do anything.

CREATE TABLE IF NOT EXISTS listing_comments (
    comment_id  BIGSERIAL PRIMARY KEY,
    listing_id  BIGINT NOT NULL,
    user_id     UUID NOT NULL,
    content     TEXT NOT NULL,
    upvotes     INT DEFAULT 0,
    downvotes   INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_comments (
    comment_id  BIGSERIAL PRIMARY KEY,
    item_id     BIGINT NOT NULL,
    user_id     UUID NOT NULL,
    content     TEXT NOT NULL,
    upvotes     INT DEFAULT 0,
    downvotes   INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_comment_votes (
    comment_id  BIGINT NOT NULL,
    user_id     UUID NOT NULL,
    vote_type   SMALLINT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS item_comment_votes (
    comment_id  BIGINT NOT NULL,
    user_id     UUID NOT NULL,
    vote_type   SMALLINT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

-- ── Replies ────────────────────────────────────────────────
-- Self-referencing parent. The UI only ever renders two levels: a reply to a
-- reply is stored against the same root and carries an @mention instead, so
-- threads can't march off the right edge of the screen.
ALTER TABLE listing_comments
  ADD COLUMN IF NOT EXISTS parent_id BIGINT
  REFERENCES listing_comments(comment_id) ON DELETE CASCADE;

ALTER TABLE item_comments
  ADD COLUMN IF NOT EXISTS parent_id BIGINT
  REFERENCES item_comments(comment_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS listing_comments_parent_idx ON listing_comments(parent_id);
CREATE INDEX IF NOT EXISTS item_comments_parent_idx    ON item_comments(parent_id);

-- ── Mentions ───────────────────────────────────────────────
-- [{ "id": uuid, "name": text, "slug": text|null }]. The name is stored with
-- the mention because the comment body holds "@Name" as plain text: rendering
-- links without re-querying every mentioned profile needs both halves, and a
-- later rename shouldn't silently break the link.
ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS mentions JSONB;
ALTER TABLE item_comments    ADD COLUMN IF NOT EXISTS mentions JSONB;
