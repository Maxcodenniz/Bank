import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  event_id?: string;
  metadata?: any;
}

const NotificationsPanel: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch notifications from database
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        setNotifications(data || []);
        setUnreadCount(data?.filter(n => !n.read).length || 0);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          if (!newNotification.read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (showPanel) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [showPanel]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const clearAllNotifications = async () => {
    if (!confirm('Are you sure you want to delete all notifications?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    markAsRead(notification.id);
    setShowPanel(false);
    
    if (notification.event_id) {
      setTimeout(() => {
        navigate(`/watch/${notification.event_id}`);
      }, 100);
    } else if (notification.metadata?.watchUrl) {
      setTimeout(() => {
        navigate(notification.metadata.watchUrl);
      }, 100);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 text-white hover:text-yellow-400 transition-colors"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPanel(false)}
          />
          <div className="fixed left-0 top-0 md:absolute md:right-0 md:top-full md:mt-2 w-full max-w-full md:w-96 h-full md:h-auto md:max-h-[80vh] bg-gray-900/95 backdrop-blur-xl shadow-2xl z-[70] overflow-hidden flex flex-col md:border md:border-gray-700/50 md:rounded-lg" style={{ maxWidth: '100vw', boxSizing: 'border-box' }}>
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-700/50 bg-gray-800/50 flex-shrink-0 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-white truncate flex-1 min-w-0">Notifications</h3>
              <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-xs md:text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 md:gap-1.5 px-3 md:px-2 py-2.5 md:py-1.5 rounded-lg hover:bg-red-500/10 touch-manipulation min-h-[44px] md:min-h-0"
                    title="Clear all notifications"
                  >
                    <Trash2 size={18} className="md:w-4 md:h-4" />
                    <span className="hidden md:inline">Clear all</span>
                  </button>
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs md:text-sm text-purple-400 hover:text-purple-300 transition-colors px-3 md:px-2 py-2.5 md:py-1.5 rounded-lg hover:bg-purple-500/10 touch-manipulation min-h-[44px] md:min-h-0"
                    title="Mark all as read"
                  >
                    <span className="md:hidden">Read</span>
                    <span className="hidden md:inline">Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-gray-400 hover:text-white transition-colors p-2.5 md:p-1.5 rounded-lg hover:bg-white/10 touch-manipulation min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
                  aria-label="Close notifications"
                >
                  <X size={22} className="md:w-5 md:h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-gray-400 px-4">
                  <Bell size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="pb-4">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-gray-700/50 hover:bg-gray-700/50 transition-colors group ${
                        !notification.read ? 'bg-purple-900/20' : ''
                      }`}
                      style={{ maxWidth: '100%', boxSizing: 'border-box' }}
                    >
                      <div className="flex items-start justify-between gap-3 min-w-0">
                        <div 
                          className="flex-1 cursor-pointer min-w-0 overflow-hidden"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-2 mb-1 min-w-0">
                            <h4 className="font-semibold text-white text-base leading-tight break-words min-w-0 flex-1">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-300 mb-2 leading-relaxed break-words overflow-wrap-anywhere">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 break-words">
                            {formatTime(notification.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteNotification(notification.id, e)}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg flex-shrink-0"
                          title="Delete notification"
                          aria-label="Delete notification"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationsPanel;
