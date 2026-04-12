// AI-powered activity generation for any city
// Uses contextual templates and smart algorithms to generate unique, detailed activities

export interface Activity {
  time: string
  name: string
  description: string
  cost: number
  duration: string
  location: string
  googleMapsUrl: string
  category: string
}

// Real-world landmark database for major cities
const CITY_LANDMARKS: Record<string, string[]> = {
  paris: ['Eiffel Tower', 'Louvre Museum', 'Notre-Dame Cathedral', 'Arc de Triomphe', 'Sacré-Cœur', 'Musée d\'Orsay', 'Champs-Élysées', 'Montmartre', 'Seine River', 'Luxembourg Gardens'],
  london: ['Big Ben', 'Tower Bridge', 'Buckingham Palace', 'British Museum', 'Westminster Abbey', 'Tower of London', 'London Eye', 'Hyde Park', 'Camden Market', 'Covent Garden'],
  tokyo: ['Senso-ji Temple', 'Tokyo Tower', 'Shibuya Crossing', 'Meiji Shrine', 'Tsukiji Outer Market', 'Akihabara', 'Harajuku', 'Shinjuku Gyoen', 'Imperial Palace', 'Roppongi Hills', 'Tokyo Skytree', 'Ginza', 'Asakusa'],
  newyork: ['Times Square', 'Central Park', 'Empire State Building', 'Statue of Liberty', 'Brooklyn Bridge', 'Metropolitan Museum', 'One World Trade', 'High Line', 'Broadway', 'Grand Central'],
  rome: ['Colosseum', 'Vatican Museums', 'Trevi Fountain', 'Pantheon', 'Roman Forum', 'Spanish Steps', 'Sistine Chapel', 'St. Peter\'s Basilica', 'Palatine Hill', 'Piazza Navona'],
  barcelona: ['Sagrada Família', 'Park Güell', 'La Rambla', 'Casa Batlló', 'Gothic Quarter', 'Camp Nou', 'Picasso Museum', 'Barceloneta Beach', 'Montjuïc', 'Casa Milà'],
  dubai: ['Burj Khalifa', 'Dubai Mall', 'Palm Jumeirah', 'Dubai Marina', 'Burj Al Arab', 'Gold Souk', 'Desert Safari', 'Dubai Frame', 'Global Village', 'La Mer Beach'],
  singapore: ['Marina Bay Sands', 'Gardens by the Bay', 'Sentosa Island', 'Orchard Road', 'Clarke Quay', 'Singapore Zoo', 'Chinatown', 'Little India', 'Raffles Hotel', 'Haw Par Villa'],
  sydney: ['Sydney Opera House', 'Harbour Bridge', 'Bondi Beach', 'Darling Harbour', 'Royal Botanic Garden', 'The Rocks', 'Taronga Zoo', 'Manly Beach', 'Blue Mountains', 'Queen Victoria Building'],
  amsterdam: ['Anne Frank House', 'Rijksmuseum', 'Van Gogh Museum', 'Canal Ring', 'Jordaan District', 'Vondelpark', 'Dam Square', 'Heineken Experience', 'Albert Cuyp Market', 'Rembrandt House'],
  berlin: ['Brandenburg Gate', 'Berlin Wall', 'Museum Island', 'Reichstag', 'Checkpoint Charlie', 'East Side Gallery', 'Potsdamer Platz', 'Charlottenburg Palace', 'Tiergarten', 'Alexanderplatz'],
  madrid: ['Prado Museum', 'Royal Palace', 'Retiro Park', 'Plaza Mayor', 'Puerta del Sol', 'Reina Sofía Museum', 'Gran Vía', 'Santiago Bernabéu', 'El Rastro Market', 'Temple of Debod'],
  istanbul: ['Hagia Sophia', 'Blue Mosque', 'Topkapi Palace', 'Grand Bazaar', 'Basilica Cistern', 'Galata Tower', 'Spice Market', 'Bosphorus Strait', 'Dolmabahçe Palace', 'Süleymaniye Mosque'],
  bangkok: ['Grand Palace', 'Wat Pho', 'Wat Arun', 'Chatuchak Market', 'Khao San Road', 'Jim Thompson House', 'Lumphini Park', 'Asiatique', 'MBK Center', 'Damnoen Saduak'],
  hongkong: ['Victoria Peak', 'Tsim Sha Tsui', 'Big Buddha', 'Lan Kwai Fong', 'Temple Street Night Market', 'Ocean Park', 'Star Ferry', 'Man Mo Temple', 'Ladies Market', 'Dragon\'s Back'],
  losangeles: ['Hollywood Sign', 'Walk of Fame', 'Griffith Observatory', 'Santa Monica Pier', 'Venice Beach', 'Getty Center', 'Rodeo Drive', 'Universal Studios', 'Disneyland', 'La Brea Tar Pits'],
  sanfrancisco: ['Golden Gate Bridge', 'Alcatraz Island', 'Fisherman\'s Wharf', 'Lombard Street', 'Union Square', 'Chinatown', 'Cable Cars', 'Painted Ladies', 'Pier 39', 'Coit Tower'],
  chicago: ['Millennium Park', 'Willis Tower', 'Navy Pier', 'Art Institute', 'Magnificent Mile', 'Wrigley Field', 'Cloud Gate', 'Field Museum', 'Shedd Aquarium', 'Lincoln Park Zoo'],
  miami: ['South Beach', 'Art Deco District', 'Wynwood Walls', 'Little Havana', 'Vizcaya Museum', 'Bayside Marketplace', 'Everglades', 'Key Biscayne', 'Design District', 'Coconut Grove'],
  lasvegas: ['Las Vegas Strip', 'Bellagio Fountains', 'Fremont Street', 'High Roller', 'Red Rock Canyon', 'Hoover Dam', 'Venetian Gondolas', 'Caesars Palace', 'Stratosphere', 'Neon Museum'],
  seoul: ['Gyeongbokgung Palace', 'N Seoul Tower', 'Myeongdong', 'Bukchon Hanok Village', 'Dongdaemun', 'Hongdae', 'Lotte World', 'Namdaemun Market', 'Insadong', 'Gangnam'],
  mumbai: ['Gateway of India', 'Marine Drive', 'Elephanta Caves', 'Colaba Causeway', 'Juhu Beach', 'Haji Ali', 'Siddhivinayak Temple', 'Chowpatty Beach', 'Sanjay Gandhi Park', 'Fashion Street'],
  delhi: ['Red Fort', 'India Gate', 'Qutub Minar', 'Humayun\'s Tomb', 'Chandni Chowk', 'Lotus Temple', 'Akshardham', 'Jama Masjid', 'Raj Ghat', 'National Museum'],
  riodejaneiro: ['Christ the Redeemer', 'Copacabana Beach', 'Sugarloaf Mountain', 'Ipanema Beach', 'Selarón Steps', 'Maracanã Stadium', 'Tijuca Forest', 'Botanical Garden', 'Lapa Arches', 'Leblon'],
  cairo: ['Pyramids of Giza', 'Sphinx', 'Egyptian Museum', 'Khan el-Khalili', 'Cairo Citadel', 'Al-Azhar Mosque', 'Coptic Cairo', 'Nile River', 'Muizz Street', 'Al-Azhar Park'],
  capetown: ['Table Mountain', 'Robben Island', 'V&A Waterfront', 'Kirstenbosch', 'Camps Bay', 'Bo-Kaap', 'District Six Museum', 'Two Oceans Aquarium', 'Lion\'s Head', 'Boulders Beach'],
  machupicchu: ['Machu Picchu', 'Inca Trail', 'Sun Gate', 'Temple of the Sun', 'Huayna Picchu', 'Sacred Valley', 'Ollantaytambo', 'Pisac Market', 'Moray', 'Maras Salt Mines'],
}

