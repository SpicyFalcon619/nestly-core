'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, CheckCircle, Clock, Trash2, Plus, X } from 'lucide-react';
import { fmt } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import CustomSelect from '@/components/CustomSelect';

interface CustomFee { name: string; amount: number }

interface Payment {
  payment_id?: number;
  id?: number;
  bill_id: number;
  resident_user_id: string;
  status: 'paid' | 'unpaid';
  paid_at?: string;
  resident?: { id: string; name: string };
}

interface Bill {
  bill_id?: number;
  id?: number;
  listing_id?: number | null;
  bill_month: string;
  electricity: number;
  gas: number;
  water: number;
  internet: number;
  other: number;
  custom_fees?: CustomFee[];
  total: number;
  per_person: number;
  payments: Payment[];
  listing?: { title: string; address: string } | null;
}

interface Listing {
  listing_id: number;
  title: string;
  address: string;
  zone_name: string;
  current_occupancy: number;
  base_rent: number;
}

interface CurrentUser { id: string; name: string; role: string }

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const CURRENT_YEAR = new Date().getFullYear();
const MONTH_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].flatMap(y =>
  MONTHS.map((m, i) => ({ value: `${m} ${y}`, label: `${m} ${y}` }))
);

function getBillId(b: Bill) { return b.bill_id ?? b.id ?? 0; }
function getPayId(p: Payment) { return p.payment_id ?? p.id ?? 0; }

