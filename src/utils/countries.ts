/**
 * Comprehensive list of all world countries
 * ISO 3166-1 alpha-2 compliant country names
 */
export const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe"
] as const;

/**
 * Get filtered countries based on search query
 * Shows results only if query is at least 2 characters
 */
export const filterCountries = (query: string): string[] => {
  if (!query || query.length < 2) {
    return [];
  }
  
  const lowerQuery = query.toLowerCase();
  return COUNTRIES.filter(country =>
    country.toLowerCase().includes(lowerQuery)
  ).slice(0, 20); // Limit to 20 results for better UX
};

/**
 * Check if a country exists in the list
 */
export const isValidCountry = (country: string): boolean => {
  return COUNTRIES.includes(country as typeof COUNTRIES[number]);
};

/**
 * Normalize country names to standard format
 * Converts variations like "USA", "usa", "U.S.A." to "United States"
 * and handles other common variations
 */
export const normalizeCountryName = (country: string | null | undefined): string | null => {
  if (!country) return null;
  
  const trimmed = country.trim();
  if (!trimmed) return null;
  
  // Normalize to lowercase for comparison
  const lower = trimmed.toLowerCase();
  
  // Map of common variations to standard names
  const countryVariations: Record<string, string> = {
    // United States variations
    'usa': 'United States',
    'u.s.a.': 'United States',
    'u.s.a': 'United States',
    'us': 'United States',
    'u.s.': 'United States',
    'u.s': 'United States',
    'united states of america': 'United States',
    'america': 'United States',
    
    // United Kingdom variations
    'uk': 'United Kingdom',
    'u.k.': 'United Kingdom',
    'u.k': 'United Kingdom',
    'great britain': 'United Kingdom',
    'britain': 'United Kingdom',
    'england': 'United Kingdom',
    'scotland': 'United Kingdom',
    'wales': 'United Kingdom',
    'northern ireland': 'United Kingdom',
    
    // Other common variations
    'russia': 'Russia',
    'russian federation': 'Russia',
    'south korea': 'South Korea',
    'north korea': 'North Korea',
    'democratic republic of the congo': 'Democratic Republic of the Congo',
    'drc': 'Democratic Republic of the Congo',
    'dr congo': 'Democratic Republic of the Congo',
    'congo (democratic republic)': 'Democratic Republic of the Congo',
    'congo (kinshasa)': 'Democratic Republic of the Congo',
    'congo': 'Congo',
    'republic of the congo': 'Congo',
    'congo (brazzaville)': 'Congo',
    'myanmar': 'Myanmar',
    'burma': 'Myanmar',
    'czech republic': 'Czech Republic',
    'czechia': 'Czech Republic',
    'east timor': 'Timor-Leste',
    'timor leste': 'Timor-Leste',
    'cape verde': 'Cabo Verde',
    'ivory coast': 'Côte d\'Ivoire',
    'cote d\'ivoire': 'Côte d\'Ivoire',
    'swaziland': 'Eswatini',
  };
  
  // Check if it's a known variation
  if (countryVariations[lower]) {
    return countryVariations[lower];
  }
  
  // Check if it's already a standard country name (case-insensitive)
  const standardCountry = COUNTRIES.find(
    c => c.toLowerCase() === lower
  );
  
  if (standardCountry) {
    return standardCountry;
  }
  
  // If not found, try to find a close match (fuzzy matching for common typos)
  // For now, return the original if it's close to a standard name
  // Otherwise return null to exclude it
  return trimmed;
};

/**
 * Get unique, normalized countries from a list
 * Removes duplicates and normalizes country names
 */
export const getUniqueNormalizedCountries = (countries: (string | null | undefined)[]): string[] => {
  const normalized = countries
    .map(normalizeCountryName)
    .filter((country): country is string => country !== null);
  
  // Remove duplicates and sort
  return Array.from(new Set(normalized)).sort();
};

