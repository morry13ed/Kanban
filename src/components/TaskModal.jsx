import { useState, useRef, useEffect } from 'react';
import {
  LEVEL_MIN,
  LEVEL_MAX,
  LEVEL_DEFAULT,
  getPriority,
  roundLevel,
  formatLevel,
} from '../utils/helpers';
import {
  ACCEPTED_TYPES,
  fileToAttachment,
  imageFilesFromPaste,
  isImage,
} from '../utils/attachments';
import './TaskModal.css';

function ImagePlusIcon() {
  return (
    <svg
      className="attach-icon"
      viewBox="0 0 20 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="2.5" width="11.5" height="11" rx="2.5" />
      <circle cx="5" cy="6.3" r="1.15" />
      <path d="M2 11.4 5.6 8.2l2.4 2.1 2-1.8 2.5 2.4" />
      <path d="M16.5 6.2v5.6M13.7 9h5.6" />
    </svg>
  );
}

function FileGlyph({ name }) {
  const ext = (name.split('.').pop() || '').slice(0, 4).toUpperCase();
  return <span className="attachment-ext">{ext || 'FILE'}</span>;
}

export default function TaskModal({
  task,
  defaultColumnId,
  members = [],
  onSave,
  onClose,
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task?.assignee || 'Unassigned');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  // Not editable here: new tasks land in the column you added them from, and
  // existing ones move by dragging or the arrows on the card.
  const columnId = task?.columnId || defaultColumnId || '';
  const [impact, setImpact] = useState(task?.impact ?? LEVEL_DEFAULT);
  const [time, setTime] = useState(task?.time ?? LEVEL_DEFAULT);
  const [isBug, setIsBug] = useState(task?.isBug ?? false);
  const [attachments, setAttachments] = useState(task?.attachments ?? []);
  const [attachError, setAttachError] = useState('');
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPreview(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  const addFiles = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;

    setAttachError('');
    const accepted = [];
    const failures = [];

    for (const file of list) {
      try {
        accepted.push(await fileToAttachment(file));
      } catch (err) {
        failures.push(err.message);
      }
    }

    if (accepted.length > 0) {
      setAttachments((current) => [...current, ...accepted]);
    }
    if (failures.length > 0) setAttachError(failures[0]);
  };

  const handleFileInput = (e) => {
    addFiles(e.target.files);
    // Let the same file be picked again after removing it.
    e.target.value = '';
  };

  // Only intercept a paste that actually carries an image; text pastes are
  // left alone.
  const handlePaste = (e) => {
    const images = imageFilesFromPaste(e);
    if (images.length === 0) return;
    e.preventDefault();
    addFiles(images);
  };

  const removeAttachment = (id) => {
    setAttachments((current) => current.filter((a) => a.id !== id));
    setAttachError('');
  };

  const assigneeOptions = ['Unassigned', ...members];
  const priority = getPriority({ impact, time });

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      title: trimmed,
      description: description.trim(),
      assignee,
      columnId,
      dueDate,
      impact: roundLevel(impact),
      time: roundLevel(time),
      isBug,
      attachments,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        <div className="modal-header">
          <h3>{task ? 'Edit Task' : 'New Task'}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="task-title">Title *</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-desc">Description</label>
            <div className="description-field">
              <textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />

              <div className="attachment-bar">
                {attachments.map((file) => (
                  <span key={file.id} className="attachment-thumb">
                    {isImage(file.type) ? (
                      <button
                        type="button"
                        className="attachment-open"
                        title={`Open ${file.name}`}
                        onClick={() => setPreview(file)}
                      >
                        <img src={file.dataUrl} alt={file.name} />
                      </button>
                    ) : (
                      <FileGlyph name={file.name} />
                    )}
                    <button
                      type="button"
                      className="attachment-remove"
                      title={`Remove ${file.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(file.id);
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  className="attachment-add"
                  title="Add an image or PDF"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlusIcon />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            {attachError && (
              <span className="attachment-error">{attachError}</span>
            )}
          </div>

          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={isBug}
              onChange={(e) => setIsBug(e.target.checked)}
            />
            Bug
          </label>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="task-assignee">Assignee</label>
              <select
                id="task-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                {assigneeOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="task-due">Due date</label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="task-impact">
                Impact <span className="level-value">{formatLevel(impact)}</span>
              </label>
              <input
                id="task-impact"
                type="range"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                step="any"
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="task-duration">
                Duration{' '}
                <span className="level-value">{formatLevel(time)}</span>
              </label>
              <input
                id="task-duration"
                type="range"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                step="any"
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="priority-readout">
            <span>Priority</span>
            <span className="priority-score">{priority}</span>
          </div>

          {preview && (
            <div className="lightbox" onClick={() => setPreview(null)}>
              <img
                src={preview.dataUrl}
                alt={preview.name}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="lightbox-close"
                title="Close"
                onClick={() => setPreview(null)}
              >
                ×
              </button>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
