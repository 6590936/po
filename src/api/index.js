// API 请求封装
import useAuthStore from '../store/authStore';

const BASE_URL = '/api';

// 获取存储的 token
function getToken() {
  return useAuthStore.getState().token;
}

// 通用请求方法
async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('认证失败，请重新登录');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '请求失败');
    }

    return data;
  } catch (err) {
    throw err;
  }
}

// 认证相关
export const authAPI = {
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => request('/auth/me'),
  getUsers: () => request('/auth/users'),
  createUser: (data) =>
    request('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteUser: (id) =>
    request(`/auth/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id, newPassword) =>
    request(`/auth/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    }),
};

// 客户相关
export const customerAPI = {
  getList: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/customers?${query}`);
  },
  getDetail: (id) => request(`/customers/${id}`),
  create: (data) =>
    request('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    request(`/customers/${id}`, { method: 'DELETE' }),
  addFollowup: (customerId, data) =>
    request(`/customers/${customerId}/followups`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getOverdue: () => request('/customers/reminders/overdue'),
  getToday: () => request('/customers/reminders/today'),
  getSalesList: () => request('/customers/meta/sales'),
  exportList: () => request('/customers/export/list'),
  exportFollowups: () => request('/customers/export/followups'),
  getGradeSuggestions: () => request('/customers/grade-suggestions'),
};

// 看板相关
export const dashboardAPI = {
  getData: (period = 'month') => request(`/dashboard?period=${period}`),
  getKPI: (month) => {
    const query = month ? `?month=${month}` : '';
    return request(`/dashboard/kpi${query}`);
  },
  getDiagnostics: () => request('/dashboard/diagnostics'),
};

// 每日活动记录
export const activityAPI = {
  saveToday: (data) =>
    request('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getToday: () => request('/activities/today'),
  getRange: (start, end) => request(`/activities/range?start=${start}&end=${end}`),
  getStats: (period = 'week') => request(`/activities/stats?period=${period}`),
};

// 报价管理
export const quoteAPI = {
  getList: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/quotes?${query}`);
  },
  create: (data) =>
    request('/quotes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    request(`/quotes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    request(`/quotes/${id}`, { method: 'DELETE' }),
  getStats: () => request('/quotes/stats'),
};

// 周报
export const reportAPI = {
  getWeeklyList: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/reports/weekly?${query}`);
  },
  saveWeekly: (data) =>
    request('/reports/weekly', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getWeekStats: () => request('/reports/weekly/stats'),
};

// 云无云数据
export const yunwuyunAPI = {
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/yunwuyun/orders?${query}`);
  },
  getOrderDetail: (id) => request(`/yunwuyun/orders/${id}`),
  createOrder: (data) => request('/yunwuyun/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id, data) => request(`/yunwuyun/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrder: (id) => request(`/yunwuyun/orders/${id}`, { method: 'DELETE' }),

  getCustomers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/yunwuyun/customers?${query}`);
  },
  getCustomerFilters: () => request('/yunwuyun/customers/filters'),
  getCustomerDetail: (id) => request(`/yunwuyun/customers/${id}`),
  createCustomer: (data) => request('/yunwuyun/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/yunwuyun/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/yunwuyun/customers/${id}`, { method: 'DELETE' }),

  getStats: () => request('/yunwuyun/stats'),
  syncOrders: () => request('/yunwuyun/sync-orders', { method: 'POST' }),
  syncCustomers: () => request('/yunwuyun/sync-customers', { method: 'POST' }),

  // 客户账号管理
  enableLogin: (id, login_account, password) => request(`/yunwuyun/customers/${id}/enable-login`, { method: 'PUT', body: JSON.stringify({ login_account, password }) }),
  disableLogin: (id) => request(`/yunwuyun/customers/${id}/disable-login`, { method: 'PUT' }),
  resetCustomerPassword: (id, password) => request(`/yunwuyun/customers/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) }),
};

// 角色管理
export const roleAPI = {
  getRoles: () => request('/roles'),
  getMenus: () => request('/roles/menus'),
  getPermissions: () => request('/roles/permissions'),
  createRole: (data) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id, data) => request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id) => request(`/roles/${id}`, { method: 'DELETE' }),
};

// 客户端门户
export const clientAPI = {
  login: (data) => request('/client/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/client/me'),
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/client/orders?${query}`);
  },
  getOrderDetail: (id) => request(`/client/orders/${id}`),
  getStats: () => request('/client/stats'),
  updateProfile: (data) => request('/client/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

// 企业微信推送
export const wechatAPI = {
  getConfig: () => request('/wechat/config'),
  saveConfig: (data) => request('/wechat/config', { method: 'PUT', body: JSON.stringify(data) }),
  testWebhook: (webhook_url) => request('/wechat/test-webhook', { method: 'POST', body: JSON.stringify({ webhook_url }) }),
  saveCustomerWebhook: (id, data) => request(`/wechat/customer-webhook/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  pushOrders: (data) => request('/wechat/push', { method: 'POST', body: JSON.stringify(data) }),
  getLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/wechat/logs?${query}`);
  },
};

export default { authAPI, customerAPI, dashboardAPI, activityAPI, quoteAPI, reportAPI, yunwuyunAPI, roleAPI, clientAPI, wechatAPI };