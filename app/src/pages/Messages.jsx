import { useEffect, useRef, useState } from "react";
import {
  fetchConversations,
  fetchConversationMessages,
  sendInboxMessage,
  markConversationRead,
} from "../api/inbox";
import { SendIcon } from "../icons";
import PlatformBadge, { PLATFORM_META } from "../components/PlatformBadge";

// How often the sidebar and the open thread are re-polled. The inbox has
// no push channel to the browser (webhooks land on the server), so this
// is what makes a new inbound message show up without a manual reload.
const CONVERSATIONS_POLL_MS = 6000;
const MESSAGES_POLL_MS = 4000;

function initialOf(name) {
  return name ? name.trim().charAt(0).toUpperCase() : "?";
}

// Always shows a picture — the sender's real profile photo when the
// webhook enrichment (or, for mock data, the seed script) supplied one,
// otherwise a generated initial so the row never renders blank.
function Avatar({ name, url, large }) {
  const className = "inbox-avatar" + (large ? " inbox-avatar-lg" : "");
  if (url) return <img className={className} src={url} alt={name || "Korisnik"} />;
  return <span className={className + " inbox-avatar-fallback"}>{initialOf(name)}</span>;
}

// Photo on top, platform + which of our accounts it came in on below it —
// the combination that identifies both who's writing and where.
function ConversationAvatarColumn({ conversation, large }) {
  const platformLabel = PLATFORM_META[conversation.platform]?.label || conversation.platform;
  return (
    <span className="inbox-avatar-col">
      <Avatar name={conversation.senderName} url={conversation.senderAvatarUrl} large={large} />
      <span className="inbox-avatar-sub" title={conversation.accountLabel || platformLabel}>
        <PlatformBadge platform={conversation.platform} small />
        <span className="inbox-avatar-account">{conversation.accountLabel || platformLabel}</span>
      </span>
    </span>
  );
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = (n) => String(n).padStart(2, "0");
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ConversationListItem({ conversation, active, onSelect }) {
  return (
    <button
      type="button"
      className={"inbox-conversation" + (active ? " active" : "") + (conversation.unreadCount ? " unread" : "")}
      onClick={onSelect}
    >
      <ConversationAvatarColumn conversation={conversation} />
      <span className="inbox-conversation-body">
        <span className="inbox-conversation-top">
          <span className="inbox-conversation-name">{conversation.senderName || "Nepoznat korisnik"}</span>
          <span className="inbox-conversation-time">{formatTime(conversation.lastMessageAt)}</span>
        </span>
        <span className="inbox-conversation-preview">{conversation.lastMessageText || "—"}</span>
      </span>
      {conversation.unreadCount > 0 && (
        <span className="inbox-unread-dot">{conversation.unreadCount}</span>
      )}
    </button>
  );
}

function MessageBubble({ message }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={"inbox-bubble-row" + (outbound ? " outbound" : "")}>
      <div className="inbox-bubble">
        <p className="inbox-bubble-text">{message.text}</p>
        <span className="inbox-bubble-meta">
          {formatTime(message.timestamp)}
          {outbound && message.status === "failed" && " · nije poslato"}
        </span>
      </div>
    </div>
  );
}

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchConversations()
        .then((data) => {
          if (cancelled) return;
          setConversations(data.conversations || []);
        })
        .catch(() => {})
        .finally(() => setLoadingConversations(false));
    };
    load();
    const interval = setInterval(load, CONVERSATIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoadingMessages(true);
    setError("");

    const load = () => {
      fetchConversationMessages(selectedId)
        .then((data) => {
          if (cancelled) return;
          setMessages(data.messages || []);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoadingMessages(false);
        });
    };
    load();
    const interval = setInterval(load, MESSAGES_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const selectConversation = (conversation) => {
    setSelectedId(conversation.id);
    if (conversation.unreadCount > 0) {
      setConversations((cur) =>
        cur.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c))
      );
      markConversationRead(conversation.id).catch(() => {});
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError("");
    try {
      const { message } = await sendInboxMessage(selectedId, text);
      setMessages((cur) => [...cur, message]);
      setDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  return (
    <div className="inbox-page">
      <h1 className="settings-title">Poruke</h1>
      <p className="orders-breadcrumb">Nadzorna tabla / Porudžbine / Poruke</p>

      <div className="inbox-layout">
        <div className="inbox-sidebar">
          {loadingConversations ? (
            <div className="empty-hint">Učitavanje konverzacija…</div>
          ) : conversations.length === 0 ? (
            <div className="empty-hint">
              Nema pristiglih poruka. Poveži Messenger, Instagram ili WhatsApp webhook da bi
              se konverzacije pojavile ovde.
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                active={c.id === selectedId}
                onSelect={() => selectConversation(c)}
              />
            ))
          )}
        </div>

        <div className="inbox-chat">
          {!selectedConversation ? (
            <div className="inbox-chat-empty">Izaberi konverzaciju sa leve strane.</div>
          ) : (
            <>
              <div className="inbox-chat-header">
                <ConversationAvatarColumn conversation={selectedConversation} large />
                <p className="inbox-chat-name">{selectedConversation.senderName || "Nepoznat korisnik"}</p>
              </div>

              <div className="inbox-chat-messages" ref={scrollRef}>
                {loadingMessages && messages.length === 0 ? (
                  <div className="empty-hint">Učitavanje poruka…</div>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
              </div>

              {error && <div className="woo-error">{error}</div>}

              <form className="inbox-chat-input" onSubmit={handleSend}>
                <input
                  type="text"
                  placeholder="Napiši odgovor…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={sending}
                />
                <button type="submit" disabled={sending || !draft.trim()} aria-label="Pošalji">
                  <SendIcon />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
