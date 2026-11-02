import { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'

// With local auth this must not outlive the FastAPI JWT (ACCESS_TOKEN_EXPIRE_MINUTES,
// default 24h). With Supabase Auth the access token is renewed below and the
// session still ends after this long.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24
// Renew Supabase access tokens this long before they expire.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Swap the refresh token for a new access token. On failure the token is
 *  cleared, so API calls 401 and the user signs in again. */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${apiUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const data: { access_token: string; refresh_token: string; expires_in: number } = await res.json()
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
      error: undefined,
    }
  } catch {
    return { ...token, accessToken: undefined, refreshToken: undefined, error: 'RefreshAccessTokenError' }
  }
}

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

        const res = await fetch(`${apiUrl()}/auth/login`, {
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
          // Only present with Supabase Auth.
          refreshToken: user.refresh_token ?? undefined,
          accessTokenExpires: user.expires_in ? Date.now() + user.expires_in * 1000 : undefined,
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
        token.refreshToken = user.refreshToken
        token.accessTokenExpires = user.accessTokenExpires
        return token
      }
      if (token.refreshToken && token.accessTokenExpires
          && Date.now() > token.accessTokenExpires - REFRESH_MARGIN_MS) {
        return refreshAccessToken(token)
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.freelancerId = token.freelancerId
      }
      session.accessToken = token.accessToken
      session.error = token.error
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
