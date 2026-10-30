import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OdooAccessApi, type LocationSummary, type LookupResult } from './api';
import { LocationPicker } from './LocationPicker';

const first = { id: 1, code: 'TEST-ENTRADA', name: 'Entrada' };
const second = { id: 2, code: 'TEST-SALIDA', name: 'Salida' };
const result = (location: LocationSummary): LookupResult => ({ ok: true, record: { kind: 'location', ...location, title: location.name, active: true, items: [], next_offset: null } });
function open(lookup: (token: string, code: string) => Promise<LookupResult>) {
  const api = new OdooAccessApi();
  vi.spyOn(api, 'locations').mockResolvedValue({ ok: true, items: [first, second], next_offset: null });
  const reads = vi.spyOn(api, 'lookup').mockImplementation(lookup);
  function Harness() {
    const [value, setValue] = useState<LocationSummary | null>(null);
    return <LocationPicker api={api} token="synthetic-token" value={value} onChange={setValue} onAccessError={vi.fn()} autoFocus/>;
  }
  render(<Harness/>);
  return { reads, field: screen.getByLabelText('Buscar o escanear ubicación existente') };
}

describe('location scanner correction', () => {
  it.each(['unknown', 'production', 'pallet', 'archived'])('clears a rejected %s scan so the next location is read on its own', async kind => {
    const rejected: LookupResult = kind === 'unknown' ? { ok: false, error: 'Código desconocido' }
      : { ok: true, record: { kind: kind === 'archived' ? 'location' : kind as 'production' | 'pallet', id: 9, code: 'WRONG', title: 'Wrong', active: kind !== 'archived', items: [], next_offset: null } };
    const { reads, field } = open(async (_token, code) => code === 'WRONG' ? rejected : result(first));
    const user = userEvent.setup();
    await user.keyboard('WRONG{Enter}');
    await screen.findByRole('alert');
    expect(field).toHaveValue('');
    expect(screen.queryByText('Ubicación elegida:')).not.toBeInTheDocument();
    await user.keyboard('CMP:LOC:' + first.code + '{Enter}');
    await screen.findByText('Ubicación elegida:');
    expect(field).toHaveValue('');
    expect(reads).toHaveBeenLastCalledWith('synthetic-token', 'CMP:LOC:' + first.code);
    await user.click(screen.getByRole('button', { name: 'Quitar ubicación' }));
    expect(screen.queryByText('Ubicación elegida:')).not.toBeInTheDocument();
    await waitFor(() => expect(field).toHaveFocus());
  });

  it('keeps one selected location, replaces it on the next valid scan and permits removal', async () => {
    const { field } = open(async (_token, code) => result(code === first.code ? first : second));
    const user = userEvent.setup();
    await user.keyboard(first.code + '{Enter}');
    await screen.findByText('Ubicación elegida:');
    await user.keyboard(second.code + '{Tab}');
    await waitFor(() => expect(screen.getByText('Ubicación elegida:')).toHaveTextContent(second.code));
    expect(screen.getByText('Ubicación elegida:')).not.toHaveTextContent(first.code);
    expect(field).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Quitar ubicación' }));
    expect(screen.queryByText('Ubicación elegida:')).not.toBeInTheDocument();
  });

  it('ignores a slow older reply after a newer correct scan', async () => {
    let finish!: (value: LookupResult) => void;
    const delayed = new Promise<LookupResult>(resolve => { finish = resolve; });
    const { field } = open(async (_token, code) => code === 'WRONG' ? delayed : result(second));
    const user = userEvent.setup();
    await user.keyboard('WRONG{Enter}');
    expect(field).toHaveValue('');
    await user.keyboard(second.code + '{Enter}');
    await screen.findByText('Ubicación elegida:');
    await act(async () => { finish({ ok: false, error: 'Old failure' }); });
    expect(screen.getByText('Ubicación elegida:')).toHaveTextContent(second.code);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
