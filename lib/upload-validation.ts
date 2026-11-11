// Server-side checks for uploaded files. A browser reports a file's name and
// type, and both can be set to anything, so they are never trusted: the real
// type is read from the first bytes of the file itself.

export const MAX_VERIFICATION_BYTES = 5 * 1024 * 1024; // 5 MB

export const NID_TYPES = ['National ID', 'Passport', 'Driving License'] as const;

export type DetectedFile = {
  ext: 'jpg' | 'png' | 'webp' | 'pdf';
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
};

/** Identify a JPEG, PNG, WebP or PDF from its leading bytes. Anything else returns null. */
export function detectFileType(bytes: Uint8Array): DetectedFile | null {
  const at = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

  if (at([0xff, 0xd8, 0xff])) return { ext: 'jpg', mime: 'image/jpeg' };
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', mime: 'image/png' };
  if (at([0x25, 0x50, 0x44, 0x46, 0x2d])) return { ext: 'pdf', mime: 'application/pdf' }; // "%PDF-"
  // WebP is "RIFF" + 4 size bytes + "WEBP"
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return { ext: 'webp', mime: 'image/webp' };

  return null;
}
