import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { DEMO_USERS } from './auth-users'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
          const res = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })
          if (res.ok) {
            const user = await res.json()
            return {
              id: String(user.id),
              name: user.name,
              email: user.email,
              role: user.role,
              freelancerId: user.freelancer_id ? Number(user.freelancer_id) : undefined,
            }
          }
        } catch (error) {
          console.error('FastAPI auth error, falling back to static DEMO_USERS:', error)
        }

        // Resilient Fallback to static DEMO_USERS
        const demoUser = DEMO_USERS.find(
          u => u.email === credentials.email && u.password === credentials.password
        )
        if (demoUser) {
          return {
            id: String(demoUser.id),
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role,
            freelancerId: demoUser.freelancerId,
          }
        }
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.freelancerId = (user as any).freelancerId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).freelancerId = token.freelancerId;
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt'
  }
}
