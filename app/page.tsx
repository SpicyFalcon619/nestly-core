import { ShieldCheck, Users, ShoppingBag, Receipt, BadgeCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import ListingCard from '@/components/ListingCard';
import ExchangeItemCard from '@/components/ExchangeItemCard';
import HeroSearchForm from '@/components/HeroSearchForm';

export default async function Home() {
  const supabase = await createClient();
  
  // Fetch latest listings
  const { data: listingsData } = await supabase
    .from('listings')
    .select('*, costs:utility_costs(*)')
    .neq('status', 'occupied')
    .limit(4)
    .order('created_at', { ascending: false });
    
  const listings = listingsData || [];

  // Fetch latest exchange items
  const { data: itemsData } = await supabase
    .from('items')
    .select('*')
    .limit(4)
    .order('created_at', { ascending: false });
    
  const items = itemsData || [];
  
  // Check if user is logged in for ExchangeItemCard
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <h1>Find your home near UIU.<br /><span className="hero-accent">No hidden costs. Ever.</span></h1>
          <p>The only platform that actually shows every single bill like rent, electricity, gas, and internet right upfront, before you commit to a single taka.</p>
          <HeroSearchForm />
          <p className="hero-trust">Trusted by <strong>UIU students</strong> · Verified landlords · Transparent billing</p>
        </div>
      </section>

      <div className="container">
        <div className="bento-label">Everything you need. Nothing you don't.</div>
        <div className="bento-grid">
          <div className="bento-card bento-wide bento-emerald">
            <div className="bento-icon"><ShieldCheck size={32} /></div>
            <h3>No Hidden Costs</h3>
            <p>Rent, electricity (individual or shared), gas, water, internet, and caretaker fees are all tracked separately. We automatically sum them up into a true monthly total that's displayed right on the card.</p>
            <div className="bento-tag">Cost Transparency</div>
          </div>

          <div className="bento-card bento-tall">
            <div className="bento-icon bento-icon-soft"><Users size={32} /></div>
            <h3>Flatmate Matching</h3>
            <p>An 8-dimension compatibility score that compares your sleep schedule, diet, cleanliness, noise tolerance, guest rules, and more.</p>
            <div className="bento-score-preview">
              <div className="bsc-pill bsc-high"><span>High Match</span> <span>92%</span></div>
              <div className="bsc-pill bsc-mid"><span>Good Match</span> <span>71%</span></div>
              <div className="bsc-pill bsc-low"><span>Low Match</span> <span>38%</span></div>
            </div>
          </div>

          <div className="bento-card">
            <div className="bento-icon bento-icon-soft"><ShoppingBag size={32} /></div>
            <h3>Nestly Exchange</h3>
            <p>Buy and sell fans, tables, and appliances with people right in your campus zone. We've even built in a simple offer and counter-offer system.</p>
          </div>

          <div className="bento-card">
            <div className="bento-icon bento-icon-soft"><Receipt size={32} /></div>
            <h3>Mess Bill Manager</h3>
            <p>Split monthly utility bills automatically. Track who paid, who hasn't, across every resident.</p>
          </div>

          <div className="bento-card bento-wide bento-surface">
            <div className="bento-icon bento-icon-soft"><BadgeCheck size={32} /></div>
            <h3>Verified Landlords &amp; Reviews</h3>
            <p>NID-verified landlord badges, multi-dimension property reviews (accuracy, cleanliness, safety, value, landlord responsiveness), and a formal complaint system with admin resolution.</p>
            <div className="bento-tag">Trust Layer</div>
          </div>
        </div>

        <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="section-head">
            <h2>Latest listings near UIU</h2>
            <a href="/listings">Browse all listings →</a>
          </div>
          <div className="grid-4" id="latestListings">
            {listings.length > 0 ? (
              listings.map(l => (
                <ListingCard key={(l as any).listing_id || (l as any).id} listing={l as any} />
              ))
            ) : (
              <p style={{ color: 'var(--gray)', gridColumn: '1/-1', textAlign: 'center' }}>No listings available right now.</p>
            )}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Nestly Exchange: Buy and sell near campus</h2>
            <a href="/exchange">Browse all items →</a>
          </div>
          <div className="grid-4" id="latestItems">
            {items.length > 0 ? (
              items.map(item => (
                <ExchangeItemCard key={(item as any).item_id || (item as any).id} item={item as any} isLoggedIn={isLoggedIn} />
              ))
            ) : (
              <p style={{ color: 'var(--gray)', gridColumn: '1/-1', textAlign: 'center' }}>No items listed recently.</p>
            )}
          </div>
        </section>

        <section className="section" style={{ borderBottom: 'none' }}>
          <h2 className="section-center-title">How it works</h2>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><h3>Register</h3><p>Sign up with your UIU email address.</p></div>
            <div className="step"><div className="step-num">2</div><h3>Browse</h3><p>Browse verified listings with full cost breakdown.</p></div>
            <div className="step"><div className="step-num">3</div><h3>Connect</h3><p>Connect with landlords and compatible flatmates.</p></div>
          </div>
        </section>
      </div>
    </>
  );
}
