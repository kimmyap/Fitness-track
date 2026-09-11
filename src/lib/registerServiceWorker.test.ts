import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './registerServiceWorker';

const register = vi.fn<(url: string, opts?: RegistrationOptions) => Promise<unknown>>();

/** Fire the listener registered on window's `load`, which is where we defer to. */
function fireLoad(): void {
  window.dispatchEvent(new Event('load'));
}

beforeEach(() => {
  register.mockReset();
  register.mockResolvedValue({});
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('registerServiceWorker', () => {
  it('does nothing in development, where a worker would serve stale modules', () => {
    vi.stubEnv('PROD', false);
    registerServiceWorker();
    fireLoad();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers under the deployed base path, not the server root', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('BASE_URL', '/Fitness-track/');
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled(); // deferred until load

    fireLoad();
    expect(register).toHaveBeenCalledWith('/Fitness-track/sw.js', { scope: '/Fitness-track/' });
  });

  it('survives a browser without service workers', () => {
    vi.stubEnv('PROD', true);
    Reflect.deleteProperty(navigator, 'serviceWorker');
    expect(() => {
      registerServiceWorker();
      fireLoad();
    }).not.toThrow();
  });

  it('warns instead of throwing when registration is rejected', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('BASE_URL', '/Fitness-track/');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    register.mockRejectedValue(new Error('insecure origin'));

    registerServiceWorker();
    fireLoad();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
