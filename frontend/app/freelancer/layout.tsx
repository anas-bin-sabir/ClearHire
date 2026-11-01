import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/layout/AppShell'

export default async function FreelancerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'freelancer') redirect('/login')

  return <AppShell role="freelancer">{children}</AppShell>
}
