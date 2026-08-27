import { FilePdfOutlined, FileExcelOutlined, FileWordOutlined, FilePptOutlined } from '@ant-design/icons';
import React from 'react';

export const FILE_ICON_MAP = {
  '.pdf': <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />,
  '.xls': <FileExcelOutlined style={{ color: '#52c41a', fontSize: 18 }} />,
  '.xlsx': <FileExcelOutlined style={{ color: '#52c41a', fontSize: 18 }} />,
  '.doc': <FileWordOutlined style={{ color: '#1890ff', fontSize: 18 }} />,
  '.docx': <FileWordOutlined style={{ color: '#1890ff', fontSize: 18 }} />,
  '.ppt': <FilePptOutlined style={{ color: '#fa8c16', fontSize: 18 }} />,
  '.pptx': <FilePptOutlined style={{ color: '#fa8c16', fontSize: 18 }} />,
};

export const MATERIAL_CATEGORIES = [
  { value: 'product', label: '产品知识' },
  { value: 'industry', label: '行业知识' },
  { value: 'process', label: '公司流程' },
  { value: 'software', label: '软件操作' },
  { value: 'compliance', label: '合规要求' },
  { value: 'other', label: '其他' },
];

export const TASK_TYPES = [
  { value: 'study', label: '学习资料' },
  { value: 'memorize', label: '背诵话术' },
  { value: 'practice', label: '模拟实操' },
  { value: 'real_call', label: '真实通话' },
  { value: 'quiz', label: '考核测验' },
];