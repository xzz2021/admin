export enum RedisKeys {
  AccessIp = 'access_ip',
  CAPTCHA_IMG_PREFIX = 'captcha:img:',
  AUTH_TOKEN_PREFIX = 'auth:token:',
  AUTH_PERM_PREFIX = 'auth:permission:',
  RBAC_PERMISSIONS_PREFIX = 'rbac:permissions:',
  RBAC_PERM_GEN_PREFIX = 'rbac:perm-gen:',
  RBAC_PERM_LOCK_PREFIX = 'rbac:perm-lock:',
  AUTH_PASSWORD_V_PREFIX = 'auth:passwordVersion:',
  ONLINE_USER_PREFIX = 'online:user:',
  ONLINE_SESSION_PREFIX = 'online:session:',
  ONLINE_INDEX = 'online:index',
  TOKEN_BLACKLIST_PREFIX = 'token:blacklist:',
  MONITOR_METRICS = 'monitor:metrics',
  MONITOR_LATEST = 'monitor:latest',
  MONITOR_ERRORS = 'monitor:errors',
}
export const API_CACHE_PREFIX = 'api-cache:'
