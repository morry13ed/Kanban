// Shared inline icons for task chips, used by the desktop card and the
// mobile row.

export function BugIcon() {
  return (
    <svg className="bug-icon" viewBox="0 0 16 16" aria-hidden="true">
      {/* Antennae and legs stay thin; the body is solid so the silhouette
          still reads as a beetle at 11px rather than a starburst. */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <path d="M5.7 2.7 7.1 4.6M10.3 2.7 8.9 4.6" />
        <path d="M4.7 8.2H2.1M4.9 11.3 2.9 12.6M11.3 8.2h2.6M11.1 11.3l2 1.3" />
      </g>
      <rect x="4.7" y="4.5" width="6.6" height="9" rx="3.3" fill="currentColor" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg className="status-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2.8v10.4c0 .8.9 1.3 1.6.9l8-5.2c.6-.4.6-1.4 0-1.8l-8-5.2c-.7-.4-1.6.1-1.6.9z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg className="status-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3.4" height="11" rx="1.2" fill="currentColor" />
      <rect x="9.1" y="2.5" width="3.4" height="11" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function ClipIcon() {
  return (
    <svg
      className="clip-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.29 7.37l-6.13 6.13a4 4 0 0 1-5.66-5.66l6.13-6.13a2.67 2.67 0 0 1 3.77 3.77l-6.13 6.13a1.33 1.33 0 0 1-1.89-1.89l5.66-5.65" />
    </svg>
  );
}

export function BulbIcon() {
  return (
    <svg
      className="bulb-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1.8a4.4 4.4 0 0 0-2.6 7.95c.55.42.9 1 .95 1.65h3.3c.05-.65.4-1.23.95-1.65A4.4 4.4 0 0 0 8 1.8z" />
      <path d="M6.6 13.6h2.8" />
    </svg>
  );
}

export function GaugeIcon() {
  return (
    <svg
      className="gauge-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M2.5 12a5.5 5.5 0 0 1 11 0" />
      <path d="M8 12l2.6-3.1" />
    </svg>
  );
}

// Material Symbols "delete", outlined - light weight to match the app's
// quiet icon language.
export function TrashIcon() {
  return (
    <svg
      className="trash-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z" />
    </svg>
  );
}
