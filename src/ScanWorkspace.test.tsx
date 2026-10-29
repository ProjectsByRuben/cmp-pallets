import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type AccessApi, type ScanRecord } from './api';
import { ScanWorkspace } from './ScanWorkspace';

const location = { id: 3, code: 'TEST-CORTE', name: 'Corte de prueba' };
const of: ScanRecord = { revision: 'a'.repeat(64), kind: 'production', id: 1, code: 'OF99-00001', title: 'Pieza de prueba', quantity: 10, uom: 'ud.', state_label: 'En proceso', items: [], next_offset: null };
const pallet: ScanRecord = { revision: 'b'.repeat(64), kind: 'pallet', id: 2, code: 'P209900001', title: 'Pallet', location, active: true, items: [of], next_offset: null };
const production: ScanRecord = { ...of, items: [pallet] };

function mockApi() {
  return {
    bootstrap: vi.fn(), login: vi.fn(), unlock: vi.fn(), setupPin: vi.fn(), profile: vi.fn(), lock: vi.fn(), logout: vi.fn(),
    associate: vi.fn<AccessApi['associate']>().mockResolvedValue({ ok: true, pallet_code: 'P209900001', added: 1 }),
    lookup: vi.fn<AccessApi['lookup']>().mockImplementation(async (_token, code) => {
      const record = [production, pallet].find(item => code === item.code || code.endsWith(':' + item.code));
      return record ? { ok: true, record } : { ok: false, error: 'QR no encontrado o sin acceso.' };
    }),
  } satisfies AccessApi;
}

function open(api = mockApi()) {
  const onAccessError = vi.fn();
  const onSwitch = vi.fn();
  const view = render(<ScanWorkspace api={api} token="synthetic-token" profile={{ employee_id: 20, name: 'Empleado de prueba', role: 'operator' }} onAccessError={onAccessError} onSwitch={onSwitch} onChangeAccount={vi.fn()} switching={false}/>);
  return { api, onAccessError, onSwitch, ...view };
}

