'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { PublicBoxedLayout } from '@/shared/template/public-boxed-layout.component';

function PublicRouteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === '/join' || pathname.startsWith('/join/');

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return <PublicBoxedLayout>{children}</PublicBoxedLayout>;
}

export default function PublicGroupLayout({ children }: { children: React.ReactNode }) {
  // usePathname reads the request URL; with Cache Components it must render inside a Suspense boundary
  return (
    <Suspense fallback={null}>
      <PublicRouteLayout>{children}</PublicRouteLayout>
    </Suspense>
  );
}
