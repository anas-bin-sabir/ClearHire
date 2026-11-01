import { Badge } from './Badge'
import { contractTone } from '@/lib/utils'

interface Props {
  status: 'pending' | 'active' | 'completed' | 'cancelled' | string
}

export function StatusBadge({ status }: Props) {
  const key = status.toLowerCase()
  const text = key.replace(/_/g, ' ')
  const label = text.charAt(0).toUpperCase() + text.slice(1)
  return <Badge tone={contractTone[key] ?? 'neutral'}>{label}</Badge>
}
