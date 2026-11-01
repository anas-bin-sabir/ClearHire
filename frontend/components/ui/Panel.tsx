interface Props extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'section' | 'div' | 'article' | 'aside'
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Remove body padding, e.g. for tables and lists that run edge to edge. */
  flush?: boolean
}

/** White surface with a hairline border. The only card primitive; don't nest it. */
export function Panel({ as: Tag = 'section', title, description, actions, flush, className = '', children, ...rest }: Props) {
  return (
    <Tag className={`rounded-panel border border-line-2 bg-panel shadow-card ${className}`} {...rest}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[15px] font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-fg-2">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </Tag>
  )
}
