-- ============================================================
-- Nestly v2 — Supabase PostgreSQL Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_gender CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS listing_type CASCADE;
DROP TYPE IF EXISTS property_type CASCADE;
DROP TYPE IF EXISTS gender_pref CASCADE;
DROP TYPE IF EXISTS listing_status CASCADE;

CREATE TYPE user_role AS ENUM ('student', 'landlord', 'admin');
CREATE TYPE user_gender AS ENUM ('male', 'female', 'other');
CREATE TYPE user_status AS ENUM ('active', 'suspended');
CREATE TYPE listing_type AS ENUM ('full_property', 'peer_listing');
CREATE TYPE property_type AS ENUM ('single_room', 'shared_room', 'full_mess', 'sublet');
CREATE TYPE gender_pref AS ENUM ('male', 'female', 'any');
CREATE TYPE listing_status AS ENUM ('available', 'occupied', 'soon_vacant');
CREATE TYPE electricity_type AS ENUM ('individual', 'shared');
CREATE TYPE sleep_schedule AS ENUM ('early', 'late', 'flexible');
CREATE TYPE diet_type AS ENUM ('vegetarian', 'non_veg', 'halal_strict');
CREATE TYPE guest_policy AS ENUM ('allowed', 'restricted', 'not_allowed');
CREATE TYPE noise_tolerance AS ENUM ('quiet', 'moderate', 'noisy');
CREATE TYPE complaint_category AS ENUM ('hidden_costs', 'harassment', 'deposit_not_returned', 'misrepresentation', 'other');
CREATE TYPE complaint_status AS ENUM ('submitted', 'under_review', 'resolved');
CREATE TYPE seeking_property_type AS ENUM ('single_room', 'shared_room', 'full_mess', 'sublet', 'any');
CREATE TYPE seeking_status AS ENUM ('active', 'fulfilled');
CREATE TYPE payment_status AS ENUM ('paid', 'unpaid');
CREATE TYPE item_category AS ENUM ('furniture', 'appliances', 'electronics', 'kitchen', 'study', 'other');
CREATE TYPE item_condition AS ENUM ('new', 'like_new', 'good', 'fair');
CREATE TYPE item_status AS ENUM ('available', 'sold', 'withdrawn');
CREATE TYPE offer_status AS ENUM ('pending', 'countered', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE application_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE nid_type AS ENUM ('National ID', 'Passport', 'Driving License');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE response_status AS ENUM ('pending', 'accepted', 'rejected');

-- ============================================================
-- 1. profiles (mirrors auth.users, links to Supabase Auth)
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    gender user_gender NOT NULL,
    phone VARCHAR(20),
    university_id VARCHAR(50) UNIQUE,
    profile_pic TEXT,
    status user_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: auto-create profile row when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, gender)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'),
    COALESCE((NEW.raw_user_meta_data->>'gender')::user_gender, 'other')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- 2. zones
-- ============================================================
CREATE TABLE zones (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    description TEXT,
    center_lat NUMERIC(9,6) NOT NULL,
    center_lng NUMERIC(9,6) NOT NULL,
    radius_km NUMERIC(4,2) NOT NULL
);

