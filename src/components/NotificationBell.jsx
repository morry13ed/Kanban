import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  isRemoteEnabled,
  fetchNotifications,
  markNotificationsRead,
  subscribeNotifications,
} from '../utils/sync';
import { requestOpenTask } from '../utils/mentions';
import './NotificationBell.css';

function BellIcon() {
  return (
    <svg
      className="bell-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6.5a4 4 0 0 1 8 0c0 3 1.3 4.3 1.3 4.3H2.7S4 9.5 4 6.5Z" />
      <path d="M6.6 13.2a1.5 1.5 0 0 0 2.8 0" />
    </svg>
  );
}

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Who tagged you, where. Lives in the board header (desktop) and the top bar
// (mobile); only exists when signed in to the cloud.
export default function NotificationBell({ buttonClassName = '' }) {
  const { user } = useAuth();
  const { state, dispatch } = useApp();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const userId = user?.id;
  const active = isRemoteEnabled() && Boolean(userId);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    fetchNotifications().then(({ rows }) => {
      if (mounted) setItems(rows);
    });
    const unsubscribe = subscribeNotifications((row) => {
      setItems((current) =>
        current.some((n) => n.id === row.id) ? current : [row, ...current]
      );
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [active, userId]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!active) return null;

  const unread = items.filter((n) => !n.read);

  const markRead = (ids) => {
    if (ids.length === 0) return;
    setItems((current) =>
      current.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    );
    markNotificationsRead(ids);
  };

  const openItem = (item) => {
    markRead(item.read ? [] : [item.id]);
    setOpen(false);
    if (!state.boards.some((b) => b.id === item.board_id)) return;
    dispatch({ type: 'SET_ACTIVE_BOARD', payload: item.board_id });
    requestOpenTask(item.task_id);
  };

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`bell-btn ${buttonClassName}`}
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        {unread.length > 0 && <span className="bell-badge" />}
      </button>

      {open && (
        <div className="bell-menu">
          <div className="bell-menu-head">
            <span>Notifications</span>
            {unread.length > 0 && (
              <button
                type="button"
                className="bell-mark-all"
                onClick={() => markRead(unread.map((n) => n.id))}
              >
                Mark all as read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="bell-empty">
              Nothing yet. When someone tags you with @ in a task, it shows
              up here.
            </p>
          ) : (
            <div className="bell-list">
              {items.map((item) => {
                const reachable = state.boards.some(
                  (b) => b.id === item.board_id
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`bell-item ${item.read ? '' : 'unread'}`}
                    onClick={() => openItem(item)}
                    title={reachable ? 'Open task' : 'This board is no longer available'}
                  >
                    <span className="bell-item-dot" />
                    <span className="bell-item-body">
                      <span className="bell-item-text">
                        <strong>{item.author_name || item.author_email}</strong>{' '}
                        tagged you in{' '}
                        <strong>{item.task_title || 'a task'}</strong>
                      </span>
                      <span className="bell-item-time">
                        {timeAgo(item.created_at)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
