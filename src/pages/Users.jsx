import { useEffect, useState } from 'react';
import { db, auth } from '../firebase/config';
import {
    collection, getDocs, doc,
    updateDoc, setDoc, serverTimestamp, addDoc, deleteDoc
} from 'firebase/firestore';
import {
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithEmailAndPassword
} from 'firebase/auth';
import {
    UserPlus, Search, Shield, Mail,
    ToggleLeft, ToggleRight, X, Key, Lock, Unlock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendNotification } from '../utils/sendNotification';

export default function Users() {
    const { profile: currentProfile } = useAuth();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState('');
    const [showPinModal, setShowPinModal] = useState(false);
    const [lastCreatedPin, setLastCreatedPin] = useState('');
    const [lastCreatedStudent, setLastCreatedStudent] = useState('');
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

    async function logAction(action, details) {
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

    function generatePin() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    function generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async function createUser() {
        if (!newUser.email || !newUser.displayName) {
            alert('Please fill in all required fields.');
            return;
        }

        if (newUser.role === 'it_admin' && currentProfile?.role !== 'it_admin') {
            alert('Only IT Admins can create other IT Admin accounts.');
            return;
        }

        if (newUser.role === 'student' && !newUser.studentId) {
            alert('Student ID is required for student accounts.');
            return;
        }

        // Password validation for instructor and admin
        if ((newUser.role === 'instructor' || newUser.role === 'it_admin') && (!newUser.password || newUser.password.length < 6)) {
            alert('Password must be at least 6 characters for instructor/admin accounts.');
            return;
        }

        try {
            if (newUser.role === 'student') {
                await createStudentUser();
            } else if (newUser.role === 'instructor') {
                await createInstructorUser();
            } else if (newUser.role === 'it_admin') {
                await createAdminUser();
            }
        } catch (e) {
            console.error('Error creating user:', e);
            alert('Error: ' + e.message);
        }
    }

    async function createStudentUser() {
        // REMOVE: const cred = await createUserWithEmailAndPassword(...)

        // Generate a unique ID for the Firestore document
        const userId = generateUserId();
        const pinCode = generatePin();

        const studentData = {
            userId: userId, // Document ID will be this userId
            email: newUser.email,
            displayName: newUser.displayName,
            role: 'student',
            studentId: newUser.studentId,
            yearLevel: newUser.yearLevel,
            institution: 'Mapua University',
            isActive: true,
            pinCode: pinCode, // PIN is the secret, not a password
            authUid: null, // No authUid until they verify in Unity!
            createdAt: serverTimestamp(),
        };

        // Save to Firestore ONLY
        await setDoc(doc(db, 'users', userId), studentData);
        
        await logAction('STUDENT_CREATED', 
            `Created student: ${newUser.email} (ID: ${newUser.studentId})`);
        
        // Send notification to the new student
        await sendNotification({
            userId: newUser.email,
            title: 'Welcome to ERLink AR! 🎉',
            message: `Your student account has been created. Your AR app PIN is: ${pinCode}. Use your Student ID and PIN to login to the AR app.`,
            type: 'user_created'
        });
        
        setLastCreatedPin(pinCode);
        setLastCreatedStudent(newUser.displayName);
        setShowPinModal(true);
        
        showMessage(`Student ${newUser.displayName} created successfully!`);
        setShowModal(false);
        setNewUser({
            email: '', password: '', displayName: '',
            role: 'student', studentId: '', yearLevel: ''
        });
        loadUsers();
    }

    async function createInstructorUser() {
        // Store current admin info
        const adminEmail = currentProfile?.email;
        const adminPassword = prompt('Please re-enter your password to confirm instructor creation:');
        
        if (!adminPassword) {
            alert('Password required to create instructor user.');
            return;
        }

        // Create Firebase Auth user for instructor
        const cred = await createUserWithEmailAndPassword(
            auth, newUser.email, newUser.password);

        const instructorData = {
            userId: cred.user.uid,
            email: newUser.email,
            displayName: newUser.displayName,
            role: 'instructor',
            employeeId: newUser.studentId || '',
            institution: 'Mapua University',
            isActive: true,
            isLocked: false,
            failedLoginAttempts: 0,
            createdAt: serverTimestamp(),
            createdBy: adminEmail,
        };

        await setDoc(doc(db, 'users', cred.user.uid), instructorData);
        await logAction('INSTRUCTOR_CREATED', `Created instructor: ${newUser.email}`);
        
        // Send notification to the new instructor
        await sendNotification({
            userId: newUser.email,
            title: 'Welcome to ERLink AR Portal 👋',
            message: `Your instructor account has been created. Use your email (${newUser.email}) and password to login to the web portal.`,
            type: 'user_created'
        });

        // Send notification to admin that instructor was created
        await sendNotification({
            userId: adminEmail,
            title: 'New Instructor Created 📝',
            message: `Instructor ${newUser.displayName} (${newUser.email}) was created by you.`,
            type: 'user_created'
        });

        // Logout new instructor and login back as admin
        await auth.signOut();
        await new Promise(resolve => setTimeout(resolve, 500));
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        
        showMessage(`Instructor ${newUser.displayName} created successfully!`);
        setShowModal(false);
        setNewUser({
            email: '', password: '', displayName: '',
            role: 'student', studentId: '', yearLevel: ''
        });
        loadUsers();
    }

    async function createAdminUser() {
        if (!newUser.password || newUser.password.length < 6) {
            alert('Password must be at least 6 characters for admin accounts.');
            return;
        }

        const adminEmail = currentProfile?.email;
        const adminPassword = prompt('Please re-enter your password to confirm admin creation:');
        
        if (!adminPassword) {
            alert('Password required to create admin user.');
            return;
        }

        const cred = await createUserWithEmailAndPassword(
            auth, newUser.email, newUser.password);

        const adminData = {
            userId: cred.user.uid,
            email: newUser.email,
            displayName: newUser.displayName,
            role: 'it_admin',
            institution: 'Mapua University',
            isActive: true,
            isLocked: false,
            failedLoginAttempts: 0,
            createdAt: serverTimestamp(),
            createdBy: adminEmail,
        };

        await setDoc(doc(db, 'users', cred.user.uid), adminData);
        await logAction('ADMIN_CREATED', `Created IT Admin: ${newUser.email}`);
        
        // Send notification to the new admin
        await sendNotification({
            userId: newUser.email,
            title: 'Admin Account Created 🔑',
            message: `Your IT Admin account has been created. Use your email and password to login to the web portal.`,
            type: 'user_created'
        });

        await auth.signOut();
        await new Promise(resolve => setTimeout(resolve, 500));
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        
        showMessage(`Admin ${newUser.displayName} created successfully!`);
        setShowModal(false);
        setNewUser({
            email: '', password: '', displayName: '',
            role: 'student', studentId: '', yearLevel: ''
        });
        loadUsers();
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
        
        // Send notification to the user about status change
        if (user.role !== 'student') {
            await sendNotification({
                userId: user.email,
                title: newStatus ? 'Account Activated ✅' : 'Account Deactivated ❌',
                message: newStatus 
                    ? `Your account has been activated by ${currentProfile?.displayName}. You can now login.`
                    : `Your account has been deactivated by ${currentProfile?.displayName}. Contact IT Admin for assistance.`,
                type: newStatus ? 'user_activated' : 'user_deactivated'
            });
        }
        
        showMessage(`User ${newStatus ? 'activated' : 'deactivated'}.`);
        loadUsers();
    }

    async function unlockUser(user) {
        if (currentProfile?.role !== 'it_admin') {
            alert('Only IT Admins can unlock accounts.');
            return;
        }
        
        await updateDoc(doc(db, 'users', user.id), {
            isLocked: false,
            failedLoginAttempts: 0,
            lockExpiry: null,
            isActive: true,
            updatedAt: serverTimestamp()
        });
        
        await logAction('USER_UNLOCKED',
            `${currentProfile?.email} unlocked account for ${user.email}`);
        
        // Send notification to the user that their account is unlocked
        await sendNotification({
            userId: user.email,
            title: 'Account Unlocked 🔓',
            message: `Your account has been unlocked by ${currentProfile?.displayName}. You can now try logging in again.`,
            type: 'user_unlocked'
        });
        
        showMessage(`Account unlocked for ${user.displayName}. They can now login again.`);
        loadUsers();
    }

    async function promoteRole(user, newRole) {
        if (newRole === 'it_admin' && currentProfile?.role !== 'it_admin') {
            alert('Only IT Admins can promote users to IT Admin.');
            return;
        }
        await updateDoc(doc(db, 'users', user.id), {
            role: newRole,
            updatedAt: serverTimestamp()
        });
        await logAction('ROLE_CHANGED',
            `${currentProfile?.email} changed ${user.email} role to ${newRole}`);
        
        // Send notification about role change
        if (user.role !== 'student') {
            const roleLabels = { student: 'Student', instructor: 'Instructor', it_admin: 'IT Admin' };
            await sendNotification({
                userId: user.email,
                title: 'Role Updated 🔄',
                message: `Your role has been changed to ${roleLabels[newRole]}.`,
                type: 'role_changed'
            });
        }
        
        showMessage(`Role updated to ${newRole}.`);
        loadUsers();
    }

    async function sendPasswordReset(email) {
    console.log('🔍 Attempting to send password reset to:', email);
    
    try {
        // Check if user exists in Firebase Auth first
        await sendPasswordResetEmail(auth, email);
        console.log('✅ Password reset email sent successfully to:', email);
        
        await logAction('PASSWORD_RESET_SENT',
            `Password reset sent to ${email} by ${currentProfile?.email}`);
        
        await sendNotification({
            userId: email,
            title: 'Password Reset Request 📧',
            message: `A password reset email has been sent to ${email}. Check your inbox to reset your password.`,
            type: 'password_reset'
        });
        
        showMessage(`Password reset email sent to ${email}`);
        
    } catch (e) {
        console.error('❌ Password reset failed:');
        console.error('Error code:', e.code);
        console.error('Error message:', e.message);
        
        // Show user-friendly message based on error code
        if (e.code === 'auth/user-not-found') {
            alert('No account found with this email. The user may not have a Firebase Auth account.');
        } else if (e.code === 'auth/too-many-requests') {
            alert('Too many requests. Please try again later.');
        } else {
            alert('Error: ' + e.message);
        }
    }
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
            {actionMsg && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
                    ✓ {actionMsg}
                </div>
            )}

            {showPinModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Key size={32} className="text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                Student Created Successfully!
                            </h2>
                            <p className="text-gray-600 mb-4">
                                Student: <strong>{lastCreatedStudent}</strong>
                            </p>
                            <div className="bg-gray-100 p-4 rounded-xl mb-4">
                                <p className="text-sm text-gray-600 mb-1">AR App Login PIN:</p>
                                <p className="text-3xl font-bold text-blue-600 tracking-wider">
                                    {lastCreatedPin}
                                </p>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                                Give this PIN to the student for AR app access.
                                They can login using their Student ID and this PIN.
                            </p>
                            <button
                                onClick={() => setShowPinModal(false)}
                                className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        User Management
                    </h1>
                    <p className="text-gray-500">
                        {users.length} total users 
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

            <div className="relative mb-4 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-4 h-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Number</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Year/Dept</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lock</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">AR PIN</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(user => (
                                    <tr key={user.id}
                                        className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}
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
                                            {user.studentId || user.employeeId || '--'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {user.yearLevel || (user.role === 'instructor' ? 'Faculty' : '--')}
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
                                            {user.isLocked ? (
                                                <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg bg-red-100 text-red-700">
                                                    <Lock size={12} />
                                                    Locked
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg bg-green-100 text-green-700">
                                                    <Unlock size={12} />
                                                    Unlocked
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.role === 'student' && user.pinCode && (
                                                <div className="flex items-center gap-2">
                                                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                                        {user.pinCode}
                                                    </code>
                                                    <button
                                                        onClick={() => {
                                                            setLastCreatedPin(user.pinCode);
                                                            setLastCreatedStudent(user.displayName);
                                                            setShowPinModal(true);
                                                        }}
                                                        className="text-xs text-blue-600 hover:text-blue-700"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            )}
                                            {user.role !== 'student' && <span className="text-gray-400 text-xs">--</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                {user.role !== 'student' && (
                                                    <button
                                                        onClick={() => sendPasswordReset(user.email)}
                                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                                        title="Send password reset email"
                                                    >
                                                        <Mail size={13} />
                                                        Reset
                                                    </button>
                                                )}
                                                {user.isLocked && user.role !== 'student' && (
                                                    <button
                                                        onClick={() => unlockUser(user)}
                                                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
                                                        title="Unlock account"
                                                    >
                                                        <Unlock size={13} />
                                                        Unlock
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

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
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
                            {/* ROLE SELECTOR */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Role *
                                </label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                >
                                    <option value="student">Student</option>
                                    <option value="instructor">Instructor</option>
                                    {currentProfile?.role === 'it_admin' && (
                                        <option value="it_admin">IT Admin</option>
                                    )}
                                </select>
                            </div>

                            {/* Full Name */}
                            <div>
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

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                    placeholder="user@mapua.edu.ph"
                                />
                            </div>

                            {/* Password - For Instructor and IT Admin */}
                            {(newUser.role === 'instructor' || newUser.role === 'it_admin') && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Password * (Min 6 characters)
                                    </label>
                                    <input
                                        type="password"
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                        placeholder="Minimum 6 characters"
                                    />
                                </div>
                            )}

                            {newUser.role === 'student' && (
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-xs text-blue-600">
                                        ℹ️ Students will receive a PIN for AR app login. 
                                        No password needed for web portal since they don't have access.
                                    </p>
                                </div>
                            )}

                            {/* STUDENT-SPECIFIC FIELDS */}
                            {newUser.role === 'student' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Student ID *
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
                                            Year Level *
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
                                </>
                            )}

                            {/* INSTRUCTOR-SPECIFIC FIELDS */}
                            {newUser.role === 'instructor' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Employee ID (Optional)
                                    </label>
                                    <input
                                        value={newUser.studentId}
                                        onChange={e => setNewUser({ ...newUser, studentId: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                                        placeholder="EMP-XXXXX"
                                    />
                                </div>
                            )}

                            {/* IT ADMIN WARNING */}
                            {newUser.role === 'it_admin' && (
                                <div className="bg-amber-50 p-3 rounded-lg">
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                        <Shield size={14} />
                                        IT Admin will have full access to all system settings and user management
                                    </p>
                                </div>
                            )}
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