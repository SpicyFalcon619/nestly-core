'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomSelect from './CustomSelect';

export default function HeroSearchForm() {
  const router = useRouter();
  const [zone, setZone] = useState('');
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (zone && zone !== 'all') params.set('zone', zone);
    if (type && type !== 'all') params.set('type', type);
    if (budget) params.set('budget', budget);
    router.push(`/listings?${params.toString()}`);
  };

  return (
    <form className="hero-search" onSubmit={handleSearch}>
      <div className="hero-search-field">
        <label className="hs-label">Zone</label>
        <CustomSelect
          name="zone"
          value={zone || 'all'}
          onChange={(v) => setZone(v)}
          options={[
            { value: 'all', label: 'All Zones' },
            { value: 'Badda Campus Area', label: 'Badda Campus Area' },
            { value: 'Sayed Nagar', label: 'Sayed Nagar' },
            { value: 'Shatarkul', label: 'Shatarkul' },
            { value: 'Nurer Chala', label: 'Nurer Chala' },
            { value: 'Aftabnagar', label: 'Aftabnagar' },
            { value: 'Notun Bazar', label: 'Notun Bazar' }
          ]}
        />
      </div>
      <span className="search-divider"></span>
      <div className="hero-search-field">
        <label className="hs-label">Room Type</label>
        <CustomSelect
          name="type"
          value={type || 'all'}
          onChange={(v) => setType(v)}
          options={[
            { value: 'all', label: 'Any type' },
            { value: 'single_room', label: 'Single Room' },
            { value: 'shared_room', label: 'Shared Room' },
            { value: 'full_mess', label: 'Full Mess' },
            { value: 'sublet', label: 'Sub-let' }
          ]}
        />
      </div>
      <span className="search-divider"></span>
      <div className="hero-search-field">
        <label className="hs-label">Max Budget</label>
        <input 
          type="number" 
          name="budget" 
          placeholder="৳ 15,000" 
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary hs-btn">Search Listings</button>
    </form>
  );
}
