'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Modal from './Modal';
import type { Zone } from '@/types';
import CustomSelect from '@/components/CustomSelect';
import dynamic from 'next/dynamic';
import { createAdminNotification } from '@/app/actions/notifications';
import { notifySavedSearchMatches } from '@/app/actions/savedSearches';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false, loading: () => <div style={{height: '300px', background: 'var(--surface-2)', color: 'var(--ink-muted)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading map...</div> });

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateListingModal({ isOpen, onClose, onSuccess }: CreateListingModalProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    zone_id: '',
    property_type: 'single_room',
    total_rooms: '3',
    current_occupancy: '1',
    address: '',
    description: '',
    lat: 23.797900,
    lng: 90.449700,
    
    // Costs
    base_rent: '',
    gas_bill: '0',
    electricity_type: 'shared',
    electricity_amount: '0',
    water_bill: '0',
    internet_cost: '0',
    maintenance_fee: '0',
    caretaker_fee: '0',
    
    // Preferences
    sleep: 'Flexible',
    diet: 'Non-Vegetarian',
    guest: 'Allowed',
    cleanliness: '4',
    noise: 'Moderate',
    smoking: false,
  });

  const [amenities, setAmenities] = useState({
    attached_bathroom: false,
    attached_kitchen: false,
    is_furnished: false,
    rooftop_access: false,
    power_backup: false,
    lift_access: false,
    parking: false
  });

  const [customFees, setCustomFees] = useState<{name: string, amount: string}[]>([]);
  
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);

  useEffect(() => {
    if (isOpen) {
      const init = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check verification
        const { data: verif } = await supabase.from('verifications').select('status').eq('user_id', user.id).order('submitted_at', { ascending: false }).limit(1).maybeSingle();
        if (!verif || verif.status !== 'approved') {
          toast.error("You must submit a verification document in your Profile and wait for Admin approval before listing a property.");
          setIsVerified(false);
          onClose();
          return;
        }
        setIsVerified(true);

        if (zones.length === 0) {
          const { data } = await supabase.from('zones').select('*').order('zone_name');
          if (data) {
            setZones(data);
            if (data.length > 0) setFormData(prev => ({ ...prev, zone_id: data[0].zone_id.toString() }));
          }
        }
      };
      init();
    }
  }, [isOpen, zones.length, onClose]);

  const activeZone = useMemo(() => zones.find(z => z.zone_id.toString() === formData.zone_id), [zones, formData.zone_id]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAmenityChange = (field: keyof typeof amenities, value: boolean) => {
    setAmenities(prev => ({ ...prev, [field]: value }));
  };

  const addCustomFee = () => {
    setCustomFees([...customFees, { name: '', amount: '0' }]);
  };

  const updateCustomFee = (index: number, field: 'name'|'amount', value: string) => {
    const newFees = [...customFees];
    newFees[index][field] = value;
    setCustomFees(newFees);
  };

  const removeCustomFee = (index: number) => {
    setCustomFees(customFees.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumbnail) {
      toast.error('Thumbnail image is required');
      return;
    }
    
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be logged in.');
      setLoading(false);
      return;
    }

    try {
      // 1. Upload photos
      let photos: string[] = [];
      
      const uploadFile = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('uiunest').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('uiunest').getPublicUrl(filePath);
        return data.publicUrl;
      };

      const thumbUrl = await uploadFile(thumbnail);
      photos.push(thumbUrl);

      for (const file of gallery) {
        const url = await uploadFile(file);
        photos.push(url);
      }

      // Calculate total custom fees
      const totalCustom = customFees.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
      
      const base_rent = parseFloat(formData.base_rent) || 0;
      const electricity_amount = parseFloat(formData.electricity_amount) || 0;
      const gas_bill = parseFloat(formData.gas_bill) || 0;
      const water_bill = parseFloat(formData.water_bill) || 0;
      const internet_cost = parseFloat(formData.internet_cost) || 0;
      const maintenance_fee = parseFloat(formData.maintenance_fee) || 0;
      const caretaker_fee = parseFloat(formData.caretaker_fee) || 0;
      
      const total_monthly = base_rent + electricity_amount + gas_bill + water_bill + internet_cost + maintenance_fee + caretaker_fee + totalCustom;

      // Determine listing_type based on role
      const { data: profile } = await supabase.from('profiles').select('role, gender').eq('id', user.id).single();
      const listing_type = profile?.role === 'landlord' ? 'full_property' : 'peer_listing';
      const gender_pref = profile?.gender || 'any';

      // 2. Insert Listing
      const { data: listing, error: submitError } = await supabase.from('listings').insert({
        user_id: user.id,
        title: formData.title,
        address: formData.address,
        zone_id: parseInt(formData.zone_id),
        property_type: formData.property_type,
        listing_type,
        gender_pref,
        total_rooms: parseInt(formData.total_rooms) || 1,
        current_occupancy: parseInt(formData.current_occupancy) || 0,
        description: formData.description,
        lat: formData.lat,
        lng: formData.lng,
        status: 'available',
        photos
      }).select().single();

      if (submitError) throw submitError;

      // 3. Insert Utility Costs
      await supabase.from('utility_costs').insert({
        listing_id: listing.listing_id,
        base_rent,
        electricity_type: formData.electricity_type,
        electricity_amount,
        gas_bill,
        water_bill,
        internet_cost,
        maintenance_fee,
        caretaker_fee,
        other_fees: totalCustom,
        total_monthly
      });

      // 4. Insert Amenities
      await supabase.from('listing_amenities').insert({
        listing_id: listing.listing_id,
        ...amenities
      });

      // 5. Upsert User Preferences
      await supabase.from('user_preferences').upsert({
        user_id: user.id,
        sleep: formData.sleep,
        diet: formData.diet,
        guest: formData.guest,
        cleanliness: parseInt(formData.cleanliness) || 4,
        noise: formData.noise,
        smoking: formData.smoking ? 1 : 0
      }, { onConflict: 'user_id' });

      // Trigger admin notification
      await createAdminNotification(
        'listing',
        `New property listing created: ${formData.title}`,
        `/admin?tab=overview`
      );

      // Alert anyone whose saved search this matches. Never let it block publishing.
      try { await notifySavedSearchMatches(listing.listing_id); } catch { /* feature may not be migrated yet */ }

      toast.success('Listing published successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while creating listing');
    } finally {
      setLoading(false);
    }
  };

  if (!isVerified) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="List a Property" maxWidth="650px">
      <form onSubmit={handleSubmit}>
        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>Basic Details</div>
        
        <div className="form-group">
          <label>Title</label>
          <input type="text" required placeholder="e.g. Spacious Single Room near Badda Campus" value={formData.title} onChange={e => handleChange('title', e.target.value)} />
        </div>
        
        <div className="grid-2">
          <div className="form-group">
            <label>Zone</label>
            <CustomSelect name="zone" value={formData.zone_id} onChange={v => handleChange('zone_id', v)} options={zones.map(z => ({ value: z.zone_id.toString(), label: z.zone_name }))} />
          </div>
          <div className="form-group">
            <label>Property Type</label>
            <CustomSelect name="property_type" value={formData.property_type} onChange={v => handleChange('property_type', v)} options={[
              { value: 'single_room', label: 'Single Room' },
              { value: 'shared_room', label: 'Shared Room' },
              { value: 'full_mess', label: 'Full Mess' },
              { value: 'sublet', label: 'Sub-let' }
            ]} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group"><label>Total Rooms</label><input type="number" required min="1" value={formData.total_rooms} onChange={e => handleChange('total_rooms', e.target.value)} /></div>
          <div className="form-group"><label>Current Occupancy</label><input type="number" required min="0" value={formData.current_occupancy} onChange={e => handleChange('current_occupancy', e.target.value)} /></div>
        </div>

        <div className="form-group"><label>Address</label><input type="text" required placeholder="e.g. House 45, Road 2, Vatara, Dhaka" value={formData.address} onChange={e => handleChange('address', e.target.value)} /></div>
        <div className="form-group"><label>Description</label><textarea required placeholder="Describe your property in detail..." value={formData.description} onChange={e => handleChange('description', e.target.value)}></textarea></div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>Pick Location on Map</label>
          <MapPicker 
            initialLat={formData.lat} 
            initialLng={formData.lng} 
            onLocationChange={(lat, lng) => { handleChange('lat', lat); handleChange('lng', lng); }}
            zonePolygon={activeZone?.polygon ? activeZone.polygon as [number, number][] : undefined}
          />
        </div>

        <div className="grid-2">
          <div className="form-group"><label>Thumbnail Image (Required)</label><input type="file" accept="image/*" required onChange={e => setThumbnail(e.target.files?.[0] || null)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', width: '100%' }} /></div>
          <div className="form-group"><label>Gallery Photos (Optional)</label><input type="file" accept="image/*" multiple onChange={e => setGallery(Array.from(e.target.files || []))} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', width: '100%' }} /></div>
        </div>

        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '14px' }}>Monthly Costs</div>
        <div className="grid-2">
          <div className="form-group"><label>Base Rent (৳)</label><input type="number" required min="0" value={formData.base_rent} onChange={e => handleChange('base_rent', e.target.value)} /></div>
          <div className="form-group"><label>Gas Bill (৳)</label><input type="number" required min="0" value={formData.gas_bill} onChange={e => handleChange('gas_bill', e.target.value)} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>Electricity Meter Type</label>
            <CustomSelect name="electricity_type" value={formData.electricity_type} onChange={v => handleChange('electricity_type', v)} options={[
              { value: 'individual', label: 'Individual Meter' },
              { value: 'shared', label: 'Shared Meter' }
            ]} />
          </div>
          <div className="form-group"><label>Estimated Electricity Cost (৳)</label><input type="number" required min="0" value={formData.electricity_amount} onChange={e => handleChange('electricity_amount', e.target.value)} /></div>
        </div>
        <div className="grid-3">
          <div className="form-group"><label>Water Bill (৳)</label><input type="number" required min="0" value={formData.water_bill} onChange={e => handleChange('water_bill', e.target.value)} /></div>
          <div className="form-group"><label>Internet Cost (৳)</label><input type="number" required min="0" value={formData.internet_cost} onChange={e => handleChange('internet_cost', e.target.value)} /></div>
          <div className="form-group"><label>Maintenance (৳)</label><input type="number" required min="0" value={formData.maintenance_fee} onChange={e => handleChange('maintenance_fee', e.target.value)} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label>Caretaker Fee (৳)</label><input type="number" required min="0" value={formData.caretaker_fee} onChange={e => handleChange('caretaker_fee', e.target.value)} /></div>
        </div>

        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Custom / Other Fees (Optional)</span>
          <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={addCustomFee}>+ Add Custom Fee</button>
        </div>
        
        {customFees.map((fee, i) => (
          <div className="grid-3" key={i} style={{ alignItems: 'end', marginBottom: '10px' }}>
            <div className="form-group" style={{ margin: 0 }}><label>Fee Name</label><input type="text" required placeholder="e.g. Cooking Fee" value={fee.name} onChange={e => updateCustomFee(i, 'name', e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>Amount (৳)</label><input type="number" required min="0" value={fee.amount} onChange={e => updateCustomFee(i, 'amount', e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><button type="button" className="btn btn-danger btn-block" onClick={() => removeCustomFee(i)}>Remove</button></div>
          </div>
        ))}

        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '14px' }}>Amenities</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}><input type="checkbox" style={{ width: '17px', height: '17px', accentColor: 'var(--emerald)' }} checked={amenities.attached_bathroom} onChange={e => handleAmenityChange('attached_bathroom', e.target.checked)} /> Attached Bath</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}><input type="checkbox" style={{ width: '17px', height: '17px', accentColor: 'var(--emerald)' }} checked={amenities.attached_kitchen} onChange={e => handleAmenityChange('attached_kitchen', e.target.checked)} /> Kitchen</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}><input type="checkbox" style={{ width: '17px', height: '17px', accentColor: 'var(--emerald)' }} checked={amenities.is_furnished} onChange={e => handleAmenityChange('is_furnished', e.target.checked)} /> Furnished</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}><input type="checkbox" style={{ width: '17px', height: '17px', accentColor: 'var(--emerald)' }} checked={amenities.rooftop_access} onChange={e => handleAmenityChange('rooftop_access', e.target.checked)} /> Rooftop Access</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}><input type="checkbox" style={{ width: '17px', height: '17px', accentColor: 'var(--emerald)' }} checked={amenities.power_backup} onChange={e => handleAmenityChange('power_backup', e.target.checked)} /> Power Backup</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}><input type="checkbox" style={{ width: '17px', height: '17px', accentColor: 'var(--emerald)' }} checked={amenities.lift_access} onChange={e => handleAmenityChange('lift_access', e.target.checked)} /> Lift</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}><input type="checkbox" style={{ width: '17px', height: '17px', accentColor: 'var(--emerald)' }} checked={amenities.parking} onChange={e => handleAmenityChange('parking', e.target.checked)} /> Parking</label>
        </div>

        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '14px' }}>Resident Preferences (For Matching)</div>
        <div className="grid-2">
          <div className="form-group">
            <label>Sleep Schedule</label>
            <CustomSelect name="sleep" value={formData.sleep} onChange={v => handleChange('sleep', v)} options={[
              { value: 'Flexible', label: 'Flexible' },
              { value: 'Early Bird (before 11pm)', label: 'Early Bird (before 11pm)' },
              { value: 'Night Owl (after 12am)', label: 'Night Owl (after 12am)' }
            ]} />
          </div>
          <div className="form-group">
            <label>Diet</label>
            <CustomSelect name="diet" value={formData.diet} onChange={v => handleChange('diet', v)} options={[
              { value: 'Non-Vegetarian', label: 'Non-Vegetarian' },
              { value: 'Vegetarian', label: 'Vegetarian' },
              { value: 'Strictly Halal', label: 'Strictly Halal' }
            ]} />
          </div>
        </div>
        <div className="grid-3">
          <div className="form-group">
            <label>Guests</label>
            <CustomSelect name="guest" value={formData.guest} onChange={v => handleChange('guest', v)} options={[
              { value: 'Allowed', label: 'Allowed' },
              { value: 'Restricted (weekends only)', label: 'Restricted' },
              { value: 'Not Allowed', label: 'Not Allowed' }
            ]} />
          </div>
          <div className="form-group"><label>Cleanliness Standard (1-5)</label><input type="number" required min="1" max="5" value={formData.cleanliness} onChange={e => handleChange('cleanliness', e.target.value)} /></div>
          <div className="form-group">
            <label>Noise Level</label>
            <CustomSelect name="noise" value={formData.noise} onChange={v => handleChange('noise', v)} options={[
              { value: 'Quiet', label: 'Quiet' },
              { value: 'Moderate', label: 'Moderate' },
              { value: 'Lively is fine', label: 'Lively is fine' }
            ]} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
            <input type="checkbox" style={{ width: '17px', height: '17px', accentColor: 'var(--emerald)' }} checked={formData.smoking} onChange={e => handleChange('smoking', e.target.checked)} /> 
            Prefers Non-Smoking Environment
          </label>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Publishing...' : 'Publish Listing'}
        </button>
      </form>
    </Modal>
  );
}
