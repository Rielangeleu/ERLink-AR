import { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Users, Target, Clock, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
    const { profile } = useAuth();
    const [stats, setStats] = useState(null);
    const [recent, setRecent] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadDashboardData(); }, []);

    async function loadDashboardData() {
        try {
            const [usersSnap, sessionsSnap] = await Promise.all([
                getDocs(collection(db, 'users')),
                getDocs(query(
                    collection(db, 'sessions'),
                    orderBy('completedAt', 'desc'),
                    limit(50)
                ))
            ]);

            const users = usersSnap.docs.map(d => d.data());
            const sessions = sessionsSnap.docs.map(d => ({
                id: d.id, ...d.data()
            }));

            const students = users.filter(u => u.role === 'student');
            const scores = sessions.map(s => s.finalScore).filter(Boolean);
            const avgScore = scores.length
                ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
                : 0;
            const avgTime = sessions.length
                ? (sessions.reduce((a, b) => a + (b.timeTaken || 0), 0)
                    / sessions.length).toFixed(0)
                : 0;

            setStats({
                totalStudents: students.length,
                totalSessions: sessions.length,
                avgScore,
                avgTime
            });
            setRecent(sessions.slice(0, 5));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading dashboard...</div>
        </div>
    );

    const statCards = [
        {
            label: 'Total Students', value: stats?.totalStudents ?? 0,
            icon: Users, color: 'text-blue-600', bg: 'bg-blue-50'
        },
        {
            label: 'Avg Accuracy', value: `${stats?.avgScore ?? 0}%`,
            icon: Target, color: 'text-green-600', bg: 'bg-green-50'
        },
        {
            label: 'Avg Response', value: `${stats?.avgTime ?? 0}s`,
            icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50'
        },
        {
            label: 'Total Sessions', value: stats?.totalSessions ?? 0,
            icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50'
        },
    ];

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
                <p className="text-gray-500">
                    Welcome back, {profile?.displayName}
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                                <Icon size={18} className={color} />
                            </div>
                            <span className="text-sm text-gray-500">{label}</span>
                        </div>
                        <p className="text-3xl font-semibold text-gray-900">{value}</p>
                    </div>
                ))}
            </div>

            {/* Recent Sessions */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Recent Sessions</h2>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {['Student', 'Scenario', 'Score', 'Time', 'Correct', 'Date'].map(h => (
                                <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {recent.map(session => (
                            <tr key={session.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    {session.displayName || 'Unknown'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {session.scenarioTitle || '--'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-sm font-medium ${getScoreClass(session.finalScore)}`}>
                                        {session.finalScore}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {formatTime(session.timeTaken)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${session.isCorrect
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        {session.isCorrect ? 'Correct' : 'Incorrect'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {formatDate(session.completedAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function getScoreClass(score) {
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