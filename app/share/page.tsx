'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SharePage() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const text = params.get('text') || params.get('title') || params.get('url') || '';
    if (text) {
      // Pass to home page via sessionStorage — more reliable than URL params
      sessionStorage.setItem('sigseal_shared_text', text);
    }
    router.replace('/');
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#64748b',
      background: '#f8fafc',
    }}>
      Loading offer...
    </div>
  );
}
