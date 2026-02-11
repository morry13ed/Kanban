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
  const [newBoardCollaborators, setNewBoardCollaborators] = useState([]);
  const [editingBoardId, setEditingBoardId] = useState(null);
  const [editingBoardName, setEditingBoardName] = useState('');
  const [editingBoardColor, setEditingBoardColor] = useState(BOARD_COLORS[0]);
  const [editingBoardCollaborators, setEditingBoardCollaborators] = useState([]);
  const fileInputRef = useRef(null);

  const handleCreateBoard = () => {
    const name = newBoardName.trim();
    if (!name) return;
    const members = newBoardCollaborators
      .map(({ name, email }) => ({
        name: name.trim(),
        email: email.trim(),
      }))
      .filter((c) => c.name);

    dispatch({
      type: 'ADD_BOARD',
      payload: { name, color: newBoardColor, members },
    });
    setNewBoardName('');
    setNewBoardColor(BOARD_COLORS[0]);
    setNewBoardCollaborators([]);
    setShowNewBoard(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreateBoard();
    if (e.key === 'Escape') {
      setShowNewBoard(false);
      setNewBoardCollaborators([]);
    }
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

  const startEditingBoard = (board) => {
    setEditingBoardId(board.id);
    setEditingBoardName(board.name);
    setEditingBoardColor(board.color);
    const members = (board.members || []).map((m) =>
      typeof m === 'string'
        ? { name: m, email: '' }
        : { name: m.name || '', email: m.email || '' }
    );
    setEditingBoardCollaborators(members);
  };

  const saveEditingBoard = (board) => {
    if (!editingBoardId) return;
    const name = editingBoardName.trim() || board.name;
    const members = editingBoardCollaborators
      .map(({ name, email }) => ({
        name: name.trim(),
        email: email.trim(),
      }))
      .filter((c) => c.name);
    dispatch({
      type: 'UPDATE_BOARD',
      payload: {
        id: board.id,
        updates: {
          name,
          color: editingBoardColor,
          members,
        },
      },
    });
    setEditingBoardId(null);
    setEditingBoardCollaborators([]);
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
                  {state.boards.map((board) => {
                    const isActive = state.activeBoardId === board.id;
                    const isEditing = editingBoardId === board.id;

                    return (
                      <li
                        key={board.id}
                        className={`board-item ${isActive ? 'active' : ''} ${
                          isEditing ? 'editing' : ''
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
                        {isEditing ? (
                          <div className="board-edit-content">
                            <input
                              type="text"
                              value={editingBoardName}
                              onChange={(e) => setEditingBoardName(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="board-name-input"
                            />
                            <div
                              className="collaborators-section"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {editingBoardCollaborators.map((collab, idx) => (
                                <div key={idx} className="collaborator-row">
                                  <input
                                    type="text"
                                    placeholder="Name"
                                    value={collab.name}
                                    onChange={(e) => {
                                      const next = [...editingBoardCollaborators];
                                      next[idx] = {
                                        ...next[idx],
                                        name: e.target.value,
                                      };
                                      setEditingBoardCollaborators(next);
                                    }}
                                    className="new-board-input"
                                  />
                                  <input
                                    type="email"
                                    placeholder="Email"
                                    value={collab.email}
                                    onChange={(e) => {
                                      const next = [...editingBoardCollaborators];
                                      next[idx] = {
                                        ...next[idx],
                                        email: e.target.value,
                                      };
                                      setEditingBoardCollaborators(next);
                                    }}
                                    className="new-board-input"
                                  />
                                </div>
                              ))}
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() =>
                                  setEditingBoardCollaborators([
                                    ...editingBoardCollaborators,
                                    { name: '', email: '' },
                                  ])
                                }
                              >
                                Add collaborator
                              </button>
                            </div>
                            <div
                              className="board-color-picker"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {BOARD_COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`board-color-dot ${
                                    editingBoardColor === c ? 'selected' : ''
                                  }`}
                                  style={{ backgroundColor: c }}
                                  onClick={() => setEditingBoardColor(c)}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="board-name">{board.name}</span>
                        )}
                        <button
                          type="button"
                          className="board-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditing) {
                              saveEditingBoard(board);
                            } else {
                              startEditingBoard(board);
                            }
                          }}
                          title={isEditing ? 'Save changes' : 'Edit project'}
                        >
                          {isEditing ? '✓' : '✎'}
                        </button>
                      </li>
                    );
                  })}
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
                    <div className="collaborators-section">
                      {newBoardCollaborators.map((collab, idx) => (
                        <div key={idx} className="collaborator-row">
                          <input
                            type="text"
                            placeholder="Name"
                            value={collab.name}
                            onChange={(e) => {
                              const next = [...newBoardCollaborators];
                              next[idx] = { ...next[idx], name: e.target.value };
                              setNewBoardCollaborators(next);
                            }}
                            className="new-board-input"
                          />
                          <input
                            type="email"
                            placeholder="Email"
                            value={collab.email}
                            onChange={(e) => {
                              const next = [...newBoardCollaborators];
                              next[idx] = { ...next[idx], email: e.target.value };
                              setNewBoardCollaborators(next);
                            }}
                            className="new-board-input"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() =>
                          setNewBoardCollaborators([
                            ...newBoardCollaborators,
                            { name: '', email: '' },
                          ])
                        }
                      >
                        Add collaborator
                      </button>
                    </div>
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
