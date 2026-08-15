// 常量定义

// 客户状态
export const CUSTOMER_STATUS = {
  potential: { label: '潜在客户', color: '#8c8c8c' },
  contacted: { label: '已触达', color: '#2E86C1' },
  communicated: { label: '有效沟通', color: '#52c41a' },
  quoting: { label: '报价中', color: '#faad14' },
  trial: { label: '试单中', color: '#722ed1' },
  deal: { label: '已成交', color: '#1B4F72' },
  lost: { label: '已流失', color: '#ff4d4f' },
};

// 客户等级
export const CUSTOMER_GRADE = {
  A: { label: 'A级 - 重点客户', color: '#ff4d4f', followupFrequency: '每天跟进', followupDays: 1 },
  B: { label: 'B级 - 意向客户', color: '#faad14', followupFrequency: '每周2-3次', followupDays: 3 },
  C: { label: 'C级 - 培育客户', color: '#2E86C1', followupFrequency: '每周1次', followupDays: 7 },
  D: { label: 'D级 - 储备客户', color: '#8c8c8c', followupFrequency: '每月1-2次', followupDays: 30 },
};

// 客户类型
export const CUSTOMER_TYPE = {
  '跨境电商': { color: '#2E86C1' },
  '传统外贸': { color: '#52c41a' },
  '储能电池': { color: '#722ed1' },
  '同行货代': { color: '#faad14' },
};

// 跟进方式
export const FOLLOWUP_METHOD = {
  phone: { label: '电话', color: '#2E86C1' },
  wechat: { label: '微信', color: '#52c41a' },
  email: { label: '邮件', color: '#faad14' },
  meeting: { label: '面谈', color: '#722ed1' },
};

// 主题色
export const THEME = {
  primary: '#1B4F72',
  secondary: '#2E86C1',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  background: '#f0f2f5',
};

// 状态文本映射
export function getStatusText(status) {
  return CUSTOMER_STATUS[status]?.label || status;
}

export function getStatusColor(status) {
  return CUSTOMER_STATUS[status]?.color || '#8c8c8c';
}

export function getGradeColor(grade) {
  return CUSTOMER_GRADE[grade]?.color || '#8c8c8c';
}

export function getMethodText(method) {
  return FOLLOWUP_METHOD[method]?.label || method;
}
