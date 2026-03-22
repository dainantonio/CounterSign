'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SharePage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, []);
  return null;
}
