import Redis from 'ioredis';
import { SessionRegistry } from './session-registry';

describe('SessionRegistry', () => {
  const values = new Map<string, string>();
  const redis = {
    get: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    set: jest.fn((key: string, value: string, ...args: unknown[]) => {
      if (args.includes('NX') && values.has(key)) return Promise.resolve(null);
      values.set(key, String(value));
      return Promise.resolve('OK');
    }),
    del: jest.fn((...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (values.delete(key)) count++;
      }
      return Promise.resolve(count);
    }),
  };

  const createRegistry = (maxSessions = 2) =>
    new SessionRegistry(redis as unknown as Redis, {
      listPrefix: 'sessions:',
      expiryPrefix: 'expiry:',
      blacklistPrefix: 'blacklist:',
      lockPrefix: 'lock:',
      ttlSeconds: 3600,
      maxSessions,
    });

  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
  });

  it('registers sessions and evicts the oldest above the limit', async () => {
    const registry = createRegistry(1);
    const exp = Math.floor(Date.now() / 1000) + 1800;

    await registry.register('user-1', 'jti-1', exp);
    await registry.register('user-1', 'jti-2', exp);

    await expect(registry.listSessions('user-1')).resolves.toEqual(['jti-2']);
    await expect(registry.isBlacklisted('jti-1')).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith('sessions:user-1', JSON.stringify(['jti-2']), 'EX', 3600);
  });

  it('rotates a session and rejects the old jti', async () => {
    const registry = createRegistry();
    const exp = Math.floor(Date.now() / 1000) + 1800;

    await registry.register('user-1', 'old-jti', exp);
    await registry.register('user-1', 'new-jti', exp, 'old-jti');

    await expect(registry.listSessions('user-1')).resolves.toEqual(['new-jti']);
    await expect(registry.isBlacklisted('old-jti')).resolves.toBe(true);
  });

  it('revokes all sessions and removes the active list', async () => {
    const registry = createRegistry();
    const exp = Math.floor(Date.now() / 1000) + 1800;
    await registry.register('user-1', 'jti-1', exp);
    await registry.register('user-1', 'jti-2', exp);

    await registry.revokeAll('user-1');

    await expect(registry.listSessions('user-1')).resolves.toEqual([]);
    await expect(registry.isBlacklisted('jti-1')).resolves.toBe(true);
    await expect(registry.isBlacklisted('jti-2')).resolves.toBe(true);
  });
});
