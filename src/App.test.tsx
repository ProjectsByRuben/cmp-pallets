import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ApiError, OdooAccessApi, type AccessApi, type Bootstrap, type ScanRecord } from './api';

const initial: Bootstrap = {
  user: { id: 10, name: 'FABRICA PRUEBAS' }, requires_pin: true, csrf_token: 'synthetic-csrf',
  employees: [{ id: 20, name: 'Operario de prueba', pin_setup_required: false }],
};
const identity = { employee_id: 20, name: 'Operario de prueba', role: 'operator' as const };

function apiMock() {
  return {
    bootstrap: vi.fn().mockResolvedValue(initial), login: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn().mockResolvedValue({ ok: true, token: 'synthetic-token', profile: identity }),
    setupPin: vi.fn().mockResolvedValue({ ok: true, token: 'synthetic-token', profile: identity }),
    profile: vi.fn().mockResolvedValue(identity), lock: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    locations: vi.fn<AccessApi['locations']>().mockResolvedValue({ ok: true, items: [], next_offset: null }),
    createPallet: vi.fn<AccessApi['createPallet']>().mockResolvedValue({ ok: true, pallet_id: 2, pallet_code: 'P26-00001' }),
    label: vi.fn<AccessApi['label']>().mockResolvedValue({ ok: true, pallet_id: 2, code: 'P26-00001', qr_payload: 'CMP:PALLET:P26-00001', png_base64: 'iVBORw0KGgo=' }),
    move: vi.fn<AccessApi['move']>().mockResolvedValue({ ok: true, moved: 1, unchanged: 0, location_code: 'TEST-DESTINO' }),
    associate: vi.fn<AccessApi['associate']>().mockResolvedValue({ ok: true, pallet_code: 'P26-00001', added: 1 }),
    lookup: vi.fn().mockResolvedValue({ ok: false, error: 'Código no encontrado' }),
  } satisfies AccessApi;
}

