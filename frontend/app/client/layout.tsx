import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import ClientSidebar from '@/components/layout/ClientSidebar'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = (await getServerSession(authOptions)) as any
  if (!session || session.user?.role !== 'client') redirect('/login')

  return (
    <div className="flex h-screen bg-ink overflow-hidden">
      <ClientSidebar />
      <main className="flex-1 overflow-y-auto bg-ink/30 relative">{children}</main>
    </div>
  )
}
