import { useEffect, useState } from 'react';
import { db, storage } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Save, Upload, AlertTriangle, Smartphone, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';

export default function SystemConfig() {
    const { profile } = useAuth();
    const [config, setConfig] = useState({
        appName: 'ERLink AR',
        primaryColor: '#2563EB',
        theme: 'default',
        logoUrl: '',
        maintenanceMode: false,
        maintenanceMessage: 'System is under maintenance. Please try again later.',
        minAppVersion: '1.0.0',
        currentAppVersion: '1.0.0',
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [logoFile, setLogoFile] = useState(null);

    useEffect(() => { loadConfig(); }, []);

    async function loadConfig() {
        const snap = await getDoc(
            doc(db, 'system_config', 'app_settings'));
        if (snap.exists())
            setConfig(prev => ({ ...prev, ...snap.data() }));
    }

    async function saveConfig() {
        setSaving(true);
        try {
            let logoUrl = config.logoUrl;
            if (logoFile) {
                const storageRef = ref(storage, 'system/logo');
                await uploadBytes(storageRef, logoFile);
                logoUrl = await getDownloadURL(storageRef);
            }

            const finalConfig = { ...config, logoUrl, updatedAt: serverTimestamp() };
            await setDoc(doc(db, 'system_config', 'app_settings'), finalConfig);

            await addDoc(collection(db, 'audit_logs'), {
                action: 'SYSTEM_CONFIG_UPDATED',
                details: `System configuration updated by ${profile?.email}`,
                performedBy: profile?.email,
                timestamp: serverTimestamp()
            });

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            alert('Save failed: ' + e.message);
        } finally {
            setSaving(false);
        }
    }

    const Section = ({ title, icon: Icon, children, danger }) => (
        <div className={`bg-white rounded-2xl border p-6 mb-4 ${danger ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-5">
                <Icon size={18} className={danger ? 'text-red-500' : 'text-gray-500'} />
                <h2 className={`font-semibold ${danger ? 'text-red-700' : 'text-gray-900'}`}>
                    {title}
                </h2>
            </div>
            {children}
        </div>
    );

    return (
        <div className="max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">System Configuration</h1>
                <p className="text-gray-500">Control app behavior and appearance</p>
            </div>

            {/* App Appearance */}
            <Section title="App Appearance" icon={Smartphone}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Application Name
                        </label>
                        <input
                            value={config.appName}
                            onChange={e => setConfig({ ...config, appName: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
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
                                className="w-12 h-11 rounded-xl border border-gray-200 cursor-pointer p-1"
                            />
                            <input
                                value={config.primaryColor}
                                onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                className="flex-1 h-11 px-4 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Theme
                        </label>
                        <select
                            value={config.theme}
                            onChange={e => setConfig({ ...config, theme: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none"
                        >
                            <option value="default">Default Blue</option>
                            <option value="medical">Medical Teal</option>
                            <option value="dark">Dark Mode</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            App Logo
                        </label>
                        <div className="flex items-center gap-4">
                            {config.logoUrl && (
                                <img src={config.logoUrl} alt="Logo"
                                    className="w-14 h-14 rounded-xl object-contain border border-gray-200" />
                            )}
                            <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-sm text-gray-600">
                                <Upload size={16} />
                                {logoFile ? logoFile.name : 'Upload Logo'}
                                <input type="file" accept="image/*" className="hidden"
                                    onChange={e => setLogoFile(e.target.files[0])} />
                            </label>
                        </div>
                    </div>
                </div>
            </Section>

            {/* Version Control */}
            <Section title="Version Enforcement" icon={Smartphone}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Current App Version
                        </label>
                        <input
                            value={config.currentAppVersion}
                            onChange={e => setConfig({ ...config, currentAppVersion: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400"
                            placeholder="1.0.0"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minimum Required Version
                        </label>
                        <input
                            value={config.minAppVersion}
                            onChange={e => setConfig({ ...config, minAppVersion: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400"
                            placeholder="1.0.0"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Users with an older version will be forced to update
                        </p>
                    </div>
                </div>
            </Section>

            {/* Maintenance Mode */}
            <Section title="Maintenance Mode" icon={AlertTriangle} danger={config.maintenanceMode}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <p className="text-sm font-medium text-gray-900">
                                Maintenance Mode
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                When enabled, all mobile app users see a maintenance message
                            </p>
                        </div>
                        <button
                            onClick={() => setConfig({
                                ...config, maintenanceMode: !config.maintenanceMode
                            })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${config.maintenanceMode ? 'bg-red-500' : 'bg-gray-300'
                                }`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.maintenanceMode ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>
                    {config.maintenanceMode && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-xs font-medium text-red-700 mb-2">
                                ⚠ Maintenance mode is ON — mobile app is showing maintenance screen
                            </p>
                            <textarea
                                value={config.maintenanceMessage}
                                onChange={e => setConfig({ ...config, maintenanceMessage: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 rounded-xl border border-red-200 text-sm focus:outline-none focus:border-red-400 bg-white"
                                placeholder="Message shown to users during maintenance..."
                            />
                        </div>
                    )}
                </div>
            </Section>

            <button
                onClick={saveConfig}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 w-full justify-center"
            >
                <Save size={16} />
                {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save All Changes'}
            </button>
        </div>
    );
}