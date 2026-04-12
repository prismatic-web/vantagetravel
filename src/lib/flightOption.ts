/** Round-trip flight card (demo estimates or Amadeus live offers). */
export interface FlightOption {
  airline: string
  airlineCode: string
  outboundFlightNumber: string
  inboundFlightNumber: string
  departure: string
  arrival: string
  outboundDepartureTime: string
  outboundArrivalTime: string
  inboundDepartureTime: string
  inboundArrivalTime: string
  price: number
  outboundDuration: string
  inboundDuration: string
  outboundStops: number
  inboundStops: number
  outboundStopCity?: string
  inboundStopCity?: string
  /** Same family as Google Flights “round trip” deep link for this city pair + dates */
  googleFlightsUrl: string
  /** Legacy name — same URL as googleFlightsUrl */
  bookingUrl: string
  outboundAircraft: string
  inboundAircraft: string
  dataSource: 'amadeus' | 'demo' | 'aviationstack' | 'serpapi' | 'rapidapi'
  /** e.g. "JFK → ORD → CDG" when connections exist */
  outboundRoute?: string
  inboundRoute?: string
}