describe('live scan consultation', () => {
  it('shows an orange inactive state when leaving the window and green on return', () => {
    open();
    const status = screen.getByRole('status', { name: 'Estado del lector' });
    expect(status).toHaveAttribute('data-ready', 'true');
    fireEvent(window, new Event('blur'));
    expect(status).toHaveAttribute('data-ready', 'false');
    expect(status).toHaveTextContent('Activa esta página para leer');
    fireEvent(window, new Event('focus'));
    expect(status).toHaveAttribute('data-ready', 'true');
    expect(status).toHaveTextContent('Preparado para leer');
  });

  it('shows orange when a button has focus instead of the scan field', () => {
    open();
    act(() => screen.getByRole('button', { name: /Inicio/ }).focus());
    expect(screen.getByRole('status', { name: 'Estado del lector' })).toHaveAttribute('data-ready', 'false');
    expect(screen.getByRole('status', { name: 'Estado del lector' })).toHaveTextContent('Selecciona la casilla para leer');
    act(() => screen.getByLabelText('Código de OF, pallet o ubicación').focus());
    expect(screen.getByRole('status', { name: 'Estado del lector' })).toHaveAttribute('data-ready', 'true');
  });

  it('shows orange while the tab is hidden and resumes green when visible', () => {
    open();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('status', { name: 'Estado del lector' })).toHaveAttribute('data-ready', 'false');
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('status', { name: 'Estado del lector' })).toHaveAttribute('data-ready', 'true');
  });
  it('restores reader focus after clicking outside the scan field', async () => {
    const { api } = open();
    const user = userEvent.setup();
    await user.click(screen.getByRole('heading', { name: 'Escanear' }));
    await waitFor(() => expect(screen.getByLabelText('Código de OF, pallet o ubicación')).toHaveFocus());
    await user.keyboard(production.code + '{Enter}');
    expect(await screen.findByRole('heading', { name: production.code })).toBeVisible();
    expect(api.lookup).toHaveBeenCalledWith('synthetic-token', production.code, 0);
  });

  it('captures the first scanner character even when a navigation button has focus', async () => {
    const { api } = open();
    const user = userEvent.setup();
    act(() => screen.getByRole('button', { name: /Inicio/ }).focus());
    await user.keyboard(production.code + '{Enter}');
    expect(await screen.findByRole('heading', { name: production.code })).toBeVisible();
    expect(api.lookup).toHaveBeenCalledTimes(1);
    expect(api.lookup).toHaveBeenCalledWith('synthetic-token', production.code, 0);
  });

  it('restores focus when returning to the browser window', async () => {
    open();
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    act(() => field.blur());
    fireEvent(window, new Event('focus'));
    expect(field).toHaveFocus();
  });

  it('reads OF text and Enter from a HID keyboard without clicking a scan button', async () => {
    const { api } = open();
    const user = userEvent.setup();
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    expect(field).toHaveFocus();
    await user.type(field, production.code + '{Enter}');
    expect(await screen.findByRole('heading', { name: production.code })).toBeVisible();
    expect(screen.getByText('Pieza de prueba')).toBeVisible();
    expect(screen.getByText('Cantidad de la OF')).toBeVisible();
    expect(api.lookup).toHaveBeenCalledWith('synthetic-token', production.code, 0);
    expect(api.lookup).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue('');
  });

  it('accepts Tab suffix and a complete known code after the idle fallback', async () => {
    const { api } = open();
    const user = userEvent.setup();
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    await user.type(field, production.code + '{Tab}');
    await screen.findByRole('heading', { name: production.code });
    fireEvent.change(field, { target: { value: pallet.code } });
    expect(await screen.findByRole('heading', { name: pallet.code }, { timeout: 2000 })).toBeVisible();
    expect(api.lookup).toHaveBeenCalledTimes(2);
  });

  it('opens a related pallet, reloads Back from Odoo and resets with Home', async () => {
    const { api } = open();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de OF, pallet o ubicación'), production.code + '{Enter}');
    await user.click(await screen.findByRole('button', { name: new RegExp(pallet.code) }));
    expect(await screen.findByRole('heading', { name: pallet.code })).toBeVisible();
    expect(screen.getAllByText('TEST-CORTE · Corte de prueba').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Volver/ }));
    expect(await screen.findByRole('heading', { name: production.code })).toBeVisible();
    expect(api.lookup).toHaveBeenLastCalledWith('synthetic-token', 'CMP:OF:' + production.code, 0);
    await user.click(screen.getByRole('button', { name: /Inicio/ }));
    expect(screen.queryByRole('region', { name: 'Detalle de la lectura' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver/ })).toBeDisabled();
  });

  it('supports manual entry and closing it without making a query', async () => {
    const { api } = open();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Escribir/ }));
    expect(screen.getByRole('status', { name: 'Estado del lector' })).toHaveTextContent('Lector en pausa');
    await user.type(screen.getByLabelText('OF, pallet o ubicación'), 'discarded');
    await user.click(screen.getByRole('button', { name: 'Cerrar entrada manual' }));
    expect(api.lookup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Escribir/ }));
    expect(screen.getByLabelText('OF, pallet o ubicación')).toHaveValue('');
    await user.type(screen.getByLabelText('OF, pallet o ubicación'), production.code);
    await user.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByRole('heading', { name: production.code })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the last valid detail when a subsequent QR is unknown', async () => {
    open();
    const user = userEvent.setup();
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    await user.type(field, production.code + '{Enter}');
    await screen.findByRole('heading', { name: production.code });
    await user.type(field, 'unknown{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('QR no encontrado');
    expect(screen.getByRole('heading', { name: production.code })).toBeVisible();
  });

  it('does not issue concurrent queries while waiting for Odoo', async () => {
    const api = mockApi();
    let finish!: (value: Awaited<ReturnType<AccessApi['lookup']>>) => void;
    api.lookup.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    open(api);
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    fireEvent.change(field, { target: { value: production.code } });
    fireEvent.submit(field.closest('form')!);
    fireEvent.submit(field.closest('form')!);
    expect(api.lookup).toHaveBeenCalledTimes(1);
    expect(field).toBeDisabled();
    await act(async () => finish({ ok: true, record: production }));
    expect(screen.getByRole('heading', { name: production.code })).toBeVisible();
  });

  it('does not display stale data after network failure and does not fake success', async () => {
    const api = mockApi();
    open(api);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    await user.type(field, production.code + '{Enter}');
    await screen.findByRole('heading', { name: production.code });
    api.lookup.mockRejectedValueOnce(new ApiError('Sin conexión con Odoo.', 'network'));
    await user.type(field, pallet.code + '{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    expect(screen.queryByRole('region', { name: 'Detalle de la lectura' })).not.toBeInTheDocument();
  });

  it('leaves the authenticated workspace when the server revokes identity', async () => {
    const api = mockApi();
    api.lookup.mockRejectedValueOnce(new ApiError('Identifícate de nuevo.', 'access'));
    const { onAccessError } = open(api);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de OF, pallet o ubicación'), production.code + '{Enter}');
    expect(onAccessError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'access' }));
  });

  it('ignores a delayed response after switching operator/unmounting', async () => {
    const api = mockApi();
    let finish!: (value: Awaited<ReturnType<AccessApi['lookup']>>) => void;
    api.lookup.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { unmount, onAccessError } = open(api);
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    fireEvent.change(field, { target: { value: production.code } });
    fireEvent.submit(field.closest('form')!);
    unmount();
    await act(async () => finish({ ok: true, record: production }));
    expect(screen.queryByText('Pieza de prueba')).not.toBeInTheDocument();
    expect(onAccessError).not.toHaveBeenCalled();
  });

  it('appends paged results without duplicating an existing item', async () => {
    const api = mockApi();
    api.lookup.mockResolvedValueOnce({ ok: true, record: { ...production, next_offset: 50 } });
    open(api);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de OF, pallet o ubicación'), production.code + '{Enter}');
    api.lookup.mockResolvedValueOnce({ ok: true, record: { ...production, items: [pallet, { ...pallet, id: 4, code: 'P209900002' }] } });
    await user.click(await screen.findByRole('button', { name: 'Ver más' }));
    expect(await screen.findByRole('button', { name: /P209900002/ })).toBeVisible();
    expect(screen.getAllByRole('button', { name: /P209900001/ })).toHaveLength(1);
    expect(api.lookup).toHaveBeenLastCalledWith('synthetic-token', 'CMP:OF:' + production.code, 50);
  });
});


