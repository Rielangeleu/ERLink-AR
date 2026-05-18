import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

export async function sendNotification({ userId, title, message, type }) {
    try {
        await addDoc(collection(db, 'notifications'), {
            userId: userId,
            title: title,
            message: message,
            type: type,
            isRead: false,
            createdAt: serverTimestamp()
        });
        console.log(`✅ Notification sent to ${userId}: ${title}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending notification:', error);
        return false;
    }
}

export async function sendNotificationToAllAdmins({ title, message, type }) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'it_admin'));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            console.log('No IT Admins found');
            return;
        }
        
        let sentCount = 0;
        for (const docSnap of querySnapshot.docs) {
            const adminData = docSnap.data();
            const adminEmail = adminData.email;
            
            if (adminData.isActive !== false) {
                await addDoc(collection(db, 'notifications'), {
                    userId: adminEmail,
                    title: title,
                    message: message,
                    type: type,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
                sentCount++;
                console.log(`✅ Sent to admin: ${adminEmail}`);
            }
        }
        console.log(`✅ Sent to ${sentCount} IT Admin(s)`);
        return true;
    } catch (error) {
        console.error('❌ Error sending to admins:', error);
        return false;
    }
}