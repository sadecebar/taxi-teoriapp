import { storage } from './storage.js';
// ─── Per-installation ID ──────────────────────────────────────────────────────
// Each browser / PWA instance gets one stable UUID stored in storage.
// All Supabase rows and storage flags are keyed to this ID so that
// progress on different devices never interferes with each other.

const STORAGE_KEY = "taxi-teori-installation-id";

function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getInstallationId() {
  let id = storage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateUUID();
    storage.setItem(STORAGE_KEY, id);
  }
  return id;
}
