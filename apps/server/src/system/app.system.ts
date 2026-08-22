import { AuthModule } from '@/system/auth/auth.module'
import { CaptchaModule } from '@/system/captcha/captcha.module'
import { DepartmentModule } from '@/system/department/department.module'
import { DictionaryModule } from '@/system/dictionary/dictionary.module'
import { DbBackupModule } from '@/system/db-backup/db-backup.module'
import { MenuModule } from '@/system/menu/menu.module'
import { MessageModule } from '@/system/message/message.module'
import { MonitorModule } from '@/system/monitor/monitor.module'
import { OnlineModule } from '@/system/online/online.module'
import { PermissionModule } from '@/system/permission/permission.module'
import { RoleModule } from '@/system/role/role.module'
import { SessionModule } from '@/system/session/session.module'
import { UserModule } from '@/system/user/user.module'
export const CORE_SYSTEM_MODULE = [
  SessionModule,
  DepartmentModule,
  MenuModule,
  PermissionModule,
  UserModule,
  DictionaryModule,
  DbBackupModule,
  AuthModule,
  RoleModule,
  CaptchaModule,
  MonitorModule,
  OnlineModule,
  MessageModule,
]
