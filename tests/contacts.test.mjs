import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchContacts } from '../lib/contacts.ts';

// A stand-in for the Supabase client that records what it was asked.
function fakeClient(result) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return result;
    },
  };
}

test('asks the database function for the unique ids and maps the rows by id', async () => {
  const client = fakeClient({
    data: [{ id: 'a', email: 'a@example.com', phone: '111' }],
    error: null,
  });
  const contacts = await fetchContacts(client, ['a', 'a', 'b', null, undefined]);

  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].name, 'get_contact_details');
  assert.deepEqual(client.calls[0].args, { target_ids: ['a', 'b'] });
  assert.deepEqual(contacts.get('a'), { email: 'a@example.com', phone: '111' });
  assert.equal(contacts.get('b'), undefined, 'a person the database did not return has no contact');
});

test('makes no database call when there is nobody to look up', async () => {
  const client = fakeClient({ data: [], error: null });
  const contacts = await fetchContacts(client, [null, undefined]);
  assert.equal(client.calls.length, 0);
  assert.equal(contacts.size, 0);
});

test('a database error yields no contacts instead of throwing', async () => {
  const client = fakeClient({ data: null, error: { message: 'boom' } });
  const original = console.error;
  console.error = () => {};
  try {
    const contacts = await fetchContacts(client, ['a']);
    assert.equal(contacts.size, 0);
  } finally {
    console.error = original;
  }
});
