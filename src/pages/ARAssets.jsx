import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Box, Eye, Trash2, Loader2, XCircle, CheckCircle, FileArchive, Globe, Info, UploadCloud, Construction } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ARAssets() {
    const { profile } = useAuth();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [gitConfig, setGitConfig] = useState(null);
    const [assetName, setAssetName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [status, setStatus] = useState({ type: '', message: '' });

    const isITAdmin = profile?.role === 'it_admin';

    // FUTURE DEVELOPMENT FLAG - Set to false to disable, true to enable
    const IS_UPLOAD_ENABLED = false; // Change to true when ready for production

    // Define fetchAssets first
    const fetchAssets = useCallback(async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'ar_assets'));
            const assetList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAssets(assetList);
        } catch (error) {
            console.error('Firestore Fetch Error:', error);
        }
    }, []);

    // Define initializePage
    const initializePage = useCallback(async () => {
        setLoading(true);
        try {
            const gitSnap = await getDoc(doc(db, 'system_config', 'github_settings'));
            if (gitSnap.exists()) {
                setGitConfig(gitSnap.data());
            }
            await fetchAssets();
        } catch (error) {
            console.error('Initialization Error:', error);
        } finally {
            setLoading(false);
        }
    }, [fetchAssets]);

    useEffect(() => {
        initializePage();
    }, [initializePage]);

    const convertFileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    async function handleSubmit(e) {
        e.preventDefault();

        if (!IS_UPLOAD_ENABLED) {
            alert('Asset upload is currently disabled. This feature is under development.');
            return;
        }

        if (!selectedFile) {
            setStatus({ type: 'error', message: 'Please select a .glb file to upload.' });
            return;
        }
        if (!gitConfig || !gitConfig.token) {
            setStatus({ type: 'error', message: 'GitHub API credentials not found or uninitialized.' });
            return;
        }

        setSubmitting(true);
        setStatus({ type: '', message: '' });

        try {
            const cleanFileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
            const fullPath = gitConfig.folderPath ? `${gitConfig.folderPath}/${cleanFileName}` : cleanFileName;
            const calculatedSize = (selectedFile.size / (1024 * 1024)).toFixed(2);
            const base64Content = await convertFileToBase64(selectedFile);
            const githubUrl = `https://api.github.com/repos/${gitConfig.owner}/${gitConfig.repo}/contents/${fullPath}`;

            const ghResponse = await fetch(githubUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${gitConfig.token.trim()}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Upload AR Asset: ${assetName.trim()} via Portal Engine`,
                    content: base64Content,
                    branch: gitConfig.branch || 'main'
                })
            });

            if (!ghResponse.ok) {
                const errData = await ghResponse.json();
                throw new Error(errData.message || 'Failed to upload asset payload to GitHub servers.');
            }

            const rawDownloadUrl = `https://raw.githubusercontent.com/${gitConfig.owner}/${gitConfig.repo}/${gitConfig.branch || 'main'}/${fullPath}`;

            await addDoc(collection(db, 'ar_assets'), {
                assetName: assetName.trim(),
                downloadURL: rawDownloadUrl,
                fileType: 'GLB',
                fileSize: calculatedSize,
                source: 'GitHub Cloud CDN',
                uploadedBy: profile?.email || 'Admin',
                uploadedAt: serverTimestamp(),
                isActive: true
            });

            setStatus({ type: 'success', message: `Model "${assetName}" successfully routed to GitHub storage & mapped to Firestore!` });
            setShowModal(false);
            setAssetName('');
            setSelectedFile(null);
            await fetchAssets();
        } catch (error) {
            console.error('Asset Pipeline Error:', error);
            setStatus({ type: 'error', message: error.message });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(assetId, name) {
        if (!confirm(`Remove record for "${name}"? This deletes the app database reference. (The file remains safely on your GitHub repository).`)) return;
        try {
            await deleteDoc(doc(db, 'ar_assets', assetId));
            setStatus({ type: 'success', message: 'Asset entry map dropped.' });
            await fetchAssets();
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
                    <p className="text-gray-500 text-sm mt-1">Upload and map 3D patient files directly to secure GitHub storage repositories.</p>
                </div>

                {/* Under Development Badge - Shows for ALL users (Admin AND Instructor) */}
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-xl">
                    <Construction size={18} className="text-yellow-600" />
                    <span className="text-sm text-yellow-700 font-medium">Under Development</span>
                </div>
            </div>

            {/* Future Development Notice - Shows for Admin ONLY */}
            {!IS_UPLOAD_ENABLED && isITAdmin && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3 items-start">
                    <Info size={20} className="text-blue-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-blue-800">🚧 Feature Under Development</p>
                        <p className="text-sm text-blue-700 mt-1">
                            Asset upload will be available in a future update. For now, existing assets are displayed below.
                            <br />
                            <span className="text-xs text-blue-600 mt-1 block">
                                To enable this feature, set <code className="bg-blue-100 px-1 rounded">IS_UPLOAD_ENABLED = true</code> in ARAssets.jsx
                            </span>
                        </p>
                    </div>
                </div>
            )}

            {status.message && (
                <div className={`mb-6 p-4 rounded-xl flex gap-3 text-sm font-bold border animate-slide-up ${status.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
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
                                        <p className="text-sm italic font-medium">No assets registered yet.</p>
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
                                                <div className="max-w-[260px]">
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
                                                    title="Verify Dynamic Link"
                                                >
                                                    <Eye size={20} />
                                                </a>
                                                {isITAdmin && (
                                                    <button
                                                        onClick={() => handleDelete(asset.id, asset.assetName)}
                                                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Delete Entry Map"
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

            {/* Modal remains but disabled via IS_UPLOAD_ENABLED */}
            {showModal && IS_UPLOAD_ENABLED && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in border border-white/20">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Upload 3D Patient</h2>
                            <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Asset Scenario Tag Name</label>
                                <input
                                    required
                                    type="text"
                                    value={assetName}
                                    onChange={(e) => setAssetName(e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-gray-700 transition-all"
                                    placeholder="e.g., CodeBlue_Triage_Patient"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Select 3D Object Mesh Build File (.glb)</label>
                                <div className="flex items-center justify-center w-full">
                                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-200 border-dashed rounded-2xl cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-colors p-4 text-center">
                                        <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                            <UploadCloud className="w-10 h-10 text-purple-500 mb-2 animate-pulse" />
                                            <p className="text-sm text-gray-700 font-bold px-2 truncate max-w-xs">
                                                {selectedFile ? selectedFile.name : 'Click to select local model'}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                                                Accepted format: GLB binary compiled extensions.
                                            </p>
                                        </div>
                                        <input
                                            required
                                            type="file"
                                            accept=".glb"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 font-bold text-gray-400 hover:bg-gray-100 rounded-2xl transition-all">Cancel</button>
                            <button type="submit" disabled={submitting || !gitConfig} className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/20 hover:bg-purple-700 disabled:opacity-50 transition-all">
                                {submitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin" size={18} />
                                        Streaming to Git...
                                    </span>
                                ) : 'Upload & Route Asset'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}