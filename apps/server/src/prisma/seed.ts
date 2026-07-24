/*
种子服务需要  菜单  初始数据

*/

import { prisma, Prisma } from './lib/prisma';
import { createSeedAdmin } from './seed-admin';
import { _menu, _permission, _role } from './sql';

async function create_menus_batch(menu_data: any[], tx: Prisma.TransactionClient, parentId?: string) {
  for (const menu_item of menu_data) {
    const { children, ...menu_fields } = menu_item;
    const menu = await tx.menu.create({
      data: {
        ...menu_fields,
        parentId: parentId || null,
      },
    });
    if (Array.isArray(children) && children.length > 0) {
      await create_menus_batch(children, tx, menu.id);
    }
  }
}
async function create_menus(menu_data: any[], tx: Prisma.TransactionClient) {
  await create_menus_batch(menu_data, tx);
}

async function create_roles(role_data: any[], tx: Prisma.TransactionClient) {
  for (const role_item of role_data) {
    await tx.role.create({
      data: role_item,
    });
  }
}

async function create_users(user_data: { username: string; password: string; phone: string }, tx: Prisma.TransactionClient) {
  // 1. 查出超管角色id 2. 创建用户并关联角色
  const super_admin_role = await tx.role.findFirst({
    where: {
      code: 'super_admin',
    },
  });
  if (!super_admin_role) {
    throw new Error('Super admin role not found');
  }
  await tx.user.create({
    data: {
      ...user_data,
      // 因为 User.roles 关联的不是 Role，而是中间表 UserRole
      roles: {
        create: {
          role: {
            connect: { id: super_admin_role.id },
          },
        },
      },
    },
  });
  console.log(`🌱 Created user: ${user_data.username}`);
}

const PERMISSION_TYPE_MAP = {
  button: 'BUTTON',
  data: 'DATA',
  api: 'API',
  other: 'OTHER',
};
//  创建权限  先查找menu表path字段= resource的menuId,进行关联, code的值取resource:code
async function create_permissions(permission_data: any[], tx: Prisma.TransactionClient) {
  for (const permission_item of permission_data) {
    const { resource, code, name, type } = permission_item;
    const menu = await tx.menu.findFirst({
      where: {
        path: resource,
      },
      select: {
        id: true,
      },
    });
    if (!menu) {
      throw new Error(`Menu ${resource} not found`);
    }
    await tx.permission.create({
      data: { name, code: `${resource}:${code}`, menuId: menu.id, type: PERMISSION_TYPE_MAP[type] },
    });
  }
}
async function main() {
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const menuCount = await tx.menu.count();
      if (menuCount > 0) {
        console.log(`ℹ️ Menu already contains ${menuCount} records; skipping full seed.`);
        await ensureMonitorMenu(tx);
        return;
      }

      await create_menus(_menu, tx);
      console.log('🌱 Seeding menus data success...');
      await create_roles(_role, tx);
      console.log('🌱 Seeding roles data success...');
      await create_permissions(_permission, tx);
      console.log('🌱 Seeding permissions data success...');
      const seedAdmin = await createSeedAdmin(process.env);
      await create_users(seedAdmin, tx);
      console.log('✅ Seeding finished.');
    },
    { timeout: 60_000 },
  );
}

/** 已有库增量补齐服务监控菜单与权限（幂等） */
async function ensureMonitorMenu(tx: Prisma.TransactionClient) {
  const exists = await tx.menu.findFirst({ where: { path: 'server' }, select: { id: true } });
  if (exists) {
    const perm = await tx.permission.findFirst({ where: { code: 'server:view' }, select: { id: true } });
    if (!perm) {
      await tx.permission.create({
        data: { name: '查看', code: 'server:view', menuId: exists.id, type: 'BUTTON' },
      });
      console.log('🌱 Ensured permission server:view');
    }
    return;
  }

  const systemMenu = await tx.menu.findFirst({ where: { path: 'system' }, select: { id: true } });
  if (!systemMenu) {
    console.log('⚠️ System menu not found, skip ensureMonitorMenu');
    return;
  }

  const menu = await tx.menu.create({
    data: {
      name: 'Server',
      path: 'server',
      redirect: null,
      type: 1,
      component: 'views/System/Server/Server',
      sort: 0,
      enabled: true,
      title: 'router.server',
      icon: 'monitor',
      hidden: false,
      affix: false,
      activeMenu: null,
      alwaysShow: false,
      breadcrumb: true,
      canTo: false,
      noCache: false,
      noTagsView: false,
      parentId: systemMenu.id,
    },
  });
  await tx.permission.create({
    data: { name: '查看', code: 'server:view', menuId: menu.id, type: 'BUTTON' },
  });
  console.log('🌱 Ensured monitor menu & permission server:view');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
