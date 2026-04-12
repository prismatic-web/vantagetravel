/**
 * Opens Google Flights with a round-trip query for the given IATA airports and calendar dates.
 * Format matches Google’s RT compact query (origin.dest.yyyymmdd*dest.origin.yyyymmdd).
 */
export function buildRoundTripGoogleFlightsUrl(
  originIata: string,
  destIata: string,
  departYyyyMmDd: string,
  returnYyyyMmDd: string
): string {
  const o = originIata.toUpperCase().slice(0, 3)
  const d = destIata.toUpperCase().slice(0, 3)
  const d1 = departYyyyMmDd.replace(/-/g, '')
  const d2 = returnYyyyMmDd.replace(/-/g, '')
  const q = `RT ${o}.${d}.${d1}*${d}.${o}.${d2}`
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`
}
