import { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Shield, Download } from 'lucide-react';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => { loadLogs(); }, []);

    async function loadLogs() {
        try {
            const snap = await getDocs(query(
                collection(db, 'audit_logs'),
                orderBy('timestamp', 'desc'),
                limit(200)
            ));
            const loadedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setLogs(loadedLogs);

            // Debug: Log unique action types to console (remove in production)
            if (loadedLogs.length > 0) {
                const uniqueActions = [...new Set(loadedLogs.map(l => l.action))];
                console.log('Available action types:', uniqueActions);
                console.log('Session-related actions found:', loadedLogs.filter(l =>
                    l.action?.toLowerCase().includes('session') ||
                    l.action?.toLowerCase().includes('complete') ||
                    l.action?.toLowerCase().includes('result') ||
                    l.action?.toLowerCase().includes('finish')
                ).length);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    function exportLogs() {
        const csv = [
            ['Action', 'Details', 'Performed By', 'Timestamp'],
            ...logs.map(l => [
                l.action, l.details, l.performedBy,
                l.timestamp?.toDate?.()?.toLocaleString('en-PH') || '--'
            ])
        ].map(r => r.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${Date.now()}.csv`;
        a.click();
    }

    // Improved session detection - checks for multiple possible action types
    const isSessionAction = (action) => {
        if (!action) return false;
        const actionUpper = action.toUpperCase();
        return actionUpper.includes('SESSION') ||
            actionUpper.includes('COMPLETED') ||
            actionUpper.includes('RESULT') ||
            actionUpper.includes('FINISHED') ||
            actionUpper.includes('SAVED');
    };

    const isUserAction = (action) => {
        if (!action) return false;
        const actionUpper = action.toUpperCase();
        return actionUpper.includes('USER') ||
            actionUpper.includes('LOGIN') ||
            actionUpper.includes('LOGOUT') ||
            actionUpper.includes('CREATED') ||
            actionUpper.includes('DEACTIVATED') ||
            actionUpper.includes('ACTIVATED') ||
            actionUpper.includes('ROLE') ||
            actionUpper.includes('PASSWORD');
    };

    const isConfigAction = (action) => {
        if (!action) return false;
        const actionUpper = action.toUpperCase();
        return actionUpper.includes('CONFIG') ||
            actionUpper.includes('SYSTEM') ||
            actionUpper.includes('SETTINGS') ||
            actionUpper.includes('UPDATE');
    };

    const categories = {
        all: { label: 'All', color: 'gray' },
        USER: { label: 'User Actions', color: 'blue' },
        SESSION: { label: 'Sessions', color: 'green' },
        SYSTEM: { label: 'System', color: 'orange' },
    };

    const filtered = logs.filter(l => {
        if (filter === 'all') return true;
        if (filter === 'USER') return isUserAction(l.action);
        if (filter === 'SESSION') return isSessionAction(l.action);
        if (filter === 'SYSTEM') return isConfigAction(l.action);
        return false;
    });

    const actionColor = (action) => {
        if (!action) return 'bg-gray-100 text-gray-600';
        if (action.includes('LOGIN')) return 'bg-blue-100 text-blue-700';
        if (action.includes('LOGOUT')) return 'bg-gray-100 text-gray-600';
        if (action.includes('CREATED')) return 'bg-green-100 text-green-700';
        if (action.includes('DEACTIVATED')) return 'bg-red-100 text-red-700';
        if (action.includes('ACTIVATED')) return 'bg-green-100 text-green-700';
        if (action.includes('ROLE')) return 'bg-purple-100 text-purple-700';
        if (action.includes('PASSWORD')) return 'bg-yellow-100 text-yellow-700';
        if (action.includes('SYSTEM')) return 'bg-orange-100 text-orange-700';
        if (action.includes('CONFIG')) return 'bg-orange-100 text-orange-700';
        if (action.includes('SESSION')) return 'bg-teal-100 text-teal-700';
        if (action.includes('COMPLETED')) return 'bg-teal-100 text-teal-700';
        if (action.includes('RESULT')) return 'bg-teal-100 text-teal-700';
        return 'bg-gray-100 text-gray-600';
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Audit Logs</h1>
                    <p className="text-gray-500">
                        {logs.length} log entries — read only record of all system actions
                    </p>
                </div>
                <button
                    onClick={exportLogs}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                    <Download size={16} />
                    Export CSV
                </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
                {Object.entries(categories).map(([key, cat]) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === key
                                ? `bg-${cat.color}-600 text-white`
                                : `bg-gray-100 text-gray-600 hover:bg-gray-200`
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total Entries', value: logs.length, color: 'text-gray-900' },
                    { label: 'User Actions', value: logs.filter(l => isUserAction(l.action)).length, color: 'text-blue-600' },
                    { label: 'Sessions Saved', value: logs.filter(l => isSessionAction(l.action)).length, color: 'text-green-600' },
                    { label: 'Config Changes', value: logs.filter(l => isConfigAction(l.action)).length, color: 'text-orange-600' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                        <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {['Action', 'Details', 'Performed By', 'Timestamp'].map(h => (
                                <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Loading logs...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No logs match the selected filter</td></tr>
                        ) : filtered.map(log => (
                            <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-6 py-3">
                                    <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${actionColor(log.action)}`}>
                                        {log.action || '--'}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">
                                    {log.details || '--'}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-500 whitespace-nowrap">
                                    {log.performedBy || '--'}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-400 whitespace-nowrap">
                                    {log.timestamp?.toDate?.()?.toLocaleString('en-PH') || '--'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}