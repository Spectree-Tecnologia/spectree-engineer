import { Card } from '@/shared/components/ui/card';

/**
 * Example dashboard (route `/dashboard`, private group).
 *
 * Rendered inside the AdminShell (see the private group's layout). It is an open
 * route: there is no authentication gate. Replace the cards with real widgets.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da aplicação.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['Métrica A', 'Métrica B', 'Métrica C'].map((title) => (
          <Card key={title} className="p-6">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold">—</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
