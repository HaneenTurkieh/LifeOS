// One-time migration helper for the Aurora → Nuvora rename: every
// localStorage/sessionStorage key used to be prefixed `aurora_` and is
// moving to `nuvora_`. Call this once (e.g. at module load or on first
// read) for each old/new key pair — if something's sitting under the
// old key and nothing's under the new one yet, it gets copied over and
// the old key is removed. After that, every read can just use the new
// key directly, no fallback logic needed anywhere else.
export function migrateStorageKey(storage, oldKey, newKey) {
  try {
    if (storage.getItem(newKey) !== null) return;
    const legacy = storage.getItem(oldKey);
    if (legacy !== null) {
      storage.setItem(newKey, legacy);
      storage.removeItem(oldKey);
    }
  } catch (_) { /* storage unavailable (private mode, etc.) — nothing to migrate */ }
}
