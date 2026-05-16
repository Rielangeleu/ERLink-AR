import { useEffect, useState } from 'react';
import { db, auth } from '../firebase/config';
import {
    collection, getDocs, doc,
    updateDoc, setDoc, serverTimestamp, query, where
} from 'firebase/firestore';
import {
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from 'firebase/auth';
import {
    UserPlus, Search, Shield, Mail,
    ToggleLeft, ToggleRight, ChevronDown, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Users() {
    const { profile: currentProfile } = useAuth();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState('');
    const [newUser, setNewUser] = useState({
        email: '', password: '', displayName: '',
        role: 'student', studentId: '', yearLevel: ''
    });

    useEffect(() => { loadUsers(); }, []);

    async function loadUsers() {
        const snap = await getDocs(collection(db, 'users'));
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    }

    async function createUser() {
        if (!newUser.email || !newUser.password || !newUser.displayName) {
            alert('Please fill in all required fields.');
            return;
        }

        // Safety rule: only it_admin can create it_admin
        if (newUser.role === 'it_admin' &&
            currentProfile?.role !== 'it_admin') {
            alert('Only IT Admins can create other IT Admin accounts.');
            return;
        }

        try {
            const cred = await createUserWithEmailAndPassword(
                auth, newUser.email, newUser.password);

            await setDoc(doc(db, 'users', cred.user.uid), {
                userId: cred.user.uid,
                email: newUser.email,
                displayName: newUser.displayName,
                role: newUser.role,
                studentId: newUser.studentId || '',
                yearLevel: newUser.yearLevel || '',
                institution: 'Mapua University',
                isActive: true,
                failedLogins: 0,
                createdAt: serverTimestamp(),
                createdBy: currentProfile?.email || 'admin',
                lastLogin: null
            });

            await logAction('USER_CREATED',
                `Created ${newUser.role}: ${newUser.email}`);

            showMessage(`User ${newUser.displayName} created successfully!`);
            setShowModal(false);
            setNewUser({
                email: '', password: '', displayName: '',
                role: 'student', studentId: '', yearLevel: ''
            });
            loadUsers();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    async function toggleUserStatus(user) {
        const newStatus = !user.isActive;
        await updateDoc(doc(db, 'users', user.id), {
            isActive: newStatus,
            updatedAt: serverTimestamp()
        });
        await logAction(
            newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
            `${currentProfile?.email} ${newStatus ? 'activated' : 'deactivated'} ${user.email}`
        );
        showMessage(`User ${newStatus ? 'activated' : 'deactivated'}.`);
        loadUsers();
    }

    async function promoteRole(user, newRole) {
        if (newRole === 'it_admin' &&
            currentProfile?.role !== 'it_admin') {
            alert('Only IT Admins can promote users to IT Admin.');
            return;
        }
        await updateDoc(doc(db, 'users', user.id), {
            role: newRole,
            updatedAt: serverTimestamp()
        });
        await logAction('ROLE_CHANGED',
            `${currentProfile?.email} changed ${user.email} role to ${newRole}`);
        showMessage(`Role updated to ${newRole}.`);
        loadUsers();
    }

    async function sendPasswordReset(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            await logAction('PASSWORD_RESET_SENT',
                `Password reset sent to ${email} by ${currentProfile?.email}`);
            showMessage(`Password reset email sent to ${email}`);
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    async function logAction(action, details) {
        const { addDoc } = await import('firebase/firestore');
        await addDoc(collection(db, 'audit_logs'), {
            action,
            details,
            performedBy: currentProfile?.email || 'unknown',
            timestamp: serverTimestamp()
        });
    }

    function showMessage(msg) {
        setActionMsg(msg);
        setTimeout(() => setActionMsg(''), 3000);
    }

    const filtered = users.filter(u => {
        const matchSearch =
            u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase()) ||
            u.studentId?.toLowerCase().includes(search.toLowerCase());
        const matchRole =
            roleFilter === 'all' || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    const roleCounts = {
        all: users.length,
        student: users.filter(u => u.role === 'student').length,
        instructor: users.filter(u => u.role === 'instructor').length,
        it_admin: users.filter(u => u.role === 'it_admin').length,
    };

    return (
        <div>
            {/* Success message toast */}
            {actionMsg && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
                    ✓ {actionMsg}
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        User Management
                    </h1>
                    <p className="text-gray-500">
                        {users.length} total users — deactivate instead of delete
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    <UserPlus size={16} />
                    Add User
                </button>
            </div>

            {/* Role filter tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {[
                    { key: 'all', label: 'All Users' },
                    { key: 'student', label: 'Students' },
                    { key: 'instructor', label: 'Instructors' },
                    { key: 'it_admin', label: 'IT Admins' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setRoleFilter(tab.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${roleFilter === tab.key
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {tab.label}
                        <span className={`ml-2 px-1.5 py-0.5 rounded-md text-xs ${roleFilter === tab.key
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                            {roleCounts[tab.key]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-4 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {['User', 'Student ID', 'Year', 'Role', 'Status', 'Actions'].map(h => (
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
                                    Loading users...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                    No users found
                                </td>
                            </tr>
                        ) : filtered.map(user => (
                            <tr key={user.id}
                                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!user.isActive ? 'opacity-50' : ''
                                    }`}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${getRoleAvatarStyle(user.role)}`}>
                                            {user.displayName?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {user.displayName}
                                            </p>
                                            <p className="text-xs text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {user.studentId || '--'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {user.yearLevel || '--'}
                                </td>
                                <td className="px-6 py-4">
                                    <RoleSelector
                                        currentRole={user.role}
                                        currentUserRole={currentProfile?.role}
                                        onChange={newRole => promoteRole(user, newRole)}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => toggleUserStatus(user)}
                                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${user.isActive
                                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                                            }`}
                                    >
                                        {user.isActive
                                            ? <><ToggleRight size={14} /> Active</>
                                            : <><ToggleLeft size={14} /> Inactive</>
                                        }
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => sendPasswordReset(user.email)}
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                        title="Send password reset email"
                                    >
                                        <Mail size={13} />
                                        Reset Password
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-gray-900">
                                Add New User
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Full Name *
                                    </label>
                                    <input
                                        value={newUser.displayName}
                                        onChange={e => setNewUser({ ...newUser, displayName: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                        placeholder="Juan dela Cruz"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                        placeholder="student@mapua.edu.ph"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Password *
                                    </label>
                                    <input
                                        type="password"
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                        placeholder="Minimum 6 characters"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Student ID
                                    </label>
                                    <input
                                        value={newUser.studentId}
                                        onChange={e => setNewUser({ ...newUser, studentId: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                        placeholder="2021-XXXXX"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Year Level
                                    </label>
                                    <select
                                        value={newUser.yearLevel}
                                        onChange={e => setNewUser({ ...newUser, yearLevel: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none"
                                    >
                                        <option value="">Select year</option>
                                        <option value="1st Year">1st Year</option>
                                        <option value="2nd Year">2nd Year</option>
                                        <option value="3rd Year">3rd Year</option>
                                        <option value="4th Year">4th Year</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Role *
                                    </label>
                                    <select
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none"
                                    >
                                        <option value="student">Student</option>
                                        <option value="instructor">Instructor</option>
                                        {currentProfile?.role === 'it_admin' && (
                                            <option value="it_admin">IT Admin</option>
                                        )}
                                    </select>
                                    {newUser.role === 'it_admin' && (
                                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                            <Shield size={12} />
                                            IT Admin has full system access
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createUser}
                                className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                            >
                                Create User
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RoleSelector({ currentRole, currentUserRole, onChange }) {
    const roles = ['student', 'instructor'];
    if (currentUserRole === 'it_admin') roles.push('it_admin');

    const roleStyles = {
        student: 'bg-blue-100 text-blue-700',
        instructor: 'bg-purple-100 text-purple-700',
        it_admin: 'bg-orange-100 text-orange-700',
    };
    const roleLabels = {
        student: 'Student',
        instructor: 'Instructor',
        it_admin: 'IT Admin',
    };

    return (
        <select
            value={currentRole}
            onChange={e => onChange(e.target.value)}
            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none ${roleStyles[currentRole]}`}
        >
            {roles.map(r => (
                <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
        </select>
    );
}

function getRoleAvatarStyle(role) {
    const styles = {
        student: 'bg-blue-100 text-blue-600',
        instructor: 'bg-purple-100 text-purple-600',
        it_admin: 'bg-orange-100 text-orange-600',
    };
    return styles[role] || 'bg-gray-100 text-gray-600';
}