import { useEffect, useState } from 'react';
import { db, storage } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Save, Upload, AlertTriangle, Key, Palette, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SystemConfig() {
    const { profile } = useAuth();
    
    // Original config (saved in database)
    const [originalConfig, setOriginalConfig] = useState(null);
    
    // Editable config (changes while editing)
    const [config, setConfig] = useState({
        appName: 'ERLink AR',
        portalName: 'ERLink Admin Portal',
        primaryColor: '#2563EB',
        secondaryColor: '#7C3AED',
        accentColor: '#10B981',
        theme: 'default',
        logoUrl: '',
        portalLogoUrl: '',
        faviconUrl: '',
        maintenanceMode: false,
        maintenanceMessage: 'System is under maintenance. Please try again later.',
        minAppVersion: '1.0.0',
        currentAppVersion: '1.0.0',
        allowSelfRegistration: true,
        maxLoginAttempts: 5,
        sessionTimeout: 60,
        enableEmailNotifications: true,
        enablePushNotifications: false,
        sidebarColor: '#1F2937',
        headerColor: '#FFFFFF',
        animationEnabled: true
    });
    
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [logoFile, setLogoFile] = useState(null);
    const [portalLogoFile, setPortalLogoFile] = useState(null);
    const [faviconFile, setFaviconFile] = useState(null);
    const [previewLogo, setPreviewLogo] = useState(null);
    const [previewPortalLogo, setPreviewPortalLogo] = useState(null);
    const [previewFavicon, setPreviewFavicon] = useState(null);
    const [activeTab, setActiveTab] = useState('appearance');

    useEffect(() => { 
        loadConfig(); 
    }, []);

    // Apply saved theme to the actual portal
    const applySavedTheme = (themeConfig) => {
        const root = document.documentElement;
        const colors = themeConfig;
        
        if (colors?.primaryColor) {
            root.style.setProperty('--primary-color', colors.primaryColor);
            root.style.setProperty('--primary-50', `${colors.primaryColor}0D`);
            root.style.setProperty('--primary-600', colors.primaryColor);
            root.style.setProperty('--primary-700', colors.primaryColor);
        }
        
        if (colors?.sidebarColor) {
            root.style.setProperty('--sidebar-color', colors.sidebarColor);
        }
        
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: colors }));
    };

    async function loadConfig() {
        try {
            const snap = await getDoc(doc(db, 'system_config', 'app_settings'));
            if (snap.exists()) {
                const data = snap.data();
                setOriginalConfig(data);
                setConfig(prev => ({ ...prev, ...data }));
                // Apply saved theme to portal after loading
                setTimeout(() => applySavedTheme(data), 100);
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    async function logAction(action, details) {
        try {
            await addDoc(collection(db, 'audit_logs'), {
                action,
                details,
                performedBy: profile?.email || 'system',
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error('Error logging action:', error);
        }
    }

    async function saveConfig() {
        setSaving(true);
        try {
            let logoUrl = config.logoUrl;
            let portalLogoUrl = config.portalLogoUrl;
            let faviconUrl = config.faviconUrl;

            if (logoFile) {
                if (config.logoUrl) {
                    try {
                        const oldLogoRef = ref(storage, config.logoUrl);
                        await deleteObject(oldLogoRef);
                    } catch (e) { }
                }
                const logoRef = ref(storage, `system/ar_logo_${Date.now()}`);
                await uploadBytes(logoRef, logoFile);
                logoUrl = await getDownloadURL(logoRef);
            }

            if (portalLogoFile) {
                if (config.portalLogoUrl) {
                    try {
                        const oldPortalLogoRef = ref(storage, config.portalLogoUrl);
                        await deleteObject(oldPortalLogoRef);
                    } catch (e) { }
                }
                const portalLogoRef = ref(storage, `system/portal_logo_${Date.now()}`);
                await uploadBytes(portalLogoRef, portalLogoFile);
                portalLogoUrl = await getDownloadURL(portalLogoRef);
            }

            if (faviconFile) {
                if (config.faviconUrl) {
                    try {
                        const oldFaviconRef = ref(storage, config.faviconUrl);
                        await deleteObject(oldFaviconRef);
                    } catch (e) { }
                }
                const faviconRef = ref(storage, `system/favicon_${Date.now()}`);
                await uploadBytes(faviconRef, faviconFile);
                faviconUrl = await getDownloadURL(faviconRef);
            }

            const finalConfig = { 
                ...config, 
                logoUrl, 
                portalLogoUrl,
                faviconUrl,
                updatedAt: serverTimestamp(),
                updatedBy: profile?.email,
                lastUpdated: new Date().toISOString()
            };
            
            await setDoc(doc(db, 'system_config', 'app_settings'), finalConfig);
            setConfig(finalConfig);
            setOriginalConfig(finalConfig);
            
            // Apply theme to the actual portal after save
            applySavedTheme(finalConfig);
            
            await logAction('SYSTEM_CONFIG_UPDATED', 
                `System configuration updated by ${profile?.email}`);
            
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            
            setLogoFile(null);
            setPortalLogoFile(null);
            setFaviconFile(null);
            setPreviewLogo(null);
            setPreviewPortalLogo(null);
            setPreviewFavicon(null);
            
        } catch (error) {
            console.error('Save failed:', error);
            alert('Save failed: ' + error.message);
        } finally {
            setSaving(false);
        }
    }

    function handleLogoChange(e, type) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('Logo must be less than 2MB');
                return;
            }
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file');
                return;
            }
            if (type === 'ar') {
                setLogoFile(file);
                setPreviewLogo(URL.createObjectURL(file));
            } else if (type === 'portal') {
                setPortalLogoFile(file);
                setPreviewPortalLogo(URL.createObjectURL(file));
            }
        }
    }

    function handleFaviconChange(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500 * 1024) {
                alert('Favicon must be less than 500KB');
                return;
            }
            setFaviconFile(file);
            setPreviewFavicon(URL.createObjectURL(file));
        }
    }

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
        >
            <Icon size={16} className="inline mr-2" />
            {label}
        </button>
    );

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        System Configuration
                    </h1>
                    <p className="text-gray-500">
                        Customize portal appearance and system settings
                    </p>
                </div>
            </div>

            {/* Tabs - VERSIONS TAB REMOVED */}
            <div className="flex gap-2 mb-6 flex-wrap">
                <TabButton id="appearance" label="Appearance" icon={Palette} />
                <TabButton id="security" label="Security" icon={Shield} />
                <TabButton id="maintenance" label="Maintenance" icon={AlertTriangle} />
            </div>

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Palette size={18} />
                            Theme Customization
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Changes will apply after clicking "Save Changes"</p>
                    </div>
                    
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Portal Name
                            </label>
                            <input
                                value={config.portalName}
                                onChange={e => setConfig({ ...config, portalName: e.target.value })}
                                className="w-full max-w-md h-11 px-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                placeholder="ERLink Admin Portal"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Primary Color
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={config.primaryColor}
                                    onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                    className="w-12 h-11 rounded-lg cursor-pointer p-0 border-0"
                                    style={{ backgroundColor: config.primaryColor }}
                                />
                                <input
                                    value={config.primaryColor}
                                    onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                    className="flex-1 max-w-xs h-11 px-4 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400"
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                Used for: buttons, links, active menu items, focus rings
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Sidebar Color
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={config.sidebarColor || '#1F2937'}
                                    onChange={e => setConfig({ ...config, sidebarColor: e.target.value })}
                                    className="w-12 h-11 rounded-lg cursor-pointer p-0 border-0"
                                    style={{ backgroundColor: config.sidebarColor || '#1F2937' }}
                                />
                                <input
                                    value={config.sidebarColor || '#1F2937'}
                                    onChange={e => setConfig({ ...config, sidebarColor: e.target.value })}
                                    className="flex-1 max-w-xs h-11 px-4 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400"
                                />
                            </div>
                        </div>

                        {/* Portal Logo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Portal Logo (Sidebar)
                            </label>
                            <div className="flex items-center gap-4">
                                {(previewPortalLogo || config.portalLogoUrl) && (
                                    <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 p-2 flex items-center justify-center">
                                        <img 
                                            src={previewPortalLogo || config.portalLogoUrl} 
                                            alt="Portal Logo"
                                            className="max-w-full max-h-full object-contain"
                                            onError={(e) => e.target.style.display = 'none'}
                                        />
                                    </div>
                                )}
                                <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-600">
                                    <Upload size={16} />
                                    {portalLogoFile ? portalLogoFile.name : (config.portalLogoUrl ? 'Change Logo' : 'Upload Logo')}
                                    <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => handleLogoChange(e, 'portal')} />
                                </label>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Appears in the sidebar next to portal name</p>
                        </div>

                        {/* AR App Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                AR App Name
                            </label>
                            <input
                                value={config.appName}
                                onChange={e => setConfig({ ...config, appName: e.target.value })}
                                className="w-full max-w-md h-11 px-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                placeholder="ERLink AR"
                            />
                        </div>

                        {/* AR App Logo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                AR App Logo
                            </label>
                            <div className="flex items-center gap-4">
                                {(previewLogo || config.logoUrl) && (
                                    <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 p-2 flex items-center justify-center">
                                        <img 
                                            src={previewLogo || config.logoUrl} 
                                            alt="AR Logo"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                )}
                                <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-600">
                                    <Upload size={16} />
                                    {logoFile ? logoFile.name : (config.logoUrl ? 'Change Logo' : 'Upload Logo')}
                                    <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => handleLogoChange(e, 'ar')} />
                                </label>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Appears in the mobile AR application</p>
                        </div>

                        {/* Favicon */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Favicon (Browser Tab Icon)
                            </label>
                            <div className="flex items-center gap-4">
                                {(previewFavicon || config.faviconUrl) && (
                                    <div className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 p-1 flex items-center justify-center">
                                        <img 
                                            src={previewFavicon || config.faviconUrl} 
                                            alt="Favicon" 
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                )}
                                <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-600">
                                    <Upload size={16} />
                                    {faviconFile ? faviconFile.name : (config.faviconUrl ? 'Change Favicon' : 'Upload Favicon')}
                                    <input type="file" accept="image/*" className="hidden"
                                        onChange={handleFaviconChange} />
                                </label>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Small icon that appears in browser tab</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Shield size={18} />
                            Security Settings
                        </h2>
                    </div>
                    
                    <div className="p-6 space-y-5">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p className="text-sm font-medium text-gray-900">Allow Self-Registration</p>
                                <p className="text-xs text-gray-500">Users can create accounts in AR app</p>
                            </div>
                            <button
                                onClick={() => setConfig({ ...config, allowSelfRegistration: !config.allowSelfRegistration })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${config.allowSelfRegistration ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.allowSelfRegistration ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Login Attempts
                            </label>
                            <input
                                type="number"
                                min="3"
                                max="10"
                                value={config.maxLoginAttempts || 5}
                                onChange={e => setConfig({ ...config, maxLoginAttempts: parseInt(e.target.value) })}
                                className="w-full max-w-xs h-11 px-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                            />
                            <p className="text-xs text-gray-400 mt-1">Number of failed attempts before account is locked</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Session Timeout (minutes)
                            </label>
                            <input
                                type="number"
                                min="15"
                                max="480"
                                value={config.sessionTimeout || 60}
                                onChange={e => setConfig({ ...config, sessionTimeout: parseInt(e.target.value) })}
                                className="w-full max-w-xs h-11 px-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                            />
                            <p className="text-xs text-gray-400 mt-1">Auto logout after inactivity (minutes)</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Maintenance Tab */}
            {activeTab === 'maintenance' && (
                <div className={`bg-white rounded-2xl border ${config.maintenanceMode ? 'border-red-200' : 'border-gray-200'} overflow-hidden`}>
                    <div className="p-6 border-b border-gray-100">
                        <h2 className={`font-semibold flex items-center gap-2 ${config.maintenanceMode ? 'text-red-700' : 'text-gray-900'}`}>
                            <AlertTriangle size={18} />
                            Maintenance Mode
                        </h2>
                    </div>
                    
                    <div className="p-6 space-y-5">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p className="text-sm font-medium text-gray-900">Enable Maintenance Mode</p>
                                <p className="text-xs text-gray-500">AR app users will see maintenance message</p>
                            </div>
                            <button
                                onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${config.maintenanceMode ? 'bg-red-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.maintenanceMode ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {config.maintenanceMode && (
                            <textarea
                                value={config.maintenanceMessage}
                                onChange={e => setConfig({ ...config, maintenanceMessage: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-red-400"
                                placeholder="Maintenance message for users..."
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Save Button */}
            <div className="sticky bottom-4 mt-6">
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 w-full max-w-md transition-all shadow-lg"
                >
                    {saving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving Configuration...
                        </>
                    ) : saved ? (
                        <>✓ Configuration Saved!</>
                    ) : (
                        <>
                            <Save size={16} />
                            Save Changes
                        </>
                    )}
                </button>
                {saved && (
                    <p className="text-center text-xs text-green-600 mt-2">
                        ✓ Settings successfully applied!
                    </p>
                )}
            </div>
        </div>
    );
}