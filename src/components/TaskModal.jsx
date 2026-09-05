import { useState, useRef, useEffect } from 'react';
import {
  LEVEL_MIN,
  LEVEL_MAX,
  LEVEL_DEFAULT,
  getPriority,
  roundLevel,
  formatLevel,
  STATUS_NONE,
  isActiveColumn,
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

function ChevronIcon() {
  return (
    <svg
      className="select-chevron"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 6.2 4 4 4-4" />
    </svg>
  );
}

export default function TaskModal({
  task,
  defaultColumnId,
  columns = [],
  members = [],
  memberColorOf = () => undefined,
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
  const inActiveColumn = isActiveColumn(
    columns.find((c) => c.id === columnId)
  );
  const [impact, setImpact] = useState(task?.impact ?? LEVEL_DEFAULT);
  const [time, setTime] = useState(task?.time ?? LEVEL_DEFAULT);
  const [demand, setDemand] = useState(task?.demand ?? LEVEL_MIN);
  const [isBug, setIsBug] = useState(task?.isBug ?? false);
  const [isFeature, setIsFeature] = useState(task?.isFeature ?? false);
  // Status is set by column transfers (and the card chip), not edited here.
  const status = task?.status ?? STATUS_NONE;
  const [completion, setCompletion] = useState(task?.completion ?? 0);
  const [attachments, setAttachments] = useState(task?.attachments ?? []);
  const [attachError, setAttachError] = useState('');
  const [preview, setPreview] = useState(null);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const assigneeRef = useRef(null);
  const fileInputRef = useRef(null);

  // The assignee menu dismisses on a click anywhere else.
  useEffect(() => {
    if (!assigneeMenuOpen) return;
    const onPointerDown = (e) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) {
        setAssigneeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [assigneeMenuOpen]);

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
  const score = getPriority({ impact, time, demand });

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
      demand: roundLevel(demand),
      isBug,
      isFeature,
      attachments,
      status,
      completion: Math.round(completion),
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

          <div className="form-checkbox-row">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={isBug}
                onChange={(e) => setIsBug(e.target.checked)}
              />
              Bug
            </label>

            <label
              className="form-checkbox"
              title="A new feature idea, usually meaning research to do"
            >
              <input
                type="checkbox"
                checked={isFeature}
                onChange={(e) => setIsFeature(e.target.checked)}
              />
              Feature
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="task-assignee">Assignee</label>
              <div className="assignee-field" ref={assigneeRef}>
                <button
                  type="button"
                  id="task-assignee"
                  className="assignee-select"
                  onClick={() => setAssigneeMenuOpen((open) => !open)}
                >
                  <span className="assignee-select-value">{assignee}</span>
                  <ChevronIcon />
                </button>

                {assigneeMenuOpen && (
                  <div className="assignee-menu">
                    {assigneeOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`assignee-menu-item ${
                          option === assignee ? 'active' : ''
                        }`}
                        onClick={() => {
                          setAssignee(option);
                          setAssigneeMenuOpen(false);
                        }}
                      >
                        {option !== 'Unassigned' && (
                          <span
                            className="assignee-menu-dot"
                            style={{ backgroundColor: memberColorOf(option) }}
                          />
                        )}
                        <span className="assignee-menu-name">{option}</span>
                        {option === assignee && (
                          <span className="assignee-menu-check">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

              </div>
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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="task-demand">
                Demand{' '}
                <span className="level-value">{formatLevel(demand)}</span>
              </label>
              <input
                id="task-demand"
                type="range"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                step="any"
                value={demand}
                onChange={(e) => setDemand(Number(e.target.value))}
              />
            </div>

            <div className="form-group score-group">
              <div className="priority-readout">
                <span>Score</span>
                <span className="priority-score">{score}</span>
              </div>
            </div>
          </div>

          {inActiveColumn && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="task-completion">
                  Completion{' '}
                  <span className="level-value">
                    {Math.round(completion)}%
                  </span>
                </label>
                <input
                  id="task-completion"
                  type="range"
                  min="0"
                  max="100"
                  step="any"
                  value={completion}
                  onChange={(e) => setCompletion(Number(e.target.value))}
                />
              </div>
            </div>
          )}


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
