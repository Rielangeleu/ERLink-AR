import { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { Download, Filter } from 'lucide-react';

export default function Results() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        difficulty: 'all',
        correct: 'all',
        limit: 50
    });

    useEffect(() => { loadResults(); }, [filters]);

    async function loadResults() {
        setLoading(true);
        try {
            let q = query(
                collection(db, 'sessions'),
                orderBy('completedAt', 'desc'),
                limit(filters.limit)
            );

            const snap = await getDocs(q);
            let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (filters.difficulty !== 'all')
                data = data.filter(s => s.difficulty === filters.difficulty);
            if (filters.correct !== 'all')
                data = data.filter(s =>
                    filters.correct === 'correct' ? s.isCorrect : !s.isCorrect);

            setSessions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    function exportCSV() {
        const headers = [
            'Student', 'Email', 'Scenario', 'Difficulty',
            'Final Score', 'Accuracy', 'Speed', 'Time Taken',
            'Selected Tag', 'Correct Tag', 'Correct?', 'EHR Correct?', 'Date'
        ];

        const rows = sessions.map(s => [
            s.displayName || '',
            s.userEmail || '',
            s.scenarioTitle || '',
            s.difficulty || '',
            s.finalScore || 0,
            s.accuracyScore || 0,
            s.speedScore || 0,
            formatTime(s.timeTaken),
            s.selectedCategory || '',
            s.correctCategory || '',
            s.isCorrect ? 'Yes' : 'No',
            s.ehrCorrect ? 'Yes' : 'No',
            formatDate(s.completedAt)
        ]);

        const csv = [headers, ...rows]
            .map(r => r.join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `erlink_results_${Date.now()}.csv`;
        a.click();
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        Simulation Results
                    </h1>
                    <p className="text-gray-500">
                        {sessions.length} sessions loaded
                    </p>
                </div>
                <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                    <Download size={16} />
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
                <select
                    value={filters.difficulty}
                    onChange={e => setFilters({ ...filters, difficulty: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-gray-200 text-sm"
                >
                    <option value="all">All difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                </select>

                <select
                    value={filters.correct}
                    onChange={e => setFilters({ ...filters, correct: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-gray-200 text-sm"
                >
                    <option value="all">All results</option>
                    <option value="correct">Correct only</option>
                    <option value="incorrect">Incorrect only</option>
                </select>

                <select
                    value={filters.limit}
                    onChange={e => setFilters({ ...filters, limit: Number(e.target.value) })}
                    className="h-10 px-3 rounded-xl border border-gray-200 text-sm"
                >
                    <option value={25}>Last 25</option>
                    <option value={50}>Last 50</option>
                    <option value={100}>Last 100</option>
                    <option value={500}>All</option>
                </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
                <table className="w-full min-w-max">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {['Student', 'Scenario', 'Difficulty', 'Score', 'Accuracy', 'Speed', 'Time', 'Tag Selected', 'Correct?', 'Date'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                                    Loading results...
                                </td>
                            </tr>
                        ) : sessions.map(s => (
                            <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                                    {s.displayName || 'Unknown'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                    {s.scenarioTitle || '--'}
                                </td>
                                <td className="px-4 py-3">
                                    <DifficultyBadge level={s.difficulty} />
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-sm font-semibold ${getScoreColor(s.finalScore)}`}>
                                        {s.finalScore}%
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {s.accuracyScore}%
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {s.speedScore}%
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                    {formatTime(s.timeTaken)}
                                </td>
                                <td className="px-4 py-3">
                                    <TriageBadge category={s.selectedCategory} />
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${s.isCorrect
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        {s.isCorrect ? 'Correct' : 'Incorrect'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                    {formatDate(s.completedAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DifficultyBadge({ level }) {
    const styles = {
        Easy: 'bg-green-100 text-green-700',
        Medium: 'bg-yellow-100 text-yellow-700',
        Hard: 'bg-red-100 text-red-700',
    };
    return (
        <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${styles[level] || 'bg-gray-100 text-gray-600'}`}>
            {level || '--'}
        </span>
    );
}

function TriageBadge({ category }) {
    const styles = {
        Immediate: 'bg-red-100 text-red-700',
        Delayed: 'bg-yellow-100 text-yellow-700',
        Minor: 'bg-green-100 text-green-700',
        Expectant: 'bg-gray-200 text-gray-700',
    };
    return (
        <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${styles[category] || 'bg-gray-100 text-gray-600'}`}>
            {category || '--'}
        </span>
    );
}

function getScoreColor(score) {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
}

function formatTime(seconds) {
    if (!seconds || seconds >= Number.MAX_SAFE_INTEGER) return 'Expired';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(timestamp) {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
}