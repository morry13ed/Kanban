import { useState } from 'react';
import { hslToHex, hexHue, hexLightness, isValidHex } from '../utils/helpers';
import './ColorPicker.css';

// Tiny colour popover: preview swatch, hex field, hue and brightness
// sliders, cancel/apply. Brightness up gives pastels of the chosen hue;
// the hex field accepts anything.
export default function ColorPicker({ value, onApply, onClose }) {
  const [hex, setHex] = useState(value);
  const [hexText, setHexText] = useState(value);

  const hue = hexHue(hex);
  const lightness = Math.min(90, Math.max(15, hexLightness(hex)));

  const applyHsl = (h, l) => {
    const next = hslToHex(h, 70, l);
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
        value={hue}
        onChange={(e) => applyHsl(Number(e.target.value), lightness)}
      />
      <input
        type="range"
        className="lightness-slider"
        title="Brightness"
        min={15}
        max={90}
        step={1}
        value={lightness}
        onChange={(e) => applyHsl(hue, Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, hsl(${hue}, 70%, 15%), hsl(${hue}, 70%, 52%), hsl(${hue}, 70%, 90%))`,
        }}
      />
    </div>
  );
}
