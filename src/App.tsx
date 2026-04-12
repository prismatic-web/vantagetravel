import { useState, useRef, useEffect } from 'react'
import { GeometricBackground } from './components/FluidBackground'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { 
  Plane, Calendar, MapPin, Users, DollarSign, Compass, 
  Sun, Cloud, Umbrella, Snowflake, Thermometer, Moon, Sun as SunIcon,
  Check, Download, Copy, Sparkles, Crown, Lock,
  ExternalLink, Star, Zap, ArrowRight,
  Loader2, RefreshCw, Map, Backpack, Building, TrendingUp,
  Mail, Shield, FileText, Cookie, X
} from 'lucide-react'
import { format, addDays, differenceInDays, parseISO, isValid } from 'date-fns'
import jsPDF from 'jspdf'
import type { FlightOption } from './lib/flightOption'
// Google Flights URL builder removed - we now use direct links
import { buildRoundTripGoogleFlightsUrl } from './lib/googleFlights'
// Security: Input validation and sanitization
import { 
  TripGenerationRequestSchema, 
  validateDateRange,
  sanitizeForDisplay,
  MAX_TRIP_DAYS,
  SecurityError,
  getSafeErrorMessage 
} from './lib/security'
import './App.css'

// Types
interface TravelFormData {
  departureAirport: string
  destination: string
  country: string
  departureDate: string
  returnDate: string
  dateFlexibility: 'exact' | 'flexible' | 'timeframe'
  flexibleDays: number
  timeframeStart: string
  timeframeEnd: string
  dailyBudget: number
  travelStyle: 'adventure' | 'relaxation' | 'foodie' | 'culture' | 'business'
  groupSize: number
  fitnessLevel: 'low' | 'moderate' | 'high'
  weatherPreference: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'any'
}

import type { Activity } from './lib/aiActivities'
export type { Activity }

interface DayPlan {
  day: number
  date: string
  activities: Activity[]
  dayTotal: number
}

interface PackingItem {
  name: string
  category: 'essentials' | 'clothing' | 'gear' | 'documents'
  checked: boolean
  reason: string
}

interface TripCosts {
  flights: number
  accommodation: number
  activities: number
  food: number
  transport: number
  total: number
}

// Major airports
const MAJOR_AIRPORTS = [
  'JFK - New York', 'LAX - Los Angeles', 'ORD - Chicago', 'DFW - Dallas',
  'DEN - Denver', 'ATL - Atlanta', 'SFO - San Francisco', 'SEA - Seattle',
  'LAS - Las Vegas', 'MCO - Orlando', 'MIA - Miami', 'BOS - Boston',
  'PHX - Phoenix', 'IAH - Houston', 'PHL - Philadelphia'
]

// AI-powered activity generation - replaced static database with intelligent generation
import { generateDayActivities } from './lib/aiActivities'

const CITY_COUNTRY_TO_IATA: Record<string, string> = {
  paris: 'CDG', parisfrance: 'CDG',
  london: 'LHR', londonuk: 'LHR', londonunitedkingdom: 'LHR', londongreatbritain: 'LHR',
  tokyo: 'HND', tokyojapan: 'HND',
  newyork: 'JFK', newyorkcity: 'JFK', nyc: 'JFK', manhattan: 'JFK',
  losangeles: 'LAX', la: 'LAX',
  sanfrancisco: 'SFO', chicago: 'ORD', dallas: 'DFW', denver: 'DEN',
  atlanta: 'ATL', seattle: 'SEA', miami: 'MIA', boston: 'BOS', phoenix: 'PHX',
  houston: 'IAH', philadelphia: 'PHL', orlando: 'MCO', vegas: 'LAS', 'lasvegas': 'LAS',
  barcelona: 'BCN', rome: 'FCO', berlin: 'BER', amsterdam: 'AMS', dublin: 'DUB',
  madrid: 'MAD', lisbon: 'LIS', vienna: 'VIE', prague: 'PRG', dubai: 'DXB',
  singapore: 'SIN', sydney: 'SYD', toronto: 'YYZ', vancouver: 'YVR', mexicocity: 'MEX',
}

function parseAirportCode(airportLabel: string): string {
  const m = airportLabel.trim().match(/^([A-Z]{3})\b/)
  return m ? m[1] : 'JFK'
}

function resolveDestinationIATA(city: string, country: string): string {
  const raw = `${city} ${country}`.toLowerCase().replace(/[^a-z]/g, '')
  const cityOnly = city.toLowerCase().replace(/[^a-z]/g, '')
  if (CITY_COUNTRY_TO_IATA[raw]) return CITY_COUNTRY_TO_IATA[raw]
  if (CITY_COUNTRY_TO_IATA[cityOnly]) return CITY_COUNTRY_TO_IATA[cityOnly]
  const c = city.trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(c)) return c
  return city.trim().slice(0, 3).toUpperCase().padEnd(3, 'X').slice(0, 3)
}

function safeFormatIsoDate(isoDate: string, fmt: string): string {
  const d = parseISO(isoDate)
  if (!isValid(d)) return '—'
  try {
    return format(d, fmt)
  } catch {
    return '—'
  }
}

function safeTripDurationDays(departIso: string, returnIso: string): number {
  const a = parseISO(departIso)
  const b = parseISO(returnIso)
  if (!isValid(a) || !isValid(b)) return 1
  const n = differenceInDays(b, a) + 1
  return Number.isFinite(n) && n >= 1 ? n : 1
}

// Activity generation now uses AI-powered system from aiActivities.ts
// The old static database has been replaced with intelligent, context-aware generation

// Build Google Flights search URL for accurate real-time flight data
function buildGoogleFlightsUrl(
  fromIata: string,
  toIata: string,
  departDate: string,
  returnDate: string
): string {
  // Format: https://www.google.com/travel/flights?q=Flights%20from%20XXX%20to%20YYY%20on%20YYYY-MM-DD%20through%20YYYY-MM-DD
  return `https://www.google.com/travel/flights?q=Flights%20from%20${fromIata}%20to%20${toIata}%20on%20${departDate}%20through%20${returnDate}`
}

