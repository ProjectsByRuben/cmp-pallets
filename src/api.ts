export type Role = 'operator' | 'admin';
export type Profile = { employee_id: number; name: string; role: Role };
export type Employee = { id: number; name: string; pin_setup_required: boolean };
export type Bootstrap = {
  user: { id: number; name: string };
  requires_pin: boolean;
  employees: Employee[];
  csrf_token: string;
};
export type UnlockResult =
  | { ok: true; token: string; profile: Profile }
  | { ok: false; error: string; needs_setup?: boolean };
export type ScanKind = 'production' | 'pallet' | 'location';
export type LocationSummary = { id: number; code: string; name: string };
export type ScanSummary = {
  kind: ScanKind; id: number; code: string; title: string;
  state_label?: string; active?: boolean; location?: LocationSummary | null;
};
export type ScanRecord = ScanSummary & {
  quantity?: number; uom?: string; lot?: string | null; revision?: string;
  items: ScanSummary[]; next_offset: number | null;
};
export type LookupResult = { ok: true; record: ScanRecord } | { ok: false; error: string };

export type Association = {
  request_id: string; pallet_id: number; pallet_revision: string;
  productions: { id: number; revision: string }[]; location_id?: number;
};
export type AssociationResult = { ok: true; pallet_code: string; added: number } | { ok: false; error: string; conflict?: boolean };

export type Movement = {
  request_id: string; pallets: { id: number; revision: string }[]; location_id: number;
};
export type MovementResult = { ok: true; moved: number; unchanged: number; location_code: string } | { ok: false; error: string; conflict?: boolean };

export type PalletCreation = { request_id: string; location_id?: number };
export type PalletCreated = { ok: true; pallet_id: number; pallet_code: string };
export type PalletLabel = { ok: true; pallet_id: number; code: string; qr_payload: string; png_base64: string };

export class ApiError extends Error {
  constructor(message: string, public kind: 'session' | 'access' | 'network' | 'business') {
    super(message);
  }
}

export type LocationPage = { ok: true; items: LocationSummary[]; next_offset: number | null };

export interface AccessApi {
  locations(token: string, query?: string, offset?: number): Promise<LocationPage>;
  createPallet(token: string, proposal: PalletCreation): Promise<PalletCreated>;
  label(token: string, palletId: number): Promise<PalletLabel>;
  associate(token: string, proposal: Association): Promise<AssociationResult>;
  move(token: string, proposal: Movement): Promise<MovementResult>;
  bootstrap(): Promise<Bootstrap>;
  login(login: string, password: string): Promise<void>;
  unlock(employeeId: number | null, pin: string): Promise<UnlockResult>;
  setupPin(employeeId: number, pin: string, confirmation: string): Promise<UnlockResult>;
  profile(token: string): Promise<Profile>;
  lock(token: string): Promise<void>;
  logout(): Promise<void>;
  lookup(token: string, code: string, offset?: number): Promise<LookupResult>;
}

declare const __ODOO_DB__: string;

function profile(value: unknown): Profile {
  const item = value as Partial<Profile> | null;
  if (!item || !Number.isInteger(item.employee_id) || item.employee_id! <= 0 || typeof item.name !== 'string' || !['operator', 'admin'].includes(item.role || '')) {
    throw new ApiError('La respuesta de acceso no es válida. Vuelve a identificarte.', 'access');
  }
  return item as Profile;
}

