'use client';

import { useState, useMemo } from 'react';
import type { Item, Zone } from '@/types';
import ExchangeItemCard from '@/components/ExchangeItemCard';
import { useRouter } from 'next/navigation';
import SellItemModal from '@/components/modals/SellItemModal';
import { fmt } from '@/lib/utils';
import { ShoppingBag, Search, Filter } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

export default function ExchangeContent({
  items,
  zones,
  isLoggedIn,
  isAdmin
}: {
  items: Item[];
  zones: Zone[];
  isLoggedIn: boolean;
  isAdmin?: boolean;
}) {
  const [filterCat, setFilterCat] = useState('all');
  const [filterCond, setFilterCond] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [maxPrice, setMaxPrice] = useState(20000);
  const [sort, setSort] = useState('newest');
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const router = useRouter();

  const filteredItems = useMemo(() => {
    let result = items.filter(it => {
      if (it.status !== 'available') return false;
      if (filterCat !== 'all' && it.category !== filterCat) return false;
      if (filterCond !== 'all' && it.item_condition !== filterCond) return false;
      if (filterZone !== 'all' && it.zone !== filterZone) return false;
      if (it.asking_price > maxPrice) return false;
      return true;
    });

    if (sort === 'lo') result.sort((a, b) => a.asking_price - b.asking_price);
    if (sort === 'hi') result.sort((a, b) => b.asking_price - a.asking_price);
    if (sort === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [items, filterCat, filterCond, filterZone, maxPrice, sort]);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Nestly Exchange</h1>
        <div id="sellBtnMount">
          {isLoggedIn && !isAdmin && (
            <button className="btn btn-gold" onClick={() => setSellModalOpen(true)}>+ Sell Item</button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Category</label>
          <CustomSelect
            name="category"
            value={filterCat}
            onChange={val => setFilterCat(val)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'furniture', label: 'Furniture' },
              { value: 'appliances', label: 'Appliances' },
              { value: 'electronics', label: 'Electronics' },
              { value: 'kitchen', label: 'Kitchen' },
              { value: 'study', label: 'Study' }
            ]}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Condition</label>
          <CustomSelect
            name="condition"
            value={filterCond}
            onChange={val => setFilterCond(val)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'new', label: 'New' },
              { value: 'like_new', label: 'Like New' },
              { value: 'good', label: 'Good' },
              { value: 'fair', label: 'Fair' }
            ]}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Zone</label>
          <CustomSelect
            name="zone"
            value={filterZone}
            onChange={val => setFilterZone(val)}
            options={[
              { value: 'all', label: 'All' },
              ...zones.map(z => ({ value: z.zone_name, label: z.zone_name }))
            ]}
          />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
          <label>Max price: <span id="priceVal">{fmt(maxPrice)}</span></label>
          <input
            type="range"
            min="0"
            max="20000"
            step="500"
            value={maxPrice}
            onChange={e => setMaxPrice(parseInt(e.target.value))}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Sort</label>
          <CustomSelect
            name="sort"
            value={sort}
            onChange={val => setSort(val)}
            options={[
              { value: 'newest', label: 'Newest' },
              { value: 'lo', label: 'Price ↑' },
              { value: 'hi', label: 'Price ↓' }
            ]}
          />
        </div>
      </div>

      <div className="grid-3" id="itemsGrid">
        {filteredItems.length > 0 ? (
          filteredItems.map(it => (
            <ExchangeItemCard key={it.item_id} item={it} isLoggedIn={isLoggedIn} />
          ))
        ) : (
          <p style={{ color: 'var(--gray)', gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
            No items listed on the exchange yet.
          </p>
        )}
      </div>

      <SellItemModal 
        isOpen={sellModalOpen} 
        onClose={() => setSellModalOpen(false)} 
        zones={zones}
        onSuccess={() => { router.refresh(); }}
      />
    </div>
  );
}
