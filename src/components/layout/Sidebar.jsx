import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
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
    const [portalLogo, setPortalLogo] = useState(null);
    const [portalName, setPortalName] = useState('ERLink AR');
    const [sidebarColor, setSidebarColor] = useState('#1F2937');
    const [primaryColor, setPrimaryColor] = useState('#2563EB');

    // Load system config for logo and colors
    useEffect(() => {
        loadSystemConfig();
        
        // Listen for theme changes from System Config
        const handleThemeChange = (event) => {
            if (event.detail) {
                if (event.detail.portalLogoUrl) setPortalLogo(event.detail.portalLogoUrl);
                if (event.detail.portalName) setPortalName(event.detail.portalName);
                if (event.detail.sidebarColor) setSidebarColor(event.detail.sidebarColor);
                if (event.detail.primaryColor) setPrimaryColor(event.detail.primaryColor);
            }
        };
        
        window.addEventListener('themeChanged', handleThemeChange);
        
        // Also listen for storage events (in case config saves in another tab)
        const handleStorageChange = () => {
            loadSystemConfig();
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('themeChanged', handleThemeChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    async function loadSystemConfig() {
        try {
            const configDoc = await getDoc(doc(db, 'system_config', 'app_settings'));
            if (configDoc.exists()) {
                const data = configDoc.data();
                if (data.portalLogoUrl) setPortalLogo(data.portalLogoUrl);
                if (data.portalName) setPortalName(data.portalName);
                if (data.sidebarColor) setSidebarColor(data.sidebarColor);
                if (data.primaryColor) setPrimaryColor(data.primaryColor);
                
                // Apply CSS variables to sidebar
                const root = document.documentElement;
                root.style.setProperty('--sidebar-color', data.sidebarColor || '#1F2937');
                root.style.setProperty('--primary-color', data.primaryColor || '#2563EB');
            }
        } catch (error) {
            console.error('Error loading system config:', error);
        }
    }

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const visibleItems = navItems.filter(item =>
        item.roles.includes(profile?.role));

    return (
        <aside 
            className="w-56 flex flex-col h-screen sticky top-0 transition-all duration-300"
            style={{ backgroundColor: sidebarColor }}
        >
            {/* Logo Section - Dynamically updates */}
            <div className="p-6 border-b" style={{ borderColor: `${sidebarColor}80` }}>
                <div className="flex items-center gap-2 mb-1">
                    {portalLogo ? (
                        <img 
                            src={portalLogo} 
                            alt={portalName}
                            className="w-8 h-8 object-contain rounded-lg"
                        />
                    ) : (
                        <Activity size={24} style={{ color: primaryColor }} />
                    )}
                    <span className="font-semibold text-lg" style={{ color: '#FFFFFF' }}>
                        {portalName}
                    </span>
                </div>
                <p className="text-xs capitalize" style={{ color: '#9CA3AF' }}>
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
                            `flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`
                        }
                        style={({ isActive }) => isActive ? { backgroundColor: primaryColor } : {}}
                    >
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* User info + logout */}
            <div className="p-4 border-t" style={{ borderColor: `${sidebarColor}80` }}>
                <div className="mb-3">
                    <p className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>
                        {profile?.displayName || 'User'}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>
                        {profile?.email || 'loading...'}
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm w-full px-2 py-2 rounded-lg transition-colors"
                    style={{ color: '#9CA3AF' }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#374151';
                        e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#9CA3AF';
                    }}
                >
                    <LogOut size={16} />
                    Sign out
                </button>
            </div>
        </aside>
    );
}