export default function BillsContent({
  initialBills,
  myListings,
  currentUser,
}: {
  initialBills: Bill[];
  myListings: Listing[];
  currentUser: CurrentUser;
}) {
  const supabase = createClient();
  const hasListings = myListings.length > 0;

  // ── active listing for the "manage flat" switcher ──
  const [activeListing, setActiveListing] = useState<Listing | null>(
    hasListings ? myListings[0] : null
  );
  const [bills, setBills] = useState<Bill[]>(initialBills);

  // ── form state ──
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  });
  const [electricity, setElectricity] = useState(600);
  const [gas, setGas] = useState(200);
  const [water, setWater] = useState(100);
  const [internet, setInternet] = useState(500);
  const [baseRent, setBaseRent] = useState(activeListing?.base_rent ?? 0);
  const [occupancy, setOccupancy] = useState(activeListing?.current_occupancy ?? 1);
  const [customFees, setCustomFees] = useState<CustomFee[]>([]);
  const [saving, setSaving] = useState(false);

  // ── payment tracker ──
  const [trackerBillId, setTrackerBillId] = useState<number | null>(null);

  // ── confirm delete modal ──
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // recompute base rent / occupancy when active listing changes
  useEffect(() => {
    setBaseRent(activeListing?.base_rent ?? 0);
    setOccupancy(activeListing?.current_occupancy ?? 1);
  }, [activeListing]);

  // bills for the active listing (or all self-created when no listing)
  const visibleBills = activeListing
    ? bills.filter(b => b.listing_id === activeListing.listing_id)
    : bills.filter(b => !b.listing_id);

  // sync tracker selection when visible bills change
  useEffect(() => {
    if (visibleBills.length > 0) {
      const ids = visibleBills.map(getBillId);
      if (trackerBillId === null || !ids.includes(trackerBillId)) {
        setTrackerBillId(ids[0]);
      }
    } else {
      setTrackerBillId(null);
    }
  }, [activeListing, bills]);

  const trackerBill = visibleBills.find(b => getBillId(b) === trackerBillId) ?? null;

  // ── live total ──
  const utilTotal = Number(electricity) + Number(gas) + Number(water) + Number(internet);
  const feesTotal = customFees.reduce((s, f) => s + Number(f.amount), 0);
  const liveTotal = Number(baseRent) + utilTotal + feesTotal;
  const perPerson = occupancy > 0 ? Math.round(liveTotal / occupancy) : liveTotal;

  // ── save bill ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month) { toast.error('Please select a month'); return; }
    setSaving(true);

    // get residents for this listing (if any)
    let residents: { applicant_id: string }[] = [];
    if (activeListing) {
      const { data } = await supabase
        .from('applications')
        .select('applicant_id')
        .eq('listing_id', activeListing.listing_id)
        .eq('status', 'accepted');
      residents = data || [];
    }

    const insertPayload: any = {
      bill_month: month,
      electricity: Number(electricity),
      gas: Number(gas),
      water: Number(water),
      internet: Number(internet),
      other: feesTotal,
      custom_fees: customFees.length > 0 ? customFees : null,
      total: liveTotal,
      per_person: perPerson,
    };
    if (activeListing) insertPayload.listing_id = activeListing.listing_id;

    const { data: newBill, error } = await supabase
      .from('monthly_bills')
      .insert(insertPayload)
      .select(`*, listing:listings(title, address), payments:bill_payments(*, resident:profiles!bill_payments_resident_user_id_fkey(id, name))`)
      .single();

    if (error) { toast.error(error.message); setSaving(false); return; }

    // insert payment rows
    const payRows = residents.length > 0
      ? residents.map(r => ({ bill_id: newBill.bill_id, resident_user_id: r.applicant_id, status: 'unpaid' }))
      : [{ bill_id: newBill.bill_id, resident_user_id: currentUser.id, status: 'unpaid' }];

    const { data: newPayments } = await supabase
      .from('bill_payments')
      .insert(payRows)
      .select(`*, resident:profiles!bill_payments_resident_user_id_fkey(id, name)`);

    const fullBill: Bill = { ...newBill, payments: newPayments || [] };
    setBills(prev => [fullBill, ...prev]);
    setTrackerBillId(getBillId(fullBill));
    setCustomFees([]);
    toast.success("Month's bill logged!");
    setSaving(false);
  };

  // ── mark paid ──
  const handleMarkPaid = async (payId: number, billId: number) => {
    const { error } = await supabase
      .from('bill_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('payment_id', payId);
    if (error) { toast.error('Failed to update payment'); return; }
    setBills(prev => prev.map(b =>
      getBillId(b) === billId
        ? { ...b, payments: b.payments.map(p => getPayId(p) === payId ? { ...p, status: 'paid' as const, paid_at: new Date().toISOString() } : p) }
        : b
    ));
    toast.success('Payment marked as paid');
  };

  // ── delete bill ──
  const handleDelete = async (billId: number) => {
    const { error } = await supabase.from('monthly_bills').delete().eq('bill_id', billId);
    if (error) { toast.error('Failed to delete bill'); return; }
    const remaining = bills.filter(b => getBillId(b) !== billId);
    setBills(remaining);
    const nextVisible = remaining.filter(b => activeListing ? b.listing_id === activeListing.listing_id : !b.listing_id);
    setTrackerBillId(nextVisible.length > 0 ? getBillId(nextVisible[0]) : null);
    setConfirmDeleteId(null);
    toast.success('Bill log deleted');
  };

  const addFee = () => setCustomFees(prev => [...prev, { name: '', amount: 0 }]);
  const removeFee = (i: number) => setCustomFees(prev => prev.filter((_, idx) => idx !== i));
  const updateFee = (i: number, field: 'name' | 'amount', val: string) =>
    setCustomFees(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: field === 'amount' ? Number(val) : val } : f));

  // ── listing switcher options ──
  const listingOptions = myListings.map(l => ({ value: String(l.listing_id), label: l.title }));

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>Mess Bill Manager</h1>
        {hasListings && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>Manage Flat:</label>
            <div style={{ minWidth: 200 }}>
              <CustomSelect
                value={activeListing ? String(activeListing.listing_id) : ''}
                onChange={val => setActiveListing(myListings.find(l => String(l.listing_id) === val) ?? null)}
                options={listingOptions}
              />
            </div>
          </div>
        )}
      </div>

      {activeListing && (
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={14} />
          {activeListing.title} ({activeListing.zone_name || activeListing.address})
        </p>
      )}
      {!hasListings && (
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 24 }}>
          Log your own monthly mess bills below.
        </p>
      )}

      {/* ── Two-column main area ── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

        {/* ── LEFT: Enter Monthly Bills ── */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px', color: 'var(--navy)' }}>Enter Monthly Bills</h3>
          <form onSubmit={handleSave}>

            <div className="form-group">
              <label>Month</label>
              <CustomSelect
                value={month}
                onChange={setMonth}
                options={MONTH_OPTIONS}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Electricity (৳)</label>
                <input type="number" min="0" value={electricity} onChange={e => setElectricity(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Gas (৳)</label>
                <input type="number" min="0" value={gas} onChange={e => setGas(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Water (৳)</label>
                <input type="number" min="0" value={water} onChange={e => setWater(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Internet (৳)</label>
                <input type="number" min="0" value={internet} onChange={e => setInternet(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Base Rent (৳)</label>
                <input
                  type="number" min="0" value={baseRent}
                  onChange={e => setBaseRent(Number(e.target.value))}
                  style={{ background: activeListing ? 'var(--surface-2)' : undefined }}
                  readOnly={!!activeListing}
                />
              </div>
              <div className="form-group">
                <label>Occupants to split by</label>
                <input type="number" min="1" value={occupancy} onChange={e => setOccupancy(Number(e.target.value))} />
              </div>
            </div>

            {/* Extra fees */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontWeight: 600, margin: 0 }}>Extra Fees</label>
                <button type="button" className="btn btn-outline btn-sm" onClick={addFee}>
                  <Plus size={13} style={{ marginRight: 4 }} />Add Fee
                </button>
              </div>
              {customFees.map((fee, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <input
                      placeholder="Fee name (e.g. Maid)"
                      value={fee.name}
                      onChange={e => updateFee(i, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number" min="0" placeholder="Amount (৳)"
                      value={fee.amount || ''}
                      onChange={e => updateFee(i, 'amount', e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => removeFee(i)}
                    style={{ padding: '8px 10px', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'none', marginBottom: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Live total */}
            <div style={{ background: 'var(--light-bg)', padding: 14, borderRadius: 8, borderLeft: '3px solid var(--navy)', marginTop: 8, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)' }}>
                Total: <span>{fmt(liveTotal)}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--gray)', marginTop: 4 }}>
                Per Person: <strong>{fmt(perPerson)}</strong>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
              {saving ? 'Saving…' : "Log & Save Month's Bills"}
            </button>
          </form>
        </div>

        {/* ── RIGHT: Payment Tracker ── */}
        <div className="card">
          <h3 style={{ margin: '0 0 10px', color: 'var(--navy)' }}>Payment Tracker</h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Select Month to Track:</label>
              <div style={{ minWidth: 180 }}>
                <CustomSelect
                  value={trackerBillId !== null ? String(trackerBillId) : ''}
                  onChange={val => setTrackerBillId(Number(val))}
                  options={
                    visibleBills.length > 0
                      ? visibleBills.map(b => ({ value: String(getBillId(b)), label: b.bill_month }))
                      : [{ value: '', label: 'No bills logged' }]
                  }
                />
              </div>
            </div>
            {trackerBill && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setConfirmDeleteId(getBillId(trackerBill))}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={13} /> Delete Log
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {!trackerBill ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray)' }}>Select or log a bill month first.</td></tr>
                ) : trackerBill.payments.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray)' }}>No residents assigned.</td></tr>
                ) : (
                  trackerBill.payments.map(p => {
                    const pid = getPayId(p);
                    const name = (p.resident as any)?.name ?? currentUser.name;
                    const isMe = p.resident_user_id === currentUser.id;
                    return (
                      <tr key={pid}>
                        <td>{name}{isMe && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--emerald)', fontWeight: 700 }}>You</span>}</td>
                        <td>{fmt(trackerBill.per_person)}</td>
                        <td>
                          {p.status === 'paid'
                            ? <span className="badge badge-green"><CheckCircle size={11} /> Paid</span>
                            : <span className="badge badge-amber"><Clock size={11} /> Unpaid</span>
                          }
                        </td>
                        <td>
                          {p.status === 'unpaid' && (isMe || currentUser.role === 'landlord')
                            ? <button className="btn btn-success btn-sm" onClick={() => handleMarkPaid(pid, getBillId(trackerBill))}>Mark Paid</button>
                            : '—'
                          }
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {trackerBill && trackerBill.payments.length > 0 && (() => {
            const paidCount = trackerBill.payments.filter(p => p.status === 'paid').length;
            const total = trackerBill.payments.length;
            return (
              <p style={{ marginTop: 10, fontSize: 14, color: 'var(--gray)' }}>
                {paidCount} of {total} occupants paid ({fmt(paidCount * trackerBill.per_person)} / {fmt(total * trackerBill.per_person)})
              </p>
            );
          })()}
        </div>
      </div>

      {/* ── Bill History Log ── */}
      <div className="card">
        <h3 style={{ margin: '0 0 14px', color: 'var(--navy)' }}>Bill History Log</h3>
        {visibleBills.length === 0 ? (
          <p style={{ color: 'var(--gray)', textAlign: 'center', padding: '24px 0' }}>
            No bills have been logged {activeListing ? 'for this property' : ''} yet.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Rent</th>
                  <th>Utilities</th>
                  <th>Extra Fees</th>
                  <th>Total</th>
                  <th>Split</th>
                  <th>Payments</th>
                </tr>
              </thead>
              <tbody>
                {visibleBills.map(b => {
                  const utils = b.electricity + b.gas + b.water + b.internet;
                  const fees: CustomFee[] = b.custom_fees || [];
                  const feesSum = fees.reduce((s, f) => s + f.amount, 0);
                  const rent = b.total - utils - feesSum;
                  const paidCount = b.payments.filter(p => p.status === 'paid').length;
                  return (
                    <tr key={getBillId(b)}>
                      <td><strong>{b.bill_month}</strong></td>
                      <td>{fmt(rent > 0 ? rent : 0)}</td>
                      <td>{fmt(utils)}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray)' }}>
                        {fees.length > 0 ? fees.map(f => `${f.name}: ${fmt(f.amount)}`).join(', ') : '—'}
                      </td>
                      <td><strong>{fmt(b.total)}</strong></td>
                      <td>{fmt(b.per_person)}</td>
                      <td>{paidCount} / {b.payments.length} paid</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirm Delete Modal ── */}
      {confirmDeleteId !== null && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}>
          <div className="modal" style={{ maxWidth: 400, textAlign: 'center', padding: 40, position: 'relative' }}>
            <h3 style={{ marginTop: 0, color: 'var(--navy)' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--gray)', marginBottom: 24 }}>
              Are you sure you want to completely delete the log for this month? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDeleteId)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