// Activity templates by travel style
const ACTIVITY_TEMPLATES: Record<string, Array<(city: string, _country: string, budget: number) => Partial<Activity>>> = {
  culture: [
    (city, _country, budget) => ({
      name: `${city} Historic Walking Tour`,
      description: `Explore the rich history and architecture of ${city} with a guided walking tour through historic neighborhoods. Discover hidden courtyards, ancient monuments, and hear fascinating stories from local historians.`,
      cost: Math.round(budget * 0.15),
      duration: '3 hours',
      category: 'History',
    }),
    (city, _country, budget) => ({
      name: 'Museum of Fine Arts Visit',
      description: `Spend the afternoon at ${city}'s premier art museum, featuring collections spanning centuries of artistic achievement. Audio guides available in multiple languages.`,
      cost: Math.round(budget * 0.12),
      duration: '2.5 hours',
      category: 'Museum',
    }),
    (city, _country, budget) => ({
      name: 'Local Heritage Site Exploration',
      description: `Visit one of ${city}'s UNESCO World Heritage sites or historic monuments. Marvel at the architecture and learn about the cultural significance of these preserved treasures.`,
      cost: Math.round(budget * 0.1),
      duration: '2 hours',
      category: 'Landmark',
    }),
    (city, country, budget) => ({
      name: 'Traditional Performance Evening',
      description: `Experience authentic ${country} culture through music, dance, or theater at a renowned local venue. Perfect for immersing yourself in local artistic traditions.`,
      cost: Math.round(budget * 0.25),
      duration: '2 hours',
      category: 'Performance',
    }),
    (city, _country, budget) => ({
      name: 'Old Town Architecture Tour',
      description: `Wander through ${city}'s charming old town, admiring centuries-old buildings, cobblestone streets, and architectural gems from different eras.`,
      cost: Math.round(budget * 0.05),
      duration: '2 hours',
      category: 'Walking',
    }),
    (city, _country, budget) => ({
      name: 'Cathedral & Religious Sites Visit',
      description: `Tour ${city}'s magnificent cathedrals, temples, or mosques. Learn about religious history, admire stunning interiors, and enjoy peaceful moments of reflection.`,
      cost: Math.round(budget * 0.08),
      duration: '1.5 hours',
      category: 'Spiritual',
    }),
    (city, _country, budget) => ({
      name: 'Historical Monument Photography',
      description: `Capture stunning photos of ${city}'s most iconic monuments and landmarks. Early morning or golden hour visit for the best lighting and fewer crowds.`,
      cost: Math.round(budget * 0.06),
      duration: '2 hours',
      category: 'Photography',
    }),
    (city, _country, budget) => ({
      name: 'Cultural History Lecture',
      description: `Attend an engaging lecture or presentation about ${city}'s unique history and cultural evolution at a local university or cultural center.`,
      cost: Math.round(budget * 0.1),
      duration: '2 hours',
      category: 'Education',
    }),
  ],
  foodie: [
    (city, _country, budget) => ({
      name: 'Gourmet Food Tour',
      description: `Embark on a culinary journey through ${city}'s best neighborhoods. Sample local specialties, street food, and hidden gems with an expert food guide.`,
      cost: Math.round(budget * 0.4),
      duration: '3.5 hours',
      category: 'Food Tour',
    }),
    (city, country, budget) => ({
      name: 'Traditional Cooking Class',
      description: `Learn to prepare authentic ${country} dishes with a local chef. Visit a local market to select fresh ingredients, then cook and enjoy your creations.`,
      cost: Math.round(budget * 0.35),
      duration: '4 hours',
      category: 'Cooking',
    }),
    (city, _country, budget) => ({
      name: 'Fine Dining Experience',
      description: `Indulge in an exceptional dinner at one of ${city}'s top-rated restaurants. Experience innovative cuisine that blends local flavors with modern techniques.`,
      cost: Math.round(budget * 0.6),
      duration: '2.5 hours',
      category: 'Fine Dining',
    }),
    (city, _country, budget) => ({
      name: 'Local Market Food Crawl',
      description: `Explore ${city}'s bustling food markets, tasting fresh produce, artisanal cheeses, cured meats, and local delicacies. A feast for all senses!`,
      cost: Math.round(budget * 0.2),
      duration: '2 hours',
      category: 'Market',
    }),
    (_city, _country, budget) => ({
      name: 'Wine & Cheese Tasting',
      description: `Sample carefully curated selections of regional wines paired with artisanal cheeses. Learn about terroir, production methods, and perfect pairings.`,
      cost: Math.round(budget * 0.3),
      duration: '2 hours',
      category: 'Tasting',
    }),
    (city, _country, budget) => ({
      name: 'Street Food Adventure',
      description: `Discover ${city}'s best street food vendors and food trucks. Try local favorites and hidden specialties that locals love.`,
      cost: Math.round(budget * 0.15),
      duration: '2 hours',
      category: 'Street Food',
    }),
    (city, _country, budget) => ({
      name: 'Chocolate & Pastry Tour',
      description: `Savor handcrafted chocolates, pastries, and desserts from ${city}'s finest patisseries and chocolatiers. A sweet journey through culinary artistry.`,
      cost: Math.round(budget * 0.18),
      duration: '2 hours',
      category: 'Dessert',
    }),
    (_city, country, budget) => ({
      name: 'Farm-to-Table Dinner',
      description: `Enjoy a sustainable dining experience featuring locally-sourced ingredients. Meet the producers and learn about ${country}'s culinary traditions.`,
      cost: Math.round(budget * 0.5),
      duration: '2.5 hours',
      category: 'Sustainable Dining',
    }),
  ],
  adventure: [
    (city, _country, budget) => ({
      name: 'Scenic Hiking Expedition',
      description: `Trek through stunning natural landscapes surrounding ${city}. Experience breathtaking views, diverse flora and fauna, and the thrill of outdoor adventure.`,
      cost: Math.round(budget * 0.2),
      duration: '5 hours',
      category: 'Hiking',
    }),
    (city, _country, budget) => ({
      name: 'Adrenaline Activity',
      description: `Get your heart racing with exciting activities like zip-lining, rock climbing, or water sports available near ${city}. Professional guides ensure safety.`,
      cost: Math.round(budget * 0.4),
      duration: '3 hours',
      category: 'Adventure',
    }),
    (city, _country, budget) => ({
      name: 'Sunrise Summit Trek',
      description: `Wake early for an unforgettable sunrise hike to ${city}'s best viewpoint. Watch the city awaken as the sun paints the sky in brilliant colors.`,
      cost: Math.round(budget * 0.15),
      duration: '4 hours',
      category: 'Nature',
    }),
    (city, _country, budget) => ({
      name: 'Kayaking or Water Adventure',
      description: `Explore ${city}'s waterways by kayak, paddleboard, or boat. Discover hidden coves, waterfront neighborhoods, and marine life from a unique perspective.`,
      cost: Math.round(budget * 0.25),
      duration: '2.5 hours',
      category: 'Water Sports',
    }),
    (city, _country, budget) => ({
      name: 'Mountain Biking Trail',
      description: `Ride exciting trails through forests and hills near ${city}. Suitable for various skill levels with bikes and safety gear provided.`,
      cost: Math.round(budget * 0.3),
      duration: '3 hours',
      category: 'Cycling',
    }),
    (city, country, budget) => ({
      name: 'Paragliding or Sky Experience',
      description: `Soar above ${city} for a bird's-eye view of the landscape. An unforgettable experience with certified instructors and top safety standards.`,
      cost: Math.round(budget * 0.8),
      duration: '2 hours',
      category: 'Air Sports',
    }),
    (city, country, budget) => ({
      name: 'Wildlife Safari or Nature Tour',
      description: `Spot native wildlife in their natural habitat near ${city}. Expert naturalists guide you through pristine ecosystems.`,
      cost: Math.round(budget * 0.35),
      duration: '4 hours',
      category: 'Wildlife',
    }),
    (city, country, budget) => ({
      name: 'Cave Exploration or Canyoning',
      description: `Discover underground wonders or navigate through canyons near ${city}. An exciting blend of exploration and mild adventure.`,
      cost: Math.round(budget * 0.45),
      duration: '3 hours',
      category: 'Exploration',
    }),
  ],
  relaxation: [
    (city, country, budget) => ({
      name: 'Luxury Spa & Wellness Day',
      description: `Rejuvenate with world-class spa treatments using local ingredients and techniques. Massages, facials, and relaxation therapies await.`,
      cost: Math.round(budget * 0.5),
      duration: '3 hours',
      category: 'Spa',
    }),
    (city, country, budget) => ({
      name: 'Scenic Park Retreat',
      description: `Unwind in ${city}'s most beautiful park or garden. Find a peaceful spot to read, meditate, or simply enjoy nature's tranquility.`,
      cost: Math.round(budget * 0.05),
      duration: '2 hours',
      category: 'Nature',
    }),
    (city, country, budget) => ({
      name: 'Sunset Cruise or Viewing',
      description: `Relax while watching a spectacular sunset over ${city}. Whether from a boat, beach, or hilltop, it's pure magic.`,
      cost: Math.round(budget * 0.2),
      duration: '2 hours',
      category: 'Scenic',
    }),
    (city, country, budget) => ({
      name: 'Thermal Baths or Hot Springs',
      description: `Soak in natural hot springs or luxurious thermal baths. The mineral-rich waters soothe muscles and calm the mind.`,
      cost: Math.round(budget * 0.3),
      duration: '2.5 hours',
      category: 'Wellness',
    }),
    (city, country, budget) => ({
      name: 'Beach Day & Coastal Relaxation',
      description: `Spend a lazy day at ${city}'s best beach. Swim, sunbathe, and enjoy beachside refreshments at your leisure.`,
      cost: Math.round(budget * 0.15),
      duration: '4 hours',
      category: 'Beach',
    }),
    (city, country, budget) => ({
      name: 'Yoga & Meditation Session',
      description: `Join a rejuvenating yoga class in a beautiful setting. Suitable for all levels, focusing on relaxation and mindfulness.`,
      cost: Math.round(budget * 0.12),
      duration: '1.5 hours',
      category: 'Wellness',
    }),
    (city, country, budget) => ({
      name: 'Café Hopping & People Watching',
      description: `Slow down at ${city}'s charming cafés. Enjoy artisanal coffee, pastries, and the art of people-watching like a local.`,
      cost: Math.round(budget * 0.1),
      duration: '2 hours',
      category: 'Leisure',
    }),
    (city, country, budget) => ({
      name: 'Botanical Garden Stroll',
      description: `Wander through beautifully curated gardens featuring native and exotic plants. A peaceful escape from urban bustle.`,
      cost: Math.round(budget * 0.08),
      duration: '2 hours',
      category: 'Nature',
    }),
  ],
  business: [
    (city, country, budget) => ({
      name: 'Business District Networking Tour',
      description: `Explore ${city}'s financial and business hubs. See iconic skyscrapers and learn about the local economy and major industries.`,
      cost: Math.round(budget * 0.1),
      duration: '2 hours',
      category: 'Business',
    }),
    (city, country, budget) => ({
      name: 'Executive Coworking Day Pass',
      description: `Work from a premium coworking space with high-speed internet, meeting rooms, and networking opportunities with local professionals.`,
      cost: Math.round(budget * 0.2),
      duration: '4 hours',
      category: 'Work',
    }),
    (city, country, budget) => ({
      name: 'Business Lunch at Top Venue',
      description: `Network over an impressive lunch at one of ${city}'s premier business restaurants. Perfect for client meetings or professional connections.`,
      cost: Math.round(budget * 0.4),
      duration: '2 hours',
      category: 'Networking',
    }),
    (city, country, budget) => ({
      name: 'Industry-Specific Business Tour',
      description: `Visit key companies or innovation hubs in ${city}'s leading industry sectors. Gain insights into local business practices.`,
      cost: Math.round(budget * 0.15),
      duration: '3 hours',
      category: 'Industry',
    }),
    (city, country, budget) => ({
      name: 'Professional Conference or Seminar',
      description: `Attend a business seminar or industry talk. Stay current with trends while expanding your professional network in ${city}.`,
      cost: Math.round(budget * 0.25),
      duration: '3 hours',
      category: 'Education',
    }),
    (city, country, budget) => ({
      name: 'Executive Lounge Experience',
      description: `Relax and work from an exclusive executive lounge with premium amenities, city views, and a sophisticated atmosphere.`,
      cost: Math.round(budget * 0.3),
      duration: '3 hours',
      category: 'Luxury',
    }),
    (city, country, budget) => ({
      name: 'Startup Ecosystem Meetup',
      description: `Connect with ${city}'s vibrant startup community. Pitch ideas, find collaborators, or simply get inspired by innovation.`,
      cost: Math.round(budget * 0.1),
      duration: '2 hours',
      category: 'Networking',
    }),
    (city, country, budget) => ({
      name: 'International Trade Center Visit',
      description: `Tour ${city}'s major trade centers or exhibition halls. Understand the city's role in global commerce and trade.`,
      cost: Math.round(budget * 0.12),
      duration: '2 hours',
      category: 'Business',
    }),
  ],
}

