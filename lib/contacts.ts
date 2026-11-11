import type { SupabaseClient } from '@supabase/supabase-js';

// Email and phone live in protected columns of `profiles`. They are not read
// with a normal query; the database hands them out through get_contact_details
// (migration 0010), and only where the product allows it: your own, an
// applicant's to the landlord, a landlord's once an application is accepted, a
// buyer's and seller's to each other, and so on. Anyone not allowed simply
// gets no row back.

export type Contact = { email: string | null; phone: string | null };

export async function fetchContacts(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, Contact>> {
  const contacts = new Map<string, Contact>();
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return contacts;

  const { data, error } = await supabase.rpc('get_contact_details', { target_ids: unique });
  if (error) {
    console.error('get_contact_details failed:', error.message);
    return contacts;
  }

  for (const row of (data || []) as Array<{ id: string; email: string | null; phone: string | null }>) {
    contacts.set(row.id, { email: row.email, phone: row.phone });
  }
  return contacts;
}
