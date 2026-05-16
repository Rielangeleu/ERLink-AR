import React, { useState, useEffect } from 'react';
// These imports are correct for your local project structure
// If the Canvas preview shows a "Could not resolve" error, it is because those 
// local files are not present in this web-based environment.
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Box, Link as LinkIcon, Eye, Trash2, Loader2, XCircle, CheckCircle, FileArchive, Globe, Info, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * AR Asset Management Page
 * Handles the registration of 3D GLB models hosted on external CDNs (like GitHub).
 * This allows the system to remain on the Firebase Spark (Free) plan.
 */
export default function ARAssets() {
    const { profile } = useAuth();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Form States
    const [assetName, setAssetName] = useState('');
    const [externalUrl, setExternalUrl] = useState('');
    const [fileSize, setFileSize] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });

    const isITAdmin = profile?.role === 'it_admin';

    // Fetch asset records on mount
    useEffect(() => {
        fetchAssets();
    }, []);

    async function fetchAssets() {
        setLoading(true);
        try {
            // Reference the ar_assets collection defined in your database structure
            const querySnapshot = await getDocs(collection(db, 'ar_assets'));
            const assetList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAssets(assetList);
        } catch (error) {
            console.error('Firestore Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    }

    /**
     * GitHub Link Helper
     * Automatically converts standard GitHub blob URLs to Raw CDN URLs
     * so Unity can download the binary file directly.
     */
    const getRawUrl = (url) => {
        if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
            return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }
        return url;
    };

    async function handleSubmit(e) {
        e.preventDefault();
        const rawUrl = getRawUrl(externalUrl.trim());

        setSubmitting(true);
        setStatus({ type: '', message: '' });

        try {
            // Save the registration to Firestore
            await addDoc(collection(db, 'ar_assets'), {
                assetName: assetName.trim(),
                downloadURL: rawUrl,
                fileType: 'GLB',
                fileSize: fileSize.trim() || 'Unknown',
                source: 'GitHub External',
                uploadedBy: profile?.email || 'Admin',
                uploadedAt: serverTimestamp(),
                isActive: true
            });

            setStatus({ type: 'success', message: 'Asset successfully registered!' });
            setShowModal(false);

            // Clear form
            setAssetName('');
            setExternalUrl('');
            setFileSize('');

            // Refresh list
            fetchAssets();
        } catch (error) {
            console.error('Asset Registration Error:', error);
            setStatus({ type: 'error', message: error.message });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(assetId, name) {
        if (!confirm(`Remove record for "${name}"? This only deletes the system reference.`)) return;

        try {
            await deleteDoc(doc(db, 'ar_assets', assetId));
            setStatus({ type: 'success', message: 'Asset link removed.' });
            fetchAssets();
        } catch (error) {
            console.error('Delete Error:', error);
            setStatus({ type: 'error', message: error.message });
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fade">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AR Asset Management</h1>
                    <p className="text-gray-500 text-sm mt-1">Registering models hosted on GitHub for Unity dynamic loading.</p>
                </div>
                {isITAdmin && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-bold flex gap-2 items-center hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 active:scale-95"
                    >
                        <LinkIcon size={18} />
                        Register GitHub Asset
                    </button>
                )}
            </div>

            {status.message && (
                <div className={`mb-6 p-4 rounded-xl flex gap-3 text-sm font-bold border animate-slide-up ${status.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'
                    }`}>
                    {status.type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
                    {status.message}
                </div>
            )}

            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <th className="px-6 py-5">Patient Model</th>
                                <th className="px-6 py-5">Source Status</th>
                                <th className="px-6 py-5">File Size</th>
                                <th className="px-6 py-4">Uploaded By</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-24 text-center text-gray-400 font-medium">
                                        <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                                        Syncing records...
                                    </td>
                                </tr>
                            ) : assets.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-24 text-center text-gray-400">
                                        <FileArchive className="mx-auto mb-4 opacity-10" size={56} />
                                        <p className="text-sm italic font-medium">No assets registered yet. Add your first GitHub model link.</p>
                                    </td>
                                </tr>
                            ) : (
                                assets.map(asset => (
                                    <tr key={asset.id} className="hover:bg-gray-50/30 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-inner group-hover:scale-110 transition-transform">
                                                    <Box size={22} />
                                                </div>
                                                <div className="max-w-[200px]">
                                                    <p className="font-bold text-gray-900 truncate">{asset.assetName}</p>
                                                    <p className="text-[10px] text-gray-400 font-medium truncate" title={asset.downloadURL}>
                                                        {asset.downloadURL}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-[9px] bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-extrabold uppercase tracking-widest flex items-center gap-1.5 w-fit">
                                                <Globe size={12} /> Live CDN
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-sm font-bold text-gray-600">
                                            {asset.fileSize} {asset.fileSize !== 'Unknown' ? 'MB' : ''}
                                        </td>
                                        <td className="px-6 py-5 text-xs text-gray-500 font-medium">{asset.uploadedBy}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-end gap-2">
                                                <a
                                                    href={asset.downloadURL}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                    title="Verify Link"
                                                >
                                                    <Eye size={20} />
                                                </a>
                                                {isITAdmin && (
                                                    <button
                                                        onClick={() => handleDelete(asset.id, asset.assetName)}
                                                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Delete Entry"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Registration Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in border border-white/20">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Register Asset</h2>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Asset Display Name</label>
                                <input
                                    required
                                    type="text"
                                    value={assetName}
                                    onChange={(e) => setAssetName(e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-gray-700 transition-all"
                                    placeholder="e.g., CodeBlue_Patient_v1"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                                    GitHub File URL
                                    <HelpCircle size={12} className="text-blue-400" title="Paste the URL from the browser, we will convert it to a raw link automatically." />
                                </label>
                                <input
                                    required
                                    type="url"
                                    value={externalUrl}
                                    onChange={(e) => setExternalUrl(e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-xs text-gray-500 transition-all"
                                    placeholder="https://github.com/user/repo/blob/..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Estimated Size (MB)</label>
                                <input
                                    type="text"
                                    value={fileSize}
                                    onChange={(e) => setFileSize(e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-gray-700"
                                    placeholder="e.g., 4.2"
                                />
                            </div>
                        </div>

                        <div className="mt-8 p-4 bg-blue-50 rounded-2xl flex gap-4 items-start border border-blue-100">
                            <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-[11px] text-blue-700 leading-relaxed font-medium">
                                <p className="font-bold mb-1 underline">Zero-Cost Hosting Rule:</p>
                                Paste the regular GitHub URL. The system converts it to a <strong>Raw CDN URL</strong> automatically, allowing the Unity app to download models without needing the Firebase Blaze plan.
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-4 font-bold text-gray-400 hover:bg-gray-100 rounded-2xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/20 hover:bg-purple-700 disabled:opacity-50 transition-all"
                            >
                                {submitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin" size={18} />
                                        Syncing...
                                    </span>
                                ) : 'Register Asset'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}