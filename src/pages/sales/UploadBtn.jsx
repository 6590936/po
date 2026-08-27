import React, { useState } from 'react';
import { Space, Button, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { salesAPI } from '../../api';
import FileLink from './FileLink';

function UploadBtn({ value, onChange, accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif', maxSize = 50 }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (info) => {
    if (info.file.status === 'uploading') { setUploading(true); return; }
    if (info.file.status === 'done') {
      setUploading(false);
      const res = info.file.response;
      if (res.url) { onChange?.(res.url, res.name); message.success('上传成功'); }
      else { message.error(res.error || '上传失败'); }
    } else if (info.file.status === 'error') {
      setUploading(false); message.error('上传失败');
    }
  };

  const beforeUpload = (file) => {
    const isLt = file.size / 1024 / 1024 < maxSize;
    if (!isLt) { message.error(`文件不能超过${maxSize}MB`); return false; }
    return true;
  };

  return (
    <Space>
      <Upload
        customRequest={({ file, onSuccess, onError }) => {
          salesAPI.upload(file).then(res => {
            if (res.url) onSuccess(res, file);
            else onError(new Error(res.error));
          }).catch(onError);
        }}
        showUploadList={false}
        beforeUpload={beforeUpload}
        onChange={handleUpload}
        accept={accept}
      >
        <Button icon={<UploadOutlined />} loading={uploading}>{value ? '重新上传' : '上传文件'}</Button>
      </Upload>
      {value && <FileLink fileUrl={value} onDelete={() => onChange?.('', '')} />}
    </Space>
  );
}

export default UploadBtn;