-- ============================================================
-- Contact details: stage 1 of 2 (functions only, safe to apply any time).
--
-- profiles holds three private columns: email, phone and university_id.
-- Today the public SELECT policy lets anyone with the public API key read
-- them for every user, so the product's own rule ("contact details stay
-- private until the landlord accepts") is only enforced in page code.
--
-- Stage 2 (migration 0011) locks those columns at the database. This stage
-- adds the two functions the app needs once they are locked:
--
--   get_my_profile()               your own complete profile row
--   get_contact_details(uuid[])    email and phone of other people, but only
--                                  where the product says you may see them
--
-- Apply this BEFORE deploying the matching app change, and apply 0011 only
-- after the app change is live and tested.
--
-- Who may see whose email and phone (the rules, in one place):
--   * you, your own
--   * an admin, anyone's
--   * a landlord, the people who applied to their listings
--   * an applicant, the landlord, once the application is accepted
--   * a seller and a buyer, each other, once the buyer has made an offer
--   * the author of a "seeking" post and anyone who responded to it, each other
-- Nobody else, including signed-in users and visitors who are not signed in.
-- university_id is never returned by get_contact_details.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_contact_details(target_ids uuid[])
RETURNS TABLE (id uuid, email text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email::text, p.phone::text
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY (target_ids)
    AND (
      -- yourself
      p.id = auth.uid()

      -- an admin
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'admin'
      )

      -- a landlord sees the people who applied to their listings
      OR EXISTS (
        SELECT 1
        FROM public.applications a
        JOIN public.listings l ON l.listing_id = a.listing_id
        WHERE a.applicant_id = p.id AND l.user_id = auth.uid()
      )

      -- an applicant sees the landlord once the application is accepted
      OR EXISTS (
        SELECT 1
        FROM public.applications a
        JOIN public.listings l ON l.listing_id = a.listing_id
        WHERE a.applicant_id = auth.uid() AND l.user_id = p.id AND a.status = 'accepted'
      )

      -- a buyer who made an offer sees the seller
      OR EXISTS (
        SELECT 1
        FROM public.offers o
        JOIN public.items i ON i.item_id = o.item_id
        WHERE o.buyer_id = auth.uid() AND i.seller_id = p.id
      )

      -- a seller sees the people who made offers on their items
      OR EXISTS (
        SELECT 1
        FROM public.offers o
        JOIN public.items i ON i.item_id = o.item_id
        WHERE i.seller_id = auth.uid() AND o.buyer_id = p.id
      )

      -- someone who responded to a seeking post sees its author
      OR EXISTS (
        SELECT 1
        FROM public.seeking_responses r
        JOIN public.seeking_posts sp ON sp.post_id = r.post_id
        WHERE r.responder_id = auth.uid() AND sp.user_id = p.id
      )

      -- the author of a seeking post sees the people who responded
      OR EXISTS (
        SELECT 1
        FROM public.seeking_responses r
        JOIN public.seeking_posts sp ON sp.post_id = r.post_id
        WHERE sp.user_id = auth.uid() AND r.responder_id = p.id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_contact_details(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_details(uuid[]) TO authenticated;

-- ============================================================
-- Before applying: confirm the columns these rules rely on exist in
-- your live database (run this; expect 13 rows). The repository's older
-- migrations do not fully describe production, so check rather than assume.
--
--   select table_name, column_name
--   from information_schema.columns
--   where table_schema = 'public' and (table_name, column_name) in (
--     ('applications','applicant_id'), ('applications','listing_id'), ('applications','status'),
--     ('listings','listing_id'), ('listings','user_id'),
--     ('offers','buyer_id'), ('offers','item_id'),
--     ('items','item_id'), ('items','seller_id'),
--     ('seeking_responses','post_id'), ('seeking_responses','responder_id'),
--     ('seeking_posts','post_id'), ('seeking_posts','user_id')
--   );
-- ============================================================
