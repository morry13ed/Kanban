import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  BOARD_COLORS,
  DEFAULT_MEMBER_COLOR,
} from '../utils/helpers';
import ColorPicker from './ColorPicker';
import DashedButton from './DashedButton';
import './BoardEditModal.css';

// Centered board editor: name, collaborators (which is sharing), colour.
// Reuses the collaborator row and colour dot styling from the sidebar.
export default function BoardEditModal({ board, onClose }) {
  const { dispatch } = useApp();
  const [name, setName] = useState(board.name);
  const [color, setColor] = useState(board.color);
  const [collaborators, setCollaborators] = useState(
    (board.members || []).map((m) =>
      typeof m === 'string'
        ? { name: m, email: '' }
        : { name: m.name || '', email: m.email || '', color: m.color }
    )
  );

  // { target: 'collab', index } | { target: 'board' }, plus fixed coords.
  const [colorPicking, setColorPicking] = useState(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!colorPicking) return;
    const onDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setColorPicking(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colorPicking]);

  const anchorAt = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 222)),
      top: Math.min(rect.bottom + 6, window.innerHeight - 120),
    };
  };

  const save = () => {
    const members = collaborators
      .map(({ name: n, email, color: c }) => ({
        name: n.trim(),
        email: email.trim(),
        ...(c ? { color: c } : {}),
      }))
      .filter((c) => c.name);
    dispatch({
      type: 'UPDATE_BOARD',
      payload: {
        id: board.id,
        updates: { name: name.trim() || board.name, color, members },
      },
    });
    onClose();
  };

  const setCollab = (index, patch) =>
    setCollaborators((current) =>
      current.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit board</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-form">
          <div className="form-group">
            <label htmlFor="board-name">Board name</label>
            <input
              id="board-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Collaborators</label>
            <div className="collaborators-section">
              {collaborators.map((collab, idx) => (
                <div key={idx} className="collaborator-row">
                  <div className="collab-name-wrap">
                    <input
                      type="text"
                      placeholder="Name"
                      value={collab.name}
                      onChange={(e) => setCollab(idx, { name: e.target.value })}
                      className="new-board-input"
                    />
                    <button
                      type="button"
                      className="collab-color-dot"
                      style={{
                        backgroundColor: collab.color || DEFAULT_MEMBER_COLOR,
                      }}
                      title="Collaborator colour"
                      onClick={(e) => {
                        // Read the anchor before setState: the synthetic
                        // event's currentTarget is nulled once dispatch ends.
                        const at = anchorAt(e.currentTarget);
                        setColorPicking((current) =>
                          current?.target === 'collab' && current.index === idx
                            ? null
                            : { target: 'collab', index: idx, ...at }
                        );
                      }}
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={collab.email}
                    onChange={(e) => setCollab(idx, { email: e.target.value })}
                    className="new-board-input"
                  />
                </div>
              ))}
              <DashedButton
                small
                onClick={() =>
                  setCollaborators([...collaborators, { name: '', email: '' }])
                }
              >
                + Add collaborator
              </DashedButton>
            </div>
          </div>

          <div className="form-group">
            <label>Board colour</label>
            <div className="board-color-picker">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`board-color-dot ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <button
                type="button"
                className={`board-color-dot spectrum ${
                  BOARD_COLORS.includes(color) ? '' : 'selected'
                }`}
                title="Custom colour"
                onClick={(e) => {
                  const at = anchorAt(e.currentTarget);
                  setColorPicking((current) =>
                    current?.target === 'board'
                      ? null
                      : { target: 'board', ...at }
                  );
                }}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              ✓ Ok
            </button>
          </div>
        </div>

        {colorPicking && (
          <div
            className="picker-fixed"
            ref={pickerRef}
            style={{ left: colorPicking.left, top: colorPicking.top }}
          >
            <ColorPicker
              value={
                colorPicking.target === 'board'
                  ? color
                  : collaborators[colorPicking.index]?.color ||
                    DEFAULT_MEMBER_COLOR
              }
              onApply={(hex) => {
                if (colorPicking.target === 'board') setColor(hex);
                else setCollab(colorPicking.index, { color: hex });
                setColorPicking(null);
              }}
              onClose={() => setColorPicking(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
