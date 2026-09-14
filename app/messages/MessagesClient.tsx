'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendMessage, markConversationRead, markConversationUnread } from '@/app/actions/messages';
import { avatarInitials } from '@/lib/utils';
import { Send, MessageCircle, Building2, ShoppingBag, CheckCheck, Search, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Conversation {
  id: string;
  created_at: string;
  listing_id?: number | null;
  item_id?: number | null;
  other_user: { id: string; name: string; profile_pic?: string; profile_slug?: string };
  listing_title?: string | null;
  item_title?: string | null;
  last_message?: { body: string; created_at: string; sender_id: string } | null;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

/** One entry in the sidebar — represents a person, grouping all their conversations */
interface PersonThread {
  personId: string;
  otherUser: Conversation['other_user'];
  convos: Conversation[];
  totalUnread: number;
  latestMessage?: Conversation['last_message'];
  latestConvoId: string;
}

interface MessagesClientProps {
  conversations: Conversation[];
  currentUserId: string;
  initialConvoId: string | null;
}

// ─────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────
const EMERALD       = 'var(--btn-primary-bg)';   // filled surfaces (bubble, badges, avatar)
const EMERALD_INK   = 'var(--btn-primary-ink)';  // text/icons sitting on EMERALD
const EMERALD_TEXT  = 'var(--emerald)';          // links and accent text
const EMERALD_SOFT  = 'var(--emerald-soft)';
const EMERALD_LIGHT = 'var(--emerald-soft)';

function Avatar({ src, name, size = 40 }: { src?: string; name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: EMERALD, color: EMERALD_INK,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.35,
    }}>
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : avatarInitials(name)}
    </div>
  );
}

