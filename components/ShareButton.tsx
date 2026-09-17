'use client';

import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ShareButton({ title }: { title: string }) {
  const share = async () => {
    const url = window.location.href;
    // Native share sheet on phones (WhatsApp/Messenger is how most listings get passed around);
    // clipboard everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user dismissed the sheet — not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <button type="button" className="btn btn-outline" onClick={share} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Share2 size={17} />
      Share
    </button>
  );
}