-- ============================================================
-- 3. listings
-- ============================================================
CREATE TABLE listings (
    listing_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    zone_id INT REFERENCES zones(zone_id),
    listing_type listing_type NOT NULL,
    property_type property_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,
    gender_pref gender_pref NOT NULL DEFAULT 'any',
    total_rooms INT NOT NULL,
    current_occupancy INT DEFAULT 0,
    status listing_status DEFAULT 'available',
    expected_vacate_date DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    description TEXT,
    photos JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ============================================================
-- 4. utility_costs
-- ============================================================
CREATE TABLE utility_costs (
    cost_id SERIAL PRIMARY KEY,
    listing_id INT UNIQUE REFERENCES listings(listing_id) ON DELETE CASCADE,
    base_rent NUMERIC(10,2) NOT NULL,
    electricity_amount NUMERIC(8,2) DEFAULT 0,
    electricity_type electricity_type NOT NULL DEFAULT 'individual',
    gas_bill NUMERIC(8,2) DEFAULT 0,
    water_bill NUMERIC(8,2) DEFAULT 0,
    internet_cost NUMERIC(8,2) DEFAULT 0,
    maintenance_fee NUMERIC(8,2) DEFAULT 0,
    caretaker_fee NUMERIC(8,2) DEFAULT 0,
    other_fees NUMERIC(8,2) DEFAULT 0,
    total_monthly NUMERIC(10,2) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER utility_costs_updated_at
  BEFORE UPDATE ON utility_costs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ============================================================
-- 5. listing_amenities
-- ============================================================
CREATE TABLE listing_amenities (
    amenity_id SERIAL PRIMARY KEY,
    listing_id INT UNIQUE REFERENCES listings(listing_id) ON DELETE CASCADE,
    attached_bathroom BOOLEAN DEFAULT FALSE,
    attached_kitchen BOOLEAN DEFAULT FALSE,
    is_furnished BOOLEAN DEFAULT FALSE,
    rooftop_access BOOLEAN DEFAULT FALSE,
    parking BOOLEAN DEFAULT FALSE,
    power_backup BOOLEAN DEFAULT FALSE,
    lift_access BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- 6. user_preferences
-- ============================================================
CREATE TABLE user_preferences (
    pref_id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    sleep_schedule sleep_schedule NOT NULL DEFAULT 'flexible',
    study_hours INT DEFAULT 0,
    diet diet_type NOT NULL DEFAULT 'non_veg',
    guest_policy guest_policy NOT NULL DEFAULT 'restricted',
    smoking_tolerance BOOLEAN DEFAULT FALSE,
    preferred_gender gender_pref NOT NULL DEFAULT 'any',
    cleanliness_score INT CHECK (cleanliness_score BETWEEN 1 AND 5) DEFAULT 3,
    noise_tolerance noise_tolerance NOT NULL DEFAULT 'moderate'
);

-- ============================================================
-- 7. reviews
-- ============================================================
CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings(listing_id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    value_for_money INT CHECK (value_for_money BETWEEN 1 AND 5),
    listing_accuracy INT CHECK (listing_accuracy BETWEEN 1 AND 5),
    landlord_response INT CHECK (landlord_response BETWEEN 1 AND 5),
    cleanliness INT CHECK (cleanliness BETWEEN 1 AND 5),
    safety INT CHECK (safety BETWEEN 1 AND 5),
    composite_score NUMERIC(3,2) NOT NULL,
    comment VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(listing_id, reviewer_id)
);

-- ============================================================
-- 8. complaints
-- ============================================================
CREATE TABLE complaints (
    complaint_id SERIAL PRIMARY KEY,
    complainant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    against_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id INT REFERENCES listings(listing_id) ON DELETE SET NULL,
    category complaint_category NOT NULL DEFAULT 'other',
    description TEXT NOT NULL,
    status complaint_status DEFAULT 'submitted',
    document_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ============================================================
-- 9. seeking_posts
-- ============================================================
CREATE TABLE seeking_posts (
    post_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    zone_id INT REFERENCES zones(zone_id),
    budget_min NUMERIC(10,2) NOT NULL,
    budget_max NUMERIC(10,2) NOT NULL,
    property_type seeking_property_type NOT NULL DEFAULT 'any',
    preferred_gender gender_pref NOT NULL DEFAULT 'any',
    move_in_date DATE,
    requirements TEXT,
    status seeking_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. monthly_bills
-- ============================================================
CREATE TABLE monthly_bills (
    bill_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings(listing_id) ON DELETE CASCADE,
    bill_month DATE NOT NULL,
    electricity_amount NUMERIC(8,2) DEFAULT 0,
    gas_amount NUMERIC(8,2) DEFAULT 0,
    water_amount NUMERIC(8,2) DEFAULT 0,
    internet_amount NUMERIC(8,2) DEFAULT 0,
    other_amount NUMERIC(8,2) DEFAULT 0,
    custom_fees JSONB DEFAULT '[]',
    total_amount NUMERIC(10,2) NOT NULL,
    per_person_amount NUMERIC(10,2) NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. bill_payments
-- ============================================================
CREATE TABLE bill_payments (
    payment_id SERIAL PRIMARY KEY,
    bill_id INT REFERENCES monthly_bills(bill_id) ON DELETE CASCADE,
    resident_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resident_label VARCHAR(50),
    status payment_status DEFAULT 'unpaid',
    paid_at TIMESTAMPTZ
);

-- ============================================================
-- 12. rent_history
-- ============================================================
CREATE TABLE rent_history (
    history_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings(listing_id) ON DELETE CASCADE,
    old_rent NUMERIC(10,2) NOT NULL,
    new_rent NUMERIC(10,2) NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- 13. items (Exchange Marketplace)
-- ============================================================
CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    zone_id INT REFERENCES zones(zone_id),
    listing_id INT REFERENCES listings(listing_id) ON DELETE SET NULL,
    category item_category NOT NULL DEFAULT 'other',
    title VARCHAR(200) NOT NULL,
    description TEXT,
    item_condition item_condition NOT NULL DEFAULT 'good',
    asking_price NUMERIC(10,2) NOT NULL,
    reason_for_selling VARCHAR(300),
    photo_url TEXT,
    photos JSONB,
    status item_status DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. offers
-- ============================================================
CREATE TABLE offers (
    offer_id SERIAL PRIMARY KEY,
    item_id INT REFERENCES items(item_id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    offer_price NUMERIC(10,2) NOT NULL,
    message VARCHAR(300),
    status offer_status DEFAULT 'pending',
    counter_price NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ============================================================
-- 15. applications
-- ============================================================
CREATE TABLE applications (
    application_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings(listing_id) ON DELETE CASCADE,
    applicant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT,
    status application_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. verifications
-- ============================================================
CREATE TABLE verifications (
    verification_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    nid_type nid_type NOT NULL,
    document_path TEXT NOT NULL,
    description TEXT,
    status verification_status DEFAULT 'pending',
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. watchlists
-- ============================================================
CREATE TABLE watchlists (
    watchlist_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id INT REFERENCES listings(listing_id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- ============================================================
-- 18. seeking_responses
-- ============================================================
CREATE TABLE seeking_responses (
    response_id SERIAL PRIMARY KEY,
    post_id INT REFERENCES seeking_posts(post_id) ON DELETE CASCADE,
    responder_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT,
    status response_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. notifications
-- ============================================================
CREATE TABLE notifications (
    notif_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(50),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA: Zones
-- ============================================================
INSERT INTO zones (zone_name, description, center_lat, center_lng, radius_km) VALUES
('Badda Campus Area','Immediate surroundings of the Badda university campuses', 23.797900, 90.449700, 1.5),
('Sayed Nagar',      'Residential area close to campus',          23.795000, 90.444000, 2.0),
('Shatarkul',        'Quiet neighbourhood south of campus',       23.791000, 90.435000, 2.5),
('Nurer Chala',      'Bustling commercial and residential area',  23.805000, 90.438000, 2.0),
('Aftabnagar',       'Planned residential sector',                23.766000, 90.434000, 3.0),
('Notun Bazar',      'Major transit and shopping hub',            23.797000, 90.422000, 2.5);

-- ============================================================
-- SEED DATA: Master Admin
-- NOTE: After running this schema, create the admin user in
-- Supabase Auth (Dashboard > Authentication > Users > Add User)
-- with the email/password you chose.
-- Then run this UPDATE to set the role to 'admin':
--
-- ============================================================
-- 20. Database Indexes for Performance
-- ============================================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_listings_user_id ON listings(user_id);
CREATE INDEX idx_listings_zone_id ON listings(zone_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_property_type ON listings(property_type);
CREATE INDEX idx_items_seller_id ON items(seller_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_zone_id ON items(zone_id);
CREATE INDEX idx_offers_item_id ON offers(item_id);
CREATE INDEX idx_offers_buyer_id ON offers(buyer_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_applications_listing_id ON applications(listing_id);
CREATE INDEX idx_applications_applicant_id ON applications(applicant_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_seeking_posts_user_id ON seeking_posts(user_id);
CREATE INDEX idx_seeking_posts_status ON seeking_posts(status);
CREATE INDEX idx_complaints_complainant_id ON complaints(complainant_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_monthly_bills_listing_id ON monthly_bills(listing_id);

-- ============================================================
-- 21. Row Level Security (RLS)
-- ============================================================

-- 1. profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. zones
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Zones are viewable by everyone." ON zones FOR SELECT USING (true);

-- 3. listings
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listings are viewable by everyone." ON listings FOR SELECT USING (true);
CREATE POLICY "Users can insert their own listings." ON listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own listings." ON listings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own listings." ON listings FOR DELETE USING (auth.uid() = user_id);

-- 4. utility_costs
ALTER TABLE utility_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Utility costs viewable by everyone." ON utility_costs FOR SELECT USING (true);
CREATE POLICY "Listing owners can manage utility costs." ON utility_costs FOR ALL USING (
  EXISTS (SELECT 1 FROM listings WHERE listings.listing_id = utility_costs.listing_id AND listings.user_id = auth.uid())
);

-- 5. listing_amenities
ALTER TABLE listing_amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Amenities viewable by everyone." ON listing_amenities FOR SELECT USING (true);
CREATE POLICY "Listing owners can manage amenities." ON listing_amenities FOR ALL USING (
  EXISTS (SELECT 1 FROM listings WHERE listings.listing_id = listing_amenities.listing_id AND listings.user_id = auth.uid())
);

-- 6. user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User preferences viewable by everyone." ON user_preferences FOR SELECT USING (true);
CREATE POLICY "Users can manage own preferences." ON user_preferences FOR ALL USING (auth.uid() = user_id);

-- 7. reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews viewable by everyone." ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert own reviews." ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update own reviews." ON reviews FOR UPDATE USING (auth.uid() = reviewer_id);
CREATE POLICY "Users can delete own reviews." ON reviews FOR DELETE USING (auth.uid() = reviewer_id);

-- 8. complaints
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own complaints." ON complaints FOR SELECT USING (auth.uid() = complainant_id);
CREATE POLICY "Users can insert own complaints." ON complaints FOR INSERT WITH CHECK (auth.uid() = complainant_id);

-- 9. seeking_posts
ALTER TABLE seeking_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seeking posts viewable by everyone." ON seeking_posts FOR SELECT USING (true);
CREATE POLICY "Users can manage own seeking posts." ON seeking_posts FOR ALL USING (auth.uid() = user_id);

-- 10. monthly_bills
ALTER TABLE monthly_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bills viewable by involved users." ON monthly_bills FOR SELECT USING (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM bill_payments WHERE bill_payments.bill_id = monthly_bills.bill_id AND bill_payments.resident_user_id = auth.uid())
);
CREATE POLICY "Listing owners can manage bills." ON monthly_bills FOR ALL USING (auth.uid() = created_by);

-- 11. bill_payments
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payments viewable by involved users." ON bill_payments FOR SELECT USING (
  resident_user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM monthly_bills WHERE monthly_bills.bill_id = bill_payments.bill_id AND monthly_bills.created_by = auth.uid())
);
CREATE POLICY "Residents can update their own payment status." ON bill_payments FOR UPDATE USING (resident_user_id = auth.uid());
CREATE POLICY "Listing owners can manage payments." ON bill_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM monthly_bills WHERE monthly_bills.bill_id = bill_payments.bill_id AND monthly_bills.created_by = auth.uid())
);

-- 12. rent_history
ALTER TABLE rent_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rent history viewable by everyone." ON rent_history FOR SELECT USING (true);
CREATE POLICY "Listing owners can manage rent history." ON rent_history FOR ALL USING (auth.uid() = changed_by);

-- 13. items
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items viewable by everyone." ON items FOR SELECT USING (true);
CREATE POLICY "Users can manage own items." ON items FOR ALL USING (auth.uid() = seller_id);

-- 14. offers
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Offers viewable by buyer and seller." ON offers FOR SELECT USING (
  buyer_id = auth.uid() OR
  EXISTS (SELECT 1 FROM items WHERE items.item_id = offers.item_id AND items.seller_id = auth.uid())
);
CREATE POLICY "Buyers can insert offers." ON offers FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Buyers and sellers can update offers." ON offers FOR UPDATE USING (
  buyer_id = auth.uid() OR
  EXISTS (SELECT 1 FROM items WHERE items.item_id = offers.item_id AND items.seller_id = auth.uid())
);

-- 15. applications
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applications viewable by applicant and owner." ON applications FOR SELECT USING (
  applicant_id = auth.uid() OR
  EXISTS (SELECT 1 FROM listings WHERE listings.listing_id = applications.listing_id AND listings.user_id = auth.uid())
);
CREATE POLICY "Applicants can insert applications." ON applications FOR INSERT WITH CHECK (applicant_id = auth.uid());
CREATE POLICY "Listing owners can update applications." ON applications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM listings WHERE listings.listing_id = applications.listing_id AND listings.user_id = auth.uid())
);

-- 16. verifications
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own verifications." ON verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verifications." ON verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 17. watchlists
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own watchlist." ON watchlists FOR ALL USING (auth.uid() = user_id);

-- 18. seeking_responses
ALTER TABLE seeking_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Responses viewable by responder and post owner." ON seeking_responses FOR SELECT USING (
  responder_id = auth.uid() OR
  EXISTS (SELECT 1 FROM seeking_posts WHERE seeking_posts.post_id = seeking_responses.post_id AND seeking_posts.user_id = auth.uid())
);
CREATE POLICY "Responders can insert responses." ON seeking_responses FOR INSERT WITH CHECK (responder_id = auth.uid());
CREATE POLICY "Post owners can update responses." ON seeking_responses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM seeking_posts WHERE seeking_posts.post_id = seeking_responses.post_id AND seeking_posts.user_id = auth.uid())
);

-- 19. notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications." ON notifications FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 20. Triggers for auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, gender)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'User'),
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role),
    COALESCE((new.raw_user_meta_data->>'gender')::public.user_gender, 'male'::public.user_gender)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
