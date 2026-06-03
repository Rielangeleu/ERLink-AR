import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import {
    LayoutDashboard, Users, GraduationCap,
    ClipboardList, Settings, FileText,
    Box, LogOut, Activity, Shield, X
} from 'lucide-react';

// Helper function to determine if a color is light or dark
function getContrastColor(hexColor) {
    let color = hexColor.replace('#', '');
    let r, g, b;
    if (color.length === 3) {
        r = parseInt(color[0] + color[0], 16);
        g = parseInt(color[1] + color[1], 16);
        b = parseInt(color[2] + color[2], 16);
    } else {
        r = parseInt(color.substring(0, 2), 16);
        g = parseInt(color.substring(2, 4), 16);
        b = parseInt(color.substring(4, 6), 16);
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1F2937' : '#FFFFFF';
}

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

export default function Sidebar({ onClose }) {
    const { profile, logout } = useAuth();
    const navigate = useNavigate();
    const [portalLogo, setPortalLogo] = useState(null);
    const [portalName, setPortalName] = useState('ERLink AR');
    const [sidebarColor, setSidebarColor] = useState('#1F2937');
    const [primaryColor, setPrimaryColor] = useState('#2563EB');
    const [activeTextColor, setActiveTextColor] = useState('#FFFFFF');

    useEffect(() => {
        setActiveTextColor(getContrastColor(primaryColor));
    }, [primaryColor]);

    useEffect(() => {
        loadSystemConfig();

        const handleThemeChange = (event) => {
            if (event.detail) {
                if (event.detail.portalLogoUrl) setPortalLogo(event.detail.portalLogoUrl);
                if (event.detail.portalName) setPortalName(event.detail.portalName);
                if (event.detail.sidebarColor) setSidebarColor(event.detail.sidebarColor);
                if (event.detail.primaryColor) {
                    setPrimaryColor(event.detail.primaryColor);
                    setActiveTextColor(getContrastColor(event.detail.primaryColor));
                }
            }
        };

        window.addEventListener('themeChanged', handleThemeChange);
        window.addEventListener('storage', loadSystemConfig);

        return () => {
            window.removeEventListener('themeChanged', handleThemeChange);
            window.removeEventListener('storage', loadSystemConfig);
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
                if (data.primaryColor) {
                    setPrimaryColor(data.primaryColor);
                    setActiveTextColor(getContrastColor(data.primaryColor));
                }
            }
        } catch (error) {
            console.error('Error loading system config:', error);
        }
    }

    const handleLogout = async () => {
        await logout();
        navigate('/login');
        if (onClose) onClose();
    };

    const handleNavClick = () => {
        if (onClose) onClose();
    };

    const visibleItems = navItems.filter(item =>
        item.roles.includes(profile?.role));

    return (
        <aside
            className="w-64 md:w-56 flex flex-col h-screen transition-all duration-300 sidebar"
            style={{ backgroundColor: sidebarColor }}
        >
            {/* Logo Section with Close Button */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: `${sidebarColor}80` }}>
                <div className="flex items-center gap-2">
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
                {/* Mobile Close Button */}
                <button
                    onClick={onClose}
                    className="md:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    aria-label="Close menu"
                >
                    <X size={20} style={{ color: '#9CA3AF' }} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
                {visibleItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-colors ${isActive
                                ? 'font-semibold shadow-sm'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`
                        }
                        style={({ isActive }) => isActive ? {
                            backgroundColor: primaryColor,
                            color: activeTextColor,
                            opacity: 1
                        } : {}}
                    >
                        <Icon size={18} style={{ color: 'inherit' }} />
                        <span style={{ color: 'inherit' }}>{label}</span>
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