// Premium Modal Component
function PremiumModal({ isOpen, onClose, onSubscribe }: { isOpen: boolean; onClose: () => void; onSubscribe: () => void }) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-6 h-6" />
              <span className="font-semibold text-sm uppercase tracking-wider">Premium Feature</span>
            </div>
            <h3 className="text-2xl font-bold font-serif">Unlock Vantage Pro</h3>
          </div>
          
          <div className="p-6">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Get access to unlimited AI-generated itineraries, smart packing lists, real flight deals, and exclusive premium features.
            </p>
            
            <div className="space-y-3 mb-6">
              {[
                'Unlimited trip generations',
                'Real-time flight prices from actual airlines',
                'Advanced AI packing lists',
                'Flight price tracking & alerts',
                'Priority customer support',
                'Export to PDF & share',
                'Offline access to itineraries'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onSubscribe}
                className="flex-1 bg-gradient-to-r from-[#0070a0] to-[#00577c] text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all"
              >
                Start Free Trial
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Maybe Later
              </button>
            </div>
            
            <p className="text-center text-xs text-gray-400 mt-4">
              7-day free trial • Cancel anytime • $9.99/month after trial
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

const CONTACT_EMAIL = 'vantagesuitesofficial@gmail.com'

function LegalModal({
  type,
  onClose,
  isDark,
}: {
  type: 'privacy' | 'terms' | 'cookies' | null
  onClose: () => void
  isDark: boolean
}) {
  if (!type) return null
  const title =
    type === 'privacy' ? 'Privacy Policy' : type === 'terms' ? 'Terms of Service' : 'Cookie Policy'
  const body =
    type === 'privacy'
      ? `Vantage Travel collects only the information you submit in the trip planner (destinations, dates, preferences) to generate itineraries on your device. We do not sell personal data. For questions, contact ${CONTACT_EMAIL}.`
      : type === 'terms'
        ? 'Vantage Travel provides travel planning tools for informational purposes only. Fares, hours, and availability change; always confirm with airlines and venues before booking. Use of this site constitutes acceptance of these terms.'
        : 'We use essential cookies for site functionality and may use analytics cookies to improve the product. You can control cookies through your browser settings.'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key={type}
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          className={`max-w-lg w-full rounded-2xl shadow-2xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
            <h3 className={`text-lg font-semibold font-serif ${isDark ? 'text-white' : 'text-[#004968]'}`}>{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className={`px-5 py-4 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{body}</div>
          <div className={`px-5 py-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(title)}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#66a2cd] hover:text-[#8ebfe0]"
            >
              <Mail className="w-4 h-4" />
              {CONTACT_EMAIL}
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Main App Component
function App() {
  const [isDark, setIsDark] = useState(true)
  const [formData, setFormData] = useState<TravelFormData>({
    departureAirport: '',
    destination: '',
    country: '',
    departureDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    returnDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    dateFlexibility: 'exact',
    flexibleDays: 3,
    timeframeStart: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    timeframeEnd: format(addDays(new Date(), 21), 'yyyy-MM-dd'),
    dailyBudget: 150,
    travelStyle: 'culture',
    groupSize: 2,
    fitnessLevel: 'moderate',
    weatherPreference: 'any'
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'cookies' | null>(null)
  const [itinerary, setItinerary] = useState<DayPlan[]>([])
  const [packingList, setPackingList] = useState<PackingItem[]>([])
  const [flightOptions, setFlightOptions] = useState<FlightOption[]>([])
  const [tripCosts, setTripCosts] = useState<TripCosts | null>(null)
  const [activeTab, setActiveTab] = useState<'itinerary' | 'packing' | 'flights' | 'costs'>('itinerary')
  const resultsRef = useRef<HTMLDivElement>(null)
  const generateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { scrollYProgress } = useScroll()
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -100])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])

  // Toggle dark mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  useEffect(() => {
    return () => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current)
    }
  }, [])

  // Generate itinerary with real activities
  const generateItinerary = () => {
    if (generateTimeoutRef.current) {
      clearTimeout(generateTimeoutRef.current)
      generateTimeoutRef.current = null
    }
    setIsGenerating(true)

    const GENERATION_DELAY_MS = 600

    generateTimeoutRef.current = setTimeout(async () => {
      generateTimeoutRef.current = null
      try {
        // ============================================================================
        // SECURITY: Input validation
        // Validate and sanitize all user inputs before processing
        // ============================================================================
        
        // Validate using Zod schema (strict type checking, rejects unexpected fields)
        const validatedInput = TripGenerationRequestSchema.safeParse({
          departureAirport: formData.departureAirport,
          destination: formData.destination,
          country: formData.country,
          departureDate: formData.departureDate,
          returnDate: formData.returnDate,
          dateFlexibility: formData.dateFlexibility,
          flexibleDays: formData.flexibleDays,
          timeframeStart: formData.timeframeStart,
          timeframeEnd: formData.timeframeEnd,
          dailyBudget: formData.dailyBudget,
          travelStyle: formData.travelStyle,
          groupSize: formData.groupSize,
          fitnessLevel: formData.fitnessLevel,
          weatherPreference: formData.weatherPreference,
        })
        
        if (!validatedInput.success) {
          const errors = validatedInput.error.issues.map(i => i.message).join(', ')
          throw new SecurityError('validation_failed', `Invalid input: ${errors}`)
        }
        
        // Additional date range validation
        validateDateRange(validatedInput.data.departureDate, validatedInput.data.returnDate)
        
        // Sanitize text inputs (XSS prevention)
        const sanitizedDestination = sanitizeForDisplay(validatedInput.data.destination)
        const sanitizedCountry = sanitizeForDisplay(validatedInput.data.country)
        
        const days: DayPlan[] = []
        let startDate = parseISO(validatedInput.data.departureDate)
        let endDate = parseISO(validatedInput.data.returnDate)
        if (!isValid(startDate)) startDate = addDays(new Date(), 7)
        if (!isValid(endDate)) endDate = addDays(startDate, 7)
        if (endDate < startDate) endDate = addDays(startDate, 6)

        const departStr = format(startDate, 'yyyy-MM-dd')
        const returnStr = format(endDate, 'yyyy-MM-dd')

        let totalDays = differenceInDays(endDate, startDate) + 1
        if (!Number.isFinite(totalDays) || totalDays < 1) totalDays = 1
        if (totalDays > MAX_TRIP_DAYS) totalDays = MAX_TRIP_DAYS

        // Use AI-powered activity generation for any city
        let totalActivityCost = 0

        for (let i = 0; i < totalDays; i++) {
          const currentDate = addDays(startDate, i)

          // Generate AI-powered activities for this specific day (using sanitized inputs)
          const dayActivities = generateDayActivities(
            i,
            sanitizedDestination,
            sanitizedCountry,
            validatedInput.data.travelStyle,
            validatedInput.data.dailyBudget,
            validatedInput.data.weatherPreference
          ).map((activity: Activity) => ({
            ...activity,
            cost: Math.round(activity.cost * (validatedInput.data.dailyBudget / 150)),
          }))

          const dayTotal = dayActivities.reduce((sum: number, a: Activity) => sum + a.cost, 0)
          totalActivityCost += dayTotal

          days.push({
            day: i + 1,
            date: format(currentDate, 'EEEE, MMMM d, yyyy'),
            activities: dayActivities,
            dayTotal,
          })
        }

        const numTravelers = Math.max(1, formData.groupSize || 1)
        const numNights = Math.max(0, totalDays - 1)
        const fromIata = parseAirportCode(formData.departureAirport)
        const toIata = resolveDestinationIATA(formData.destination, formData.country)

        // Build Google Flights link - no API keys needed
        const googleFlightsUrl = buildRoundTripGoogleFlightsUrl(
          fromIata,
          toIata,
          departStr,
          returnStr
        )

        const flightCost = 0
        const accommodationCost = Math.round(
          formData.dailyBudget * 0.6 * numNights * (numTravelers > 2 ? Math.ceil(numTravelers / 2) : 1)
        )
        const foodCost = Math.round(formData.dailyBudget * 0.3 * totalDays * numTravelers)
        const transportCost = Math.round(formData.dailyBudget * 0.1 * totalDays * numTravelers)

        setTripCosts({
          flights: flightCost,
          accommodation: accommodationCost,
          activities: totalActivityCost * numTravelers,
          food: foodCost,
          transport: transportCost,
          total: flightCost + accommodationCost + totalActivityCost * numTravelers + foodCost + transportCost,
        })

        setFormData((prev) => ({
          ...prev,
          departureDate: departStr,
          returnDate: returnStr,
        }))

        setItinerary(days)
        generatePackingList()
        setFlightOptions([])
        // Store Google Flights URL for the UI
        localStorage.setItem('currentGoogleFlightsUrl', googleFlightsUrl)
        setShowResults(true)

        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } catch (err) {
        console.error('Trip generation failed:', err)
        // SECURITY: Don't leak internal error details to user
        const safeMessage = getSafeErrorMessage(err)
        window.alert(safeMessage)
      } finally {
        setIsGenerating(false)
      }
    }, GENERATION_DELAY_MS)
  }

  const generatePackingList = () => {
    const baseItems: PackingItem[] = [
      { name: 'Passport/ID', category: 'documents', checked: false, reason: 'Essential for travel' },
      { name: 'Travel Insurance', category: 'documents', checked: false, reason: 'Required for international travel' },
      { name: 'Phone Charger', category: 'essentials', checked: false, reason: 'Keep devices powered' },
      { name: 'Power Adapter', category: 'essentials', checked: false, reason: 'Different plug types' },
      { name: 'Toiletries', category: 'essentials', checked: false, reason: 'Personal hygiene' },
      { name: 'First Aid Kit', category: 'essentials', checked: false, reason: 'Emergency preparedness' },
    ]

    const weatherItems: Record<string, PackingItem[]> = {
      sunny: [
        { name: 'Sunscreen SPF 50+', category: 'essentials', checked: false, reason: 'UV protection' },
        { name: 'Sunglasses', category: 'gear', checked: false, reason: 'Eye protection' },
        { name: 'Lightweight Clothing', category: 'clothing', checked: false, reason: 'Hot weather comfort' },
        { name: 'Hat/Cap', category: 'gear', checked: false, reason: 'Sun protection' },
      ],
      rainy: [
        { name: 'Waterproof Jacket', category: 'clothing', checked: false, reason: 'Rain protection' },
        { name: 'Umbrella', category: 'gear', checked: false, reason: 'Stay dry' },
        { name: 'Waterproof Shoes', category: 'gear', checked: false, reason: 'Keep feet dry' },
        { name: 'Quick-dry Clothing', category: 'clothing', checked: false, reason: 'Wet weather comfort' },
      ],
      snowy: [
        { name: 'Warm Coat', category: 'clothing', checked: false, reason: 'Cold protection' },
        { name: 'Thermal Layers', category: 'clothing', checked: false, reason: 'Insulation' },
        { name: 'Waterproof Boots', category: 'gear', checked: false, reason: 'Snow protection' },
        { name: 'Gloves & Scarf', category: 'gear', checked: false, reason: 'Extremity warmth' },
      ],
      cloudy: [
        { name: 'Light Jacket', category: 'clothing', checked: false, reason: 'Mild weather' },
        { name: 'Layered Clothing', category: 'clothing', checked: false, reason: 'Temperature changes' },
        { name: 'Comfortable Shoes', category: 'gear', checked: false, reason: 'Walking comfort' },
      ],
      any: [
        { name: 'Versatile Layers', category: 'clothing', checked: false, reason: 'Any weather prep' },
        { name: 'Light Rain Jacket', category: 'clothing', checked: false, reason: 'Just in case' },
        { name: 'Comfortable Walking Shoes', category: 'gear', checked: false, reason: 'All-day comfort' },
      ]
    }

    const styleItems: Record<string, PackingItem[]> = {
      adventure: [
        { name: 'Hiking Boots', category: 'gear', checked: false, reason: 'Adventure activities' },
        { name: 'Backpack', category: 'gear', checked: false, reason: 'Gear carrying' },
        { name: 'Active Wear', category: 'clothing', checked: false, reason: 'Physical activities' },
        { name: 'Water Bottle', category: 'gear', checked: false, reason: 'Stay hydrated' },
      ],
      relaxation: [
        { name: 'Swimwear', category: 'clothing', checked: false, reason: 'Pool/beach access' },
        { name: 'Beach Towel', category: 'gear', checked: false, reason: 'Beach comfort' },
        { name: 'Casual Wear', category: 'clothing', checked: false, reason: 'Relaxed style' },
        { name: 'Good Book', category: 'gear', checked: false, reason: 'Leisure reading' },
      ],
      foodie: [
        { name: 'Comfortable Dining Clothes', category: 'clothing', checked: false, reason: 'Restaurant visits' },
        { name: 'Food Journal', category: 'gear', checked: false, reason: 'Track favorites' },
        { name: 'Reusable Utensils', category: 'gear', checked: false, reason: 'Eco-friendly dining' },
      ],
      culture: [
        { name: 'Modest Clothing', category: 'clothing', checked: false, reason: 'Temple/museum visits' },
        { name: 'Camera', category: 'gear', checked: false, reason: 'Capture memories' },
        { name: 'Guidebook', category: 'gear', checked: false, reason: 'Learn about sites' },
      ],
      business: [
        { name: 'Business Attire', category: 'clothing', checked: false, reason: 'Professional meetings' },
        { name: 'Laptop & Charger', category: 'gear', checked: false, reason: 'Work requirements' },
        { name: 'Business Cards', category: 'documents', checked: false, reason: 'Networking' },
      ]
    }

    const allItems = [
      ...baseItems,
      ...(weatherItems[formData.weatherPreference] || weatherItems.any),
      ...(styleItems[formData.travelStyle] || [])
    ]

    setPackingList(allItems)
  }

  const togglePackingItem = (index: number) => {
    if (!isPremium && index > 4) {
      setShowPremiumModal(true)
      return
    }
    
    setPackingList(prev => prev.map((item, i) => 
      i === index ? { ...item, checked: !item.checked } : item
    ))
  }

  const exportToPDF = () => {
    if (!isPremium) {
      setShowPremiumModal(true)
      return
    }

    const doc = new jsPDF()
    doc.setFontSize(20)
    doc.text(`Your Trip to ${formData.destination}`, 20, 20)
    doc.setFontSize(12)
    doc.text(`From: ${formData.departureAirport}`, 20, 30)
    doc.text(`Dates: ${formData.departureDate} to ${formData.returnDate}`, 20, 40)
    doc.text(`Travel Style: ${formData.travelStyle}`, 20, 50)
    doc.text(`Daily Budget: $${formData.dailyBudget}`, 20, 60)
    
    if (tripCosts) {
      doc.text(`Estimated Total: $${tripCosts.total.toLocaleString()}`, 20, 70)
    }
    
    let yPos = 85
    doc.setFontSize(16)
    doc.text('Itinerary', 20, yPos)
    yPos += 10
    
    itinerary.forEach((day) => {
      doc.setFontSize(12)
      doc.text(`Day ${day.day} - ${day.date}`, 20, yPos)
      yPos += 7
      day.activities.forEach((activity) => {
        doc.setFontSize(10)
        doc.text(`${activity.time}: ${activity.name} ($${activity.cost})`, 25, yPos)
        yPos += 5
      })
      yPos += 5
    })
    
    doc.save(`vantage-travel-${formData.destination}.pdf`)
  }

  const copyToClipboard = () => {
    if (!isPremium) {
      setShowPremiumModal(true)
      return
    }

    const text = `Trip to ${formData.destination}\nFrom: ${formData.departureAirport}\nDates: ${formData.departureDate} - ${formData.returnDate}\n${tripCosts ? `Estimated Total: $${tripCosts.total.toLocaleString()}` : ''}\n\n${itinerary.map(day => 
      `Day ${day.day} - ${day.date}\n${day.activities.map(a => `- ${a.time}: ${a.name} ($${a.cost})`).join('\n')}`
    ).join('\n\n')}`
    
    navigator.clipboard.writeText(text)
    alert('Itinerary copied to clipboard!')
  }

  const handlePremiumSubscribe = () => {
    setIsPremium(true)
    setShowPremiumModal(false)
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-gray-900' : 'bg-gradient-to-b from-[#e6f7ff] via-white to-white'}`}>
      {/* Google AdSense Banner */}
      <div className={`w-full py-2 text-center text-xs ${isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
        <ins className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-7206950229249249"
          data-ad-slot="top-banner"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-40 backdrop-blur-lg border-b transition-colors ${isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-[#0070a0] to-[#66a2cd] rounded-xl flex items-center justify-center">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <span className={`text-xl font-bold font-serif ${isDark ? 'text-white' : 'text-[#004968]'}`}>Vantage Travel</span>
              {isPremium && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-semibold rounded-full">
                  PRO
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                className={`p-2 rounded-full transition-colors ${isDark ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}
              >
                {isDark ? <SunIcon className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              {!isPremium ? (
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all"
                >
                  <Crown className="w-4 h-4" />
                  Upgrade to Pro
                </button>
              ) : (
                <span className="flex items-center gap-2 text-sm text-[#0070a0] font-medium">
                  <Sparkles className="w-4 h-4" />
                  Premium Active
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Fluid Geometric Background */}
      <section className="relative min-h-screen pt-16 overflow-hidden">
        {/* Clean Geometric Background */}
        <GeometricBackground isDark={isDark} />

        {/* Content */}
        <motion.div 
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 shadow-lg ${isDark ? 'bg-gray-800/90 text-[#66a2cd]' : 'bg-white/90 text-[#0070a0]'}`}>
                  <Sparkles className="w-4 h-4" />
                  AI-Powered Travel Planning
                </span>
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`text-4xl sm:text-5xl lg:text-6xl font-bold font-serif leading-tight mb-6 ${isDark ? 'text-white' : 'text-[#004968]'}`}
              >
                Travel Planning,{' '}
                <span className="text-gradient">Reimagined by AI</span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={`text-lg mb-8 max-w-xl mx-auto lg:mx-0 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Stop stressing over details. Tell us your vibe, and watch a personalized 
                itinerary with smart packing lists and real flight deals unfold in seconds.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.68, -0.6, 0.32, 1.6] }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <a
                  href="#planner"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#0070a0] to-[#00577c] text-white rounded-2xl font-semibold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                >
                  <Compass className="w-5 h-5" />
                  Plan My Trip
                  <ArrowRight className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 ${isDark ? 'bg-gray-800 text-white border-2 border-gray-700 hover:bg-gray-700' : 'bg-white text-[#0070a0] border-2 border-[#0070a0]/20 hover:bg-[#e6f7ff]'}`}
                >
                  <Crown className="w-5 h-5" />
                  See Premium Features
                </button>
              </motion.div>

              {/* Stats */}
              <motion.div
                id="features"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="flex flex-wrap gap-8 mt-12 justify-center lg:justify-start scroll-mt-24"
              >
                {[
                  { value: '50K+', label: 'Trips Planned' },
                  { value: '4.9', label: 'User Rating' },
                  { value: '150+', label: 'Countries' },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[#004968]'}`}>{stat.value}</div>
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Hero Illustration */}
            <motion.div
              initial={{ opacity: 0, x: 50, rotateY: 15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block relative"
            >
              <div className="relative animate-float">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0070a0]/20 to-[#66a2cd]/20 rounded-3xl blur-3xl" />
                <img
                  src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop"
                  alt="Travel Planning"
                  className="relative rounded-3xl shadow-2xl w-full"
                />
                
                {/* Floating Cards */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className={`absolute -left-8 top-1/4 rounded-2xl p-4 shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Itinerary Ready</p>
                      <p className="text-xs text-gray-500">7 days planned</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className={`absolute -right-4 bottom-1/4 rounded-2xl p-4 shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <Star className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Top Rated</p>
                      <p className="text-xs text-gray-500">4.9/5 stars</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-6 h-10 border-2 rounded-full flex justify-center pt-2 ${isDark ? 'border-gray-600' : 'border-[#0070a0]/30'}`}
          >
            <motion.div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-gray-400' : 'bg-[#0070a0]'}`} />
          </motion.div>
        </motion.div>
      </section>

      {/* Travel Planner Form Section */}
      <section id="planner" className="py-20 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className={`text-3xl sm:text-4xl font-bold font-serif mb-4 ${isDark ? 'text-white' : 'text-[#004968]'}`}>
              Plan Your Perfect Trip
            </h2>
            <p className={`max-w-2xl mx-auto ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Fill in your travel details and let our AI create a personalized itinerary, 
              packing list, and find real flight deals for you.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`glass-card rounded-3xl p-6 sm:p-10 ${isDark ? 'bg-gray-800/80 border-gray-700' : ''}`}
          >
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Departure Airport */}
              <div className="sm:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Building className="w-4 h-4 inline mr-1" />
                  Departure Airport
                </label>
                <select
                  value={formData.departureAirport}
                  onChange={(e) => setFormData({ ...formData, departureAirport: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                >
                  <option value="">Select your departure airport</option>
                  {MAJOR_AIRPORTS.map((airport) => (
                    <option key={airport} value={airport}>{airport}</option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div className="sm:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Destination
                </label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="City (e.g., Paris)"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                  />
                  <input
                    type="text"
                    placeholder="Country (e.g., France)"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                  />
                </div>
              </div>

              {/* Date Flexibility */}
              <div className="sm:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date Preference
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { value: 'exact', label: 'Exact Dates' },
                    { value: 'flexible', label: '± Flexible Days' },
                    { value: 'timeframe', label: 'Timeframe' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData({ ...formData, dateFlexibility: option.value as any })}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        formData.dateFlexibility === option.value
                          ? 'bg-[#0070a0] text-white'
                          : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {formData.dateFlexibility === 'exact' && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input
                      type="date"
                      value={formData.departureDate}
                      onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                    />
                    <input
                      type="date"
                      value={formData.returnDate}
                      onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                    />
                  </div>
                )}

                {formData.dateFlexibility === 'flexible' && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <input
                        type="date"
                        value={formData.departureDate}
                        onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                      />
                      <input
                        type="date"
                        value={formData.returnDate}
                        onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Flexible by:</span>
                      <input
                        type="range"
                        min="1"
                        max="7"
                        value={formData.flexibleDays}
                        onChange={(e) => setFormData({ ...formData, flexibleDays: parseInt(e.target.value) })}
                        className="flex-1 max-w-xs"
                      />
                      <span className="text-sm font-medium text-[#0070a0]">±{formData.flexibleDays} days</span>
                    </div>
                  </div>
                )}

                {formData.dateFlexibility === 'timeframe' && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <span className={`text-xs mb-1 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Earliest Date</span>
                      <input
                        type="date"
                        value={formData.timeframeStart}
                        onChange={(e) => setFormData({ ...formData, timeframeStart: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                      />
                    </div>
                    <div>
                      <span className={`text-xs mb-1 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Latest Date</span>
                      <input
                        type="date"
                        value={formData.timeframeEnd}
                        onChange={(e) => setFormData({ ...formData, timeframeEnd: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Daily Budget - Specific Amount */}
              <div className="sm:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Daily Budget (per person)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="10"
                    value={formData.dailyBudget}
                    onChange={(e) => setFormData({ ...formData, dailyBudget: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-[#0070a0] min-w-[100px]">${formData.dailyBudget}</span>
                </div>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Includes accommodation, food, activities, and local transport
                </p>
              </div>

              {/* Travel Style */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Compass className="w-4 h-4 inline mr-1" />
                  Travel Style
                </label>
                <select
                  value={formData.travelStyle}
                  onChange={(e) => setFormData({ ...formData, travelStyle: e.target.value as any })}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                >
                  <option value="adventure">Adventure</option>
                  <option value="relaxation">Relaxation</option>
                  <option value="foodie">Foodie</option>
                  <option value="culture">Culture</option>
                  <option value="business">Business</option>
                </select>
              </div>

              {/* Group Size */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Users className="w-4 h-4 inline mr-1" />
                  Travelers
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.groupSize}
                  onChange={(e) => setFormData({ ...formData, groupSize: parseInt(e.target.value) })}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                />
              </div>

              {/* Fitness Level */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Zap className="w-4 h-4 inline mr-1" />
                  Activity Level
                </label>
                <select
                  value={formData.fitnessLevel}
                  onChange={(e) => setFormData({ ...formData, fitnessLevel: e.target.value as any })}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-[#66a2cd] focus:ring-2 focus:ring-[#66a2cd]/20' : 'border-gray-200 focus:border-[#0070a0] focus:ring-2 focus:ring-[#0070a0]/20'}`}
                >
                  <option value="low">Relaxed</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">Active</option>
                </select>
              </div>

              {/* Weather Preference */}
              <div className="sm:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Cloud className="w-4 h-4 inline mr-1" />
                  Weather Preference
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'sunny', icon: Sun, label: 'Sunny' },
                    { value: 'cloudy', icon: Cloud, label: 'Cloudy' },
                    { value: 'rainy', icon: Umbrella, label: 'Rainy' },
                    { value: 'snowy', icon: Snowflake, label: 'Snowy' },
                    { value: 'any', icon: Thermometer, label: 'Any' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData({ ...formData, weatherPreference: option.value as any })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        formData.weatherPreference === option.value
                          ? 'bg-[#0070a0] text-white'
                          : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <option.icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateItinerary}
              disabled={isGenerating || !formData.destination || !formData.departureAirport}
              className="w-full mt-8 py-4 bg-gradient-to-r from-[#0070a0] to-[#00577c] text-white rounded-2xl font-semibold text-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI is crafting your perfect trip...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate My Trip Plan
                </>
              )}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Results Dashboard */}
      <AnimatePresence>
        {showResults && (
          <motion.section
            ref={resultsRef}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.8 }}
            className={`py-20 ${isDark ? 'bg-gradient-to-b from-gray-900 to-gray-800' : 'bg-gradient-to-b from-white to-[#f7f9fa]'}`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Results Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                  <h2 className={`text-3xl font-bold font-serif ${isDark ? 'text-white' : 'text-[#004968]'}`}>
                    Your Trip to {formData.destination}
                  </h2>
                  <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    {formData.departureDate} - {formData.returnDate} • {formData.travelStyle} • ${formData.dailyBudget}/day
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={copyToClipboard}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-colors ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    onClick={exportToPDF}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-colors ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                  <button
                    onClick={() => setShowResults(false)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0070a0] text-white rounded-xl hover:bg-[#00577c] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    New Plan
                  </button>
                </div>
              </div>

              {/* Trip Cost Summary Card */}
              {tripCosts && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl p-6 mb-8 ${isDark ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30' : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="w-6 h-6 text-amber-500" />
                    <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-[#004968]'}`}>Estimated Trip Cost</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white'}`}>
                      <p className="text-sm text-gray-500">Flights (Round-trip)</p>
                      {tripCosts.flights > 0 ? (
                        <p className="text-xl font-bold text-[#0070a0]">${tripCosts.flights.toLocaleString()}</p>
                      ) : (
                        <a 
                          href={buildGoogleFlightsUrl(parseAirportCode(formData.departureAirport), resolveDestinationIATA(formData.destination, formData.country), formData.departureDate, formData.returnDate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1"
                        >
                          Check on Google Flights
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white'}`}>
                      <p className="text-sm text-gray-500">Accommodation</p>
                      <p className="text-xl font-bold text-[#0070a0]">${tripCosts.accommodation.toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white'}`}>
                      <p className="text-sm text-gray-500">Activities</p>
                      <p className="text-xl font-bold text-[#0070a0]">${tripCosts.activities.toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white'}`}>
                      <p className="text-sm text-gray-500">Food & Dining</p>
                      <p className="text-xl font-bold text-[#0070a0]">${tripCosts.food.toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white'}`}>
                      <p className="text-sm text-gray-500">Local Transport</p>
                      <p className="text-xl font-bold text-[#0070a0]">${tripCosts.transport.toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30' : 'bg-gradient-to-br from-amber-100 to-orange-100'}`}>
                      <p className="text-sm text-gray-600 font-medium">Total Estimate</p>
                      <p className="text-2xl font-bold text-amber-600">${tripCosts.total.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">for {formData.groupSize} traveler{formData.groupSize > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tab Navigation */}
              <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                {[
                  { id: 'itinerary', label: 'Itinerary', icon: Map },
                  { id: 'packing', label: 'Packing List', icon: Backpack },
                  { id: 'flights', label: 'Flight Deals', icon: Plane },
                  { id: 'costs', label: 'Cost Breakdown', icon: DollarSign },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'bg-[#0070a0] text-white'
                        : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2">
                  {activeTab === 'itinerary' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      {itinerary.map((day, dayIndex) => (
                        <div key={dayIndex} className={`glass-card rounded-2xl p-6 ${isDark ? 'bg-gray-800/80 border-gray-700' : ''}`}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-[#0070a0] to-[#66a2cd] rounded-full flex items-center justify-center text-white font-bold">
                                {day.day}
                              </div>
                              <div>
                                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-[#004968]'}`}>Day {day.day}</h3>
                                <p className="text-sm text-gray-500">{day.date}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Day Total</p>
                              <p className="text-lg font-bold text-[#0070a0]">${day.dayTotal}</p>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            {day.activities.map((activity, actIndex) => (
                              <div
                                key={actIndex}
                                className={`flex gap-4 p-4 rounded-xl transition-colors ${isDark ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-[#e6f7ff]'}`}
                              >
                                <div className="text-sm font-medium text-[#0070a0] w-20 shrink-0">
                                  {activity.time}
                                </div>
                                <div className="flex-1">
                                  <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{activity.name}</h4>
                                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{activity.description}</p>
                                  <div className="flex flex-wrap gap-3 mt-2">
                                    <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-600 text-gray-300' : 'bg-white text-gray-600'}`}>
                                      ${activity.cost}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-600 text-gray-300' : 'bg-white text-gray-600'}`}>
                                      {activity.duration}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-600 text-gray-300' : 'bg-white text-gray-600'}`}>
                                      {activity.category}
                                    </span>
                                    <a
                                      href={activity.googleMapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs px-2 py-1 bg-[#0070a0]/10 rounded-full text-[#0070a0] hover:bg-[#0070a0]/20 transition-colors flex items-center gap-1"
                                    >
                                      <MapPin className="w-3 h-3" />
                                      View on Maps
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {activeTab === 'packing' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`glass-card rounded-2xl p-6 ${isDark ? 'bg-gray-800/80 border-gray-700' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-[#004968]'}`}>Smart Packing List</h3>
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {packingList.filter(i => i.checked).length} / {packingList.length} packed
                        </span>
                      </div>
                      
                      {['essentials', 'clothing', 'gear', 'documents'].map((category) => (
                        <div key={category} className="mb-6">
                          <h4 className={`text-sm font-medium uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {category}
                          </h4>
                          <div className="space-y-2">
                            {packingList
                              .filter((item) => item.category === category)
                              .map((item, index) => {
                                const actualIndex = packingList.findIndex(i => i === item)
                                const isLocked = !isPremium && actualIndex > 4
                                
                                return (
                                  <div
                                    key={index}
                                    onClick={() => !isLocked && togglePackingItem(actualIndex)}
                                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                      isLocked 
                                        ? 'bg-gray-700/50 opacity-60 cursor-not-allowed' 
                                        : isDark ? 'bg-gray-700/50 hover:bg-gray-700 cursor-pointer' : 'bg-gray-50 hover:bg-[#e6f7ff] cursor-pointer'
                                    }`}
                                  >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                      item.checked 
                                        ? 'bg-[#0070a0] border-[#0070a0]' 
                                        : isDark ? 'border-gray-500' : 'border-gray-300'
                                    }`}>
                                      {item.checked && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="flex-1">
                                      <span className={`${item.checked ? 'line-through text-gray-500' : isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {item.name}
                                      </span>
                                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{item.reason}</p>
                                    </div>
                                    {isLocked && (
                                      <Lock className="w-4 h-4 text-gray-400" />
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      ))}
                      
                      {!isPremium && (
                        <div className="mt-6 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30">
                          <div className="flex items-center gap-3">
                            <Crown className="w-5 h-5 text-amber-500" />
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                              Upgrade to Pro to unlock all packing items and save your lists!
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'flights' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      {flightOptions.length === 0 ? (
                        <div className={`glass-card rounded-2xl p-8 text-center ${isDark ? 'bg-gray-800/80 border-gray-700' : 'border border-gray-200'}`}>
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#0070a0]/10 flex items-center justify-center">
                            <Plane className="w-8 h-8 text-[#0070a0]" />
                          </div>
                          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-[#004968]'}`}>Search Flights on Google</h3>
                          <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            We couldn't find live flight offers for this route. Click below to search on Google Flights.
                          </p>
                          <a
                            href={buildGoogleFlightsUrl(parseAirportCode(formData.departureAirport), resolveDestinationIATA(formData.destination, formData.country), formData.departureDate, formData.returnDate)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg shadow-indigo-500/25"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Search on Google Flights
                          </a>
                          <p className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Get real-time prices and actual flight routes from hundreds of airlines
                          </p>
                        </div>
                      ) : (
                        <>
                        {flightOptions.map((flight, index) => (
                        <div key={index} className={`glass-card rounded-2xl overflow-hidden ${isDark ? 'bg-gray-800/80 border border-gray-700' : 'border border-gray-100'}`}>
                          <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-[#f8fbfc]'}`}>
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-gradient-to-br from-[#0070a0] to-[#66a2cd] rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">
                                {flight.airlineCode}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                  <h4 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-[#004968]'}`}>{flight.airline}</h4>
                                  {flight.dataSource === 'amadeus' && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                      Live · Amadeus
                                    </span>
                                  )}
                                  {flight.dataSource === 'serpapi' && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                      Live · Google Flights
                                    </span>
                                  )}
                                  {flight.dataSource === 'rapidapi' && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                      Live · Skyscanner
                                    </span>
                                  )}
                                  {flight.price === 0 && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                      Prices on Google Flights
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                  Round-trip · {flight.departure} → {flight.arrival}
                                </p>
                                {flight.outboundRoute && (
                                  <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Out {flight.outboundRoute}
                                    {flight.inboundRoute ? ` · In ${flight.inboundRoute}` : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 sm:text-right">
                              <div>
                                {flight.price > 0 ? (
                                  <>
                                    <p className="text-2xl font-bold text-[#0070a0]">${flight.price}</p>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                      per person (incl. carrier surcharges)
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-lg font-bold text-amber-500">View on Google Flights</p>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                      Real-time pricing available
                                    </p>
                                  </>
                                )}
                              </div>
                              <a
                                href={flight.googleFlightsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-2.5 bg-[#0070a0] text-white rounded-xl font-medium hover:bg-[#00577c] transition-colors inline-flex items-center gap-2 shrink-0 text-sm"
                                title="Open this round trip in Google Flights (same airports & dates as your plan)"
                              >
                                Google Flights
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                          <div className="p-5 space-y-5">
                            <div>
                              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-[#66a2cd]' : 'text-[#0070a0]'}`}>Outbound · {safeFormatIsoDate(formData.departureDate, 'EEE, MMM d')}</p>
                              <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="text-center min-w-[4.5rem]">
                                    <p className="text-lg font-bold tabular-nums">{flight.outboundDepartureTime}</p>
                                    <p className="text-xs text-gray-500">{flight.departure}</p>
                                  </div>
                                  <div className="flex-1 flex flex-col items-center px-2">
                                    <span className="text-xs text-gray-400">{flight.outboundDuration}</span>
                                    <div className={`w-full max-w-[140px] h-px my-1.5 relative ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                                      {flight.outboundStops > 0 && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-amber-400/30" title={flight.outboundStopCity} />
                                      )}
                                    </div>
                                    <span className="text-[10px] text-gray-500">
                                      {flight.outboundStops === 0
                                        ? 'Nonstop'
                                        : flight.outboundStops === 1
                                          ? `1 stop${flight.outboundStopCity ? ` · ${flight.outboundStopCity}` : ''}`
                                          : `${flight.outboundStops} stops${flight.outboundStopCity ? ` · via ${flight.outboundStopCity}` : ''}`}
                                    </span>
                                  </div>
                                  <div className="text-center min-w-[4.5rem]">
                                    <p className="text-lg font-bold tabular-nums">{flight.outboundArrivalTime}</p>
                                    <p className="text-xs text-gray-500">{flight.arrival}</p>
                                  </div>
                                </div>
                                <div className={`text-xs md:text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{flight.outboundFlightNumber}</span>
                                  <span className="mx-1">·</span>
                                  {flight.outboundAircraft}
                                </div>
                              </div>
                            </div>
                            <div className={`h-px ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} />
                            <div>
                              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-[#66a2cd]' : 'text-[#0070a0]'}`}>Return · {safeFormatIsoDate(formData.returnDate, 'EEE, MMM d')}</p>
                              <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="text-center min-w-[4.5rem]">
                                    <p className="text-lg font-bold tabular-nums">{flight.inboundDepartureTime}</p>
                                    <p className="text-xs text-gray-500">{flight.arrival}</p>
                                  </div>
                                  <div className="flex-1 flex flex-col items-center px-2">
                                    <span className="text-xs text-gray-400">{flight.inboundDuration}</span>
                                    <div className={`w-full max-w-[140px] h-px my-1.5 relative ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                                      {flight.inboundStops > 0 && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-amber-400/30" />
                                      )}
                                    </div>
                                    <span className="text-[10px] text-gray-500">
                                      {flight.inboundStops === 0
                                        ? 'Nonstop'
                                        : flight.inboundStops === 1
                                          ? `1 stop${flight.inboundStopCity ? ` · ${flight.inboundStopCity}` : ''}`
                                          : `${flight.inboundStops} stops${flight.inboundStopCity ? ` · via ${flight.inboundStopCity}` : ''}`}
                                    </span>
                                  </div>
                                  <div className="text-center min-w-[4.5rem]">
                                    <p className="text-lg font-bold tabular-nums">{flight.inboundArrivalTime}</p>
                                    <p className="text-xs text-gray-500">{flight.departure}</p>
                                  </div>
                                </div>
                                <div className={`text-xs md:text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{flight.inboundFlightNumber}</span>
                                  <span className="mx-1">·</span>
                                  {flight.inboundAircraft}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className={`text-center text-sm mt-4 px-2 space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <p>
                          Flight data provided by Amadeus API. Fares are indicative; always confirm pricing on the airline website or Google Flights before booking.
                        </p>
                        <p className="text-xs opacity-90">
                          Google Flights opens your exact round-trip city pair and dates (same as the planner).
                        </p>
                      </div>
                    </>
                  )}
                  </motion.div>
                )}

                  {activeTab === 'costs' && tripCosts && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`glass-card rounded-2xl p-6 space-y-6 ${isDark ? 'bg-gray-800/80 border-gray-700' : ''}`}
                    >
                      <div>
                        <h3 className={`text-xl font-semibold font-serif mb-1 ${isDark ? 'text-white' : 'text-[#004968]'}`}>Cost breakdown</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Based on your trip length, group size, daily budget, and the lowest listed round-trip fare for your route.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {(
                          [
                            { label: 'Flights (lowest RT option × travelers)', value: tripCosts.flights, hint: 'Matches Flight Deals tab' },
                            { label: 'Accommodation (est.)', value: tripCosts.accommodation, hint: 'Nights × budget share' },
                            { label: 'Activities (est.)', value: tripCosts.activities, hint: 'Itinerary line items' },
                            { label: 'Food & dining (est.)', value: tripCosts.food, hint: '30% of daily budget' },
                            { label: 'Local transport (est.)', value: tripCosts.transport, hint: '10% of daily budget' },
                          ] as const
                        ).map((row) => {
                          const total = tripCosts.total
                          const pct =
                            total > 0 && Number.isFinite(total)
                              ? Math.round((row.value / total) * 100)
                              : 0
                          const barWidth = Number.isFinite(pct) ? Math.min(100, Math.max(pct, 2)) : 2
                          return (
                            <div key={row.label}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{row.label}</span>
                                <span className="font-semibold text-[#0070a0]">${row.value.toLocaleString()}</span>
                              </div>
                              <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#0070a0] to-[#66a2cd] transition-all duration-500"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{row.hint}</p>
                            </div>
                          )
                        })}
                      </div>
                      <div className={`rounded-xl p-4 flex justify-between items-center ${isDark ? 'bg-gray-900/80 border border-gray-700' : 'bg-[#e6f7ff] border border-[#0070a0]/15'}`}>
                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-[#004968]'}`}>Total (estimate)</span>
                        <span className="text-2xl font-bold text-amber-500">${tripCosts.total.toLocaleString()}</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Trip Summary */}
                  <div className={`glass-card rounded-2xl p-6 ${isDark ? 'bg-gray-800/80 border-gray-700' : ''}`}>
                    <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-[#004968]'}`}>Trip Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>From</span>
                        <span className={`font-medium ${isDark ? 'text-white' : ''}`}>{formData.departureAirport.split(' - ')[0]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>To</span>
                        <span className={`font-medium ${isDark ? 'text-white' : ''}`}>{formData.destination}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Duration</span>
                        <span className={`font-medium ${isDark ? 'text-white' : ''}`}>
                          {safeTripDurationDays(formData.departureDate, formData.returnDate)} days
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Travelers</span>
                        <span className={`font-medium ${isDark ? 'text-white' : ''}`}>{formData.groupSize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Style</span>
                        <span className={`font-medium capitalize ${isDark ? 'text-white' : ''}`}>{formData.travelStyle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Daily Budget</span>
                        <span className="font-medium text-[#0070a0]">${formData.dailyBudget}/person</span>
                      </div>
                    </div>
                  </div>

                  {/* Premium CTA */}
                  {!isPremium && (
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white">
                      <div className="flex items-center gap-2 mb-3">
                        <Crown className="w-5 h-5" />
                        <span className="font-semibold">Vantage Pro</span>
                      </div>
                      <p className="text-sm text-white/90 mb-4">
                        Unlock unlimited trips, PDF exports, and exclusive deals.
                      </p>
                      <button
                        onClick={() => setShowPremiumModal(true)}
                        className="w-full py-3 bg-white text-orange-500 rounded-xl font-semibold hover:shadow-lg transition-all"
                      >
                        Start Free Trial
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className={`py-14 ${isDark ? 'bg-gray-950 border-t border-gray-800' : 'bg-[#003d56] border-t border-white/10'} text-white`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center ring-1 ring-white/20">
                  <Plane className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold font-serif tracking-tight">Vantage Travel</span>
              </div>
              <p className="text-white/75 text-sm leading-relaxed max-w-xs">
                AI-powered itineraries, packing lists, and route-aware flight references—built for confident trip planning.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white/95 tracking-wide text-sm uppercase">Product</h4>
              <ul className="space-y-2.5 text-white/70 text-sm">
                <li>
                  <a href="#features" className="hover:text-white transition-colors inline-flex items-center gap-1">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#planner" className="hover:text-white transition-colors">Trip planner</a>
                </li>
                <li>
                  <button type="button" onClick={() => setShowPremiumModal(true)} className="hover:text-white transition-colors text-left">
                    Pricing &amp; Premium
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white/95 tracking-wide text-sm uppercase">Legal &amp; contact</h4>
              <ul className="space-y-2.5 text-white/70 text-sm mb-5">
                <li>
                  <button type="button" onClick={() => setLegalModal('privacy')} className="hover:text-white transition-colors text-left inline-flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 opacity-80" />
                    Privacy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setLegalModal('terms')} className="hover:text-white transition-colors text-left inline-flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 opacity-80" />
                    Terms
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setLegalModal('cookies')} className="hover:text-white transition-colors text-left inline-flex items-center gap-2">
                    <Cookie className="w-3.5 h-3.5 opacity-80" />
                    Cookies
                  </button>
                </li>
              </ul>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Vantage Travel inquiry')}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/20 text-sm font-medium transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact
              </a>
              <p className="text-white/45 text-xs mt-2">{CONTACT_EMAIL}</p>
            </div>
          </div>
          <div className="border-t border-white/15 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-white/50 text-sm">
            <span>© {new Date().getFullYear()} Vantage Travel. All rights reserved.</span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-white/70 hover:text-white transition-colors text-sm font-medium"
            >
              Back to top
            </button>
          </div>
        </div>
      </footer>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} isDark={isDark} />

      {/* Premium Modal */}
      <PremiumModal 
        isOpen={showPremiumModal} 
        onClose={() => setShowPremiumModal(false)}
        onSubscribe={handlePremiumSubscribe}
      />
    </div>
  )
}

export default App
