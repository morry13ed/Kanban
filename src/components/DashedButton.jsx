import './DashedButton.css';

// The dashed "create something" affordance used across the sidebar:
// Create Project (default size), Create group / Add collaborator (small).
export default function DashedButton({ small = false, onClick, children }) {
  return (
    <button
      type="button"
      className={small ? 'btn-create-inline' : 'btn-create-project'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
