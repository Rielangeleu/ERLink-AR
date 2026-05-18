import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Activity, AlertCircle, Shield } from 'lucide-react';
import { sendNotification, sendNotificationToAllAdmins } from '../utils/sendNotification';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [remainingAttempts, setRemainingAttempts] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const MAX_ATTEMPTS = 3;
    const LOCK_MINUTES = 15;

    useEffect(() => {
        if (email) {
            checkUserStatus();
        }
    }, [email]);

    async function checkUserStatus() {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                setUserId(userDoc.id);
                setUserRole(userData.role);
                setUserName(userData.displayName || email);
                
                if (userData.role === 'student') {
                    setRemainingAttempts(null);
                    setIsLocked(false);
                    setError('');
                    return;
                }
                
                if (userData.isLocked) {
                    const lockExpiry = userData.lockExpiry?.toDate?.() || new Date();
                    const now = new Date();
                    
                    if (lockExpiry > now) {
                        const minutesLeft = Math.ceil((lockExpiry - now) / 60000);
                        setIsLocked(true);
                        setError(`🔒 Account is LOCKED. Contact IT Administrator to reset your password.`);
                    } else {
                        await updateDoc(doc(db, 'users', userDoc.id), {
                            isLocked: false,
                            failedLoginAttempts: 0,
                            lockExpiry: null,
                            isActive: true
                        });
                        setIsLocked(false);
                        setRemainingAttempts(MAX_ATTEMPTS);
                        setError('');
                    }
                } else {
                    const attempts = userData.failedLoginAttempts || 0;
                    const remaining = MAX_ATTEMPTS - attempts;
                    setRemainingAttempts(remaining);
                    
                    if (remaining === 1 && remaining > 0) {
                        setError(`⚠️ LAST TRY! You have 1 attempt remaining.`);
                    } else if (remaining > 0 && remaining < MAX_ATTEMPTS) {
                        setError(`⚠️ Incorrect password. ${remaining} attempt(s) remaining.`);
                    } else if (remaining <= 0) {
                        setError(`⚠️ No attempts remaining. Please contact IT Admin.`);
                    } else {
                        setError('');
                    }
                }
            }
        } catch (err) {
            console.error('Error checking user status:', err);
        }
    }

    async function recordFailedLogin() {
        if (userRole === 'student') {
            setError('Student accounts cannot access this portal. Please use the AR app.');
            return;
        }
        
        if (!userId) return;
        
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            const currentAttempts = (userSnap.data()?.failedLoginAttempts || 0) + 1;
            
            if (currentAttempts >= MAX_ATTEMPTS) {
                const lockExpiry = new Date();
                lockExpiry.setMinutes(lockExpiry.getMinutes() + LOCK_MINUTES);
                
                await updateDoc(userRef, {
                    failedLoginAttempts: currentAttempts,
                    isLocked: true,
                    lockExpiry: lockExpiry,
                    lastFailedAttempt: serverTimestamp(),
                    isActive: false
                });
                
                setError(`🔒 ACCOUNT LOCKED! Too many failed attempts. Please contact IT Administrator to reset your password.`);
                setIsLocked(true);
                setRemainingAttempts(0);
                
                // ✅ NOTIFICATION 1: Send to the user who got locked
                await sendNotification({
                    userId: email,
                    title: '🔒 Account Locked',
                    message: `Your account has been locked due to ${MAX_ATTEMPTS} failed login attempts. Please contact IT Administrator to unlock your account.`,
                    type: 'account_locked'
                });
                
                // ✅ NOTIFICATION 2: Send to ALL IT ADMINS
                await sendNotificationToAllAdmins({
                    title: '⚠️ Account Locked Alert',
                    message: `User "${userName}" (${email}) has been locked due to ${MAX_ATTEMPTS} failed login attempts. Please unlock the account in User Management.`,
                    type: 'account_locked'
                });
                
                console.log('✅ Lock notifications sent to user and admins');
                
            } else {
                await updateDoc(userRef, {
                    failedLoginAttempts: currentAttempts,
                    lastFailedAttempt: serverTimestamp()
                });
                
                const remaining = MAX_ATTEMPTS - currentAttempts;
                setRemainingAttempts(remaining);
                
                if (remaining === 1) {
                    setError(`⚠️ LAST TRY! You have 1 attempt remaining. Next failed attempt will LOCK your account.`);
                } else {
                    setError(`⚠️ Incorrect password. ${remaining} attempt(s) remaining.`);
                }
            }
        } catch (err) {
            console.error('Error recording failed login:', err);
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        
        if (userRole === 'student') {
            setError('Student accounts cannot access this portal. Please use the AR app.');
            return;
        }
        
        if (isLocked) {
            setError('🔒 Account is LOCKED. Please contact IT Administrator.');
            return;
        }
        
        setLoading(true);
        
        try {
            const userCredential = await login(email, password);
            
            if (userId && userRole !== 'student') {
                await updateDoc(doc(db, 'users', userId), {
                    failedLoginAttempts: 0,
                    isLocked: false,
                    lockExpiry: null,
                    lastSuccessfulLogin: serverTimestamp(),
                    isActive: true
                });
            }
            
            navigate('/dashboard');
        } catch (err) {
            if (userRole !== 'student') {
                await recordFailedLogin();
            } else {
                setError('Student accounts cannot access this portal. Please use the AR app.');
            }
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <Activity size={40} className="text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-semibold text-gray-900">ERLink AR</h1>
                    <p className="text-gray-500 mt-1">Admin & Instructor Portal</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
                    {error && (
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm ${
                            error.includes('LOCKED')
                                ? 'bg-red-50 border border-red-200 text-red-700'
                                : error.includes('LAST TRY')
                                ? 'bg-orange-50 border border-orange-200 text-orange-700'
                                : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                        }`}>
                            {error.includes('LOCKED') ? <Shield size={16} /> : <AlertCircle size={16} />}
                            {error}
                        </div>
                    )}

                    {remainingAttempts !== null && remainingAttempts > 0 && !isLocked && userRole !== 'student' && (
                        <div className="flex items-center justify-between bg-gray-100 px-4 py-2 rounded-xl mb-4 text-sm">
                            <span className="text-gray-600">Attempts remaining:</span>
                            <span className={`font-bold ${
                                remainingAttempts === 1 ? 'text-red-600' : 'text-gray-800'
                            }`}>
                                {remainingAttempts} / {MAX_ATTEMPTS}
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="your.email@mapua.edu.ph"
                                className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm"
                                required
                                disabled={isLocked}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm"
                                required
                                disabled={isLocked}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || isLocked}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors text-sm"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-xs text-gray-400 text-center mt-4">
                        Students: Please use the AR mobile application to login.
                    </p>
                    
                    <p className="text-xs text-gray-400 text-center mt-2">
                        For password reset, contact IT Administrator.
                    </p>
                </div>
            </div>
        </div>
    );
}