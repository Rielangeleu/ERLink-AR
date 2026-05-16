import { useAuth } from '../../context/AuthContext';
import { Bell } from 'lucide-react';

export default function Header() {
    const { profile } = useAuth();

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
                <h2 className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('en-PH', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </h2>
            </div>
            <div className="flex items-center gap-4">
                <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100">
                    <Bell size={20} />
                </button>
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