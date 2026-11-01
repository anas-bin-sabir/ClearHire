interface Props {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Small context line under the title, e.g. a back link. */
  before?: React.ReactNode
}

/** Left-aligned page title row used at the top of every workspace route. */
export function PageHeader({ title, description, actions, before }: Props) {
  return (
    <header className="flex flex-col gap-5 px-5 pb-2 pt-7 sm:px-8 sm:pt-9 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 max-w-2xl">
        {before && <div className="mb-3">{before}</div>}
        <h1 className="text-[40px] text-fg sm:text-[52px]">{title}</h1>
        {description && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Standard content padding for workspace pages. */
export function PageBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-6 sm:px-8 sm:py-8 ${className}`}>{children}</div>
}
