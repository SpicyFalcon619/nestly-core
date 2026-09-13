-- ============================================================
-- Nestly v2 — Migration 0002
-- Public Profiles + Live Messaging schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Extend the profiles table with new columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio          TEXT,
  ADD COLUMN IF NOT EXISTS is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS profile_slug TEXT UNIQUE;

-- 2. Slug generator function (re-runnable)
CREATE OR REPLACE FUNCTION public.generate_profile_slug(p_name TEXT, p_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  suffix    TEXT;
BEGIN
  base_slug := trim(both '-' from
    regexp_replace(
      regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )
  );
  suffix := left(replace(p_id::text, '-', ''), 4);
  RETURN base_slug || '-' || suffix;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Backfill slugs for existing profiles that don't have one yet
UPDATE public.profiles
SET    profile_slug = public.generate_profile_slug(name, id)
WHERE  profile_slug IS NULL;

-- 4. Trigger: auto-set slug on every new profile INSERT
CREATE OR REPLACE FUNCTION public.set_profile_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.profile_slug IS NULL THEN
    NEW.profile_slug := public.generate_profile_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_profile_slug ON public.profiles;
CREATE TRIGGER trigger_set_profile_slug
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_slug();

-- ============================================================
-- Messaging tables
-- ============================================================

-- 5. Conversations — one row per unique pair + context
CREATE TABLE IF NOT EXISTS public.conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id    INT  REFERENCES public.listings(listing_id) ON DELETE SET NULL,
  item_id       BIGINT REFERENCES public.items(item_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent true duplicates; context (listing/item) differentiates conversations
  UNIQUE (participant_a, participant_b, listing_id, item_id)
);

-- 6. Messages — the actual chat messages
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON public.conversations(participant_a);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON public.conversations(participant_b);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id   ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id         ON public.messages(sender_id);

-- 8. Row-Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- Conversations: only the two participants can see or create
DROP POLICY IF EXISTS "Participants can view conversations"   ON public.conversations;
DROP POLICY IF EXISTS "Participants can create conversations" ON public.conversations;

CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = participant_a OR auth.uid() = participant_b);

CREATE POLICY "Participants can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

-- Messages: participants of the conversation can read; only sender can insert
DROP POLICY IF EXISTS "Participants can view messages"  ON public.messages;
DROP POLICY IF EXISTS "Sender can insert messages"      ON public.messages;
DROP POLICY IF EXISTS "Participants can mark as read"   ON public.messages;

CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

CREATE POLICY "Sender can insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

CREATE POLICY "Participants can mark as read" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

-- 9. Enable Realtime for live messaging
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
