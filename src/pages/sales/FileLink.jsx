import React, { useState } from 'react';
import { Space, Tooltip, Popconfirm } from 'antd';
import { DownloadOutlined, CloseCircleOutlined, FileOutlined } from '@ant-design/icons';
import { FILE_ICON_MAP } from './constants.jsx';
import FilePreviewModal from './FilePreviewModal';

function FileLink({ fileUrl, fileName, onDelete }) {
  if (!fileUrl) return null;
  const ext = (fileName || fileUrl).split('.').pop()?.toLowerCase();
  const icon = FILE_ICON_MAP['.' + ext] || <FileOutlined />;
  const [previewOpen, setPreviewOpen] = useState(false);
  const displayName = fileName || fileUrl.split('/').pop();

  return (
    <>
      <Space size={4}>
        {icon}
        <a onClick={() => setPreviewOpen(true)} style={{ cursor: 'pointer' }}>{displayName}</a>
        <Tooltip title="下载"><a href={fileUrl} download={displayName}><DownloadOutlined /></a></Tooltip>
        {onDelete && (
          <Popconfirm title="确定删除附件？" onConfirm={() => onDelete()}>
            <a style={{ color: '#ff4d4f' }}><CloseCircleOutlined /></a>
          </Popconfirm>
        )}
      </Space>
      <FilePreviewModal open={previewOpen} fileUrl={fileUrl} fileName={displayName} onClose={() => setPreviewOpen(false)} />
    </>
  );
}

export default FileLink;