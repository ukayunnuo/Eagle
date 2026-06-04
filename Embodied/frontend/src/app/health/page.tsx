'use client';

import { useState, useEffect } from 'react';
import { Card, Typography, Space, Tag, Button, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import api from '@/lib/api/client';

const { Title, Text } = Typography;

interface HealthStatus {
  status: string;
  model: string;
  device: string;
  dtype: string;
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/models');
      setHealth(response.data);
    } catch (err: unknown) {
      const axiosError = err as { message?: string };
      setError(axiosError.message || '无法连接到后端服务');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <Title level={2} style={{ color: '#F8FAFC', textAlign: 'center' }}>
        系统状态检查
      </Title>

      <Card
        style={{
          background: '#1E293B',
          border: '1px solid #334155',
          borderRadius: 12,
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ textAlign: 'center' }}>
            {loading ? (
              <SyncOutlined spin style={{ fontSize: '48px', color: '#3B82F6' }} />
            ) : error ? (
              <CloseCircleOutlined style={{ fontSize: '48px', color: '#EF4444' }} />
            ) : (
              <CheckCircleOutlined style={{ fontSize: '48px', color: '#22C55E' }} />
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <Text style={{ color: '#F8FAFC', fontSize: '18px' }}>
              {loading ? '检查中...' : error ? '连接失败' : '服务正常'}
            </Text>
          </div>

          {error && (
            <div style={{ background: '#1C0A0A', padding: '16px', borderRadius: '8px' }}>
              <Text style={{ color: '#FCA5A5' }}>{error}</Text>
            </div>
          )}

          {health && (
            <div style={{ background: '#0F172A', padding: '16px', borderRadius: '8px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#94A3B8' }}>状态</Text>
                  <Tag color="green">{health.status}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#94A3B8' }}>模型</Text>
                  <Text style={{ color: '#F8FAFC' }}>{health.model}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#94A3B8' }}>设备</Text>
                  <Text style={{ color: '#F8FAFC' }}>{health.device}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#94A3B8' }}>精度</Text>
                  <Text style={{ color: '#F8FAFC' }}>{health.dtype}</Text>
                </div>
              </Space>
            </div>
          )}

          <Button
            type="primary"
            onClick={checkHealth}
            loading={loading}
            block
          >
            重新检查
          </Button>
        </Space>
      </Card>
    </div>
  );
}
