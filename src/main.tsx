import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';
import { resetChangedEnvironment } from './runtimeConfig';

resetChangedEnvironment();

createRoot(document.getElementById('root')!).render(<App />);
