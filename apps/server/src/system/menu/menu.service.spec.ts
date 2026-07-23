import type { PgService } from '@/prisma/pg.service';
import { MenuService } from './menu.service';

describe('MenuService tree updates', () => {
  const findMany = jest.fn();
  const update = jest.fn();
  const transaction = jest.fn(async (callback: (tx: { menu: { findMany: typeof findMany; update: typeof update } }) => Promise<unknown>) =>
    callback({ menu: { findMany, update } }),
  );

  const service = new MenuService({ $transaction: transaction } as unknown as PgService);

  beforeEach(() => {
    jest.clearAllMocks();
    update.mockResolvedValue({ id: 'menu-1' });
    findMany.mockResolvedValue([
      { id: 'menu-1', parentId: 'root' },
      { id: 'child', parentId: 'menu-1' },
      { id: 'root', parentId: null },
    ]);
  });

  it('preserves the current parent when parentId is omitted', async () => {
    await service.update({
      id: 'menu-1',
      name: 'Menu',
      path: 'menu',
      type: 1,
      sort: 0,
      enabled: true,
      title: 'Menu',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'menu-1' },
        data: expect.not.objectContaining({ parent: expect.anything() }),
      }),
    );
  });

  it('rejects moving a menu under its descendant', async () => {
    await expect(
      service.update({
        id: 'menu-1',
        parentId: 'child',
        name: 'Menu',
        path: 'menu',
        type: 1,
        sort: 0,
        enabled: true,
        title: 'Menu',
      }),
    ).rejects.toThrow('不能将菜单移动到自己的后代节点下');
    expect(update).not.toHaveBeenCalled();
  });
});
