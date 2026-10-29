import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ApiError, type AccessApi, type Bootstrap } from './api';

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

  it('does not store credentials or reuse an identity after reload', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const api = apiMock();
    const user = userEvent.setup();
    const view = render(<App api={api}/>);
    await choose(user);
    await user.type(screen.getByLabelText('PIN'), '4826');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Escanear' });
    expect(local).not.toHaveBeenCalled();
    view.unmount();
    render(<App api={api}/>);
    expect(await screen.findByLabelText('Empleado')).toBeVisible();
    expect(api.profile).not.toHaveBeenCalled();
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
