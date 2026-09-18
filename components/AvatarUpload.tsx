'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Camera, X } from 'lucide-react';
import { avatarInitials } from '@/lib/utils';

interface AvatarUploadProps {
  userId: string;
  name: string;
  currentUrl?: string;
  onUpload?: (url: string) => void;
  /** Called after the picture is cleared, so the parent can drop its copy. */
  onRemove?: () => void;
  /** Diameter in pixels. Defaults to 96. */
  size?: number;
  /** If false, clicking does nothing (display-only mode). */
  editable?: boolean;
}

/**
 * Public URL → object path inside the bucket, e.g.
 * https://x.supabase.co/storage/v1/object/public/uiunest/avatars/<id>/avatar.jpg?t=1
 * becomes avatars/<id>/avatar.jpg. Returns null for anything that isn't a
 * file we uploaded for this user, so removal can never delete someone else's.
 */
function ownAvatarPath(url: string, userId: string): string | null {
  const marker = '/uiunest/';
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const path = url.slice(at + marker.length).split('?')[0];
  return path.startsWith(`avatars/${userId}/`) ? decodeURIComponent(path) : null;
}

export default function AvatarUpload({
  userId,
  name,
  currentUrl,
  onUpload,
  onRemove,
  size = 96,
  editable = true,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(currentUrl);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2 MB.');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `avatars/${userId}/avatar.${ext}`;
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage
      .from('uiunest')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('uiunest')
      .getPublicUrl(path);

    // Cache-bust so the browser fetches the new image immediately
    const finalUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ profile_pic: finalUrl })
      .eq('id', userId);

    if (dbError) {
      toast.error(dbError.message);
    } else {
      setPreview(finalUrl);
      onUpload?.(finalUrl);
      toast.success('Profile picture updated!');
    }
    setUploading(false);
    // Reset input so the same file can be re-selected after a failed attempt
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async (e: React.MouseEvent) => {
    // The whole circle opens the file picker — don't do that on the way out.
    e.stopPropagation();
    if (!preview || removing || uploading) return;
    if (!window.confirm('Remove your profile picture? Your initials will be shown instead.')) return;

    setRemoving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ profile_pic: null })
      .eq('id', userId);

    if (error) {
      toast.error(error.message);
      setRemoving(false);
      return;
    }

    // Best effort: the profile row is the source of truth, so a storage
    // policy that forbids delete must not turn this into a failed removal.
    const path = ownAvatarPath(preview, userId);
    if (path) {
      const { error: storageError } = await supabase.storage.from('uiunest').remove([path]);
      if (storageError) console.warn('Avatar file left in storage:', storageError.message);
    }

    setPreview(undefined);
    onRemove?.();
    setRemoving(false);
    toast.success('Profile picture removed.');
  };

  const iconSize = Math.round(size * 0.22);
  const badgeSize = Math.round(size * 0.33);
  const busy = uploading || removing;

  return (
    <div
      onClick={editable && !busy ? () => inputRef.current?.click() : undefined}
      title={editable ? 'Change profile picture' : undefined}
      style={{
        position: 'relative',
        width: size,
        height: size,
        cursor: editable ? 'pointer' : 'default',
        flexShrink: 0,
      }}
    >
      {preview ? (
        <img
          src={preview}
          alt={name}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '3px solid var(--border)',
            display: 'block',
            opacity: removing ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'var(--btn-primary-bg)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.33),
            fontWeight: 700,
            border: '3px solid var(--border)',
            userSelect: 'none',
          }}
        >
          {avatarInitials(name || 'U')}
        </div>
      )}

      {editable && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            background: busy ? 'var(--ink-muted)' : 'var(--emerald)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
            transition: 'background 0.2s',
          }}
        >
          <Camera size={iconSize} color="white" />
        </div>
      )}

      {editable && preview && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          aria-label="Remove profile picture"
          title="Remove profile picture"
          className="avatar-remove-btn"
          style={{ width: badgeSize, height: badgeSize }}
        >
          <X size={iconSize} />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
        disabled={busy}
      />
    </div>
  );
}
