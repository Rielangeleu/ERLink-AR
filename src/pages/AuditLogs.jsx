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
            setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

    const categories = {
        all: { label: 'All', color: 'gray' },
        USER: { label: 'User Actions', color: 'blue' },
        SESSION: { label: 'Sessions', color: 'green' },
        SYSTEM: { label: 'System', color: 'orange' },
    };

    const filtered = logs.filter(l =>
        filter === 'all' || l.action?.startsWith(filter)
    );

    const actionColor = (action) => {
        if (action?.includes('LOGIN')) return 'bg-blue-100 text-blue-700';
        if (action?.includes('LOGOUT')) return 'bg-gray-100 text-gray-600';
        if (action?.includes('CREATED')) return 'bg-green-100 text-green-700';
        if (action?.includes('DEACTIVATED')) return 'bg-red-100 text-red-700';
        if (action?.includes('ACTIVATED')) return 'bg-green-100 text-green-700';
        if (action?.includes('ROLE')) return 'bg-purple-100 text-purple-700';
        if (action?.includes('PASSWORD')) return 'bg-yellow-100 text-yellow-700';
        if (action?.includes('SYSTEM')) return 'bg-orange-100 text-orange-700';
        if (action?.includes('CONFIG')) return 'bg-orange-100 text-orange-700';
        if (action?.includes('SESSION')) return 'bg-teal-100 text-teal-700';
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

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total Entries', value: logs.length, color: 'text-gray-900' },
                    { label: 'User Actions', value: logs.filter(l => l.action?.includes('USER')).length, color: 'text-blue-600' },
                    { label: 'Sessions Saved', value: logs.filter(l => l.action?.includes('SESSION')).length, color: 'text-green-600' },
                    { label: 'Config Changes', value: logs.filter(l => l.action?.includes('CONFIG') || l.action?.includes('SYSTEM')).length, color: 'text-orange-600' },
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
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No logs yet</td></tr>
                        ) : filtered.map(log => (
                            <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-6 py-3">
                                    <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${actionColor(log.action)}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">
                                    {log.details}
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