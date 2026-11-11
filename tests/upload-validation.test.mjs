import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFileType, MAX_VERIFICATION_BYTES, NID_TYPES } from '../lib/upload-validation.ts';

const bytes = (...b) => Uint8Array.from(b);
const ascii = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));

test('recognises a JPEG from its first bytes', () => {
  assert.deepEqual(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16)), { ext: 'jpg', mime: 'image/jpeg' });
});

test('recognises a PNG from its first bytes', () => {
  assert.deepEqual(
    detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)),
    { ext: 'png', mime: 'image/png' }
  );
});

test('recognises a PDF', () => {
  assert.deepEqual(detectFileType(ascii('%PDF-1.7\n')), { ext: 'pdf', mime: 'application/pdf' });
});

test('recognises a WebP (RIFF....WEBP)', () => {
  const webp = Uint8Array.from([...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBPVP8 ')]);
  assert.deepEqual(detectFileType(webp), { ext: 'webp', mime: 'image/webp' });
});

test('a RIFF file that is not WebP (for example a WAV) is rejected', () => {
  const wav = Uint8Array.from([...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WAVEfmt ')]);
  assert.equal(detectFileType(wav), null);
});

test('rejects things an attacker would try to upload as an image', () => {
  assert.equal(detectFileType(ascii('<?php system($_GET["c"]); ?>')), null, 'PHP script');
  assert.equal(detectFileType(ascii('<html><script>alert(1)</script></html>')), null, 'HTML');
  assert.equal(detectFileType(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null, 'SVG');
  assert.equal(detectFileType(bytes(0x4d, 0x5a, 0x90, 0)), null, 'Windows executable (MZ)');
  assert.equal(detectFileType(bytes(0x50, 0x4b, 0x03, 0x04)), null, 'ZIP archive');
});

test('rejects empty and truncated input without throwing', () => {
  assert.equal(detectFileType(new Uint8Array(0)), null);
  assert.equal(detectFileType(bytes(0xff, 0xd8)), null, 'only two of the three JPEG bytes');
});

test('the type comes from the bytes, never from a file name', () => {
  // Same bytes, different claimed names: detection has no name input at all.
  const php = ascii('<?php echo 1; ?>');
  assert.equal(detectFileType(php), null);
});

test('limits and document kinds are as documented', () => {
  assert.equal(MAX_VERIFICATION_BYTES, 5 * 1024 * 1024);
  assert.deepEqual([...NID_TYPES], ['National ID', 'Passport', 'Driving License']);
});
