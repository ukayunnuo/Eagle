'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, message, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Text } = Typography;
const { Dragger } = Upload;

interface DragUploadProps {
  accept: string[];
  maxSize: number; // MB
  onFileSelect: (file: File) => void;
  preview?: boolean;
  disabled?: boolean;
  description?: string;
}

export default function DragUpload({
  accept,
  maxSize,
  onFileSelect,
  preview = true,
  disabled = false,
  description,
}: DragUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      // 检查文件格式
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!accept.includes(ext)) {
        message.error(`不支持的文件格式，请上传 ${accept.join(', ')} 格式`);
        return false;
      }

      // 检查文件大小
      if (file.size > maxSize * 1024 * 1024) {
        message.error(`文件大小不能超过 ${maxSize}MB`);
        return false;
      }

      setFileName(file.name);

      // 生成预览
      if (preview && file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      onFileSelect(file);
      return false;
    },
    [accept, maxSize, onFileSelect, preview]
  );

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    disabled,
    accept: accept.join(','),
    beforeUpload: handleFile,
    showUploadList: false,
    style: { width: '100%' },
  };

  return (
    <div>
      <Dragger {...uploadProps} style={{ background: '#0F172A', border: '2px dashed #334155' }}>
        {previewUrl ? (
          <div style={{ padding: '16px' }}>
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
            <Text style={{ color: '#94A3B8', display: 'block', marginTop: '8px' }}>
              {fileName}
            </Text>
          </div>
        ) : (
          <div style={{ padding: '40px 20px' }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#22C55E', fontSize: '48px' }} />
            </p>
            <p className="ant-upload-text" style={{ color: '#F8FAFC', fontSize: '16px' }}>
              点击或拖拽文件到此区域上传
            </p>
            <p className="ant-upload-hint" style={{ color: '#94A3B8' }}>
              {description || `支持 ${accept.join(', ')} 格式，最大 ${maxSize}MB`}
            </p>
            {fileName && (
              <Text style={{ color: '#22C55E', display: 'block', marginTop: '8px' }}>
                已选择: {fileName}
              </Text>
            )}
          </div>
        )}
      </Dragger>
    </div>
  );
}