// Generic activity templates for any city not in the database
const GENERIC_TEMPLATES: Array<(city: string, country: string, budget: number, style: string) => Partial<Activity>> = [
  (city, country, budget, style) => ({
    name: `${city} City Center Exploration`,
    description: `Discover the heart of ${city} with a leisurely walk through the city center. Explore main squares, historic buildings, and local landmarks that define this vibrant ${country} destination.`,
    cost: Math.round(budget * 0.08),
    duration: '2.5 hours',
    category: 'Exploration',
  }),
  (city, country, budget, style) => ({
    name: 'Local Neighborhood Discovery',
    description: `Wander through a charming residential neighborhood in ${city}. Experience authentic local life, browse small shops, and find hidden gems off the tourist path.`,
    cost: Math.round(budget * 0.06),
    duration: '2 hours',
    category: 'Walking',
  }),
  (city, country, budget, style) => ({
    name: `${country} Cultural Immersion`,
    description: `Dive deep into ${country} culture with hands-on experiences. Learn about local customs, traditions, and daily life from friendly residents eager to share their heritage.`,
    cost: Math.round(budget * 0.2),
    duration: '3 hours',
    category: 'Culture',
  }),
  (city, country, budget, style) => ({
    name: 'Scenic Photography Walk',
    description: `Capture the beauty of ${city} on a guided photography tour. Visit the most photogenic spots and learn tips for stunning travel photography.`,
    cost: Math.round(budget * 0.12),
    duration: '2.5 hours',
    category: 'Photography',
  }),
  (city, country, budget, style) => ({
    name: 'Local Artisan Workshop Visit',
    description: `Meet local craftspeople and artisans in ${city}. Watch traditional techniques and perhaps try your hand at creating something unique to take home.`,
    cost: Math.round(budget * 0.15),
    duration: '2 hours',
    category: 'Arts',
  }),
  (city, country, budget, style) => ({
    name: 'Riverside or Waterfront Promenade',
    description: `Enjoy a relaxing walk along ${city}'s waterfront. Take in scenic views, watch boats pass by, and enjoy the refreshing breeze.`,
    cost: Math.round(budget * 0.05),
    duration: '1.5 hours',
    category: 'Scenic',
  }),
  (city, country, budget, style) => ({
    name: 'Traditional Music & Dance Show',
    description: `Experience the rhythms and movements of ${country} through a captivating performance. An authentic cultural evening you won't forget.`,
    cost: Math.round(budget * 0.25),
    duration: '2 hours',
    category: 'Entertainment',
  }),
  (city, country, budget, style) => ({
    name: 'Sunset Viewpoint Experience',
    description: `Head to ${city}'s best viewpoint for a breathtaking sunset. Watch the city transform as day turns to night and lights begin to twinkle.`,
    cost: Math.round(budget * 0.08),
    duration: '1.5 hours',
    category: 'Viewpoint',
  }),
  (city, country, budget, style) => ({
    name: 'Local Market Shopping',
    description: `Browse bustling markets where locals shop. Find unique souvenirs, sample street food, and practice your bargaining skills.`,
    cost: Math.round(budget * 0.18),
    duration: '2 hours',
    category: 'Shopping',
  }),
  (city, country, budget, style) => ({
    name: 'Hidden Courtyards & Secret Spots',
    description: `Discover ${city}'s secret corners with a local guide. Find hidden courtyards, quiet gardens, and overlooked architectural details.`,
    cost: Math.round(budget * 0.1),
    duration: '2 hours',
    category: 'Discovery',
  }),
  (city, country, budget, style) => ({
    name: 'Culinary Heritage Tasting',
    description: `Sample traditional dishes that define ${country} cuisine. Learn the stories behind each recipe and understand the regional food culture.`,
    cost: Math.round(budget * 0.3),
    duration: '2.5 hours',
    category: 'Food',
  }),
  (city, country, budget, style) => ({
    name: 'Architecture & Design Tour',
    description: `Appreciate ${city}'s diverse architecture, from historic buildings to modern structures. Learn about different architectural styles and influences.`,
    cost: Math.round(budget * 0.15),
    duration: '2.5 hours',
    category: 'Architecture',
  }),
  (city, country, budget, style) => ({
    name: 'Evening City Lights Tour',
    description: `See ${city} transform at night. Visit illuminated landmarks, experience the nightlife atmosphere, and enjoy the city's evening energy.`,
    cost: Math.round(budget * 0.12),
    duration: '2 hours',
    category: 'Nightlife',
  }),
  (city, country, budget, style) => ({
    name: 'Nature Escape Day Trip',
    description: `Take a short trip from ${city} to nearby natural attractions. Enjoy hiking, scenic views, and a refreshing break from urban life.`,
    cost: Math.round(budget * 0.35),
    duration: '5 hours',
    category: 'Nature',
  }),
  (city, country, budget, style) => ({
    name: 'Coffee Culture Experience',
    description: `Discover ${city}'s coffee scene. Visit specialty roasters, learn brewing techniques, and understand why ${country} takes coffee seriously.`,
    cost: Math.round(budget * 0.12),
    duration: '1.5 hours',
    category: 'Beverage',
  }),
  (city, country, budget, style) => ({
    name: 'Street Art & Urban Culture Walk',
    description: `Explore ${city}'s vibrant street art scene. Discover murals, graffiti, and urban installations that tell the city's contemporary story.`,
    cost: Math.round(budget * 0.06),
    duration: '2 hours',
    category: 'Art',
  }),
]