export class OdooAccessApi implements AccessApi {
  private csrf = '';
  private prepared = false;

  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}

  private async rpc<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher('/api/' + path, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new ApiError('No se puede conectar con Odoo. Comprueba la conexión y vuelve a intentarlo.', 'network');
    }
    if (!response.ok) {
      throw new ApiError('Odoo no está disponible. Vuelve a intentarlo.', 'network');
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('No se ha recibido respuesta de Odoo. Vuelve a intentarlo.', 'network');
    }
    if (!data || typeof data !== 'object') throw new ApiError('La respuesta de Odoo no es válida.', 'network');
    if (data.error) {
      const name = typeof data.error.data?.name === 'string' ? data.error.data.name : '';
      if (name.endsWith('SessionExpiredException')) {
        throw new ApiError('La sesión ha caducado. Accede de nuevo.', 'session');
      }
      if (path === 'web/session/authenticate') {
        if (name.endsWith('AccessDenied')) throw new ApiError('Usuario o contraseña incorrectos.', 'access');
        throw new ApiError('Odoo no ha podido iniciar la sesión. Vuelve a intentarlo.', 'network');
      }
      const safe = name.endsWith('AccessError') || name.endsWith('UserError');
      throw new ApiError(safe && typeof data.error.data.message === 'string' ? data.error.data.message : 'No se ha podido completar el acceso.', name.endsWith('UserError') ? 'business' : 'access');
    }
    // Odoo 16 session.destroy returns None; its JSON dispatcher omits result.
    // Accept that exact successful void envelope only for this native endpoint.
    if (path === 'web/session/destroy' && data.jsonrpc === '2.0' && data.id === 1 && !Object.hasOwn(data, 'result')) {
      return undefined as T;
    }
    if (!Object.hasOwn(data, 'result')) {
      throw new ApiError('La respuesta de Odoo no es válida.', 'network');
    }
    return data.result as T;
  }

  private async prepareSession(): Promise<void> {
    // A fresh browser must select the target database even on a multi-database
    // Odoo server. Use the native login page through a fixed proxy alias; no
    // credentials are sent and its HTML is never executed or injected.
    if (!this.prepared) {
      try {
        const response = await this.fetcher('/api/session/prepare', {
          credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error('session unavailable');
        this.prepared = true;
      } catch {
        throw new ApiError('No se puede conectar con Odoo. Comprueba la conexión y vuelve a intentarlo.', 'network');
      }
    }
  }

  async bootstrap(): Promise<Bootstrap> {
    await this.prepareSession();
    const data = await this.rpc<Bootstrap>('cmp_pallets/access/bootstrap');
    if (!data || typeof data.csrf_token !== 'string' || !data.user || typeof data.user.name !== 'string' || typeof data.requires_pin !== 'boolean' || !Array.isArray(data.employees)
      || data.employees.some(item => !Number.isInteger(item.id) || typeof item.name !== 'string' || typeof item.pin_setup_required !== 'boolean')) {
      throw new ApiError('La respuesta de acceso no es válida.', 'access');
    }
    this.csrf = data.csrf_token;
    return data;
  }

  async login(login: string, password: string): Promise<void> {
    this.csrf = '';
    // Logout clears session.db too. Re-select the configured database before
    // authenticating so installed session_info extensions have request.env.
    await this.prepareSession();
    const result = await this.rpc<{ uid?: number }>('web/session/authenticate', { db: __ODOO_DB__, login, password });
    if (!result?.uid) throw new ApiError('Odoo no ha confirmado el acceso con esta cuenta.', 'access');
    this.prepared = true;
  }

  private async identify(action: string, values: Record<string, unknown>): Promise<UnlockResult> {
    const data = await this.rpc<UnlockResult>('cmp_pallets/access/' + action, { ...values, csrf_token: this.csrf });
    if (data?.ok === true && typeof data.token === 'string' && data.token) {
      return { ...data, profile: profile(data.profile) };
    }
    if (data?.ok === false && typeof data.error === 'string') return data;
    throw new ApiError('La respuesta de identificación no es válida.', 'access');
  }

  unlock(employeeId: number | null, pin: string): Promise<UnlockResult> {
    return this.identify('unlock', { employee_id: employeeId, pin });
  }

  setupPin(employeeId: number, pin: string, confirmation: string): Promise<UnlockResult> {
    return this.identify('setup_pin', { employee_id: employeeId, pin, confirmation });
  }

  async profile(token: string): Promise<Profile> {
    return profile(await this.rpc('cmp_pallets/access/profile', { token, csrf_token: this.csrf }));
  }

  async lock(token: string): Promise<void> {
    await this.rpc('cmp_pallets/access/lock', { token, csrf_token: this.csrf });
  }

  async logout(): Promise<void> {
    try {
      await this.rpc('web/session/destroy');
    } catch (reason) {
      // An already expired session has no account left to sign out of.
      if (!(reason instanceof ApiError) || reason.kind !== 'session') throw reason;
    }
    this.csrf = '';
    this.prepared = false;
  }

  async associate(token: string, proposal: Association): Promise<AssociationResult> {
    const result = await this.rpc<AssociationResult>('cmp_pallets/associate', { ...proposal, token, csrf_token: this.csrf });
    if (result?.ok === true && typeof result.pallet_code === 'string' && Number.isInteger(result.added) && result.added >= 0) return result;
    if (result?.ok === false && typeof result.error === 'string') return result;
    // An invalid response cannot tell us whether the operation committed.
    throw new ApiError('No se ha confirmado el resultado. Reintenta la misma petición.', 'network');
  }

  async move(token: string, proposal: Movement): Promise<MovementResult> {
    const result = await this.rpc<MovementResult>('cmp_pallets/move', { ...proposal, token, csrf_token: this.csrf });
    if (result?.ok === true && typeof result.location_code === 'string' && Number.isInteger(result.moved) && result.moved >= 0
      && Number.isInteger(result.unchanged) && result.unchanged >= 0) return result;
    if (result?.ok === false && typeof result.error === 'string') return result;
    throw new ApiError('No se ha confirmado el traslado. Reintenta la misma petición.', 'network');
  }

  async locations(token: string, query = '', offset = 0): Promise<LocationPage> {
    const result = await this.rpc<LocationPage>('cmp_pallets/locations', { token, query, offset, csrf_token: this.csrf });
    if (result?.ok === true && Array.isArray(result.items) && result.items.length <= 20
      && result.items.every(item => Number.isInteger(item.id) && item.id > 0 && typeof item.code === 'string' && typeof item.name === 'string')
      && (result.next_offset === null || Number.isInteger(result.next_offset))) return result;
    throw new ApiError('No se han podido consultar las ubicaciones.', 'network');
  }

  async createPallet(token: string, proposal: PalletCreation): Promise<PalletCreated> {
    const result = await this.rpc<PalletCreated>('cmp_pallets/create', { ...proposal, token, csrf_token: this.csrf });
    if (result?.ok === true && Number.isInteger(result.pallet_id) && result.pallet_id > 0 && typeof result.pallet_code === 'string' && /^P\d{2}-\d{5,}$/.test(result.pallet_code)) return result;
    throw new ApiError('No se ha confirmado la creación. Reintenta la misma petición.', 'network');
  }

  async label(token: string, palletId: number): Promise<PalletLabel> {
    const result = await this.rpc<PalletLabel>('cmp_pallets/label', { pallet_id: palletId, token, csrf_token: this.csrf });
    if (result?.ok === true && result.pallet_id === palletId && typeof result.code === 'string'
      && /^P\d{2}-\d{5,}$/.test(result.code) && result.qr_payload === 'CMP:PALLET:' + result.code
      && typeof result.png_base64 === 'string' && result.png_base64.startsWith('iVBOR')
      && result.png_base64.length < 1000000 && /^[A-Za-z0-9+/=]+$/.test(result.png_base64)) return result;
    throw new ApiError('No se ha podido obtener la etiqueta del pallet.', 'network');
  }

  async lookup(token: string, code: string, offset = 0): Promise<LookupResult> {
    const result = await this.rpc<LookupResult>('cmp_pallets/lookup', { token, code, offset, csrf_token: this.csrf });
    if (result?.ok === false && typeof result.error === 'string') return result;
    if (result?.ok === true && validSummary(result.record) && Array.isArray(result.record.items)
      && result.record.items.every(validSummary)
      && (result.record.next_offset === null || Number.isInteger(result.record.next_offset))) return result;
    throw new ApiError('La respuesta de consulta no es válida.', 'access');
  }
}

function validSummary(value: unknown): value is ScanSummary {
  const item = value as Partial<ScanSummary> | null;
  return !!item && ['production', 'pallet', 'location'].includes(item.kind || '') && Number.isInteger(item.id)
    && typeof item.code === 'string' && typeof item.title === 'string';
}
