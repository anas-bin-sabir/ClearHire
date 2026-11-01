interface Props extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'section' | 'div' | 'article' | 'aside'
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Remove body padding, e.g. for tables and lists that run edge to edge. */
  flush?: boolean
}

/**
 * White folder-tab card. With a title, the top-right corner steps down into a notch:
 * the title sits on the raised tab and actions sit in the notch, outside the clipped
 * shape so they stay visible. The only card primitive; don't nest it.
 */
export function Panel({ as: Tag = 'section', title, description, actions, flush, className = '', children, ...rest }: Props) {
  const tabbed = Boolean(title || actions)
  return (
    <Tag className={`relative min-w-0 ${className}`} {...rest}>
      <div className={`h-full bg-panel ${tabbed ? 'notch' : 'rounded-panel'}`}>
        {tabbed && (
          <div className="px-5 pt-4">
            {title && (
              <h2 className="pr-[calc(var(--notch-w,38%)+0.5rem)] text-[22px] text-fg">{title}</h2>
            )}
            {description && <p className="mt-2 text-[13px] leading-relaxed text-fg-2">{description}</p>}
          </div>
        )}
        <div className={flush ? (tabbed ? 'pt-3' : '') : tabbed ? 'px-5 pb-5 pt-4' : 'p-5'}>{children}</div>
      </div>
      {actions && (
        <div className="absolute right-0 top-0 flex h-11 w-[38%] items-center justify-end gap-2">{actions}</div>
      )}
    </Tag>
  )
}
