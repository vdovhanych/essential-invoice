import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it('fetches logos using an Authorization header without putting credentials in URLs', async () => {
  localStorage.setItem('token', 'synthetic-session');
  const blob = new Blob(['synthetic-image'], { type: 'image/png' });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
  vi.stubGlobal('fetch', fetchMock);
  expect(await api.blob('/auth/me/logo')).toBe(blob);
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/me/logo', expect.objectContaining({
    headers: { Authorization: 'Bearer synthetic-session' }, cache: 'no-store',
  }));
});
