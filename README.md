> 项目整体结构,目录,架构设计详细文档在根目录[/docs](./docs/)下

### 本地开发

前置准备

- git/node24/pnpm11.13.1
- 准备redis和postgres数据库,配置参数在[server](./apps/server/)的.env文件定义,可以连接远端服务或参考[compose.local.yml](./compose.local.yml)在本机安装
- prisma首次初始化数据库表`prisma migrate dev --name init`,还需要初始化种子数据,[server](./apps/server/)项目下执行`pnpm prisma:seed`,为了避免数据冲突,增量需要自行构造查询写入逻辑,文件在[seeds](./apps/./server/src/prisma/seed.ts),用于初始化菜单和超级管理员账号; 如果是后期开发已有迁移数据而开发时数据库有重置,则执行`pnpm exec prisma migrate deploy`再执行`pnpm exec prisma db seed`以保持迁移记录一致
- 每次更新schema后需要执行`pnpm generate`同步prisma client,执行`prisma migrate dev --name anyname`同步数据库
- 如果想调试数据库备份功能,需要本机(win10)安装PostgreSQL Command Line Tools命令行工具并设置环境变量