// Time slots for activities
const TIME_SLOTS = [
  '09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '07:00 PM', '09:30 PM'
]

// Generate location based on activity type and city
function generateLocation(activityName: string, city: string, country: string): string {
  const cityKey = city.toLowerCase().replace(/[^a-z]/g, '')
  const landmarks = CITY_LANDMARKS[cityKey]
  
  if (landmarks && landmarks.length > 0) {
    const randomLandmark = landmarks[Math.floor(Math.random() * landmarks.length)]
    return `${randomLandmark}, ${city}`
  }
  
  // Generate contextual locations
  if (activityName.includes('Museum')) return `Museum District, ${city}`
  if (activityName.includes('Park')) return `Central Park, ${city}`
  if (activityName.includes('Beach')) return `Beachfront, ${city}`
  if (activityName.includes('Market')) return `Central Market, ${city}`
  if (activityName.includes('Restaurant') || activityName.includes('Dining')) return `Restaurant Row, ${city}`
  if (activityName.includes('Spa')) return `Wellness District, ${city}`
  if (activityName.includes('Historic') || activityName.includes('Old Town')) return `Historic Center, ${city}`
  if (activityName.includes('Waterfront') || activityName.includes('Riverside')) return `Waterfront Promenade, ${city}`
  if (activityName.includes('Viewpoint')) return `Observation Deck, ${city}`
  
  return `City Center, ${city}`
}

