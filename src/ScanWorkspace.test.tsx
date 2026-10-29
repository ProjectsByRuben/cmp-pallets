import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type AccessApi, type ScanRecord } from './api';
import { ScanWorkspace } from './ScanWorkspace';

const location = { id: 3, code: 'TEST-CORTE', name: 'Corte de prueba' };
const of: ScanRecord = { revision: 'a'.repeat(64), kind: 'production', id: 1, code: 'OF99-00001', title: 'Pieza de prueba', quantity: 10, uom: 'ud.', state_label: 'En proceso', items: [], next_offset: null };
const pallet: ScanRecord = { revision: 'b'.repeat(64), kind: 'pallet', id: 2, code: 'P26-00001', title: 'Pallet', location, active: true, items: [of], next_offset: null };
const production: ScanRecord = { ...of, items: [pallet] };

function mockApi() {
  return {
    bootstrap: vi.fn(), login: vi.fn(), unlock: vi.fn(), setupPin: vi.fn(), profile: vi.fn(), lock: vi.fn(), logout: vi.fn(),
    createPallet: vi.fn<AccessApi['createPallet']>().mockResolvedValue({ ok: true, pallet_id: 2, pallet_code: 'P26-00001' }),
    label: vi.fn<AccessApi['label']>().mockResolvedValue({ ok: true, pallet_id: 2, code: 'P26-00001', qr_payload: 'CMP:PALLET:P26-00001', png_base64: 'iVBORw0KGgo=' }),
    move: vi.fn<AccessApi['move']>().mockResolvedValue({ ok: true, moved: 1, unchanged: 0, location_code: 'TEST-DESTINO' }),
    associate: vi.fn<AccessApi['associate']>().mockResolvedValue({ ok: true, pallet_code: 'P26-00001', added: 1 }),
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
    api.lookup.mockResolvedValueOnce({ ok: true, record: { ...production, items: [pallet, { ...pallet, id: 4, code: 'P26-00002' }] } });
    await user.click(await screen.findByRole('button', { name: 'Ver más' }));
    expect(await screen.findByRole('button', { name: /P26-00002/ })).toBeVisible();
    expect(screen.getAllByRole('button', { name: /P26-00001/ })).toHaveLength(1);
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


describe('flexible selection and group movement', () => {
  const secondOrder: ScanRecord = { ...production, id: 5, code: 'OF99-00002', revision: 'd'.repeat(64) };
  const secondPallet: ScanRecord = { ...pallet, id: 4, code: 'P26-00002', revision: 'c'.repeat(64) };
  const destination: ScanRecord = { kind: 'location', id: 6, code: 'TEST-DESTINO', title: 'Destino de prueba', active: true, items: [], next_offset: null };

  function flexibleApi() {
    const api = mockApi();
    api.lookup.mockImplementation(async (_token, code) => {
      const record = [production, pallet, secondOrder, secondPallet, destination].find(p => code === p.code || code.endsWith(':' + p.code));
      return record ? { ok: true, record } : { ok: false, error: 'QR no encontrado' };
    });
    api.move.mockResolvedValue({ ok: true, moved: 2, unchanged: 0, location_code: destination.code });
    return api;
  }

  async function scan(code: string) {
    const field = screen.getByLabelText('Código de OF, pallet o ubicación');
    fireEvent.change(field, { target: { value: code } });
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(field).not.toBeDisabled());
  }

  it('opens any of three selected pallets, OF or location without altering the operation target or group', async () => {
    const api = flexibleApi();
    const thirdPallet: ScanRecord = { ...pallet, id: 7, code: 'P26-00003' };
    const lookup = api.lookup.getMockImplementation()!;
    api.lookup.mockImplementation(async (token, code, offset) => code.endsWith(thirdPallet.code)
      ? { ok: true, record: thirdPallet } : lookup(token, code, offset));
    open(api);
    for (const code of [production.code, destination.code, pallet.code, secondPallet.code, thirdPallet.code]) await scan(code);
    expect(screen.getByRole('heading', { name: thirdPallet.code })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Pallet de destino para las OFs'), { target: { value: String(secondPallet.id) } });
    for (const item of [pallet, thirdPallet, secondPallet, production, destination]) {
      fireEvent.click(screen.getByRole('button', { name: 'Ver ' + item.code }));
      await screen.findByRole('heading', { name: item.code });
      expect(screen.getByRole('button', { name: 'Ver ' + item.code })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('region', { name: 'Pallets seleccionados' })).toHaveTextContent('Pallets seleccionados · 3');
      expect(screen.getByLabelText('Pallet de destino para las OFs')).toHaveValue(String(secondPallet.id));
    }
    expect(api.associate).not.toHaveBeenCalled();
    expect(api.move).not.toHaveBeenCalled();
    expect(api.createPallet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }));
    await screen.findByText(/Traslado confirmado/);
    expect(api.move).toHaveBeenCalledWith('synthetic-token', expect.objectContaining({
      location_id: destination.id, pallets: [pallet, secondPallet, thirdPallet].map(p => ({ id: p.id, revision: p.revision })),
    }));
  });

  it.each(['pallet', 'production', 'location'])('clears the detail and navigation after removing every selection, last: %s', async last => {
    const api = flexibleApi(); open(api);
    for (const item of [pallet, secondPallet, production, destination]) await scan(item.code);
    const items = [pallet, secondPallet, production, destination];
    const final = items.find(item => item.kind === last)!;
    for (const item of [...items.filter(item => item.id !== final.id), final]) {
      fireEvent.click(screen.getByRole('button', { name: item.kind === 'location' ? 'Quitar ubicación' : 'Quitar ' + item.code }));
    }
    expect(screen.queryByRole('region', { name: 'Detalle de la lectura' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Pallets seleccionados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Asociación pendiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ubicación seleccionada' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver/ })).toBeDisabled();
    expect(api.associate).not.toHaveBeenCalled();
    expect(api.move).not.toHaveBeenCalled();
    await scan(final.code);
    expect(await screen.findByRole('heading', { name: final.code })).toBeVisible();
  });

  it.each(['pallet-first', 'orders-first'])('associates several OFs with one pallet in either order: %s', async order => {
    const api = flexibleApi(); open(api);
    const codes = order === 'pallet-first' ? [pallet.code, production.code, secondOrder.code] : [production.code, secondOrder.code, pallet.code];
    for (const code of codes) await scan(code);
    expect(screen.getByRole('heading', { name: 'OFs seleccionadas · 2' })).toBeVisible();
    expect(api.associate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asociación' }));
    await screen.findByText(/Asociación confirmada en/);
    expect(api.associate).toHaveBeenCalledWith('synthetic-token', expect.objectContaining({ pallet_id: pallet.id,
      productions: [{ id: production.id, revision: production.revision }, { id: secondOrder.id, revision: secondOrder.revision }],
    }));
    expect(api.move).not.toHaveBeenCalled();
  });

  it.each(['location-first', 'pallets-first'])('moves several pallets in either order: %s', async order => {
    const api = flexibleApi(); open(api);
    const codes = order === 'location-first' ? [destination.code, pallet.code, secondPallet.code] : [pallet.code, secondPallet.code, destination.code];
    for (const code of codes) await scan(code);
    expect(screen.getByRole('heading', { name: 'Pallets seleccionados · 2' })).toBeVisible();
    expect(api.move).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }));
    expect(await screen.findByText(/Traslado confirmado a/)).toBeVisible();
    expect(api.move).toHaveBeenCalledWith('synthetic-token', expect.objectContaining({ location_id: destination.id,
      pallets: [{ id: pallet.id, revision: pallet.revision }, { id: secondPallet.id, revision: secondPallet.revision }],
    }));
    expect(screen.queryByRole('region', { name: 'Pallets seleccionados' })).not.toBeInTheDocument();
    expect(api.associate).not.toHaveBeenCalled();
  });

  it('requires an explicit single target when OFs and multiple pallets are selected', async () => {
    const api = flexibleApi(); open(api);
    for (const code of [pallet.code, production.code, secondPallet.code, secondOrder.code]) await scan(code);
    expect(screen.queryByRole('button', { name: 'Confirmar asociación' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Pallet de destino para las OFs'), String(secondPallet.id));
    await waitFor(() => expect(screen.getByLabelText('Código de OF, pallet o ubicación')).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asociación' }));
    await screen.findByText(/Asociación confirmada en/);
    expect(api.associate).toHaveBeenCalledTimes(1);
    expect(api.associate.mock.calls[0][1].pallet_id).toBe(secondPallet.id);
    expect(api.associate.mock.calls[0][1].productions).toHaveLength(2);
    expect(api.move).not.toHaveBeenCalled();
  });

  it('keeps association and movement separate with all three record types selected', async () => {
    const api = flexibleApi(); open(api);
    for (const code of [destination.code, pallet.code, production.code]) await scan(code);
    expect(screen.getByText(/Esta asociación conserva la ubicación actual/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirmar traslado' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asociación' }));
    await screen.findByText(/Asociación confirmada en/);
    expect(api.associate.mock.calls[0][1]).not.toHaveProperty('location_id');
    expect(api.move).not.toHaveBeenCalled();
  });

  it('a group move never associates the selected OFs implicitly', async () => {
    const api = flexibleApi(); open(api);
    for (const code of [production.code, pallet.code, destination.code]) await scan(code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }));
    await screen.findByText(/Traslado confirmado a/);
    expect(api.associate).not.toHaveBeenCalled();
  });

  it('deduplicates readings and supports removal, immediate rescan and cancellation', async () => {
    const api = flexibleApi(); open(api);
    for (const code of [production.code, pallet.code, 'CMP:PALLET:' + pallet.code, destination.code]) await scan(code);
    expect(screen.getByRole('heading', { name: 'Pallets seleccionados · 1' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar ubicación' }));
    await scan(destination.code);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar ' + pallet.code }));
    await scan(pallet.code);
    expect(screen.getByRole('heading', { name: 'OFs seleccionadas · 1' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar ' + production.code }));
    expect(screen.getByRole('button', { name: 'Confirmar traslado' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar selección' }));
    expect(screen.queryByRole('region', { name: 'Traslado pendiente' })).not.toBeInTheDocument();
    expect(api.associate).not.toHaveBeenCalled(); expect(api.move).not.toHaveBeenCalled();
  });

  it('reports pallets already at destination and does not submit a zero-change movement', async () => {
    const api = flexibleApi();
    api.lookup.mockResolvedValueOnce({ ok: true, record: pallet }).mockResolvedValueOnce({ ok: true, record: { ...destination, id: location.id, code: location.code, title: location.name } });
    open(api); await scan(pallet.code); await scan(location.code);
    expect(screen.getByText('Todos los pallets seleccionados ya están en esta ubicación.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirmar traslado' })).toBeDisabled();
    expect(api.move).not.toHaveBeenCalled();
  });

  it('retains the exact movement request and freezes selection after losing the response', async () => {
    const api = flexibleApi(); api.move.mockRejectedValueOnce(new ApiError('lost response', 'network'));
    open(api); await scan(destination.code); await scan(pallet.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }));
    const retry = await screen.findByRole('button', { name: 'Reintentar traslado' });
    expect(screen.getByRole('button', { name: 'Quitar ubicación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quitar ' + pallet.code })).toBeDisabled();
    expect(screen.queryByText(/Traslado confirmado a/)).not.toBeInTheDocument();
    fireEvent.click(retry); await screen.findByText(/Traslado confirmado a/);
    expect(api.move.mock.calls[0]).toEqual(api.move.mock.calls[1]);
  });

  it('requires fresh selection after a movement conflict', async () => {
    const api = flexibleApi(); api.move.mockResolvedValueOnce({ ok: false, conflict: true, error: 'Los pallets han cambiado' });
    open(api); await scan(pallet.code); await scan(destination.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Los pallets han cambiado');
    expect(screen.queryByRole('region', { name: 'Pallets seleccionados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar traslado' })).not.toBeInTheDocument();
  });

  it('keeps selection for a business error and does not revoke the operator profile', async () => {
    const api = flexibleApi(); api.move.mockRejectedValueOnce(new ApiError('Destino no permitido', 'business'));
    const { onAccessError } = open(api); await scan(destination.code); await scan(pallet.code);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Destino no permitido');
    expect(screen.getByRole('region', { name: 'Pallets seleccionados' })).toBeVisible();
    expect(onAccessError).not.toHaveBeenCalled();
  });

  it('viewing a related OF does not add it to the material selection', async () => {
    const api = flexibleApi(); open(api); await scan(pallet.code);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(production.code + '.*Pieza') }));
    await screen.findByRole('heading', { name: production.code });
    expect(screen.queryByRole('region', { name: 'Asociación pendiente' })).not.toBeInTheDocument();
    expect(api.associate).not.toHaveBeenCalled();
  });
});


describe('pallet creation and printing entry points', () => {
  it('creates once, opens its label and keeps selected OFs for explicit association', async () => {
    const { api } = open();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de OF, pallet o ubicación'), production.code + '{Enter}');
    await screen.findByRole('heading', { name: production.code });
    await user.click(screen.getByRole('button', { name: /Crear pallet/ }));
    expect(api.createPallet).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Crear pallet y ver etiqueta' }));
    expect(await screen.findByRole('dialog', { name: /Etiqueta/ })).toBeVisible();
    expect(api.createPallet).toHaveBeenCalledTimes(1);
    expect(api.associate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cerrar etiqueta' }));
    expect(await screen.findByRole('region', { name: 'Asociación pendiente' })).toHaveTextContent(production.code);
    expect(screen.getByRole('region', { name: 'Pallets seleccionados' })).toHaveTextContent(pallet.code);
  });

  it('reprints from consultation without creating or changing selection', async () => {
    const { api } = open();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de OF, pallet o ubicación'), pallet.code + '{Enter}');
    await screen.findByRole('heading', { name: pallet.code });
    await user.click(screen.getByRole('button', { name: 'Ver QR / Imprimir etiqueta' }));
    expect(await screen.findByAltText('QR del pallet ' + pallet.code)).toBeVisible();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const button = screen.getByRole('button', { name: 'Imprimir etiqueta / Guardar PDF' });
    expect(button).toBeDisabled();
    fireEvent.load(screen.getByAltText('QR del pallet ' + pallet.code));
    await user.click(button);
    expect(print).toHaveBeenCalledOnce();
    expect(api.createPallet).not.toHaveBeenCalled();
    expect(api.move).not.toHaveBeenCalled();
  });

  it('locks the creation form after a lost reply and retries the identical request', async () => {
    const api = mockApi();
    api.createPallet.mockRejectedValueOnce(new ApiError('Offline', 'network'));
    open(api);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Crear pallet/ }));
    await user.click(screen.getByRole('button', { name: 'Crear pallet y ver etiqueta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('evitar duplicados');
    expect(screen.getByRole('button', { name: 'Cerrar creación' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Crear pallet' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar creación' }));
    await screen.findByRole('dialog', { name: /Etiqueta/ });
    expect(api.createPallet.mock.calls[0]).toEqual(api.createPallet.mock.calls[1]);
  });

  it('uses only the explicitly accepted scanned location and creates no OF link implicitly', async () => {
    const api = mockApi();
    const original = api.lookup.getMockImplementation()!;
    api.lookup.mockImplementation(async (token, code, offset) => code === location.code
      ? { ok: true, record: { ...location, title: location.name, kind: 'location', active: true, items: [], next_offset: null } }
      : original(token, code, offset));
    open(api);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de OF, pallet o ubicación'), location.code + '{Enter}');
    await screen.findByRole('heading', { name: location.code });
    await user.click(screen.getByRole('button', { name: /Crear pallet/ }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Crear pallet y ver etiqueta' }));
    await screen.findByRole('dialog', { name: /Etiqueta/ });
    expect(api.createPallet).toHaveBeenCalledWith('synthetic-token', expect.objectContaining({ location_id: location.id }));
    expect(api.associate).not.toHaveBeenCalled();
  });
});
