import React from 'react';
import { Modal } from 'antd';
import { FileOutlined } from '@ant-design/icons';
import useAuthStore from '../../store/authStore';

function FilePreviewModal({ open, fileUrl, fileName, onClose }) {
  if (!open) return null;
  const ext = (fileName || fileUrl || '').split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    return (
      <Modal open={open} onCancel={onClose} footer={null} width="90%" title={fileName || 'PDF预览'} style={{ top: 20 }}>
        <iframe src={fileUrl} style={{ width: '100%', height: 'calc(100vh - 160px)', border: 'none' }} />
      </Modal>
    );
  }

  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
    const token = useAuthStore.getState().token;
    const previewUrl = `/api/sales/preview?file=${encodeURIComponent(fileUrl)}&token=${encodeURIComponent(token)}`;
    return (
      <Modal open={open} onCancel={onClose} footer={null} width="90%" title={fileName || '文件预览'} style={{ top: 20 }}>
        <iframe src={previewUrl} style={{ width: '100%', height: 'calc(100vh - 160px)', border: 'none' }} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={fileName || '文件预览'}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <FileOutlined style={{ fontSize: 48, color: '#999' }} />
        <p style={{ marginTop: 16 }}>此文件类型不支持预览</p>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">下载查看</a>
      </div>
    </Modal>
  );
}

export default FilePreviewModal;