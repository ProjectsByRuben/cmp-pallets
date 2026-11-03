import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => { window.CMP_CONFIG = { database: 'cmpslu', backend: 'https://fixture-odoo.invalid', appOrigin: 'https://pallets.cmp3.es' }; });

afterEach(() => { cleanup(); sessionStorage.clear(); });
