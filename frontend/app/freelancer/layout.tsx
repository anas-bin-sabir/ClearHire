import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import FreelancerSidebar from '@/components/layout/FreelancerSidebar'

export default async function FreelancerLayout({ children }: { children: React.ReactNode }) {
  const session = (await getServerSession(authOptions)) as any
  if (!session || session.user?.role !== 'freelancer') redirect('/login')

  return (
    <div className="flex h-screen bg-ink overflow-hidden">
      <FreelancerSidebar />
      <main className="flex-1 overflow-y-auto bg-ink/30 relative">{children}</main>
    </div>
  )
}