async function choose(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText('Empleado'), '20');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('operator access screen', () => {
  it('uses an existing Odoo session, selects an employee and verifies a PIN', async () => {
    const api = apiMock();
    const user = userEvent.setup();
    render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('PIN'), '4826');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Escanear' })).toBeVisible();
    expect(screen.getByText('Operario')).toBeVisible();
    expect(api.unlock).toHaveBeenCalledWith(20, '4826');
    expect(api.login).not.toHaveBeenCalled();
  });

  it('requests account credentials only when the Odoo session is missing', async () => {
    const api = apiMock();
    api.bootstrap.mockRejectedValueOnce(new ApiError('Sesión caducada', 'session'));
    const user = userEvent.setup();
    render(<App api={api}/>);
    await user.type(await screen.findByLabelText('Usuario Odoo'), 'fabrica');
    await user.type(screen.getByLabelText('Contraseña'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Acceder' }));
    expect(await screen.findByLabelText('Empleado')).toBeVisible();
    expect(api.login).toHaveBeenCalledWith('fabrica', 'synthetic-password');
  });

  it('clears a rejected account password and stays on the login form', async () => {
    const api = apiMock();
    api.bootstrap.mockRejectedValueOnce(new ApiError('Sesión caducada', 'session'));
    api.login.mockRejectedValueOnce(new ApiError('Usuario o contraseña incorrectos.', 'access'));
    const user = userEvent.setup();
    render(<App api={api}/>);
    await user.type(await screen.findByLabelText('Usuario Odoo'), 'fabrica');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrect');
    await user.click(screen.getByRole('button', { name: 'Acceder' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('clears a wrong PIN and never retries it automatically', async () => {
    const api = apiMock();
    api.unlock.mockResolvedValueOnce({ ok: false, error: 'No se ha podido verificar el PIN.' });
    const user = userEvent.setup();
    render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('PIN'), '0000');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido verificar el PIN.');
    expect(screen.getByLabelText('PIN')).toHaveValue('');
    expect(api.unlock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Acceso confirmado')).not.toBeInTheDocument();
  });

  it('confirms a new PIN with the server rather than overwriting it locally', async () => {
    const api = apiMock();
    api.bootstrap.mockResolvedValue({ ...initial, employees: [{ ...initial.employees[0], pin_setup_required: true }] });
    const user = userEvent.setup();
    render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('Nuevo PIN'), '4826');
    await user.type(screen.getByLabelText('Confirma tu PIN'), '4826');
    await user.click(screen.getByRole('button', { name: 'Crear PIN y entrar' }));
    expect(await screen.findByRole('heading', { name: 'Escanear' })).toBeVisible();
    expect(api.setupPin).toHaveBeenCalledWith(20, '4826', '4826');
    expect(api.unlock).not.toHaveBeenCalled();
  });

  it('can go back and discard an unsubmitted PIN', async () => {
    const api = apiMock();
    const user = userEvent.setup();
    render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('PIN'), '4826');
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByLabelText('Empleado')).toHaveValue('');
    expect(api.unlock).not.toHaveBeenCalled();
    await choose(user);
    expect(screen.getByLabelText('PIN')).toHaveValue('');
  });

  it('prevents concurrent identification requests', async () => {
    const api = apiMock();
    let finish!: (value: unknown) => void;
    api.unlock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup();
    render(<App api={api}/>);
    await choose(user);
    const field = screen.getByLabelText('PIN');
    await user.type(field, '4826');
    fireEvent.submit(field.closest('form')!);
    fireEvent.submit(field.closest('form')!);
    expect(api.unlock).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: true, token: 'synthetic-token', profile: identity }));
  });

  it('restores a verified identity after reload without storing PIN or password', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const api = apiMock();
    const user = userEvent.setup();
    const view = render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('PIN'), '4826');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Escanear' });
    expect(local.mock.calls.some(call => String(call[1]).includes('4826'))).toBe(false);
    expect(localStorage.length).toBe(0);
    view.unmount();
    render(<App api={api}/>);
    expect(await screen.findByRole('heading', { name: 'Escanear' })).toBeVisible();
    expect(api.profile).toHaveBeenCalledWith('synthetic-token');
  });

  it('locks just this operator profile before choosing another', async () => {
    const api = apiMock();
    const user = userEvent.setup();
    render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('PIN'), '4826');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar operario' }));
    expect(await screen.findByLabelText('Empleado')).toBeVisible();
    expect(api.lock).toHaveBeenCalledWith('synthetic-token');
    expect(api.logout).not.toHaveBeenCalled();
  });

  it('removes the displayed employee when the server revokes a profile', async () => {
    const api = apiMock();
    const user = userEvent.setup();
    render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('PIN'), '4826');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Escanear' });
    api.profile.mockRejectedValueOnce(new ApiError('El nivel de acceso ha cambiado.', 'access'));
    fireEvent(window, new Event('focus'));
    expect(await screen.findByRole('heading', { name: 'Acceso no disponible' })).toBeVisible();
    expect(screen.queryByText('Operario de prueba')).not.toBeInTheDocument();
  });

  it('fails closed without connectivity and recovers only on an explicit retry', async () => {
    const api = apiMock();
    api.bootstrap.mockRejectedValueOnce(new ApiError('No se puede conectar con Odoo.', 'network'));
    const user = userEvent.setup();
    render(<App api={api}/>);
    expect(await screen.findByRole('heading', { name: 'Sin conexión' })).toBeVisible();
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Empleado')).toBeVisible();
  });

  it('allows changing an unauthorized account without exposing employee data', async () => {
    const api = apiMock();
    api.bootstrap.mockRejectedValueOnce(new ApiError('La cuenta no tiene empleado autorizado.', 'access'));
    const user = userEvent.setup();
    render(<App api={api}/>);
    await user.click(await screen.findByRole('button', { name: 'Cambiar cuenta' }));
    expect(await screen.findByLabelText('Usuario Odoo')).toBeVisible();
    expect(api.logout).toHaveBeenCalledTimes(1);
  });

  it('uses personal-account proof without asking for a second PIN', async () => {
    const api = apiMock();
    api.bootstrap.mockResolvedValueOnce({ ...initial, requires_pin: false });
    render(<App api={api}/>);
    expect(await screen.findByRole('heading', { name: 'Escanear' })).toBeVisible();
    expect(api.unlock).toHaveBeenCalledWith(null, '');
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument();
  });

  it('does not offer scanning or simulated operations in the live access milestone', async () => {
    const api = apiMock();
    api.bootstrap.mockResolvedValueOnce({ ...initial, employees: [] });
    render(<App api={api}/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay empleados con acceso');
    await waitFor(() => expect(screen.queryByText('Escanear')).not.toBeInTheDocument());
  });
});


