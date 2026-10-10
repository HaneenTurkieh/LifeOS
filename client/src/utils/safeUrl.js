// utils/safeUrl.js
// User-typed links (a project link in the CV Builder, an internship
// listing) used to go straight into <a href>. A value like
// `javascript:alert(1)` would then run script in the page the moment it was
// clicked. This only lets http(s) and mailto through, and adds https:// to
// a bare "linkedin.com/in/me" so it behaves like the person meant.
// Returns undefined for anything else, which renders an inert <a>.
export function safeUrl(value) {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : undefined;
  } catch (_) {
    return undefined;
  }
}
