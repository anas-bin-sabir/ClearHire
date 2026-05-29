import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { ClearHireRole } from "@/lib/auth-users";
import {
  AUTH_USERS,
  findUserByEmailPassword,
  findUserByRole,
} from "@/lib/auth-users";

declare module "next-auth" {
  interface User {
    id: string;
    role: ClearHireRole;
    avatar: string;
    department: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: ClearHireRole;
      avatar: string;
      department: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: ClearHireRole;
    avatar?: string;
    department?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        demoRole: { label: "Demo Role", type: "text" },
        name: { label: "Name", type: "text" },
        registerRole: { label: "Register Role", type: "text" },
        mode: { label: "Mode", type: "text" },
      },
      async authorize(credentials) {
        const mode = credentials?.mode as string | undefined;

        if (mode === "demo") {
          const role = (credentials?.demoRole as ClearHireRole) || "admin";
          const user = findUserByRole(role);
          return {
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            department: user.department,
          };
        }

        if (mode === "register") {
          const name = (credentials?.name as string)?.trim();
          const email = (credentials?.email as string)?.trim();
          const password = credentials?.password as string;
          const role =
            (credentials?.registerRole as ClearHireRole) || "client";

          if (!name || !email || !password) return null;

          const exists = AUTH_USERS.some(
            (u) => u.email.toLowerCase() === email.toLowerCase(),
          );
          if (exists) return null;

          const avatar = name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return {
            id: String(AUTH_USERS.length + 1),
            name,
            email,
            role,
            avatar,
            department:
              role === "client" ? "Hiring Team" : "Independent Contractor",
          };
        }

        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const user = findUserByEmailPassword(email, password);
        if (!user) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          department: user.department,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.avatar = user.avatar;
        token.department = user.department;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as ClearHireRole) ?? "client";
        session.user.avatar = (token.avatar as string) ?? "CH";
        session.user.department = (token.department as string) ?? "";
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});
