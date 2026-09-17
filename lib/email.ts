// Transactional email for notifications. Server-side only.
//
// Sends through Resend's REST API when RESEND_API_KEY and EMAIL_FROM are set, and
// is a silent no-op otherwise — so the app runs unchanged without an email
// provider, and in-app notifications never depend on email succeeding.

// Only events someone would genuinely want pulled out of the app for. Comment and
// rating notifications stay in-app; emailing every upvote would train people to
// ignore Nestly mail altogether.
const EMAIL_SUBJECTS: Record<string, string> = {
  new_application:        'New application for your listing',
  application_accepted:   'Your application was accepted',
  application_rejected:   'Update on your application',
  application_withdrawn:  'An applicant withdrew their application',
  new_offer:              'You received an offer',
  offer_accepted:         'Your offer was accepted',
  offer_countered:        'You received a counter-offer',
  offer_rejected:         'Update on your offer',
  seek_response_accepted: 'Your response was accepted',
  verification:           'Update on your verification',
  saved_search_match:     'A new listing matches your saved search',
};

export function shouldEmail(type: string): boolean {
  return type in EMAIL_SUBJECTS;
}

function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return apiKey && from ? { apiKey, from } : null;
}

// Links in email must be absolute. NEXT_PUBLIC_SITE_URL wins; on Vercel the
// production URL is used automatically. Without either, the email goes out
// without a button rather than with a broken relative link.
function siteUrl(): string | null {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

// Messages contain user-supplied names and listing titles.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function sendNotificationEmail(opts: { to: string; type: string; message: string; link?: string }) {
  const config = emailConfig();
  if (!config || !shouldEmail(opts.type)) return;

  const base = siteUrl();
  const href = opts.link && base ? `${base}${opts.link.startsWith('/') ? '' : '/'}${opts.link}` : null;
  const subject = EMAIL_SUBJECTS[opts.type];

  const html = `
<div style="font-family:Inter,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1E293B">
  <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin-bottom:24px">Nest<span style="color:#1A5C45">ly</span></div>
  <p style="font-size:16px;line-height:1.6;margin:0 0 24px">${escapeHtml(opts.message)}</p>
  ${href ? `<a href="${escapeHtml(href)}" style="display:inline-block;background:#1A5C45;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">Open in Nestly</a>` : ''}
  <p style="font-size:12px;color:#94A3B8;margin:32px 0 0">You're receiving this because of activity on your Nestly account.</p>
</div>`.trim();

  const text = href ? `${opts.message}\n\n${href}` : opts.message;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: opts.to, subject, html, text }),
      // A slow email provider must never hold up the server action that triggered it.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`Email send failed (${res.status}):`, await res.text());
  } catch (error) {
    console.error('Email send failed:', error);
  }
}
