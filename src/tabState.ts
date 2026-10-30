import type { Association, Movement, PalletCreation, LocationSummary, ScanRecord } from './api';

const ACCESS = 'cmp.pallets.tab.access.v1';
const WORK = 'cmp.pallets.tab.work.v1';
export type SavedAccess = { page: 'login' | 'choose' | 'pin' | 'ready'; userId?: number; employeeId?: number; token?: string };
export type PendingOperation = { kind: 'associate'; data: Association } | { kind: 'move'; data: Movement };
export type CreationDraft = { location: LocationSummary | null; proposal: PalletCreation | null };
export type SavedWork = {
  selected: ScanRecord[]; pallets: ScanRecord[]; targetId: number | null; destination: ScanRecord | null;
  needsLocation: number | null; pending: PendingOperation | null; record: ScanRecord | null; previous: string[];
  creation: CreationDraft | null; labelPallet: { id: number; code: string } | null; scrollY: number;
};
const id = (v: unknown) => Number.isInteger(v) && (v as number) > 0;
function read(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key);
    return raw && raw.length < 2000000 ? JSON.parse(raw) : null;
  } catch { return null; }
}
function write(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled/full; normal access still works. */ }
}
export function clearTab() {
  try { sessionStorage.removeItem(ACCESS); sessionStorage.removeItem(WORK); } catch { /* Optional browser storage. */ }
}
export function readAccess(): SavedAccess | null {
  const v = read(ACCESS) as SavedAccess | null;
  if (!v || !['login', 'choose', 'pin', 'ready'].includes(v.page)) return null;
  if (v.page !== 'login' && !id(v.userId)) return null;
  if (v.page === 'pin' && !id(v.employeeId)) return null;
  if (v.page === 'ready' && (!id(v.employeeId) || typeof v.token !== 'string' || !v.token || v.token.length > 256)) return null;
  return v;
}
export function saveAccess(value: SavedAccess) { write(ACCESS, value); }
function record(v: unknown): v is ScanRecord {
  const r = v as ScanRecord | null;
  return !!r && id(r.id) && ['production', 'pallet', 'location'].includes(r.kind) && typeof r.code === 'string'
    && typeof r.title === 'string' && Array.isArray(r.items) && r.items.length <= 5000;
}
export function readWork(token: string): SavedWork | null {
  const saved = read(WORK) as { owner?: string; state?: SavedWork } | null;
  const s = saved?.state;
  if (saved?.owner !== token || !s || !Array.isArray(s.selected) || s.selected.length > 100 || !s.selected.every(record)
    || !Array.isArray(s.pallets) || s.pallets.length > 100 || !s.pallets.every(record)
    || (s.record !== null && !record(s.record)) || (s.destination !== null && !record(s.destination))
    || !Array.isArray(s.previous) || s.previous.length > 20 || !s.previous.every(x => typeof x === 'string')
    || (s.pending !== null && (!s.pending || !['associate', 'move'].includes(s.pending.kind) || !s.pending.data || typeof s.pending.data.request_id !== 'string'))
    || (s.creation !== null && (!s.creation || (s.creation.proposal !== null && typeof s.creation.proposal?.request_id !== 'string')))
    || (s.labelPallet !== null && (!id(s.labelPallet?.id) || typeof s.labelPallet.code !== 'string'))) return null;
  return s;
}
export function saveWork(token: string, state: SavedWork) {
  write(WORK, { owner: token, state: { ...state,
    selected: state.selected.map(r => ({ ...r, items: [], next_offset: null })),
    pallets: state.pallets.map(r => ({ ...r, items: [], next_offset: null })),
  } });
}
export function clearWork() { try { sessionStorage.removeItem(WORK); } catch { /* Optional browser storage. */ } }
