'use client';

import { Card, Progress, Button, Typography, Space, Tag } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  StopOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface ProgressCardProps {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number; // 0-100
  message?: string;
  onCancel?: () => void;
  taskId?: string;
}

const statusConfig = {
  pending: {
    color: '#F59E0B',
    icon: <ClockCircleOutlined />,
    label: '排队中',
  },
  processing: {
    color: '#3B82F6',
    icon: <SyncOutlined spin />,
    label: '处理中',
  },
  completed: {
    color: '#22C55E',
    icon: <CheckCircleOutlined />,
    label: '已完成',
  },
  failed: {
    color: '#EF4444',
    icon: <CloseCircleOutlined />,
    label: '失败',
  },
  cancelled: {
    color: '#64748B',
    icon: <StopOutlined />,
    label: '已取消',
  },
};

export default function ProgressCard({
  status,
  progress = 0,
  message,
  onCancel,
  taskId,
}: ProgressCardProps) {
  const config = statusConfig[status];

  return (
    <Card
      style={{
        background: '#1E293B',
        border: '1px solid #334155',
        borderRadius: 12,
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span style={{ color: config.color, fontSize: '20px' }}>{config.icon}</span>
            <Tag color={config.color}>{config.label}</Tag>
          </Space>
          {taskId && (
            <Text style={{ color: '#64748B', fontSize: '12px', fontFamily: "var(--font-fira-code)" }}>
              {taskId.substring(0, 8)}...
            </Text>
          )}
        </div>

        {status === 'processing' && (
          <div>
            <Progress
              percent={progress}
              strokeColor="#22C55E"
              trailColor="#334155"
              format={(percent) => (
                <span style={{ color: '#F8FAFC', fontFamily: "var(--font-fira-code)" }}>
                  {percent}%
                </span>
              )}
            />
            {message && (
              <Text style={{ color: '#94A3B8', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                {message}
              </Text>
            )}
          </div>
        )}

        {status === 'pending' && (
          <div>
            <Progress
              percent={0}
              strokeColor="#F59E0B"
              trailColor="#334155"
              format={() => (
                <span style={{ color: '#94A3B8' }}>等待中...</span>
              )}
            />
            {message && (
              <Text style={{ color: '#94A3B8', fontSize: '12px' }}>
                {message}
              </Text>
            )}
          </div>
        )}

        {status === 'failed' && message && (
          <div
            style={{
              background: '#1C0A0A',
              border: '1px solid #7F1D1D',
              borderRadius: 8,
              padding: '12px',
            }}
          >
            <Text style={{ color: '#FCA5A5' }}>{message}</Text>
          </div>
        )}

        {(status === 'pending' || status === 'processing') && onCancel && (
          <Button
            danger
            icon={<StopOutlined />}
            onClick={onCancel}
            block
          >
            取消任务
          </Button>
        )}
      </Space>
    </Card>
  );
}
