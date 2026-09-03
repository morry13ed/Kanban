import { useState } from 'react';
import { hslToHex, hexHue, isValidHex } from '../utils/helpers';
import './ColorPicker.css';

// Tiny colour popover: preview swatch, hex field, hue slider, cancel/apply.
// The hue slider produces a vivid tone; the hex field accepts anything.
export default function ColorPicker({ value, onApply, onClose }) {
  const [hex, setHex] = useState(value);
  const [hexText, setHexText] = useState(value);

  const applyHue = (h) => {
    const next = hslToHex(Number(h), 70, 52);
    setHex(next);
    setHexText(next);
  };

  const applyHexText = (raw) => {
    setHexText(raw);
    const candidate = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    if (isValidHex(candidate)) setHex(candidate.toLowerCase());
  };

  return (
    <div className="color-popover" onClick={(e) => e.stopPropagation()}>
      <div className="color-popover-row">
        <span className="color-popover-preview" style={{ background: hex }} />
        <input
          type="text"
          className="color-popover-hex"
          value={hexText}
          onChange={(e) => applyHexText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onApply(hex);
            if (e.key === 'Escape') onClose();
          }}
          spellCheck={false}
        />
        <button
          type="button"
          className="color-popover-btn"
          title="Cancel"
          onClick={onClose}
        >
          ×
        </button>
        <button
          type="button"
          className="color-popover-btn confirm"
          title="Apply colour"
          onClick={() => onApply(hex)}
        >
          ✓
        </button>
      </div>
      <input
        type="range"
        className="hue-slider"
        min={0}
        max={360}
        step={1}
        value={hexHue(hex)}
        onChange={(e) => applyHue(e.target.value)}
      />
    </div>
  );
}
