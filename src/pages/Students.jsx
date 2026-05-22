import { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Students() {
    const { profile } = useAuth();
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isITAdmin = profile?.role === 'it_admin';
    const isInstructor = profile?.role === 'instructor';

    useEffect(() => {
        loadStudents();
    }, []);

    async function getStudentSessions(student) {
        // Array of possible ID fields to try, in order of priority
        const possibleIds = [
            { value: student.authUid, name: 'authUid' },
            { value: student.userId, name: 'userId' },
            { value: student.uid, name: 'uid' },
            { value: student.id, name: 'documentId' }
        ];

        // First try: Query by userId field using possible IDs
        for (const id of possibleIds) {
            if (id.value) {
                try {
                    console.log(`Trying ${id.name}: ${id.value} for ${student.displayName}`);
                    const sessions = await getDocs(query(
                        collection(db, 'sessions'),
                        where('userId', '==', id.value)
                    ));

                    if (sessions.size > 0) {
                        console.log(`✓ Found ${sessions.size} sessions using ${id.name}`);
                        return sessions;
                    }
                } catch (err) {
                    console.log(`Error querying with ${id.name}:`, err);
                }
            }
        }

        // Second try: Query by userEmail field
        if (student.email) {
            try {
                console.log(`Trying email: ${student.email} for ${student.displayName}`);
                const sessions = await getDocs(query(
                    collection(db, 'sessions'),
                    where('userEmail', '==', student.email)
                ));

                if (sessions.size > 0) {
                    console.log(`✓ Found ${sessions.size} sessions using email`);
                    return sessions;
                }
            } catch (err) {
                console.log(`Error querying with email:`, err);
            }
        }

        // Third try: Get all sessions and filter client-side (slow but thorough)
        try {
            console.log(`Trying fallback: get all sessions for ${student.displayName}`);
            const allSessions = await getDocs(collection(db, 'sessions'));

            const matchingSessions = allSessions.docs.filter(doc => {
                const data = doc.data();
                // Check if any of the student's identifiers match the session
                const matchesUserId = possibleIds.some(id => id.value && data.userId === id.value);
                const matchesEmail = student.email && data.userEmail === student.email;
                const matchesDisplayName = student.displayName && data.displayName === student.displayName;

                return matchesUserId || matchesEmail || matchesDisplayName;
            });

            if (matchingSessions.length > 0) {
                console.log(`✓ Found ${matchingSessions.length} sessions using full scan fallback`);
                return { size: matchingSessions.length, docs: matchingSessions };
            }
        } catch (err) {
            console.log(`Error in fallback query:`, err);
        }

        console.log(`✗ No sessions found for ${student.displayName}`);
        return { size: 0, docs: [] };
    }

    async function loadStudents() {
        setLoading(true);
        setError(null);
        try {
            console.log("Starting to load students...");

            // Get all users with role 'student'
            const q = query(
                collection(db, 'users'),
                where('role', '==', 'student')
            );

            const snap = await getDocs(q);
            console.log("Raw snapshot size:", snap.size);

            const studentList = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log("Student list before sessions:", studentList.map(s => ({
                name: s.displayName,
                email: s.email,
                authUid: s.authUid,
                userId: s.userId,
                id: s.id
            })));

            // Load session counts for each student
            const withSessions = await Promise.all(
                studentList.map(async (student) => {
                    try {
                        const sessions = await getStudentSessions(student);

                        const scores = sessions.docs
                            ? sessions.docs.map(s => s.data().finalScore).filter(Boolean)
                            : [];

                        const avgScore = scores.length
                            ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0)
                            : null;

                        console.log(`Final: ${student.displayName} - ${sessions.size || sessions.length || 0} sessions, avg: ${avgScore}`);

                        return {
                            ...student,
                            sessionCount: sessions.size || sessions.length || 0,
                            avgScore: avgScore ? parseInt(avgScore) : null
                        };
                    } catch (err) {
                        console.error(`Error loading sessions for ${student.email}:`, err);
                        return {
                            ...student,
                            sessionCount: 0,
                            avgScore: null
                        };
                    }
                })
            );

            console.log("Final students with sessions:", withSessions.map(s => ({
                name: s.displayName,
                sessions: s.sessionCount,
                avg: s.avgScore
            })));

            setStudents(withSessions);
        } catch (e) {
            console.error("Error loading students:", e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const filtered = students.filter(s =>
        s.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-gray-400" size={32} />
                <span className="ml-2 text-gray-500">Loading students...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600">Error loading students: {error}</p>
                <button
                    onClick={loadStudents}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
                <p className="text-gray-500">
                    {students.length} registered student{students.length !== 1 ? 's' : ''}
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

            {students.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-400">
                    <p className="text-sm">No students found in the database.</p>
                    {isITAdmin && (
                        <p className="text-xs mt-2">Go to User Management to add student accounts.</p>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
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
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                            No students match your search
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(student => (
                                        <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                                                        {student.displayName?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {student.displayName || 'Unknown'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{student.email || 'No email'}</p>
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
                                                {student.sessionCount || 0}
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
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function getScoreColor(score) {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
}