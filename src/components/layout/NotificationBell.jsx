import { useState, useEffect } from 'react';
import { Bell, Lock, UserPlus, Mail, Shield, AlertCircle, Check, X, Eye } from 'lucide-react';
import { db } from '../../firebase/config';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function NotificationBell() {
    const { profile } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (!profile?.email) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', profile.email),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || new Date()
            }));
            setNotifications(notifs);
            // Recalculate unread count based on actual isRead values
            const newUnreadCount = notifs.filter(n => !n.isRead).length;
            setUnreadCount(newUnreadCount);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching notifications:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profile]);

    const markAsRead = async (notificationId) => {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
            // Update local state immediately
            setNotifications(prev => {
                const updated = prev.map(n => 
                    n.id === notificationId ? { ...n, isRead: true } : n
                );
                // Recalculate unread count
                setUnreadCount(updated.filter(n => !n.isRead).length);
                return updated;
            });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAsUnread = async (notificationId) => {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), { isRead: false });
            // Update local state immediately
            setNotifications(prev => {
                const updated = prev.map(n => 
                    n.id === notificationId ? { ...n, isRead: false } : n
                );
                // Recalculate unread count
                setUnreadCount(updated.filter(n => !n.isRead).length);
                return updated;
            });
        } catch (error) {
            console.error('Error marking as unread:', error);
        }
    };

    const markAllAsRead = async () => {
        const unreadNotifs = notifications.filter(n => !n.isRead);
        for (const notif of unreadNotifs) {
            try {
                await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
            } catch (error) {
                console.error('Error:', error);
            }
        }
        // Update local state immediately
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
    };

    const handleNotificationClick = async (notif) => {
        setSelectedNotification(notif);
        setShowModal(true);
        
        // Auto-mark as read when clicked (only if not already read)
        if (!notif.isRead) {
            await markAsRead(notif.id);
            // Update the selected notification state
            setSelectedNotification({ ...notif, isRead: true });
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'account_locked': return <Lock size={18} className="text-red-500" />;
            case 'user_created': return <UserPlus size={18} className="text-green-500" />;
            case 'password_reset': return <Mail size={18} className="text-blue-500" />;
            case 'user_unlocked': return <Shield size={18} className="text-green-500" />;
            default: return <AlertCircle size={18} className="text-yellow-500" />;
        }
    };

    const getTimeAgo = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return `${seconds} sec ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    };

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <Bell size={20} className="text-gray-600" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {showDropdown && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-900">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {loading ? (
                                    <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
                                ) : notifications.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-sm">No notifications yet</div>
                                ) : (
                                    notifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors group ${
                                                !notif.isRead ? 'bg-blue-50' : ''
                                            }`}
                                        >
                                            <div className="flex gap-3">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    {getNotificationIcon(notif.type)}
                                                </div>
                                                <div className="flex-1 min-w-0" onClick={() => handleNotificationClick(notif)}>
                                                    <p className={`text-sm ${!notif.isRead ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                        {notif.message}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                        {getTimeAgo(notif.createdAt)}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    {!notif.isRead && (
                                                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                                    )}
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (notif.isRead) {
                                                                await markAsUnread(notif.id);
                                                            } else {
                                                                await markAsRead(notif.id);
                                                            }
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200"
                                                        title={notif.isRead ? 'Mark as unread' : 'Mark as read'}
                                                    >
                                                        {notif.isRead ? (
                                                            <Eye size={14} className="text-gray-400" />
                                                        ) : (
                                                            <Check size={14} className="text-green-600" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal for notification details */}
            {showModal && selectedNotification && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                {getNotificationIcon(selectedNotification.type)}
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {selectedNotification.title}
                                </h2>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                    {selectedNotification.message}
                                </p>
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                                <span>{getTimeAgo(selectedNotification.createdAt)}</span>
                                <span>Type: {selectedNotification.type?.replace(/_/g, ' ')}</span>
                            </div>

                            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                                {selectedNotification.isRead ? (
                                    <button
                                        onClick={async () => {
                                            await markAsUnread(selectedNotification.id);
                                            setSelectedNotification({ ...selectedNotification, isRead: false });
                                        }}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                                    >
                                        Mark as unread
                                    </button>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            await markAsRead(selectedNotification.id);
                                            setSelectedNotification({ ...selectedNotification, isRead: true });
                                        }}
                                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                    >
                                        Mark as read
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}