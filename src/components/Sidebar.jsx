import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { exportState, importState } from '../utils/storage';
import { BOARD_COLORS, countOpenTasks } from '../utils/helpers';
import './Sidebar.css';

const SYNC_LABELS = {
  off: {
    text: 'This browser only',
    hint: 'Cloud sync is not configured, so boards are saved in this browser alone.',
  },
  saving: { text: 'Saving…', hint: 'Saving your boards to the cloud.' },
  synced: { text: 'Synced', hint: 'Your boards are saved to the cloud.' },
  error: {
    text: 'Not synced',
    hint: "Couldn't reach the cloud. Boards are still saved in this browser. If the Supabase project is paused, restore it.",
  },
};

export default function Sidebar() {
  const { state, dispatch, syncStatus } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  // What is being created right now, and where:
  //   { kind: 'project' }
  //   { kind: 'group', projectId }
  //   { kind: 'board', projectId, groupId }   (groupId null = directly in project)
  const [creating, setCreating] = useState(null);
  const [newName, setNewName] = useState('');
  const [newBoardColor, setNewBoardColor] = useState(BOARD_COLORS[0]);
  const [newBoardCollaborators, setNewBoardCollaborators] = useState([]);

  const [editingBoardId, setEditingBoardId] = useState(null);
  const [editingBoardName, setEditingBoardName] = useState('');
  const [editingBoardColor, setEditingBoardColor] = useState(BOARD_COLORS[0]);
  const [editingBoardCollaborators, setEditingBoardCollaborators] = useState([]);
  const fileInputRef = useRef(null);

  const openForm = (spec) => {
    setCreating(spec);
    setNewName('');
    setNewBoardColor(BOARD_COLORS[0]);
    setNewBoardCollaborators([]);
  };

  const closeForm = () => {
    setCreating(null);
    setNewBoardCollaborators([]);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name || !creating) return;

    if (creating.kind === 'project') {
      dispatch({ type: 'ADD_PROJECT', payload: name });
    } else if (creating.kind === 'group') {
      dispatch({
        type: 'ADD_GROUP',
        payload: { projectId: creating.projectId, name },
      });
    } else {
      const members = newBoardCollaborators
        .map(({ name: n, email }) => ({ name: n.trim(), email: email.trim() }))
        .filter((c) => c.name);
      dispatch({
        type: 'ADD_BOARD',
        payload: {
          name,
          color: newBoardColor,
          members,
          projectId: creating.projectId,
          groupId: creating.groupId,
        },
      });
    }
    closeForm();
  };

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') closeForm();
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
      .map(({ name: n, email }) => ({ name: n.trim(), email: email.trim() }))
      .filter((c) => c.name);
    dispatch({
      type: 'UPDATE_BOARD',
      payload: {
        id: board.id,
        updates: { name, color: editingBoardColor, members },
      },
    });
    setEditingBoardId(null);
    setEditingBoardCollaborators([]);
  };

  const isCreating = (spec) =>
    creating &&
    creating.kind === spec.kind &&
    (creating.projectId ?? null) === (spec.projectId ?? null) &&
    (creating.groupId ?? null) === (spec.groupId ?? null);

  const renderNameForm = (placeholder) => (
    <div className="new-board-form">
      <input
        type="text"
        placeholder={placeholder}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={handleFormKeyDown}
        autoFocus
        className="new-board-input"
      />
      <div className="new-board-actions">
        <button className="btn btn-sm btn-primary" onClick={handleCreate}>
          Create
        </button>
        <button className="btn btn-sm btn-ghost" onClick={closeForm}>
          Cancel
        </button>
      </div>
    </div>
  );

  const renderBoardForm = () => (
    <div className="new-board-form">
      <input
        type="text"
        placeholder="Board name..."
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={handleFormKeyDown}
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
            className={`color-dot ${newBoardColor === c ? 'selected' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => setNewBoardColor(c)}
          />
        ))}
      </div>
      <div className="new-board-actions">
        <button className="btn btn-sm btn-primary" onClick={handleCreate}>
          Create
        </button>
        <button className="btn btn-sm btn-ghost" onClick={closeForm}>
          Cancel
        </button>
      </div>
    </div>
  );

  const renderCreateBoard = (projectId, groupId) => {
    const spec = { kind: 'board', projectId, groupId };
    return isCreating(spec) ? (
      renderBoardForm()
    ) : (
      <button className="btn-create-inline" onClick={() => openForm(spec)}>
        + Create board
      </button>
    );
  };

  const renderBoardRow = (board) => {
    const isActive = state.activeBoardId === board.id;
    const isEditing = editingBoardId === board.id;
    const openCount = countOpenTasks(board);

    return (
      <li
        key={board.id}
        className={`board-item ${isActive ? 'active' : ''} ${
          isEditing ? 'editing' : ''
        }`}
        onClick={() =>
          dispatch({ type: 'SET_ACTIVE_BOARD', payload: board.id })
        }
      >
        <span className="board-dot" style={{ backgroundColor: board.color }} />
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
                      next[idx] = { ...next[idx], name: e.target.value };
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
                      next[idx] = { ...next[idx], email: e.target.value };
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
          <>
            <span className="board-name">{board.name}</span>
            {openCount > 0 && (
              <span
                className="board-count"
                title={`${openCount} open ${openCount === 1 ? 'task' : 'tasks'}`}
              >
                {openCount}
              </span>
            )}
          </>
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
          title={isEditing ? 'Save changes' : 'Edit board'}
        >
          {isEditing ? '✓' : '✎'}
        </button>
      </li>
    );
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
            <div className="sidebar-section-content">
                {state.projects.map((project) => {
                  const directBoards = state.boards.filter(
                    (b) => b.projectId === project.id && !b.groupId
                  );
                  const projectGroups = state.groups.filter(
                    (g) => g.projectId === project.id
                  );

                  return (
                    <div key={project.id} className="project-section">
                      <div className="project-label">{project.name}</div>

                      <div className="project-body">
                        {directBoards.length > 0 && (
                          <ul className="board-list">
                            {directBoards.map(renderBoardRow)}
                          </ul>
                        )}

                        {projectGroups.map((group) => (
                          <div key={group.id} className="group-section">
                            <div className="board-group-label">
                              {group.name}
                            </div>
                            <ul className="board-list">
                              {state.boards
                                .filter((b) => b.groupId === group.id)
                                .map(renderBoardRow)}
                            </ul>
                            {renderCreateBoard(project.id, group.id)}
                          </div>
                        ))}

                        <div className="project-actions">
                          {renderCreateBoard(project.id, null)}
                          {isCreating({
                            kind: 'group',
                            projectId: project.id,
                          }) ? (
                            renderNameForm('Group name...')
                          ) : (
                            <button
                              className="btn-create-inline"
                              onClick={() =>
                                openForm({
                                  kind: 'group',
                                  projectId: project.id,
                                })
                              }
                            >
                              + Create group
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="sidebar-separator" />

                {isCreating({ kind: 'project' }) ? (
                  renderNameForm('Project name...')
                ) : (
                  <button
                    className="btn-create-project"
                    onClick={() => openForm({ kind: 'project' })}
                  >
                    + Create Project
                  </button>
              )}
            </div>
          </div>

          <div className="sidebar-footer">
            <div
              className={`sync-status ${syncStatus}`}
              title={SYNC_LABELS[syncStatus].hint}
            >
              <span className="sync-dot" />
              {SYNC_LABELS[syncStatus].text}
            </div>

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
