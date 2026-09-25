const MINUTE = 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const MONTH = DAY * 30
const YEAR = DAY * 365

const UNITS: Array<[number, string]> = [
  [YEAR, 'year'],
  [MONTH, 'month'],
  [DAY, 'day'],
  [HOUR, 'hour'],
  [MINUTE, 'minute']
]

/** Renders a cookie max-age as a human-readable expiry, e.g. `31536000` -> "1 year". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Session'
  }

  for (const [unitSeconds, label] of UNITS) {
    if (seconds >= unitSeconds) {
      const count = Math.round(seconds / unitSeconds)

      return `${count} ${label}${count === 1 ? '' : 's'}`
    }
  }

  const count = Math.round(seconds)

  return `${count} second${count === 1 ? '' : 's'}`
}
