import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fluxos de Conversa | FasterChat',
  description: 'Gerencie os fluxos customizados de WhatsApp',
};

export default function FlowsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Fluxos de WhatsApp</h2>
        <div className="flex items-center space-x-2">
          {/* FAKE CREATION (since API requires companyId from req.user but we can just use router and send POST on click) */}
          <Link href="/dashboard/flows/new" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            Novo Fluxo
          </Link>
        </div>
      </div>

      <div className="mt-6 border rounded-md p-8 text-center bg-gray-50/50">
        <h3 className="text-lg font-medium">Nenhum fluxo encontrado</h3>
        <p className="text-sm text-gray-500 mt-2">Crie seu primeiro fluxo de automação para começar.</p>
      </div>
    </div>
  );
}