// Generate Google Maps URL
function generateMapsUrl(location: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(location)}`
}

// Shuffle array
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Main function to generate AI-powered activities
export function generateAIActivities(
  city: string,
  country: string,
  travelStyle: string,
  dailyBudget: number,
  numDays: number,
  weatherPreference: string = 'any'
): Activity[] {
  const normalizedStyle = travelStyle.toLowerCase()
  const templates = ACTIVITY_TEMPLATES[normalizedStyle] || ACTIVITY_TEMPLATES.culture
  
  const activities: Activity[] = []
  const usedNames = new Set<string>()
  
  // Generate style-specific activities
  const cityKey = city.toLowerCase().replace(/[^a-z]/g, '')
  const hasSpecificLandmarks = CITY_LANDMARKS[cityKey] !== undefined
  
  // Create a larger pool of possible activities
  let activityPool: Partial<Activity>[] = []
  
  // Add style-specific templates
  templates.forEach(template => {
    const activity = template(city, country, dailyBudget)
    if (!usedNames.has(activity.name!)) {
      usedNames.add(activity.name!)
      activityPool.push(activity)
    }
  })
  
  // Add generic templates
  GENERIC_TEMPLATES.forEach(template => {
    const activity = template(city, country, dailyBudget, normalizedStyle)
    if (!usedNames.has(activity.name!)) {
      usedNames.add(activity.name!)
      activityPool.push(activity)
    }
  })
  
  // If city has landmarks, create landmark-specific activities
  if (hasSpecificLandmarks) {
    const landmarks = CITY_LANDMARKS[cityKey]
    landmarks.slice(0, 5).forEach(landmark => {
      activityPool.push({
        name: `${landmark} Visit`,
        description: `Explore ${landmark}, one of ${city}'s most iconic attractions. Take your time to appreciate the history, architecture, and significance of this remarkable site.`,
        cost: Math.round(dailyBudget * 0.1),
        duration: '1.5 hours',
        category: 'Landmark',
      })
    })
  }
  
  // Shuffle the pool for variety
  activityPool = shuffle(activityPool)
  
  // Assign time slots and complete activity details
  const numActivitiesNeeded = Math.min(numDays * 4, activityPool.length)
  
  for (let i = 0; i < numActivitiesNeeded; i++) {
    const baseActivity = activityPool[i % activityPool.length]
    const timeSlot = TIME_SLOTS[i % TIME_SLOTS.length]
    const location = generateLocation(baseActivity.name!, city, country)
    
    activities.push({
      time: timeSlot,
      name: baseActivity.name!,
      description: baseActivity.description!,
      cost: Math.max(5, Math.round((baseActivity.cost || dailyBudget * 0.15) * (0.8 + Math.random() * 0.4))),
      duration: baseActivity.duration!,
      location,
      googleMapsUrl: generateMapsUrl(location),
      category: baseActivity.category!,
    })
  }
  
  return activities
}

// Generate activities for a specific day
export function generateDayActivities(
  dayIndex: number,
  city: string,
  country: string,
  travelStyle: string,
  dailyBudget: number,
  weatherPreference: string
): Activity[] {
  // Generate fresh pool for this day to ensure variety
  const allActivities = generateAIActivities(city, country, travelStyle, dailyBudget, 1, weatherPreference)
  
  // Select 4 activities for the day, rotating through the pool
  const startIndex = (dayIndex * 4) % allActivities.length
  const dayActivities: Activity[] = []
  
  for (let i = 0; i < 4; i++) {
    const activityIndex = (startIndex + i) % allActivities.length
    const activity = allActivities[activityIndex]
    
    // Adjust time based on position in day
    const timeSlot = TIME_SLOTS[i]
    
    dayActivities.push({
      ...activity,
      time: timeSlot,
      cost: Math.round(activity.cost * (dailyBudget / 150)), // Scale based on budget
    })
  }
  
  return dayActivities
}
