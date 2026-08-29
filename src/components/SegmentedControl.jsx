import './SegmentedControl.css';

// Generic pill toggle. Two sizes: the default sits in forms, `small` fits
// inline inside a column header. `options` is [{ value, label, hint }].
export default function SegmentedControl({
  options,
  value,
  onChange,
  small = false,
}) {
  return (
    <div className={`type-toggle ${small ? 'small' : ''}`}>
      {options.map((option) => (
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
