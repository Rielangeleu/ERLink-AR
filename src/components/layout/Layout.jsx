import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    console.log('Toggling sidebar:', !isSidebarOpen);
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Sidebar - Desktop always visible, Mobile slides in */}
      <div
        className={`sidebar-wrapper ${isSidebarOpen ? 'mobile-open' : ''}`}
        style={{
          width: '224px',
          flexShrink: 0,
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        <Sidebar onClose={closeSidebar} />
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="mobile-overlay"
          onClick={closeSidebar}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: 'block',
          }}
        />
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header onMenuClick={toggleSidebar} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '2rem', backgroundColor: '#F9FAFB' }}>
          <Outlet />
        </main>
      </div>

      {/* Mobile styles - inject via style tag */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 1000;
            transform: translateX(-100%);
          }
          .sidebar-wrapper.mobile-open {
            transform: translateX(0);
          }
        }
        @media (min-width: 769px) {
          .sidebar-wrapper {
            transform: translateX(0) !important;
          }
          .mobile-overlay {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}