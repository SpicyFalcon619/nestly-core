'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { Home, Building2, ShoppingBag, Search, UserCircle, LayoutDashboard, User, Heart, Receipt, LogOut, Menu, MessageCircle, ArrowLeft } from 'lucide-react';
import NotificationBell from './NotificationBell';
import MessageIcon from './MessageIcon';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (profile?.status === 'suspended') {
          await supabase.auth.signOut();
          setUser(null);
          localStorage.removeItem('userRole');
          router.push('/login');
        } else {
          setUser(profile);
          if (profile?.role) {
            localStorage.setItem('userRole', profile.role);
          }
        }
      } else {
        localStorage.removeItem('userRole');
      }
      setLoading(false);
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const pageIsScrollable = document.documentElement.scrollHeight > window.innerHeight + 2;
      const isHomepage = pathname === '/';

      if (!pageIsScrollable || currentScrollY > 60) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }

      if (!isHomepage && window.innerWidth > 560) {
        if (pageIsScrollable) {
          if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
            setNavHidden(true);
          } else {
            setNavHidden(false);
          }
        }
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccountOpen(false);
    setAvatarOpen(false);
    router.push('/');
    router.refresh();
  };

  const getLinkClass = (path: string) => pathname === path || (path !== '/' && pathname.startsWith(path)) ? 'active' : '';

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'US';

  const currentRole = user?.role;

  const navLinks = [
    { href: '/', label: 'Home', icon: <Home size={18} className="nav-icon" /> },
    { href: '/listings', label: 'Listings', icon: <Building2 size={18} className="nav-icon" /> },
    { href: '/exchange', label: 'Market', icon: <ShoppingBag size={18} className="nav-icon" /> },
    ...(currentRole !== 'landlord' ? [{ href: '/seeking', label: 'Seeking', icon: <Search size={18} className="nav-icon" /> }] : []),
  ];

  const isMessagesPage = pathname.startsWith('/messages');

  // ── Slim messages bar ──────────────────────────────────────────
  if (isMessagesPage) {
    return (
      <nav style={{
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
        position: 'relative', zIndex: 2000,
      }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-muted)', textDecoration: 'none', fontWeight: 500, fontSize: 14 }}>
          <ArrowLeft size={18} />
          Back
        </Link>

        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          Messages
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle />
          {!loading && user && (
            <div className="avatar" onClick={() => setAvatarOpen(!avatarOpen)} style={{ cursor: 'pointer', position: 'relative' }} ref={avatarMenuRef}>
              {user.profile_pic
                ? <img src={user.profile_pic} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="Avatar" />
                : initials}
              {avatarOpen && (
                <div className="avatar-menu open" style={{ top: '100%', right: 0, position: 'absolute' }}>
                  {user.role !== 'admin' && <Link href="/dashboard">Dashboard</Link>}
                  <Link href="/profile">Profile</Link>
                  {user.role !== 'admin' && <Link href="/bills">Bills</Link>}
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    );
  }

  return (
    <div id="nav-mount" className={navHidden ? 'nav-hidden' : ''}>
      <nav className="navbar">
        <div className="nav-inner" style={{ position: 'relative' }}>
          
          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginRight: '8px' }}
          >
            <Menu size={24} />
          </button>
          
          <Link href="/" className="nav-logo">
            <span className="logo-nest">Nest</span><span className="logo-ly">ly</span>
          </Link>

          <div className={`nav-links ${mobileMenuOpen ? 'open' : ''} ${scrolled ? 'nav-scrolled' : ''}`}>
            {navLinks.map((link, i) => (
              <React.Fragment key={link.href}>
                {i === 2 && user && (
                  <button key="mobile-account-btn" className="mobile-nav-extra mobile-account-btn" onClick={() => setAccountOpen(!accountOpen)}>
                    <span style={{ position: 'relative' }}>
                      <UserCircle size={18} className="nav-icon" />
                    </span>
                    <span className="nav-label">Account</span>
                  </button>
                )}
                {i === 2 && !user && !loading && (
                  <Link key="mobile-login" href="/login" className={`mobile-nav-extra mobile-account-btn ${getLinkClass('/login')}`}>
                    <UserCircle size={18} className="nav-icon" />
                    <span className="nav-label">Login</span>
                  </Link>
                )}
                
                <Link key={link.href} href={link.href} className={`${getLinkClass(link.href)} ${link.href === '/seeking' ? 'seeking-nav-link' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  {link.icon}
                  <span className="nav-label">{link.label}</span>
                </Link>
              </React.Fragment>
            ))}

            {accountOpen && user && (
              <div id="mobileAccountSheet" className="mobile-account-sheet open" ref={sheetRef}>
                <div className="mas-header">
                  <span className="mas-name">{user.name}</span>
                  <span className="mas-role">{user.role}</span>
                </div>
                {user.role !== 'admin' && (
                  <Link href="/dashboard" className="mas-item" onClick={() => setAccountOpen(false)}><LayoutDashboard size={16} /> Dashboard</Link>
                )}
                <Link href="/profile" className="mas-item" onClick={() => setAccountOpen(false)}><User size={16} /> Profile</Link>
                {user.role !== 'admin' && (
                  <>
                    <Link href="/messages" className="mas-item" onClick={() => setAccountOpen(false)}><MessageCircle size={16} /> Messages</Link>
                    <Link href="/dashboard?tab=watch" className="mas-item" onClick={() => setAccountOpen(false)}><Heart size={16} /> Watchlist</Link>
                    <Link href="/bills" className="mas-item" onClick={() => setAccountOpen(false)}><Receipt size={16} /> Bills</Link>
                  </>
                )}
                <ThemeToggle variant="menu-item" />
                <button className="mas-item mas-logout" onClick={handleLogout}><LogOut size={16} /> Logout</button>
              </div>
            )}
          </div>

          <div className="nav-right">
            <ThemeToggle />
            {!loading && (
              <>
                {user ? (
                  <>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <NotificationBell />
                    </div>
                    {user.role !== 'admin' && (
                      <>
                        <MessageIcon />
                        <Link className="icon-btn" href="/dashboard?tab=watch" title="Watchlist">
                          <Heart size={20} />
                        </Link>
                      </>
                    )}
                    <div className="avatar" id="avatarBtn" onClick={() => setAvatarOpen(!avatarOpen)} style={{ cursor: 'pointer', position: 'relative' }}>
                      {user.profile_pic ? (
                        <img src={user.profile_pic} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="Avatar" />
                      ) : initials}
                      
                      {avatarOpen && (
                        <div className="avatar-menu open" id="avatarMenu" ref={avatarMenuRef} style={{ top: '100%', right: 0, position: 'absolute' }}>
                          {user.role !== 'admin' && <Link href="/dashboard">Dashboard</Link>}
                          <Link href="/profile">Profile</Link>
                          {user.role !== 'admin' && <Link href="/messages">Messages</Link>}
                          {user.role !== 'admin' && <Link href="/bills">Bills</Link>}
                          {user.role === 'admin' && <Link href="/admin">Admin Panel</Link>}
                          <button onClick={handleLogout}>
                            Logout
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Link className="btn btn-outline" href="/login">Login</Link>
                    <Link className="btn btn-primary" href="/register">Register</Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
