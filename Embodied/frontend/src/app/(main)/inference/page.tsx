'use client';

import { Tabs, Typography } from 'antd';
import {
  PictureOutlined,
  VideoCameraOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import dynamic from 'next/dynamic';

const ImageInference = dynamic(() => import('@/components/inference/ImageInference'), {
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span style={{ color: '#64748B' }}>加载中...</span></div>,
});
const VideoInference = dynamic(() => import('@/components/inference/VideoInference'), {
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span style={{ color: '#64748B' }}>加载中...</span></div>,
});
const BatchInference = dynamic(() => import('@/components/inference/BatchInference'), {
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span style={{ color: '#64748B' }}>加载中...</span></div>,
});

const { Title } = Typography;

const tabItems = [
  {
    key: 'image',
    label: (
      <span>
        <PictureOutlined />
        图片推理
      </span>
    ),
    children: <ImageInference />,
  },
  {
    key: 'video',
    label: (
      <span>
        <VideoCameraOutlined />
        视频推理
      </span>
    ),
    children: <VideoInference />,
  },
  {
    key: 'batch',
    label: (
      <span>
        <FolderOutlined />
        批量推理
      </span>
    ),
    children: <BatchInference />,
  },
];

export default function InferencePage() {
  return (
    <div>
      <Title level={2} style={{ color: '#F8FAFC', marginBottom: 24 }}>
        推理工作台
      </Title>

      <Tabs
        defaultActiveKey="image"
        items={tabItems}
        style={{ color: '#F8FAFC' }}
      />
    </div>
  );
}
