import 'next-auth'
import 'next-auth/jwt'
import type { Role } from '@/lib/auth-users'

declare module 'next-auth' {
  interface User {
    role: Role
    freelancerId?: number
    accessToken: string
  }

  interface Session {
    accessToken?: string
    user?: {
      name?: string | null
      email?: string | null
      image?: string | null
      role?: Role
      freelancerId?: number
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role
    freelancerId?: number
    accessToken?: string
  }
}
