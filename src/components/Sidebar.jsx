import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { exportState, importState } from '../utils/storage';
import {
  BOARD_COLORS,
  DEFAULT_MEMBER_COLOR,
  countOpenTasks,
} from '../utils/helpers';
import ColorPicker from './ColorPicker';
import DashedButton from './DashedButton';
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
  const [closingBoardId, setClosingBoardId] = useState(null);
  const [editingBoardName, setEditingBoardName] = useState('');
  const [editingBoardColor, setEditingBoardColor] = useState(BOARD_COLORS[0]);
  const [editingBoardCollaborators, setEditingBoardCollaborators] = useState([]);
  const fileInputRef = useRef(null);

  // Which tiny colour picker is open:
  //   { target: 'new-collab' | 'edit-collab', index }
  //   { target: 'new-board' | 'edit-board' }
  const [colorPicking, setColorPicking] = useState(null);
  const colorPickerRef = useRef(null);

  useEffect(() => {
    if (!colorPicking) return;
    const onPointerDown = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setColorPicking(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [colorPicking]);

  const setCollabColor = (target, index, color) => {
    const setter =
      target === 'new-collab'
        ? setNewBoardCollaborators
        : setEditingBoardCollaborators;
    setter((current) =>
      current.map((c, i) => (i === index ? { ...c, color } : c))
    );
  };

  // Fixed positioning, clamped to the viewport, so the sidebar's scroll
  // container can't clip the popover.
  const anchorAt = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 222)),
      top: Math.min(rect.bottom + 6, window.innerHeight - 110),
    };
  };

  const renderColorPicker = (value, onApply) => (
    <div
      className="picker-fixed"
      ref={colorPickerRef}
      style={{ left: colorPicking.left, top: colorPicking.top }}
    >
      <ColorPicker
        value={value}
        onApply={(hex) => {
          onApply(hex);
          setColorPicking(null);
        }}
        onClose={() => setColorPicking(null)}
      />
    </div>
  );

  const renderCollabDot = (target, collab, idx) => (
    <button
      type="button"
      className="collab-color-dot"
      style={{ backgroundColor: collab.color || DEFAULT_MEMBER_COLOR }}
      title="Collaborator colour"
      onClick={(e) => {
        e.stopPropagation();
        const at = anchorAt(e.currentTarget);
        setColorPicking((current) =>
          current?.target === target && current.index === idx
            ? null
            : { target, index: idx, ...at }
        );
      }}
    />
  );

  const renderSpectrumDot = (target, currentColor) => (
    <button
      type="button"
      className={`board-color-dot spectrum ${
        BOARD_COLORS.includes(currentColor) ? '' : 'selected'
      }`}
      title="Custom colour"
      onClick={(e) => {
        e.stopPropagation();
        const at = anchorAt(e.currentTarget);
        setColorPicking((current) =>
          current?.target === target ? null : { target, ...at }
        );
      }}
    />
  );

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
        .map(({ name: n, email, color }) => ({
          name: n.trim(),
          email: email.trim(),
          ...(color ? { color } : {}),
        }))
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

  // Keeps the editor mounted for one transition's worth of time so the
  // collapse can play before it unmounts.
  const beginCloseEditor = (boardId) => {
    setEditingBoardId(null);
    setEditingBoardCollaborators([]);
    setClosingBoardId(boardId);
    setTimeout(() => setClosingBoardId(null), 230);
  };

  const cancelEditingBoard = () => {
    if (editingBoardId) beginCloseEditor(editingBoardId);
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
    beginCloseEditor(board.id);
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
      <span className="sidebar-mini-label">Board name</span>
      <input
        type="text"
        placeholder="Board name..."
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={handleFormKeyDown}
        autoFocus
        className="new-board-input"
      />
      <span className="sidebar-mini-label">Collaborators</span>
      <div className="collaborators-section">
        {newBoardCollaborators.map((collab, idx) => (
          <div key={idx} className="collaborator-row">
            <div className="collab-name-wrap">
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
              {renderCollabDot('new-collab', collab, idx)}
            </div>
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
            {colorPicking?.target === 'new-collab' &&
              colorPicking.index === idx &&
              renderColorPicker(collab.color || DEFAULT_MEMBER_COLOR, (hex) =>
                setCollabColor('new-collab', idx, hex)
              )}
          </div>
        ))}
        <DashedButton
          small
          onClick={() =>
            setNewBoardCollaborators([
              ...newBoardCollaborators,
              { name: '', email: '' },
            ])
          }
        >
          + Add collaborator
        </DashedButton>
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
        {renderSpectrumDot('new-board', newBoardColor)}
        {colorPicking?.target === 'new-board' &&
          renderColorPicker(newBoardColor, setNewBoardColor)}
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
    const isClosing = closingBoardId === board.id;
    const openCount = countOpenTasks(board);

    return (
      <li
        key={board.id}
        className={`board-item ${isActive ? 'active' : ''} ${
          isEditing || isClosing ? 'editing' : ''
        }`}
        onClick={() =>
          dispatch({ type: 'SET_ACTIVE_BOARD', payload: board.id })
        }
      >
        <span className="board-dot" style={{ backgroundColor: board.color }} />
        {isEditing || isClosing ? (
          <div className={`board-editor-well ${isEditing ? 'open' : ''}`}>
          <div className="board-edit-content">
            <span className="sidebar-mini-label">Board name</span>
            <input
              type="text"
              value={editingBoardName}
              onChange={(e) => setEditingBoardName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="board-name-input"
            />
            <span className="sidebar-mini-label">Collaborators</span>
            <div
              className="collaborators-section"
              onClick={(e) => e.stopPropagation()}
            >
              {editingBoardCollaborators.map((collab, idx) => (
                <div key={idx} className="collaborator-row">
                  <div className="collab-name-wrap">
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
                    {renderCollabDot('edit-collab', collab, idx)}
                  </div>
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
                  {colorPicking?.target === 'edit-collab' &&
                    colorPicking.index === idx &&
                    renderColorPicker(
                      collab.color || DEFAULT_MEMBER_COLOR,
                      (hex) => setCollabColor('edit-collab', idx, hex)
                    )}
                </div>
              ))}
              <DashedButton
                small
                onClick={() =>
                  setEditingBoardCollaborators([
                    ...editingBoardCollaborators,
                    { name: '', email: '' },
                  ])
                }
              >
                + Add collaborator
              </DashedButton>
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
              {renderSpectrumDot('edit-board', editingBoardColor)}
              {colorPicking?.target === 'edit-board' &&
                renderColorPicker(editingBoardColor, setEditingBoardColor)}
            </div>
            <div className="board-edit-actions">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelEditingBoard();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  saveEditingBoard(board);
                }}
              >
                ✓ Ok
              </button>
            </div>
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
        {!isEditing && (
          <button
            type="button"
            className="board-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              startEditingBoard(board);
            }}
            title="Edit board"
          >
            ✎
          </button>
        )}
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
                              <DashedButton
                                small
                                onClick={() =>
                                  openForm({
                                    kind: 'group',
                                    projectId: project.id,
                                  })
                                }
                              >
                                + Create group
                              </DashedButton>
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
                  <DashedButton onClick={() => openForm({ kind: 'project' })}>
                    + Create Project
                  </DashedButton>
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
