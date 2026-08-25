import { COLUMN_TYPES } from '../utils/helpers';
import './ColumnTypeToggle.css';

// Two sizes: the default sits in the add-column form, `small` in the inline
// column editor where it has to fit inside the header.
export default function ColumnTypeToggle({ value, onChange, small = false }) {
  return (
    <div className={`type-toggle ${small ? 'small' : ''}`}>
      {COLUMN_TYPES.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`type-toggle-btn ${value === option.value ? 'active' : ''}`}
          title={option.hint}
          onClick={(e) => {
            e.stopPropagation();
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