it('changes account using the real API adapter and Odoo void logout without reloading', async () => {
  let signedInAsSecond = false;
  let databaseSelected = false;
  const json = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
  const fetcher = vi.fn().mockImplementation(async (path: string) => {
    if (path === '/api/session/prepare') { databaseSelected = true; return new Response('login'); }
    if (path === '/api/web/session/destroy') { databaseSelected = false; return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1 })); }
    if (path === '/api/web/session/authenticate') {
      if (!databaseSelected) return new Response(JSON.stringify({ error: { data: { name: 'builtins.AttributeError', message: 'missing request.env' } } }));
      signedInAsSecond = true; return json({ uid: 11 });
    }
    if (path === '/api/cmp_pallets/access/bootstrap') return json({ ...initial, requires_pin: false, csrf_token: signedInAsSecond ? 'csrf-second' : 'csrf-first' });
    if (path === '/api/cmp_pallets/access/unlock') return json({ ok: true, token: signedInAsSecond ? 'token-second' : 'token-first', profile: { ...identity, name: signedInAsSecond ? 'Second operator' : 'First operator' } });
    throw new Error('Unexpected endpoint ' + path);
  });
  const user = userEvent.setup();
  render(<App api={new OdooAccessApi(fetcher)}/>);
  await screen.findByRole('heading', { name: 'Escanear' });
  await user.click(screen.getByRole('button', { name: 'Cambiar cuenta' }));
  expect(await screen.findByLabelText('Usuario Odoo')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Sin conexión' })).not.toBeInTheDocument();
  expect(screen.queryByText('First operator')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Usuario Odoo'), 'second-test-account');
  await user.type(screen.getByLabelText('Contraseña'), 'synthetic-password');
  await user.click(screen.getByRole('button', { name: 'Acceder' }));
  await screen.findByRole('heading', { name: 'Escanear' });
  expect(screen.getByText('Second operator')).toBeVisible();
  const unlockCalls = fetcher.mock.calls.filter(call => call[0] === '/api/cmp_pallets/access/unlock');
  expect(JSON.parse(unlockCalls.at(-1)![1].body).params.csrf_token).toBe('csrf-second');
});


it('reloads the change-account screen as a clean anonymous login, with no expired-session warning', async () => {
  const api = apiMock();
  api.bootstrap.mockResolvedValueOnce({ ...initial, requires_pin: false });
  const user = userEvent.setup();
  const view = render(<App api={api}/>);
  await screen.findByRole('heading', { name: 'Escanear' });
  await user.click(screen.getByRole('button', { name: 'Cambiar cuenta' }));
  await screen.findByLabelText('Usuario Odoo');
  view.unmount();
  api.bootstrap.mockRejectedValueOnce(new ApiError('La sesión ha caducado. Accede de nuevo.', 'session'));
  render(<App api={api}/>);
  expect(await screen.findByLabelText('Usuario Odoo')).toBeVisible();
  expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText('Operario de prueba')).not.toBeInTheDocument();
});

