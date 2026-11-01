/**
 * Readable labels for the signal ids the backend's Bayesian fraud model emits
 * (backend/app/ai/bayesian.py). Unknown ids fall back to a humanized form.
 */
const LABELS: Record<string, string> = {
  new_account: 'Account is less than 30 days old',
  copied_portfolio: 'Portfolio appears copied from elsewhere',
  review_anomaly: 'Unusual review pattern',
  no_verified_id: 'Identity not verified',
  low_response_rate: 'Low response rate',
  rate_experience_mismatch: 'Hourly rate doesn’t fit stated experience',
  stored_high_fraud_score: 'Previously scored as high risk',
}

export function signalLabel(id: string): string {
  if (LABELS[id]) return LABELS[id]
  const text = id.replace(/[_-]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
