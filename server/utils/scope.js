// 主体（租户）数据权限公共判定
// 平台管理员：tenant_id 为空 + system:platform 权限
// 主体管理员：tenant_id 非空 + system:tenant_admin（兼容旧的 data:all / system:platform）
// 普通用户：只能看自己的数据

export const PLATFORM_ONLY_MENUS = ['/yunwuyun', '/wechat'];
export const PLATFORM_ONLY_PERMISSIONS = ['data:all', 'system:platform'];

export function isPlatformAdmin(user) {
  if (!user) return false;
  return !user.tenant_id && (user.permissions || []).includes('system:platform');
}

export function isTenantAdmin(user) {
  if (!user || !user.tenant_id) return false;
  const perms = user.permissions || [];
  return user.role === 'admin'
    || perms.includes('system:tenant_admin')
    || perms.includes('system:platform')
    || perms.includes('data:all')
    || perms.includes('data:tenant');
}

export function isAdminUser(user) {
  return isPlatformAdmin(user) || isTenantAdmin(user);
}

// 数据查询的主体过滤值：平台管理员返回 undefined（不做主体过滤），
// 其余返回自身 tenant_id；缺失时返回 -1，保证查不到任何数据（失败即关闭）
export function tenantScope(user) {
  if (isPlatformAdmin(user)) return undefined;
  return user?.tenant_id || -1;
}

// 非平台管理员去掉平台专属菜单（FMS数据同步、企业微信推送）
export function stripPlatformOnlyMenus(menus, user) {
  const list = menus || [];
  if (isPlatformAdmin(user)) return list;
  return list.filter(m => !PLATFORM_ONLY_MENUS.includes(m));
}