it('still warns when an active session expires during use', async () => {
  const api = apiMock();
  api.bootstrap.mockResolvedValueOnce({ ...initial, requires_pin: false });
  render(<App api={api}/>);
  await screen.findByRole('heading', { name: 'Escanear' });
  api.profile.mockRejectedValueOnce(new ApiError('La sesión ha caducado. Accede de nuevo.', 'session'));
  fireEvent(window, new Event('focus'));
  expect(await screen.findByLabelText('Usuario Odoo')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('La sesión ha caducado. Accede de nuevo.');
  expect(screen.queryByText('Operario de prueba')).not.toBeInTheDocument();
});

describe('reload checkpoints', () => {
  const order: ScanRecord = { kind: 'production', id: 1, code: 'OF99-00001', title: 'Test product', revision: 'a'.repeat(64), items: [], next_offset: null };
  const pallet: ScanRecord = { kind: 'pallet', id: 2, code: 'P26-00001', title: 'Pallet', active: true, location: { id: 3, code: 'TEST-ENTRADA', name: 'Entrada' }, revision: 'b'.repeat(64), items: [order], next_offset: null };
  function fixture() {
    const api = apiMock();
    api.lookup.mockImplementation(async (_token, code) => {
      const record = [order, pallet].find(r => code === r.code || code.endsWith(':' + r.code));
      return record ? { ok: true, record } : { ok: false, error: 'Not found' };
    });
    return api;
  }
  async function enter(api: ReturnType<typeof apiMock>) {
    const user = userEvent.setup();
    const view = render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('PIN'), '4826');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Escanear' });
    return { user, view };
  }
  async function scan(code: string) {
    const input = screen.getByLabelText('Código de OF, pallet o ubicación');
    fireEvent.change(input, { target: { value: code } }); fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input).not.toBeDisabled());
  }
  it('restores the selected employee PIN page with the secret empty and server-owned setup state', async () => {
    const api = fixture(); const user = userEvent.setup();
    const view = render(<App api={api}/>);
    await choose(user); await user.type(screen.getByLabelText('PIN'), '4826');
    view.unmount(); render(<App api={api}/>);
    expect(await screen.findByLabelText('PIN')).toHaveValue('');
    expect(screen.getByText(identity.name)).toBeVisible();
    expect(api.unlock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('cmp.pallets.tab.access.v1')).not.toContain('4826');
  });
  it('validates the token and each restored record before showing the selection and last detail', async () => {
    const api = fixture(); const { view } = await enter(api);
    await scan(order.code); await scan(pallet.code);
    view.unmount();
    let finish!: (profile: typeof identity) => void;
    api.profile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<App api={api}/>);
    await waitFor(() => expect(api.profile).toHaveBeenCalledWith('synthetic-token'));
    expect(screen.queryByRole('region', { name: 'Pallets seleccionados' })).not.toBeInTheDocument();
    await act(async () => { finish(identity); });
    expect(await screen.findByRole('region', { name: 'Pallets seleccionados' })).toHaveTextContent(pallet.code);
    expect(screen.getByRole('region', { name: 'Asociación pendiente' })).toHaveTextContent(order.code);
    expect(screen.getByRole('region', { name: 'Detalle de la lectura' })).toHaveTextContent(pallet.code);
    expect(api.unlock).toHaveBeenCalledTimes(1);
    expect(api.associate).not.toHaveBeenCalled();
    expect(api.lookup).toHaveBeenCalledWith('synthetic-token', 'CMP:PALLET:' + pallet.code);
  });
  it('restores an uncertain association as a retry with its identical request and no automatic write', async () => {
    const api = fixture(); api.associate.mockRejectedValueOnce(new ApiError('Lost reply', 'network'));
    const { view } = await enter(api);
    await scan(order.code); await scan(pallet.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asociación' }));
    await screen.findByRole('button', { name: 'Reintentar confirmación' });
    const original = api.associate.mock.calls[0];
    view.unmount(); render(<App api={api}/>);
    const retry = await screen.findByRole('button', { name: 'Reintentar confirmación' });
    expect(api.associate).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await screen.findByText(/Asociación confirmada/);
    expect(api.associate.mock.calls[1]).toEqual(original);
  });
  it('restores an uncertain pallet creation without allocating another request ID', async () => {
    const api = fixture();
    let finish!: (value: { ok: true; pallet_id: number; pallet_code: string }) => void;
    api.createPallet.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { view } = await enter(api);
    fireEvent.click(screen.getByRole('button', { name: /Crear pallet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear pallet y ver etiqueta' }));
    await waitFor(() => expect(api.createPallet).toHaveBeenCalledTimes(1));
    const original = api.createPallet.mock.calls[0];
    view.unmount(); render(<App api={api}/>);
    const retry = await screen.findByRole('button', { name: 'Reintentar creación' });
    expect(api.createPallet).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cerrar creación' })).toBeDisabled();
    fireEvent.click(retry);
    await screen.findByRole('dialog', { name: /Etiqueta/ });
    expect(api.createPallet.mock.calls[1]).toEqual(original);
    await act(async () => { finish({ ok: true, pallet_id: 2, pallet_code: 'P26-00001' }); });
    expect(api.createPallet).toHaveBeenCalledTimes(2);
  });
  it('retries a pending movement after reload even when fresh reads show it already reached its destination', async () => {
    const api = fixture();
    const destination: ScanRecord = { kind: 'location', id: 4, code: 'TEST-SALIDA', title: 'Salida', active: true, items: [], next_offset: null };
    let arrived = false;
    api.lookup.mockImplementation(async (_token, code) => {
      const current = arrived ? { ...pallet, revision: 'c'.repeat(64), location: { id: 4, code: destination.code, name: destination.title } } : pallet;
      const record = [current, destination].find(r => code === r.code || code.endsWith(':' + r.code));
      return record ? { ok: true, record } : { ok: false, error: 'Not found' };
    });
    api.move.mockRejectedValueOnce(new ApiError('Lost reply', 'network'));
    const { view } = await enter(api);
    await scan(pallet.code); await scan(destination.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }));
    await screen.findByRole('button', { name: 'Reintentar traslado' });
    const original = api.move.mock.calls[0];
    arrived = true; view.unmount(); render(<App api={api}/>);
    const retry = await screen.findByRole('button', { name: 'Reintentar traslado' });
    expect(retry).toBeEnabled();
    expect(api.move).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await screen.findByText(/Traslado confirmado/);
    expect(api.move.mock.calls[1]).toEqual(original);
  });
  it('keeps normal access usable when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage disabled'); });
    const api = fixture(); await enter(api);
    expect(screen.getByRole('heading', { name: 'Escanear' })).toBeVisible();
  });
  it('requires new identification if the stored operator profile has expired', async () => {
    const api = fixture(); const { view } = await enter(api);
    await scan(pallet.code); view.unmount();
    api.profile.mockRejectedValueOnce(new ApiError('El perfil ha caducado.', 'access'));
    render(<App api={api}/>);
    expect(await screen.findByLabelText('Empleado')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Detalle de la lectura' })).not.toBeInTheDocument();
    expect(api.unlock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('cmp.pallets.tab.work.v1')).toBeNull();
  });
  it('does not restore another account or retain the previous operator after switching', async () => {
    const api = fixture(); const { user, view } = await enter(api);
    await scan(pallet.code);
    await user.click(screen.getByRole('button', { name: 'Cambiar operario' }));
    await screen.findByLabelText('Empleado'); view.unmount(); render(<App api={api}/>);
    expect(await screen.findByLabelText('Empleado')).toBeVisible();
    expect(api.profile).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('cmp.pallets.tab.work.v1')).toBeNull();
  });
  it('will not reuse a saved identity under a different Odoo account', async () => {
    const api = fixture(); const { view } = await enter(api); view.unmount();
    api.bootstrap.mockResolvedValueOnce({ ...initial, user: { id: 99, name: 'Different account' } });
    render(<App api={api}/>);
    await screen.findByLabelText('Empleado');
    expect(api.profile).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Escanear' })).not.toBeInTheDocument();
  });
  it('does not show cached business data if lookup no longer permits access', async () => {
    const api = fixture(); const { view } = await enter(api); await scan(pallet.code); view.unmount();
    api.lookup.mockResolvedValue({ ok: false, error: 'Not available' });
    render(<App api={api}/>);
    expect(await screen.findByRole('heading', { name: 'Recuperar trabajo' })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('ya no está disponible');
    expect(screen.queryByText(pallet.code)).not.toBeInTheDocument();
    expect(api.move).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar selección' }));
    expect(await screen.findByRole('heading', { name: 'Escanear' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Detalle de la lectura' })).not.toBeInTheDocument();
  });
});
