import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from '../lib/schemas.ts';

const valid = { name: 'Test User', email: 'test@example.com', password: 'secret123', gender: 'male' };

test('a student can register', () => {
  assert.equal(registerSchema.safeParse({ ...valid, role: 'student' }).success, true);
});

test('a landlord can register', () => {
  assert.equal(registerSchema.safeParse({ ...valid, role: 'landlord' }).success, true);
});

// Regression: sign-up used to accept role "admin", which the database then trusted.
test('nobody can register as an admin', () => {
  const result = registerSchema.safeParse({ ...valid, role: 'admin' });
  assert.equal(result.success, false);
});

test('unknown roles are rejected', () => {
  assert.equal(registerSchema.safeParse({ ...valid, role: 'superuser' }).success, false);
});

test('short names, bad emails and short passwords are rejected', () => {
  assert.equal(registerSchema.safeParse({ ...valid, role: 'student', name: 'A' }).success, false);
  assert.equal(registerSchema.safeParse({ ...valid, role: 'student', email: 'not-an-email' }).success, false);
  assert.equal(registerSchema.safeParse({ ...valid, role: 'student', password: '123' }).success, false);
});
