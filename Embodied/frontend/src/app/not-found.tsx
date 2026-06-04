'use client';

import { Button, Result, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { HomeOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#0B1120',
        padding: '24px',
      }}
    >
      <Result
        status="404"
        title={
          <Text
            style={{
              color: '#F8FAFC',
              fontSize: '48px',
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 700,
            }}
          >
            404
          </Text>
        }
        subTitle={
          <Text style={{ color: '#94A3B8', fontSize: '16px' }}>
            页面不存在
          </Text>
        }
        extra={
          <Button
            type="primary"
            icon={<HomeOutlined />}
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              border: 'none',
              height: 48,
              borderRadius: 12,
            }}
          >
            返回首页
          </Button>
        }
      />
    </div>
  );
}
