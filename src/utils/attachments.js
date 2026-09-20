import { generateId } from './helpers';

export const ACCEPTED_TYPES =
  'image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,application/pdf,' +
  'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx';

// Attachments live inside the task, which lives inside the one localStorage
// blob that gets rewritten on every edit. Photos straight off a phone would
// eat the quota, so raster images are scaled down and re-encoded first.
const MAX_DIMENSION = 1400;
const QUALITY = 0.82;
export const MAX_STORED_BYTES = 1.5 * 1024 * 1024;

// Canvas would flatten an animated GIF to its first frame.
const REENCODE_EXEMPT = ['image/gif', 'image/svg+xml'];

export function isImage(type) {
  return typeof type === 'string' && type.startsWith('image/');
}

// Anything uploaded that isn't an image counts as a document.
export function isDocFile(attachment) {
  return !isImage(attachment?.type);
}

// Google links in a description count as documents too.
const GOOGLE_DOC_RE =
  /https?:\/\/(?:docs|drive|sheets|slides)\.google\.com\/[^\s)>'"]+/g;

const GOOGLE_LABELS = [
  ['/document/', 'Doc'],
  ['/spreadsheets/', 'Sheet'],
  ['/presentation/', 'Slides'],
  ['/forms/', 'Form'],
];

export function docLinksFrom(text) {
  if (!text) return [];
  const matches = text.match(GOOGLE_DOC_RE) || [];
  return matches.map((url) => ({
    url,
    name:
      GOOGLE_LABELS.find(([part]) => url.includes(part))?.[1] ??
      'Drive',
  }));
}

// A pill's label: the file name, at most 8 characters.
export function shortName(name) {
  const base = String(name || '');
  return base.length > 8 ? base.slice(0, 8) + '…' : base;
}

// data: URLs can't be opened as a top-level page, so hand the browser a
// blob URL instead. PDFs open in a tab; other types download.
export function openAttachment(attachment) {
  const dataUrl = attachment?.dataUrl;
  if (!dataUrl) return;
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.slice(meta.indexOf(':') + 1, meta.indexOf(';'));
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buf[i] = bytes.charCodeAt(i);
  const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
  if (mime === 'application/pdf') {
    window.open(blobUrl, '_blank', 'noopener');
  } else {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = attachment.name || 'attachment';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

// A base64 payload is about 4 chars per 3 bytes.
function approximateBytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.round((base64.length * 3) / 4);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

async function downscale(file) {
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

  let out = canvas.toDataURL('image/webp', QUALITY);
  // Older browsers ignore an unsupported type and hand back a PNG.
  if (!out.startsWith('data:image/webp')) {
    out = canvas.toDataURL('image/jpeg', QUALITY);
  }

  // Re-encoding a small graphic can make it bigger; keep whichever is smaller.
  return out.length < original.length ? out : original;
}

export async function fileToAttachment(file) {
  const type = file.type || '';
  const reencode = isImage(type) && !REENCODE_EXEMPT.includes(type);
  const dataUrl = reencode ? await downscale(file) : await readAsDataUrl(file);
  const bytes = approximateBytes(dataUrl);

  if (bytes > MAX_STORED_BYTES) {
    throw new Error(
      `${file.name || 'That file'} is ${formatBytes(bytes)} after compression, over the ${formatBytes(MAX_STORED_BYTES)} limit.`
    );
  }

  return {
    id: generateId(),
    name: file.name || 'Pasted image',
    type,
    size: bytes,
    dataUrl,
  };
}

// Pulls image files out of a paste, ignoring ordinary text pastes.
export function imageFilesFromPaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  return items
    .filter((item) => item.kind === 'file' && isImage(item.type))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}
