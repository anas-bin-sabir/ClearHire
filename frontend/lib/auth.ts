import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

// Must not outlive the FastAPI JWT (ACCESS_TOKEN_EXPIRE_MINUTES, default 24h).
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      // The FastAPI backend is the only source of truth for credentials.
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        })
        if (!res.ok) return null

        const user = await res.json()
        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          freelancerId: user.freelancer_id ? Number(user.freelancer_id) : undefined,
          accessToken: user.access_token,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.freelancerId = user.freelancerId
        token.accessToken = user.accessToken
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.freelancerId = token.freelancerId
      }
      session.accessToken = token.accessToken
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
}
