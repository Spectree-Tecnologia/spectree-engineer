'use client';

import { useRouter } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { ShellProvider } from '@/shared/context/shell.context';
import { AdminShell } from '@/shared/template/admin-shell.component';
import { SidebarMenu, type SidebarMenuSection } from '@/shared/components/ui/sidebar-menu.component';

/**
 * The application's navigation.
 *
 * The navigation paths are part of the application's STATE, so they are
 * defined here in the layout, not in shared/. To change the menu (add items or
 * sections, or reorganize it), edit NAVIGATION_SECTIONS below.
 * Each `href` must point to a route inside the (private) group.
 */
const NAVIGATION_SECTIONS: SidebarMenuSection[] = [
  {
    id: 'main',
    label: 'Navigation',
    items: [{ id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, match: 'prefix' }],
  },
];

const HOME_ROUTE = '/dashboard';
const LANDING_ROUTE = '/';

export default function PrivateGroupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <ShellProvider defaultOpen>
      <AdminShell
        sidebar={<SidebarMenu sections={NAVIGATION_SECTIONS} homeHref={HOME_ROUTE} />}
        logoHref={HOME_ROUTE}
        onLogout={() => router.push(LANDING_ROUTE)}
      >
        {children}
      </AdminShell>
    </ShellProvider>
  );
}
