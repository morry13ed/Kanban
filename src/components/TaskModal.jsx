import { useState } from 'react';
import {
  LEVEL_MIN,
  LEVEL_MAX,
  LEVEL_DEFAULT,
  getPriority,
} from '../utils/helpers';
import './TaskModal.css';

export default function TaskModal({
  task,
  columns,
  defaultColumnId,
  members = [],
  onSave,
  onClose,
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task?.assignee || 'Unassigned');
  const [columnId, setColumnId] = useState(
    task?.columnId || defaultColumnId || ''
  );
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [impact, setImpact] = useState(task?.impact ?? LEVEL_DEFAULT);
  const [time, setTime] = useState(task?.time ?? LEVEL_DEFAULT);

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
      impact: Number(impact),
      time: Number(time),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

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
              <label htmlFor="task-column">Column</label>
              <select
                id="task-column"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="task-impact">
                Impact <span className="level-value">{impact}</span>
              </label>
              <input
                id="task-impact"
                type="range"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                step={1}
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="task-time">
                Time <span className="level-value">{time}</span>
              </label>
              <input
                id="task-time"
                type="range"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                step={1}
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="priority-readout">
            <span>Priority</span>
            <span className="priority-score">{priority}</span>
          </div>

          <div className="form-group">
            <label htmlFor="task-due">Due Date</label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

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
