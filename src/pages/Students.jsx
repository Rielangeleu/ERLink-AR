import { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Search, ChevronRight } from 'lucide-react';

export default function Students() {
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadStudents(); }, []);

    async function loadStudents() {
        try {
            const snap = await getDocs(query(
                collection(db, 'users'),
                where('role', '==', 'student')
            ));

            const studentList = snap.docs.map(d => ({
                id: d.id, ...d.data()
            }));

            // Load session counts for each student
            const withSessions = await Promise.all(
                studentList.map(async student => {
                    const sessions = await getDocs(query(
                        collection(db, 'sessions'),
                        where('userId', '==', student.userId)
                    ));

                    const scores = sessions.docs
                        .map(s => s.data().finalScore)
                        .filter(Boolean);

                    const avgScore = scores.length
                        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0)
                        : null;

                    return {
                        ...student,
                        sessionCount: sessions.size,
                        avgScore
                    };
                })
            );

            setStudents(withSessions);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const filtered = students.filter(s =>
        s.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
                <p className="text-gray-500">
                    {students.length} registered students
                </p>
            </div>

            <div className="relative mb-4 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, or ID..."
                    className="w-full pl-9 pr-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {['Student', 'Student ID', 'Year', 'Sessions', 'Avg Score', 'Status'].map(h => (
                                <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                    Loading students...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                    No students found
                                </td>
                            </tr>
                        ) : filtered.map(student => (
                            <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                                            {student.displayName?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {student.displayName}
                                            </p>
                                            <p className="text-xs text-gray-500">{student.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {student.studentId || '--'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {student.yearLevel || '--'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                    {student.sessionCount}
                                </td>
                                <td className="px-6 py-4">
                                    {student.avgScore ? (
                                        <span className={`text-sm font-medium ${getScoreColor(student.avgScore)}`}>
                                            {student.avgScore}%
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-400">No sessions</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${student.isActive
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        {student.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function getScoreColor(score) {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
}