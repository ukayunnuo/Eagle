'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // 检查是否有 token
    const token = localStorage.getItem('access_token');
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#0F172A'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#F8FAFC', fontSize: '2rem', marginBottom: '1rem' }}>
          LocateAnything
        </h1>
        <Spin size="large" />
      </div>
    </div>
  );
}
