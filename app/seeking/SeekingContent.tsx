'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusCircle } from 'lucide-react';
import type { SeekingPost, Zone } from '@/types';
import SeekCard from '@/components/SeekCard';
import CustomSelect from '@/components/CustomSelect';
import CreateSeekingModal from '@/components/modals/CreateSeekingModal';

export default function SeekingContent({
  posts,
  zones,
  isLoggedIn,
  isAdmin,
}: {
  posts: SeekingPost[];
  zones: Zone[];
  isLoggedIn: boolean;
  isAdmin?: boolean;
}) {
  const [filterType, setFilterType] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const router = useRouter();

  const filteredPosts = useMemo(() => {
    let result = posts.filter(p => p.status === 'active');

    if (filterType !== 'all') {
      result = result.filter(p => p.property_type === filterType || p.property_type === 'any');
    }
    if (filterZone !== 'all') {
      result = result.filter(p => p.zone === filterZone);
    }
    if (filterGender !== 'all') {
      result = result.filter(p => p.preferred_gender === filterGender || p.preferred_gender === 'any');
    }

    return result;
  }, [posts, filterType, filterZone, filterGender]);

  return (
    <div className="container" style={{ padding: '40px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 0 8px 0' }}>Seeking Flatmates</h1>
          <p style={{ margin: 0, color: 'var(--gray)' }}>Find students looking for rooms or flatmates near your campus.</p>
        </div>
        <div>
          {isLoggedIn && !isAdmin ? (
            <button className="btn btn-gold" onClick={() => setCreateModalOpen(true)}>+ Post Ad</button>
          ) : isLoggedIn && isAdmin ? null : (
            <button className="btn btn-gold" onClick={() => window.location.href = '/login'}>Log in to Post</button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Looking For</label>
          <CustomSelect
            value={filterType}
            onChange={(v) => setFilterType(v)}
            options={[
              { value: 'all', label: 'Any Property Type' },
              { value: 'single_room', label: 'Single Room' },
              { value: 'shared_room', label: 'Shared Room' },
              { value: 'full_mess', label: 'Full Mess' },
              { value: 'sublet', label: 'Sublet' }
            ]}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Zone</label>
          <CustomSelect
            value={filterZone}
            onChange={(v) => setFilterZone(v)}
            options={[
              { value: 'all', label: 'All Zones' },
              ...zones.map(z => ({ value: z.zone_name, label: z.zone_name }))
            ]}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Preferred Gender</label>
          <CustomSelect
            value={filterGender}
            onChange={(v) => setFilterGender(v)}
            options={[
              { value: 'all', label: 'Any Gender' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' }
            ]}
          />
        </div>
      </div>

      <div className="grid-3">
        {filteredPosts.length > 0 ? (
          filteredPosts.map(post => (
            <SeekCard key={post.post_id || post.id} post={post} isLoggedIn={isLoggedIn} />
          ))
        ) : (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--gray)', backgroundColor: 'white', borderRadius: '12px', border: '1px dashed var(--border)' }}>
            No seeking posts match your filters.
          </div>
        )}
      </div>

      <CreateSeekingModal 
        isOpen={createModalOpen} 
        onClose={() => setCreateModalOpen(false)} 
        zones={zones}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

