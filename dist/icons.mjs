// One consistent SVG set, drawn in code; no remote assets or icon font.
const paths = {
  scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 7h3v3H7zm7 0h3v3h-3zM7 14h3v3H7zm7 0v3h3v-3h-1M3 12h18"/>',
  camera: '<path d="M8 6l1.5-2h5L16 6h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>',
  home: '<path d="M3 10l9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
  back: '<path d="M19 12H5m7-7l-7 7 7 7"/>',
  move: '<path d="M4 7h16m-4-4l4 4-4 4M20 17H4m4-4l-4 4 4 4"/>',
  pallet: '<path d="M3 17h18v4H3zM6 17v4m6-4v4m6-4v4M5 7h6v10H5zm8 0h6v10h-6zM8 3h8v4H8z"/>',
  order: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',
  associate: '<rect x="3" y="3" width="7" height="9" rx="1"/><path d="M5 6h3M5 9h2m7 2V8h5v8m-8 1h10v4H9v-4m5-2h5M4 16h4m-2-2v4"/>',
  location: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-5-5l5 5-5 5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',
};
export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.scan}</svg>`;
}