function ContextLabel({ conv }: { conv: Conversation }) {
  if (conv.item_title)    return <><ShoppingBag size={10} /> {conv.item_title}</>;
  if (conv.listing_title) return <><Building2 size={10} /> {conv.listing_title}</>;
  return <>General</>;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function MessagesClient({ conversations: initialConvos, currentUserId, initialConvoId }: MessagesClientProps) {
  const [convos, setConvos]               = useState<Conversation[]>(initialConvos);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(initialConvoId);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState('');
  const [sending, setSending]             = useState(false);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [search, setSearch]               = useState('');
  const [ctxMenu, setCtxMenu]             = useState<{ convId: string; x: number; y: number } | null>(null);
  const [dealsOpen, setDealsOpen]         = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const dealsRef  = useRef<HTMLDivElement>(null);
  const supabase  = createClient();

  // ── Group convos by person ──────────────────────────────────
  const persons: PersonThread[] = useMemo(() => {
    const map = new Map<string, PersonThread>();
    convos.forEach(c => {
      const pid = c.other_user.id;
      if (!map.has(pid)) {
        map.set(pid, {
          personId: pid,
          otherUser: c.other_user,
          convos: [],
          totalUnread: 0,
          latestMessage: undefined,
          latestConvoId: c.id,
        });
      }
      const pt = map.get(pid)!;
      pt.convos.push(c);
      pt.totalUnread += c.unread_count;
      // pick the convo with the most recent message as "latest"
      const ptTime = pt.latestMessage?.created_at ? new Date(pt.latestMessage.created_at).getTime() : 0;
      const cTime  = c.last_message?.created_at   ? new Date(c.last_message.created_at).getTime()   : 0;
      if (cTime >= ptTime) {
        pt.latestMessage  = c.last_message ?? undefined;
        pt.latestConvoId  = c.id;
      }
    });
    // sort persons by most recent message
    return Array.from(map.values()).sort((a, b) => {
      const aT = a.latestMessage?.created_at ? new Date(a.latestMessage.created_at).getTime() : 0;
      const bT = b.latestMessage?.created_at ? new Date(b.latestMessage.created_at).getTime() : 0;
      return bT - aT;
    });
  }, [convos]);

  const activeConvo  = convos.find(c => c.id === activeConvoId);
  const activePerson = activeConvo ? persons.find(p => p.personId === activeConvo.other_user.id) : null;

  // ── Load messages ───────────────────────────────────────────
  useEffect(() => {
    if (!activeConvoId) return;
    setLoadingMsgs(true);
    setMessages([]);
    setDealsOpen(false);
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeConvoId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setMessages((data as Message[]) || []); setLoadingMsgs(false); });
    markConversationRead(activeConvoId);
    setConvos(prev => prev.map(c => c.id === activeConvoId ? { ...c, unread_count: 0 } : c));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeConvoId]);

  // ── Scroll to bottom ────────────────────────────────────────
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Realtime ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConvoId) return;
    const channel = supabase
      .channel(`msgs-${activeConvoId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvoId}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.sender_id !== currentUserId) markConversationRead(activeConvoId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvoId}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: msg.is_read } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvoId]);

  // ── Close menus on outside click ────────────────────────────
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  useEffect(() => {
    if (!dealsOpen) return;
    const close = (e: MouseEvent) => {
      if (dealsRef.current && !dealsRef.current.contains(e.target as Node)) setDealsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dealsOpen]);

  // ── Send ─────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !activeConvoId || sending) return;
    setSending(true);
    setInput('');
    const optimistic: Message = { id: `opt-${Date.now()}`, conversation_id: activeConvoId, sender_id: currentUserId, body: text, is_read: false, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    const res = await sendMessage(activeConvoId, text);
    setSending(false);
    if (res.error) {
      toast.error(res.error);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(text);
    } else if (res.message) {
      const real = res.message as Message;
      setMessages(prev =>
        prev.some(m => m.id === real.id)
          ? prev.filter(m => m.id !== optimistic.id)
          : prev.map(m => m.id === optimistic.id ? real : m)
      );
      setConvos(prev => prev.map(c => c.id === activeConvoId
        ? { ...c, last_message: { body: text, created_at: new Date().toISOString(), sender_id: currentUserId } }
        : c));
    }
  }, [input, activeConvoId, sending, currentUserId]);

  // ── Mark unread ──────────────────────────────────────────────
  const handleMarkUnread = useCallback(async (convId: string) => {
    await markConversationUnread(convId);
    setConvos(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 1 } : c));
    if (activeConvoId === convId) setActiveConvoId(null);
  }, [activeConvoId]);

  // ── Switch to person (default to their latest convo) ────────
  const selectPerson = (pt: PersonThread) => {
    setActiveConvoId(pt.latestConvoId);
  };

  // ── Time formatters ──────────────────────────────────────────
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtHHMM = (d: Date) => {
    const h = d.getHours(), m = d.getMinutes();
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const fmtTime = (iso: string) => {
    const d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString()) return fmtHHMM(d);
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };
  const fmtFull = (iso: string) => {
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${fmtHHMM(d)}`;
  };
  const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Search filter (searches over persons) ───────────────────
  const filteredPersons = search.trim()
    ? persons.filter(pt =>
        pt.otherUser.name.toLowerCase().includes(search.toLowerCase()) ||
        pt.convos.some(c => (c.listing_title || '').toLowerCase().includes(search.toLowerCase()) || (c.item_title || '').toLowerCase().includes(search.toLowerCase()))
      )
    : persons;

  const totalUnread = persons.reduce((s, pt) => s + pt.totalUnread, 0);
  const NAV_H = 64;

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: `calc(100vh - ${NAV_H}px)`, display: 'flex', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid var(--border)`, background: 'var(--surface-1)', overflow: 'hidden' }}>

        <div style={{ padding: '16px 14px 10px', borderBottom: `1px solid var(--border)`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Messages</span>
            {totalUnread > 0 && (
              <span style={{ background: EMERALD, color: EMERALD_INK, borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{totalUnread}</span>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)', pointerEvents: 'none' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', boxSizing: 'border-box', color: 'var(--ink)', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {filteredPersons.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
              {search ? 'No results.' : 'No conversations yet.'}
            </div>
          ) : filteredPersons.map(pt => {
            const isActive = activeConvoId !== null && pt.convos.some(c => c.id === activeConvoId);
            return (
              <button
                key={pt.personId}
                onClick={() => selectPerson(pt)}
                onContextMenu={e => { e.preventDefault(); setCtxMenu({ convId: pt.latestConvoId, x: e.clientX, y: e.clientY }); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '11px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: isActive ? EMERALD_LIGHT : 'transparent',
                  border: 'none', borderBottom: `1px solid var(--border)`,
                  borderLeft: `3px solid ${isActive ? EMERALD : 'transparent'}`,
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar src={pt.otherUser.profile_pic} name={pt.otherUser.name} size={42} />
                  {pt.totalUnread > 0 && (
                    <span style={{ position: 'absolute', top: -2, right: -2, width: 15, height: 15, borderRadius: '50%', background: EMERALD, color: EMERALD_INK, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                      {pt.totalUnread > 9 ? '9+' : pt.totalUnread}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontWeight: pt.totalUnread > 0 ? 700 : 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                      {pt.otherUser.name}
                    </span>
                    {pt.latestMessage && <span style={{ fontSize: 10, color: 'var(--ink-muted)', flexShrink: 0 }}>{fmtTime(pt.latestMessage.created_at)}</span>}
                  </div>
                  {/* Show deal context badges */}
                  {pt.convos.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'nowrap', overflow: 'hidden' }}>
                      {pt.convos.slice(0, 2).map(c => (
                        <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: EMERALD_TEXT, background: EMERALD_SOFT, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <ContextLabel conv={c} />
                        </span>
                      ))}
                      {pt.convos.length > 2 && (
                        <span style={{ fontSize: 10, color: 'var(--ink-muted)', flexShrink: 0 }}>+{pt.convos.length - 2}</span>
                      )}
                    </div>
                  )}
                  {pt.latestMessage && (
                    <div style={{ fontSize: 12, color: pt.totalUnread > 0 ? 'var(--ink)' : 'var(--ink-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: pt.totalUnread > 0 ? 500 : 400 }}>
                      {pt.latestMessage.sender_id === currentUserId ? 'You: ' : ''}{pt.latestMessage.body}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat panel ── */}
      {activeConvo && activePerson ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>

          {/* Chat header */}
          <div style={{ padding: '12px 20px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'var(--surface)' }}>
            <Avatar src={activeConvo.other_user.profile_pic} name={activeConvo.other_user.name} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                {activeConvo.other_user.profile_slug
                  ? <Link href={`/profiles/${activeConvo.other_user.profile_slug}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{activeConvo.other_user.name}</Link>
                  : activeConvo.other_user.name}
              </div>

              {/* Deals dropdown — only if this person has multiple conversations */}
              {activePerson.convos.length > 1 ? (
                <div style={{ position: 'relative' }} ref={dealsRef}>
                  <button
                    onClick={() => setDealsOpen(v => !v)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: EMERALD_TEXT, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, fontWeight: 500 }}
                  >
                    {activeConvo.item_title ? <ShoppingBag size={11} /> : activeConvo.listing_title ? <Building2 size={11} /> : null}
                    {activeConvo.item_title || activeConvo.listing_title || 'General'}
                    <span style={{ fontSize: 10, color: 'var(--ink-muted)', marginLeft: 2 }}>({activePerson.convos.length} deals)</span>
                    <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: dealsOpen ? 'rotate(180deg)' : 'none' }} />
                  </button>
                  {dealsOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '6px 0', minWidth: 220 }}>
                      <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-muted)' }}>
                        All deals with {activeConvo.other_user.name}
                      </div>
                      {activePerson.convos.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setActiveConvoId(c.id); setDealsOpen(false); }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '9px 12px',
                            background: c.id === activeConvoId ? EMERALD_SOFT : 'none',
                            border: 'none', cursor: 'pointer', fontSize: 13,
                            display: 'flex', alignItems: 'center', gap: 8,
                            color: c.id === activeConvoId ? EMERALD : 'var(--ink)',
                            fontWeight: c.id === activeConvoId ? 600 : 400,
                          }}
                        >
                          <span style={{ color: EMERALD_TEXT, flexShrink: 0 }}>
                            {c.item_id ? <ShoppingBag size={13} /> : c.listing_id ? <Building2 size={13} /> : <MessageCircle size={13} />}
                          </span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.item_title || c.listing_title || 'General chat'}
                          </span>
                          {c.unread_count > 0 && (
                            <span style={{ background: EMERALD, color: EMERALD_INK, borderRadius: 8, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>{c.unread_count}</span>
                          )}
                          {c.item_id
                            ? <Link href={`/exchange/${c.item_id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: EMERALD_TEXT, textDecoration: 'underline', flexShrink: 0 }}>View</Link>
                            : c.listing_id
                            ? <Link href={`/listings/${c.listing_id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: EMERALD_TEXT, textDecoration: 'underline', flexShrink: 0 }}>View</Link>
                            : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (activeConvo.item_title || activeConvo.listing_title) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: EMERALD_TEXT, marginTop: 1 }}>
                  {activeConvo.item_id ? <ShoppingBag size={11} /> : <Building2 size={11} />}
                  {activeConvo.item_id
                    ? <Link href={`/exchange/${activeConvo.item_id}`} style={{ color: EMERALD_TEXT, textDecoration: 'none', fontWeight: 500 }}>{activeConvo.item_title}</Link>
                    : activeConvo.listing_id
                    ? <Link href={`/listings/${activeConvo.listing_id}`} style={{ color: EMERALD_TEXT, textDecoration: 'none', fontWeight: 500 }}>{activeConvo.listing_title}</Link>
                    : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 2, scrollbarWidth: 'thin' }}>
            {loadingMsgs ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)' }}>Loading…</div>
            ) : messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ink-muted)' }}>
                <MessageCircle size={40} style={{ opacity: 0.2 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No messages yet — say hello!</p>
              </div>
            ) : (() => {
              const groups: { date: string; messages: Message[] }[] = [];
              messages.forEach(msg => {
                const day = new Date(msg.created_at).toDateString();
                const last = groups[groups.length - 1];
                if (last?.date === day) last.messages.push(msg);
                else groups.push({ date: day, messages: [msg] });
              });

              return groups.map(group => {
                const dayLabel = (() => {
                  const d = new Date(group.date), now = new Date();
                  if (d.toDateString() === now.toDateString()) return 'Today';
                  const y = new Date(now); y.setDate(now.getDate() - 1);
                  if (d.toDateString() === y.toDateString()) return 'Yesterday';
                  return `${FULL_MONTHS[d.getMonth()]} ${d.getDate()}`;
                })();

                return (
                  <div key={group.date}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <span style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 500 }}>{dayLabel}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {group.messages.map((msg, i) => {
                        const isMine = msg.sender_id === currentUserId;
                        const prevSame = i > 0 && group.messages[i - 1].sender_id === msg.sender_id;
                        const nextSame = i < group.messages.length - 1 && group.messages[i + 1].sender_id === msg.sender_id;

                        const r = '16px';
                        const tl = isMine ? r : (prevSame ? '4px' : r);
                        const tr = isMine ? (prevSame ? '4px' : r) : r;
                        const br = isMine ? (nextSame ? '4px' : r) : r;
                        const bl = isMine ? r : (nextSame ? '4px' : r);

                        return (
                          <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 0 : 6 }}>
                            <div
                              title={fmtFull(msg.created_at)}
                              style={{
                                maxWidth: '66%', padding: '9px 13px',
                                borderRadius: `${tl} ${tr} ${br} ${bl}`,
                                background: isMine ? EMERALD : EMERALD_SOFT,
                                color: isMine ? EMERALD_INK : 'var(--ink)',
                                fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                              }}
                            >
                              {msg.body}
                              {!nextSame && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3, fontSize: 10 }}>
                                  <span style={{ opacity: isMine ? 0.75 : 0.55 }}>{fmtTime(msg.created_at)}</span>
                                  {isMine && (
                                    <CheckCheck size={10} aria-label={msg.is_read ? 'Read' : 'Sent'} style={{ color: msg.is_read ? EMERALD_INK : 'rgba(255,255,255,0.45)' }} />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid var(--border)`, background: 'var(--surface)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-1)', borderRadius: 24, padding: '5px 5px 5px 16px', border: `1.5px solid var(--border)` }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message… (Enter to send)"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--ink)', fontFamily: 'inherit' }}
                disabled={sending}
                autoComplete="off"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: input.trim() ? EMERALD : 'var(--border)',
                  color: input.trim() ? EMERALD_INK : 'var(--ink-muted)',
                  border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--ink-muted)', background: 'var(--surface-1)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: EMERALD_SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={28} color={EMERALD} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--ink)', fontSize: 15 }}>Your Messages</p>
            <p style={{ margin: 0, fontSize: 13 }}>Select a conversation to start chatting.</p>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 99999, background: 'var(--surface)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid var(--border)', padding: '4px 0', minWidth: 160 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            style={{ width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--ink)' }}
            onMouseDown={() => { handleMarkUnread(ctxMenu.convId); setCtxMenu(null); }}
          >
            Mark as unread
          </button>
        </div>
      )}
    </div>
  );
}
