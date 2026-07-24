import { AuthModule } from '@/system/auth/auth.module';
import { CaptchaModule } from '@/system/captcha/captcha.module';
import { DepartmentModule } from '@/system/department/department.module';
import { DictionaryModule } from '@/system/dictionary/dictionary.module';
import { MenuModule } from '@/system/menu/menu.module';
import { MonitorModule } from '@/system/monitor/monitor.module';
import { PermissionModule } from '@/system/permission/permission.module';
import { RoleModule } from '@/system/role/role.module';
import { UserModule } from '@/system/user/user.module';
export const CORE_SYSTEM_MODULE = [
  DepartmentModule,
  MenuModule,
  PermissionModule,
  UserModule,
  DictionaryModule,
  AuthModule,
  RoleModule,
  CaptchaModule,
  MonitorModule,
];
