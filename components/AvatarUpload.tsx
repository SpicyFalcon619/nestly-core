'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { avatarInitials } from '@/lib/utils';

interface AvatarUploadProps {
  userId: string;
  name: string;
  currentUrl?: string;
  onUpload?: (url: string) => void;
  /** Diameter in pixels. Defaults to 96. */
  size?: number;
  /** If false, clicking does nothing (display-only mode). */
  editable?: boolean;
}

export default function AvatarUpload({
  userId,
  name,
  currentUrl,
  onUpload,
  size = 96,
  editable = true,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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

  const iconSize = Math.round(size * 0.22);
  const badgeSize = Math.round(size * 0.33);

  return (
    <div
      onClick={editable ? () => inputRef.current?.click() : undefined}
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
            background: uploading ? 'var(--ink-muted)' : 'var(--emerald)',
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

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
        disabled={uploading}
      />
    </div>
  );
}
