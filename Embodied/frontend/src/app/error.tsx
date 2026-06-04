'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Result, Typography } from 'antd';

const { Text } = Typography;

export default function Error({
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
        minHeight: '100vh',
        background: '#0B1120',
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
            {error.message || '发生了未知错误'}
          </Text>
        }
        extra={[
          <Button
            type="primary"
            key="retry"
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
            onClick={() => router.push('/dashboard')}
          >
            返回首页
          </Button>,
        ]}
      />
    </div>
  );
}
