import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Students from './pages/Students';
import Scenarios from './pages/Scenarios';
import Results from './pages/Results';
import SystemConfig from './pages/SystemConfig';
import AuditLogs from './pages/AuditLogs';
import ARAssets from './pages/ARAssets';

function ProtectedRoute({ children, allowedRoles }) {
    const { user, profile } = useAuth();
    if (!user) return <Navigate to="/login" />;
    if (allowedRoles && !allowedRoles.includes(profile?.role))
        return <Navigate to="/dashboard" />;
    return children;
}

function AppRoutes() {
    const { user } = useAuth();
    return (
        <Routes>
            <Route path="/login" element={
                user ? <Navigate to="/dashboard" /> : <Login />
            } />
            <Route path="/" element={
                <ProtectedRoute><Layout /></ProtectedRoute>
            }>
                <Route index element={<Navigate to="/dashboard" />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="students" element={<Students />} />
                <Route path="results" element={<Results />} />
                <Route path="scenarios" element={<Scenarios />} />
                <Route path="ar-assets" element={<ARAssets />} />
                <Route path="users" element={
                    <ProtectedRoute allowedRoles={['it_admin']}>
                        <Users />
                    </ProtectedRoute>
                } />
                <Route path="system-config" element={
                    <ProtectedRoute allowedRoles={['it_admin']}>
                        <SystemConfig />
                    </ProtectedRoute>
                } />
                <Route path="audit-logs" element={
                    <ProtectedRoute allowedRoles={['it_admin']}>
                        <AuditLogs />
                    </ProtectedRoute>
                } />
            </Route>
        </Routes>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}