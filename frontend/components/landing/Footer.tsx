import Link from 'next/link'

export default function Footer() {
  return (
    <footer id="footer" className="bg-shell text-on-dark">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[28px] font-bold leading-tight tracking-tight">Post your first project.</p>
            <p className="mt-2 text-on-dark-2">Describe it in a sentence; review what ClearHire extracted before it’s saved.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-lg btn-primary">Get started</Link>
            <Link href="/login" className="btn btn-lg btn-dark">Sign in</Link>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-line-dark pt-6 text-sm text-on-dark-2 sm:flex-row sm:justify-between">
          <p>ClearHire</p>
          <p>Built with FastAPI, PostgreSQL with pgvector, Neo4j, MongoDB, Next.js and Claude.</p>
        </div>
      </div>
    </footer>
  )
}
