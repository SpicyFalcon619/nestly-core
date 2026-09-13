import Link from 'next/link';

export default function Footer() {
  return (
    <footer id="footer-mount" style={{ backgroundColor: 'var(--navy)', color: '#fff', padding: '32px 0', textAlign: 'center', marginTop: 'auto' }}>
      <div style={{ marginBottom: '16px', fontSize: '15px', fontWeight: 500, display: 'flex', justifyContent: 'center', gap: '16px' }}>
        <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
        <Link href="/listings" style={{ color: '#fff', textDecoration: 'none' }}>Listings</Link>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
        <Link href="/exchange" style={{ color: '#fff', textDecoration: 'none' }}>Exchange</Link>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
        <Link href="/seeking" style={{ color: '#fff', textDecoration: 'none' }}>Looking For</Link>
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
        &copy; {new Date().getFullYear()} Nestly - United International University
      </div>
    </footer>
  );
}
