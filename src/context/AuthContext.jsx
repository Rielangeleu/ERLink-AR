import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // Load profile from Firestore
                const docSnap = await getDoc(
                    doc(db, 'users', firebaseUser.uid));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Block non-admin users from web panel
                    if (data.role === 'student') {
                        await signOut(auth);
                        setUser(null);
                        setProfile(null);
                    } else {
                        setProfile(data);
                    }
                }
            } else {
                setUser(null);
                setProfile(null);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    const login = (email, password) =>
        signInWithEmailAndPassword(auth, email, password);

    const logout = () => signOut(auth);

    return (
        <AuthContext.Provider value={{
            user, profile, loading, login, logout
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);