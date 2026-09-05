import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Board from './components/Board';
import MobileBoard from './components/MobileBoard';
import AuthScreen from './components/AuthScreen';
import { useAuth } from './context/AuthContext';
import useIsMobile from './utils/useIsMobile';
import './App.css';

function App() {
  const { enabled, ready, user } = useAuth();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editRequest, setEditRequest] = useState(null);

  // Cloud configured but nobody signed in: the gate. Without Supabase
  // configured the app stays a local, single-browser tool as before.
  if (enabled && !ready) return null;
  if (enabled && !user) return <AuthScreen />;

  if (isMobile) {
    return (
      <div className="mobile-app">
        <MobileBoard
          onOpenMenu={() => setDrawerOpen(true)}
          onEditBoard={(boardId) => {
            setEditRequest({ boardId, token: Date.now() });
            setDrawerOpen(true);
          }}
        />

        {drawerOpen && (
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
            <div
              className="drawer"
              onClick={(e) => {
                // Picking a board is the one click that should dismiss the
                // drawer; everything else (editing, creating) keeps it open.
                const row = e.target.closest('.board-item');
                const stays =
                  e.target.closest('.board-edit-btn') ||
                  e.target.closest('.board-editor-well');
                if (row && !stays) {
                  setDrawerOpen(false);
                } else {
                  e.stopPropagation();
                }
              }}
            >
              <Sidebar editRequest={editRequest} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <Board />
    </div>
  );
}

export default App;
