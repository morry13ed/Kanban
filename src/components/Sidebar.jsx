import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { exportState, importState } from '../utils/storage';
import { BOARD_COLORS } from '../utils/helpers';
import './Sidebar.css';

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardColor, setNewBoardColor] = useState(BOARD_COLORS[0]);
  const fileInputRef = useRef(null);

  const handleCreateBoard = () => {
    const name = newBoardName.trim();
    if (!name) return;
    dispatch({ type: 'ADD_BOARD', payload: { name, color: newBoardColor } });
    setNewBoardName('');
    setNewBoardColor(BOARD_COLORS[0]);
    setShowNewBoard(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreateBoard();
    if (e.key === 'Escape') setShowNewBoard(false);
  };

  const handleExport = () => {
    exportState(state);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importState(file);
      dispatch({ type: 'IMPORT_STATE', payload: data });
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <h1 className="sidebar-logo">Kanban</h1>}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {!collapsed && (
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <button
              className="sidebar-section-header"
              onClick={() => setProjectsOpen(!projectsOpen)}
            >
              <span className="section-icon">{projectsOpen ? '▾' : '▸'}</span>
              <span>Projects</span>
            </button>

            {projectsOpen && (
              <div className="sidebar-section-content">
                <ul className="board-list">
                  {state.boards.map((board) => (
                    <li
                      key={board.id}
                      className={`board-item ${
                        state.activeBoardId === board.id ? 'active' : ''
                      }`}
                      onClick={() =>
                        dispatch({
                          type: 'SET_ACTIVE_BOARD',
                          payload: board.id,
                        })
                      }
                    >
                      <span
                        className="board-dot"
                        style={{ backgroundColor: board.color }}
                      />
                      <span className="board-name">{board.name}</span>
                    </li>
                  ))}
                </ul>

                {showNewBoard ? (
                  <div className="new-board-form">
                    <input
                      type="text"
                      placeholder="Board name..."
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="new-board-input"
                    />
                    <div className="color-picker">
                      {BOARD_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`color-dot ${
                            newBoardColor === c ? 'selected' : ''
                          }`}
                          style={{ backgroundColor: c }}
                          onClick={() => setNewBoardColor(c)}
                        />
                      ))}
                    </div>
                    <div className="new-board-actions">
                      <button className="btn btn-sm btn-primary" onClick={handleCreateBoard}>
                        Create
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setShowNewBoard(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn-create-project"
                    onClick={() => setShowNewBoard(true)}
                  >
                    + Create Project
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="sidebar-footer">
            <button className="sidebar-action" onClick={handleExport} title="Export data">
              ↓ Export
            </button>
            <button
              className="sidebar-action"
              onClick={() => fileInputRef.current?.click()}
              title="Import data"
            >
              ↑ Import
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
            <button
              className="sidebar-action"
              onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
              title="Toggle theme"
            >
              {state.theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </nav>
      )}
    </aside>
  );
}
