import { format, parseISO, isValid } from 'date-fns'
import type { FlightOption } from './flightOption'
import { buildRoundTripGoogleFlightsUrl } from './googleFlights'

/** Browser calls same-origin proxy; Vite injects middleware in dev/preview. */
function amadeusApiUrl(pathWithQuery: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''
  const p = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`
  if (!base || base === '/') return `/api/amadeus${p}`
  return `${base}/api/amadeus${p}`.replace(/([^:]\/)\/+/g, '$1')
}

function parseDurationIso(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return iso
  const h = parseInt(m[1] || '0', 10)
  const min = parseInt(m[2] || '0', 10)
  if (h && min) return `${h}h ${min}m`
  if (h) return `${h}h 0m`
  if (min) return `0h ${min}m`
  return iso
}

function formatLocalTime(iso: string): string {
  const d = parseISO(iso)
  if (!isValid(d)) return '—'
  return format(d, 'h:mm a')
}

function routeSummary(segments: AmadeusSegment[]): string {
  if (!segments?.length) return ''
  const pts: string[] = [segments[0].departure.iataCode]
  for (const s of segments) pts.push(s.arrival.iataCode)
  return pts.join(' → ')
}

function hubStopCity(segments: AmadeusSegment[]): string | undefined {
  if (segments.length < 2) return undefined
  return segments[0].arrival.iataCode
}

function aircraftSummary(segments: AmadeusSegment[]): string {
  const codes = segments.map((s) => s.aircraft?.code).filter(Boolean) as string[]
  return [...new Set(codes)].join(' / ') || '—'
}

function flightNumbers(segments: AmadeusSegment[]): string {
  return segments.map((s) => `${s.carrierCode} ${s.number}`.trim()).join(' · ')
}

interface AmadeusSegment {
  departure: { iataCode: string; at: string }
  arrival: { iataCode: string; at: string }
  carrierCode: string
  number: string
  duration: string
  aircraft?: { code: string }
}

interface AmadeusItinerary {
  duration: string
  segments: AmadeusSegment[]
}

interface AmadeusOffer {
  itineraries: AmadeusItinerary[]
  price: { total: string; currency?: string }
}

interface AmadeusSearchResponse {
  data?: AmadeusOffer[]
  dictionaries?: {
    carriers?: Record<string, string>
  }
}

function mapOffer(
  offer: AmadeusOffer,
  dictionaries: AmadeusSearchResponse['dictionaries'],
  searchOrigin: string,
  searchDest: string,
  departYmd: string,
  returnYmd: string,
  adults: number
): FlightOption | null {
  const itins = offer.itineraries
  if (!itins || itins.length < 2) return null

  const out = itins[0]
  const inn = itins[1]
  const outSegs = out.segments
  const inSegs = inn.segments
  if (!outSegs?.length || !inSegs?.length) return null

  const firstOut = outSegs[0]
  const lastOut = outSegs[outSegs.length - 1]
  const firstIn = inSegs[0]
  const lastIn = inSegs[inSegs.length - 1]

  const carriers = dictionaries?.carriers || {}
  const outCodes = new Set(outSegs.map((s) => s.carrierCode))
  const marketingName =
    outCodes.size > 1
      ? 'Multiple airlines'
      : carriers[firstOut.carrierCode] || firstOut.carrierCode
  const displayCode = firstOut.carrierCode

  const rawTotal = parseFloat(offer.price.total) || 0
  const price =
    adults > 0 ? Math.round(rawTotal / adults) : Math.round(rawTotal)
  const gf = buildRoundTripGoogleFlightsUrl(searchOrigin, searchDest, departYmd, returnYmd)

  return {
    airline: marketingName,
    airlineCode: displayCode,
    outboundFlightNumber: flightNumbers(outSegs),
    inboundFlightNumber: flightNumbers(inSegs),
    departure: firstOut.departure.iataCode,
    arrival: lastOut.arrival.iataCode,
    outboundDepartureTime: formatLocalTime(firstOut.departure.at),
    outboundArrivalTime: formatLocalTime(lastOut.arrival.at),
    inboundDepartureTime: formatLocalTime(firstIn.departure.at),
    inboundArrivalTime: formatLocalTime(lastIn.arrival.at),
    price,
    outboundDuration: parseDurationIso(out.duration),
    inboundDuration: parseDurationIso(inn.duration),
    outboundStops: Math.max(0, outSegs.length - 1),
    inboundStops: Math.max(0, inSegs.length - 1),
    outboundStopCity: hubStopCity(outSegs),
    inboundStopCity: hubStopCity(inSegs),
    googleFlightsUrl: gf,
    bookingUrl: gf,
    outboundAircraft: aircraftSummary(outSegs),
    inboundAircraft: aircraftSummary(inSegs),
    dataSource: 'amadeus',
    outboundRoute: routeSummary(outSegs),
    inboundRoute: routeSummary(inSegs),
  }
}

export async function fetchAmadeusFlightOffers(params: {
  origin: string
  destination: string
  departureDate: string
  returnDate: string
  adults: number
}): Promise<FlightOption[]> {
  const qs = new URLSearchParams({
    originLocationCode: params.origin.toUpperCase().slice(0, 3),
    destinationLocationCode: params.destination.toUpperCase().slice(0, 3),
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    adults: String(Math.max(1, params.adults)),
    currencyCode: 'USD',
    max: '12',
  })

  const url = amadeusApiUrl(`/v2/shopping/flight-offers?${qs.toString()}`)
  const res = await fetch(url)
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || res.statusText)
  }

  const json = (await res.json()) as AmadeusSearchResponse
  const rows = json.data || []
  const dict = json.dictionaries

  const mapped: FlightOption[] = []
  const o = params.origin.toUpperCase().slice(0, 3)
  const d = params.destination.toUpperCase().slice(0, 3)
  for (const offer of rows) {
    const card = mapOffer(offer, dict, o, d, params.departureDate, params.returnDate, params.adults)
    if (card) mapped.push(card)
  }

  return mapped.sort((a, b) => a.price - b.price)
}
