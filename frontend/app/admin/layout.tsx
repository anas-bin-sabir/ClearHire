import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import AdminSidebar from '@/components/layout/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = (await getServerSession(authOptions)) as any
  if (!session || session.user?.role !== 'admin') redirect('/login')

  return (
    <div className="flex h-screen bg-ink overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-ink/30 relative">{children}</main>
    </div>
  )
}
