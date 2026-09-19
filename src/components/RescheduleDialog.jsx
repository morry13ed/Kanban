import { useState } from 'react';
import './ConfirmDialog.css';

// Shown when a task the due date auto-activated is moved back to a regular
// column: rescheduling (or clearing the date) keeps the loop honest, and
// cancelling leaves the task where it was.
export default function RescheduleDialog({
  initialDate,
  onApply,
  onRemove,
  onCancel,
}) {
  const [date, setDate] = useState(initialDate || '');

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title">Please change the due date</h3>
        <p className="confirm-message">
          This task was activated by its due date. Pick a new date and it will
          come back to the active column when the date arrives.
        </p>
        <input
          type="date"
          className="reschedule-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          autoFocus
        />
        <div className="confirm-actions">
          <button
            type="button"
            className="btn btn-ghost reschedule-remove"
            onClick={onRemove}
          >
            Remove due date
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!date || date === initialDate}
            onClick={() => onApply(date)}
          >
            ✓ Ok
          </button>
        </div>
      </div>
    </div>
  );
}
