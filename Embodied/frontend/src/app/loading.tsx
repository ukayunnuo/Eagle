'use client';

import { Spin, Typography } from 'antd';

const { Text } = Typography;

export default function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#0B1120',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
          marginBottom: '8px',
        }}
      >
        <span style={{ color: '#fff', fontSize: '24px', fontWeight: 700 }}>LA</span>
      </div>
      <Spin size="large" />
      <Text style={{ color: '#64748B', fontSize: '14px' }}>加载中...</Text>
    </div>
  );
}
