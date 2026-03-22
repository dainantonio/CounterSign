'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ShareHandler() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const text = params.get('text') || params.get('title') || params.get('url') || '';
    if (text) {
      sessionStorage.setItem('sigseal_shared_text', text);
    }
    router.replace('/');
  }, []);

  return null;
}

export default function SharePage() {
  return (
    <Suspense>
      <ShareHandler />
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
    </Suspense>
  );
}
