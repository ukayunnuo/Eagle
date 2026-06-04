'use client';

import { useEffect } from 'react';
import { Button, Result, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        padding: '24px',
      }}
    >
      <Result
        status="error"
        title={
          <Text style={{ color: '#F8FAFC', fontSize: '24px', fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            出现错误
          </Text>
        }
        subTitle={
          <Text style={{ color: '#94A3B8' }}>
            {error.message || '页面加载过程中发生错误'}
          </Text>
        }
        extra={[
          <Button
            type="primary"
            key="retry"
            icon={<ReloadOutlined />}
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              border: 'none',
            }}
          >
            重试
          </Button>,
          <Button
            key="home"
            icon={<HomeOutlined />}
            onClick={() => router.push('/dashboard')}
          >
            返回首页
          </Button>,
        ]}
      />
    </div>
  );
}
