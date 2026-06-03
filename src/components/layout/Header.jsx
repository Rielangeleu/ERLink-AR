import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';
import { Menu } from 'lucide-react';

export default function Header({ onMenuClick }) {
    const { profile } = useAuth();

    const handleMenuClick = () => {
        console.log('Menu button clicked');
        if (onMenuClick) onMenuClick();
    };

    return (
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {/* Mobile Menu Button */}
                <button
                    onClick={handleMenuClick}
                    className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Open menu"
                >
                    <Menu size={20} className="text-gray-600" />
                </button>
                <div>
                    <h2 className="text-sm text-gray-500 hidden md:block">
                        {new Date().toLocaleDateString('en-PH', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </h2>
                    {/* Mobile date - shorter format */}
                    <h2 className="text-xs text-gray-500 md:hidden">
                        {new Date().toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </h2>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <NotificationBell />
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                        {profile?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="hidden md:block">
                        <p className="text-sm font-medium text-gray-900">
                            {profile?.displayName}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                            {profile?.role?.replace('_', ' ')}
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
}