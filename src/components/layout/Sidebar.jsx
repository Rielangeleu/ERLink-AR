import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard, Users, GraduationCap,
    ClipboardList, Settings, FileText,
    Box, LogOut, Activity, Shield
} from 'lucide-react';

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['instructor', 'it_admin'] },
    { to: '/students', icon: GraduationCap, label: 'Students', roles: ['instructor', 'it_admin'] },
    { to: '/results', icon: ClipboardList, label: 'Results', roles: ['instructor', 'it_admin'] },
    { to: '/scenarios', icon: FileText, label: 'Scenarios', roles: ['instructor', 'it_admin'] },
    { to: '/ar-assets', icon: Box, label: 'AR Assets', roles: ['instructor', 'it_admin'] },
    { to: '/users', icon: Users, label: 'User Management', roles: ['it_admin'] },
    { to: '/system-config', icon: Settings, label: 'System Config', roles: ['it_admin'] },
    { to: '/audit-logs', icon: Shield, label: 'Audit Logs', roles: ['it_admin'] },
];

export default function Sidebar() {
    const { profile, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const visibleItems = navItems.filter(item =>
        item.roles.includes(profile?.role));

    return (
        <aside className="w-56 bg-gray-900 flex flex-col h-screen sticky top-0">
            {/* Logo */}
            <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-2 mb-1">
                    <Activity size={24} className="text-blue-400" />
                    <span className="text-white font-semibold text-lg">ERLink AR</span>
                </div>
                <p className="text-xs text-gray-400 capitalize">
                    {profile?.role?.replace('_', ' ')} Portal
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
                {visibleItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-colors ${isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`
                        }
                    >
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* User info + logout */}
            <div className="p-4 border-t border-gray-800">
                <div className="mb-3">
                    <p className="text-white text-sm font-medium truncate">
                        {profile?.displayName}
                    </p>
                    <p className="text-gray-400 text-xs truncate">
                        {profile?.email}
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-gray-400 hover:text-white text-sm w-full px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                    <LogOut size={16} />
                    Sign out
                </button>
            </div>
        </aside>
    );
}