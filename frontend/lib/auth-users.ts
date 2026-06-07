export type Role = 'client' | 'freelancer' | 'admin'

export interface DemoUser {
  id: number
  email: string
  password: string
  role: Role
  name: string
  freelancerId?: number   // only for freelancer role
}

export const DEMO_USERS: DemoUser[] = [
  { id: 1,  email: 'client@demo.com',     password: 'demo', role: 'client',     name: 'Sara Ahmed' },
  { id: 2,  email: 'freelancer@demo.com', password: 'demo', role: 'freelancer', name: 'Ali Raza', freelancerId: 1 },
  { id: 99, email: 'admin@demo.com',      password: 'demo', role: 'admin',      name: 'Admin' },
]
