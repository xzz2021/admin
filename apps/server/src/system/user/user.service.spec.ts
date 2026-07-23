import type { PgService } from '@/prisma/pg.service';
import type { RbacPermissionCacheService } from '@/processor/rbac';
import type { RtTokenService } from '@/system/auth/rt.token.service';
import type { TokenService } from '@/system/auth/token.service';
import type { RedisService } from '@liaoliaots/nestjs-redis';
import { UserService } from './user.service';

jest.mock('@/processor/utils', () => ({
  buildPrismaWhere: jest.fn(),
  formatDateToYMDHMS: jest.fn(),
  hashPayPassword: jest.fn(() => Promise.resolve('hashed')),
  verifyPayPassword: jest.fn(() => Promise.resolve(true)),
}));

describe('UserService session revocation', () => {
  const userUpdate = jest.fn();
  const userFindUnique = jest.fn();
  const invalidateUsers = jest.fn();
  const kickAccess = jest.fn();
  const kickRt = jest.fn();

  const createService = () =>
    new UserService(
      {
        user: { update: userUpdate, findUnique: userFindUnique },
        $transaction: jest.fn(),
      } as unknown as PgService,
      { getOrThrow: () => ({}) } as unknown as RedisService,
      { invalidateUsers } as unknown as RbacPermissionCacheService,
      { kickOthers: kickAccess } as unknown as TokenService,
      { kickOthers: kickRt } as unknown as RtTokenService,
      { get: () => 'api/public' } as unknown as import('@nestjs/config').ConfigService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    userUpdate.mockResolvedValue({ id: 'user-1' });
    invalidateUsers.mockResolvedValue(undefined);
    kickAccess.mockResolvedValue({ ok: true });
    kickRt.mockResolvedValue({ ok: true });
  });

  it('revokes all sessions after password change', async () => {
    userFindUnique.mockResolvedValue({ id: 'user-1', password: 'old-hash' });
    const service = createService();

    await service.updatePassword({ id: 'user-1', password: 'old-pass', newPassword: 'new-pass-1' });

    expect(kickAccess).toHaveBeenCalledWith('user-1');
    expect(kickRt).toHaveBeenCalledWith('user-1');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordChangedAt: expect.any(Date) }),
      }),
    );
  });

  it('revokes all sessions after admin password reset', async () => {
    const service = createService();

    await service.resetPassword({ id: 'user-1', password: 'NewPass_123!', operateId: 'admin-1' });

    expect(kickAccess).toHaveBeenCalledWith('user-1');
    expect(kickRt).toHaveBeenCalledWith('user-1');
  });

  it('revokes all sessions when user is disabled', async () => {
    const service = createService();

    await service.update({
      id: 'user-1',
      username: 'alice',
      phone: '13800138000',
      department: 'dept-1',
      roles: [],
      enabled: false,
    });

    expect(invalidateUsers).toHaveBeenCalledWith(['user-1']);
    expect(kickAccess).toHaveBeenCalledWith('user-1');
    expect(kickRt).toHaveBeenCalledWith('user-1');
  });

  it('does not revoke sessions when user remains enabled', async () => {
    const service = createService();

    await service.update({
      id: 'user-1',
      username: 'alice',
      phone: '13800138000',
      department: 'dept-1',
      roles: [],
      enabled: true,
    });

    expect(kickAccess).not.toHaveBeenCalled();
    expect(kickRt).not.toHaveBeenCalled();
  });
});