describe('explicit OF association', () => {
  async function scan(code: string) {
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    fireEvent.change(field, { target: { value: code } });
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(field).not.toBeDisabled());
  }

  it('selects unique orders, allows removal and writes only after confirmation', async () => {
    const { api } = open();
    await scan(production.code);
    await scan('CMP:OF:' + production.code);
    expect(screen.getByRole('heading', { name: 'OFs seleccionadas · 1' })).toBeVisible();
    await scan(pallet.code);
    expect(api.associate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar ' + production.code }));
    expect(screen.queryByRole('region', { name: 'Asociación pendiente' })).not.toBeInTheDocument();
    await scan(production.code);
    await scan(pallet.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asociación' }));
    expect(await screen.findByText(/Asociación confirmada en/)).toBeVisible();
    expect(api.associate).toHaveBeenCalledWith('synthetic-token', expect.objectContaining({
      pallet_id: pallet.id, pallet_revision: pallet.revision,
      productions: [{ id: production.id, revision: production.revision }],
    }));
    expect(screen.queryByRole('region', { name: 'Asociación pendiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Detalle de la lectura' })).not.toBeInTheDocument();
  });

  it('requests a location for an empty pallet and includes it in the single operation', async () => {
    const api = mockApi();
    api.lookup.mockImplementation(async (_token, code) => ({ ok: true, record: code === production.code ? production : code === pallet.code ? { ...pallet, location: null } : { kind: 'location', id: location.id, code: location.code, title: location.name, active: true, items: [], next_offset: null } }));
    open(api);
    await scan(production.code); await scan(pallet.code);
    expect(screen.getByRole('button', { name: 'Confirmar asociación' })).toBeDisabled();
    await scan('CMP:LOC:' + location.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asociación' }));
    await screen.findByText(/Asociación confirmada en/);
    expect(api.associate).toHaveBeenCalledWith('synthetic-token', expect.objectContaining({ location_id: location.id }));
  });

  it('retries the identical request after a lost response and prevents editing it', async () => {
    const api = mockApi();
    api.associate.mockRejectedValueOnce(new ApiError('lost response', 'network'));
    open(api);
    await scan(production.code); await scan(pallet.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asociación' }));
    const retry = await screen.findByRole('button', { name: 'Reintentar confirmación' });
    expect(screen.queryByText(/Asociación confirmada en/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inicio/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quitar ' + production.code })).toBeDisabled();
    fireEvent.click(retry);
    await screen.findByText(/Asociación confirmada en/);
    expect(api.associate.mock.calls[0]).toEqual(api.associate.mock.calls[1]);
  });

  it('requires fresh readings on conflict and cancels selection without writes', async () => {
    const api = mockApi();
    api.associate.mockResolvedValueOnce({ ok: false, conflict: true, error: 'Los datos han cambiado' });
    open(api);
    await scan(production.code); await scan(pallet.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asociación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Los datos han cambiado');
    expect(screen.queryByRole('button', { name: 'Confirmar asociación' })).not.toBeInTheDocument();
    await scan(production.code);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar selección' }));
    expect(api.associate).toHaveBeenCalledTimes(1);
  });
});
