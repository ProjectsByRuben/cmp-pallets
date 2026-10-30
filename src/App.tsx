import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, OdooAccessApi, type AccessApi, type Bootstrap, type Employee, type Profile } from './api';
import logo from '../dist/brand/cmp-logo-negativo.png';
import { ScanWorkspace } from './ScanWorkspace';

type Page = 'loading' | 'login' | 'choose' | 'pin' | 'ready' | 'blocked' | 'offline';
const defaultApi = new OdooAccessApi();

function BrandHeader() {
  return <header className="access-header"><div><img src={logo} alt="CMP"/><span>Pallets</span></div></header>;
}

function Icon({ kind }: { kind: 'lock' | 'user' | 'check' | 'arrow' }) {
  const paths = {
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    check: <><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

export function App({ api = defaultApi }: { api?: AccessApi }) {
  const [page, setPage] = useState<Page>('loading');
  const [data, setData] = useState<Bootstrap | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [setup, setSetup] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Credentials and identity tokens live only in this mounted tab, never storage.
  const token = useRef('');
  const running = useRef(false);
  const pinInput = useRef<HTMLInputElement>(null);

  function clearIdentity() {
    token.current = '';
    setProfile(null);
    setEmployee(null);
    setSelectedId('');
    setPin('');
    setConfirmation('');
  }

  function accepted(result: { token: string; profile: Profile }) {
    token.current = result.token;
    setProfile(result.profile);
    setPage('ready');
    setError('');
  }

  async function bootstrap() {
    clearIdentity();
    setData(null);
    const initial = await api.bootstrap();
    setData(initial);
    if (initial.requires_pin) {
      if (!initial.employees.length) {
        setError('No hay empleados con acceso a CMP Pallets para esta cuenta. Consulta con tu responsable.');
        setPage('blocked');
      } else {
        setPage('choose');
      }
    } else {
      const result = await api.unlock(null, '');
      if (!result.ok) throw new ApiError(result.error, 'access');
      accepted(result);
    }
  }

  function failed(reason: unknown) {
    const problem = reason instanceof ApiError ? reason : new ApiError('No se ha podido completar el acceso. Vuelve a intentarlo.', 'network');
    setProfile(null);
    setPin('');
    setConfirmation('');
    setError(problem.message);
    if (problem.kind === 'session') {
      clearIdentity();
      setData(null);
      setPage('login');
    } else if (problem.kind === 'network') {
      setPage('offline');
    } else {
      token.current = '';
      setPage('blocked');
    }
  }

  async function run(task: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try { await task(); } catch (reason) { failed(reason); }
    finally { running.current = false; setBusy(false); }
  }

  useEffect(() => {
    void run(async () => {
      try { await bootstrap(); }
      catch (reason) {
        // An anonymous initial load (including reload after logout) is normal.
        // Expiry while using the app still goes through failed() with its notice.
        if (!(reason instanceof ApiError) || reason.kind !== 'session') throw reason;
        setError('');
        setPage('login');
      }
    });
  }, [api]);

  useEffect(() => {
    if (page === 'pin' && !busy) pinInput.current?.focus();
  }, [page, busy]);

  useEffect(() => {
    if (page !== 'ready') return;
    const validate = () => {
      if (document.visibilityState === 'hidden') return;
      void run(async () => { accepted({ token: token.current, profile: await api.profile(token.current) }); });
    };
    const timer = window.setInterval(validate, 60000);
    window.addEventListener('focus', validate);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', validate); };
  }, [page, api]);

  function selectEmployee(event: FormEvent) {
    event.preventDefault();
    const chosen = data?.employees.find(item => item.id === Number(selectedId));
    if (!chosen) return;
    setEmployee(chosen);
    setSetup(chosen.pin_setup_required);
    setError('');
    setPage('pin');
  }

  function identify(event: FormEvent) {
    event.preventDefault();
    if (!employee) return;
    void run(async () => {
      try {
        const result = setup ? await api.setupPin(employee.id, pin, confirmation) : await api.unlock(employee.id, pin);
        setPin('');
        setConfirmation('');
        if (result.ok) accepted(result);
        else {
          if (typeof result.needs_setup === 'boolean') setSetup(result.needs_setup);
          setError(result.error);
        }
      } finally {
        setPin('');
        setConfirmation('');
      }
    });
  }

  const subtitle = page === 'choose' ? 'Selecciona tu nombre para continuar.'
    : page === 'pin' ? (setup ? 'Crea tu PIN de 4 a 8 números.' : 'Introduce tu PIN de empleado.')
    : page === 'login' ? 'Accede con la cuenta Odoo de este equipo.' : '';

  if (page === 'ready' && profile) return <><BrandHeader/><ScanWorkspace
    api={api} token={token.current} profile={profile} onAccessError={failed} switching={busy}
    onChangeAccount={() => void run(async () => {
      clearIdentity();
      setPage('loading');
      await api.logout();
      setData(null);
      setPage('login');
    })}
    onSwitch={() => void run(async () => {
      const previous = token.current;
      clearIdentity();
      setPage('loading');
      await api.lock(previous);
      await bootstrap();
    })}
  /></>;

  return <>
    <BrandHeader/>
    <main className="access-main">
      <section className="access-card" aria-label="Acceso a CMP Pallets" aria-busy={busy}>
        <div className={'access-symbol ' + (page === 'ready' ? 'verified' : '')}><Icon kind={page === 'ready' ? 'check' : page === 'choose' ? 'user' : 'lock'}/></div>
        <p className="eyebrow">CMP PALLETS</p>
        <h1>{page === 'loading' ? 'Conectando…' : page === 'ready' ? 'Acceso confirmado' : page === 'choose' ? '¿Quién eres?' : page === 'pin' ? (setup ? 'Crea tu PIN' : 'Tu PIN') : page === 'offline' ? 'Sin conexión' : page === 'blocked' ? 'Acceso no disponible' : 'Acceder'}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {error && <p className="access-error" role="alert">{error}</p>}

        {page === 'login' && <form onSubmit={event => {
          event.preventDefault();
          void run(async () => {
            try { await api.login(login.trim(), password); }
            catch (reason) {
              if (reason instanceof ApiError && reason.kind !== 'network') { setError(reason.message); return; }
              throw reason;
            } finally { setPassword(''); }
            await bootstrap();
          });
        }}>
          <label htmlFor="account">Usuario Odoo</label>
          <input id="account" autoComplete="username" autoCapitalize="none" spellCheck={false} value={login} onChange={event => setLogin(event.target.value)} required disabled={busy}/>
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy}/>
          <button className="primary-action" disabled={busy || !login.trim() || !password}>{busy ? 'Accediendo…' : 'Acceder'}<Icon kind="arrow"/></button>
        </form>}

        {page === 'choose' && <form onSubmit={selectEmployee}>
          <label htmlFor="employee">Empleado</label>
          <select id="employee" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={busy} required>
            <option value="">Selecciona tu nombre</option>
            {data?.employees.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button className="primary-action" disabled={!selectedId || busy}>Continuar<Icon kind="arrow"/></button>
        </form>}

        {page === 'pin' && <>
          <p className="employee-name">{employee?.name}</p>
          <form onSubmit={identify}>
            <label htmlFor="pin">{setup ? 'Nuevo PIN' : 'PIN'}</label>
            <input ref={pinInput} id="pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={event => setPin(event.target.value)} required minLength={setup ? 4 : undefined} maxLength={setup ? 8 : 128} pattern={setup ? '[0-9]{4,8}' : undefined} disabled={busy}/>
            {setup && <><label htmlFor="confirmation">Confirma tu PIN</label><input id="confirmation" type="password" inputMode="numeric" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={4} maxLength={8} pattern="[0-9]{4,8}" disabled={busy}/></>}
            <button className="primary-action" disabled={busy || !pin || (setup && !confirmation)}>{busy ? 'Verificando…' : setup ? 'Crear PIN y entrar' : 'Entrar'}<Icon kind="arrow"/></button>
          </form>
          <button className="secondary-action" disabled={busy} onClick={() => { clearIdentity(); setError(''); setPage('choose'); }}>Volver</button>
        </>}

        {(page === 'offline' || page === 'blocked') && <button className="primary-action" disabled={busy} onClick={() => void run(async () => {
          if (token.current) accepted({ token: token.current, profile: await api.profile(token.current) });
          else await bootstrap();
        })}>{busy ? 'Conectando…' : 'Reintentar'}<Icon kind="arrow"/></button>}

        {(data || page === 'blocked') && <div className="account-footer"><span>{data ? 'Cuenta: ' + data.user.name : 'Sesión Odoo activa'}</span><button disabled={busy} onClick={() => void run(async () => {
          clearIdentity();
          setPage('loading');
          await api.logout();
          setData(null);
          setPage('login');
        })}>Cambiar cuenta</button></div>}
      </section>
      <footer className="access-footer">CMP · Gestión de pallets</footer>
    </main>
  </>;
}
