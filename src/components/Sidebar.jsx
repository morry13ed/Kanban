import { useState, useRef, useEffect } from 'react';
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

// Two levels are enough for now. The group machinery (data, reducers, rows,
// popovers) all stays - flip this to true to bring the middle level back.
// While hidden, boards that already sit in a group are shown flattened into
// their project so nothing disappears.
const SHOW_GROUPS = false;

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

  const [collapsedProjects, setCollapsedProjects] = useState(() => new Set());
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const popoverRef = useRef(null);

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
        : { name: m.name || '', email: m.email || '', color: m.color }
    );
    setEditingBoardCollaborators(members);
  };

  const saveEditingBoard = (board) => {
    if (!editingBoardId) return;
    const name = editingBoardName.trim() || board.name;
    const members = editingBoardCollaborators
      .map(({ name: n, email, color }) => ({
        name: n.trim(),
        email: email.trim(),
        ...(color ? { color } : {}),
      }))
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

  const toggleIn = (setter) => (id) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleProject = toggleIn(setCollapsedProjects);
  const toggleGroup = toggleIn(setCollapsedGroups);

  const saveProjectName = (project) => {
    const name = editingProjectName.trim();
    if (name && name !== project.name) {
      dispatch({ type: 'UPDATE_PROJECT', payload: { id: project.id, name } });
    }
    setEditingProjectId(null);
  };

  // The project-level board form floats as a popover off the + button, so a
  // click anywhere else should dismiss it.
  const popoverOpen = creating?.kind === 'board';
  useEffect(() => {
    if (!popoverOpen) return;
    const onPointerDown = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        closeForm();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [popoverOpen]);

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
                  const directBoards = state.boards.filter((b) =>
                    SHOW_GROUPS
                      ? b.projectId === project.id && !b.groupId
                      : b.projectId === project.id
                  );
                  const projectGroups = SHOW_GROUPS
                    ? state.groups.filter((g) => g.projectId === project.id)
                    : [];

                  const isCollapsed = collapsedProjects.has(project.id);
                  const isEditingProject = editingProjectId === project.id;
                  const boardSpec = {
                    kind: 'board',
                    projectId: project.id,
                    groupId: null,
                  };

                  return (
                    <div key={project.id} className="project-section">
                      <div className="project-row">
                        <button
                          type="button"
                          className="project-toggle"
                          onClick={() => toggleProject(project.id)}
                          title={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                          {isCollapsed ? '▸' : '▾'}
                        </button>

                        {isEditingProject ? (
                          <input
                            type="text"
                            value={editingProjectName}
                            onChange={(e) =>
                              setEditingProjectName(e.target.value)
                            }
                            onBlur={() => saveProjectName(project)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveProjectName(project);
                              if (e.key === 'Escape') setEditingProjectId(null);
                            }}
                            autoFocus
                            className="project-name-input"
                          />
                        ) : (
                          <span
                            className="project-label"
                            onClick={() => toggleProject(project.id)}
                          >
                            {project.name}
                          </span>
                        )}

                        <button
                          type="button"
                          className="project-action-btn project-edit-btn"
                          title="Rename project"
                          onClick={() => {
                            setEditingProjectId(project.id);
                            setEditingProjectName(project.name);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="project-action-btn"
                          title="Add board"
                          onClick={() =>
                            isCreating(boardSpec)
                              ? closeForm()
                              : openForm(boardSpec)
                          }
                        >
                          +
                        </button>

                        {isCreating(boardSpec) && (
                          <div className="board-form-popover" ref={popoverRef}>
                            {renderBoardForm()}
                          </div>
                        )}
                      </div>

                      {!isCollapsed && (
                      <div className="project-body">
                        {directBoards.length > 0 && (
                          <ul className="board-list">
                            {directBoards.map(renderBoardRow)}
                          </ul>
                        )}

                        {projectGroups.map((group) => {
                          const groupCollapsed = collapsedGroups.has(group.id);
                          const groupBoardSpec = {
                            kind: 'board',
                            projectId: project.id,
                            groupId: group.id,
                          };

                          return (
                            <div key={group.id} className="group-section">
                              <div className="group-row">
                                <button
                                  type="button"
                                  className="project-toggle"
                                  onClick={() => toggleGroup(group.id)}
                                  title={groupCollapsed ? 'Expand' : 'Collapse'}
                                >
                                  {groupCollapsed ? '▸' : '▾'}
                                </button>
                                <span
                                  className="board-group-label"
                                  onClick={() => toggleGroup(group.id)}
                                >
                                  {group.name}
                                </span>
                                <button
                                  type="button"
                                  className="project-action-btn"
                                  title="Add board"
                                  onClick={() =>
                                    isCreating(groupBoardSpec)
                                      ? closeForm()
                                      : openForm(groupBoardSpec)
                                  }
                                >
                                  +
                                </button>

                                {isCreating(groupBoardSpec) && (
                                  <div
                                    className="board-form-popover"
                                    ref={popoverRef}
                                  >
                                    {renderBoardForm()}
                                  </div>
                                )}
                              </div>

                              {!groupCollapsed && (
                                <ul className="board-list">
                                  {state.boards
                                    .filter((b) => b.groupId === group.id)
                                    .map(renderBoardRow)}
                                </ul>
                              )}
                            </div>
                          );
                        })}

                        {SHOW_GROUPS && (
                          <div className="project-actions">
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
                        )}
                      </div>
                      )}
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
