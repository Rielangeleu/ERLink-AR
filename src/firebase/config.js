import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Get these values from Firebase Console
// Project Settings → General → Your apps → Web app
const firebaseConfig = {
    apiKey: "AIzaSyAbLAiMa1TYtcxoWjjbnQ8m1F8MJDEnBmo",
    authDomain: "erlinkar-3a41f.firebaseapp.com",
    projectId: "erlinkar-3a41f",
    storageBucket: "erlinkar-3a41f.firebasestorage.app",
    messagingSenderId: "1071697750618",
    appId: "1:1071697750618:web:0f124fcfa459992647c663"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;