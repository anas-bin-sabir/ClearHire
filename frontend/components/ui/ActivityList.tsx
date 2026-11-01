import type { ActivityFeedItem } from '@/lib/api'
import { fmt } from '@/lib/utils'

/** Timeline of activity feed items from /activity/feed. */
export function ActivityList({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-fg-2">Nothing has happened yet. Activity appears here as searches, contracts and reviews come in.</p>
  }
  return (
    <ol className="px-5 py-2">
      {items.map((item, idx) => (
        <li key={item.id || idx} className="relative flex gap-3 py-3 pl-1">
          <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-[13px] leading-relaxed text-fg">{item.text}</p>
            <time dateTime={item.time} className="mt-0.5 block text-xs tabular-nums text-fg-2">
              {fmt.timeAgo(item.time)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}
