'use client'

interface Option<T extends string> {
  value: T
  label: React.ReactNode
}

interface Props<T extends string> {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  className?: string
  /** Stretch to the container width, options sharing it equally. */
  fill?: boolean
}

/** Segmented control (radio group semantics) for switching a view or mode. */
export function Segmented<T extends string>({ label, value, options, onChange, className = '', fill = false }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`${fill ? 'flex w-full' : 'inline-flex'} rounded-control border border-line bg-sunken p-1 ${className}`}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-8 rounded-chip px-3 ${fill ? 'flex-1' : ''} text-[13px] font-semibold transition-colors duration-150 ${
              active ? 'bg-panel text-fg shadow-card' : 'text-fg-2 hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
