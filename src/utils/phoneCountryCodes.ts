/**
 * Country names with E.164 dial codes for phone input dropdown.
 * Format: "+" prefix + country code (e.g. +1, +44).
 */
export interface PhoneCountry {
  name: string;
  dialCode: string;
}

export const PHONE_COUNTRY_CODES: PhoneCountry[] = [
  { name: 'Afghanistan', dialCode: '+93' },
  { name: 'Albania', dialCode: '+355' },
  { name: 'Algeria', dialCode: '+213' },
  { name: 'Andorra', dialCode: '+376' },
  { name: 'Angola', dialCode: '+244' },
  { name: 'Antigua and Barbuda', dialCode: '+1268' },
  { name: 'Argentina', dialCode: '+54' },
  { name: 'Armenia', dialCode: '+374' },
  { name: 'Australia', dialCode: '+61' },
  { name: 'Austria', dialCode: '+43' },
  { name: 'Azerbaijan', dialCode: '+994' },
  { name: 'Bahamas', dialCode: '+1242' },
  { name: 'Bahrain', dialCode: '+973' },
  { name: 'Bangladesh', dialCode: '+880' },
  { name: 'Barbados', dialCode: '+1246' },
  { name: 'Belarus', dialCode: '+375' },
  { name: 'Belgium', dialCode: '+32' },
  { name: 'Belize', dialCode: '+501' },
  { name: 'Benin', dialCode: '+229' },
  { name: 'Bhutan', dialCode: '+975' },
  { name: 'Bolivia', dialCode: '+591' },
  { name: 'Bosnia and Herzegovina', dialCode: '+387' },
  { name: 'Botswana', dialCode: '+267' },
  { name: 'Brazil', dialCode: '+55' },
  { name: 'Brunei', dialCode: '+673' },
  { name: 'Bulgaria', dialCode: '+359' },
  { name: 'Burkina Faso', dialCode: '+226' },
  { name: 'Burundi', dialCode: '+257' },
  { name: 'Cabo Verde', dialCode: '+238' },
  { name: 'Cambodia', dialCode: '+855' },
  { name: 'Cameroon', dialCode: '+237' },
  { name: 'Canada', dialCode: '+1' },
  { name: 'Central African Republic', dialCode: '+236' },
  { name: 'Chad', dialCode: '+235' },
  { name: 'Chile', dialCode: '+56' },
  { name: 'China', dialCode: '+86' },
  { name: 'Colombia', dialCode: '+57' },
  { name: 'Comoros', dialCode: '+269' },
  { name: 'Congo', dialCode: '+242' },
  { name: 'Costa Rica', dialCode: '+506' },
  { name: 'Croatia', dialCode: '+385' },
  { name: 'Cuba', dialCode: '+53' },
  { name: 'Cyprus', dialCode: '+357' },
  { name: 'Czech Republic', dialCode: '+420' },
  { name: 'Democratic Republic of the Congo', dialCode: '+243' },
  { name: 'Denmark', dialCode: '+45' },
  { name: 'Djibouti', dialCode: '+253' },
  { name: 'Dominica', dialCode: '+1767' },
  { name: 'Dominican Republic', dialCode: '+1809' },
  { name: 'Ecuador', dialCode: '+593' },
  { name: 'Egypt', dialCode: '+20' },
  { name: 'El Salvador', dialCode: '+503' },
  { name: 'Equatorial Guinea', dialCode: '+240' },
  { name: 'Eritrea', dialCode: '+291' },
  { name: 'Estonia', dialCode: '+372' },
  { name: 'Eswatini', dialCode: '+268' },
  { name: 'Ethiopia', dialCode: '+251' },
  { name: 'Fiji', dialCode: '+679' },
  { name: 'Finland', dialCode: '+358' },
  { name: 'France', dialCode: '+33' },
  { name: 'Gabon', dialCode: '+241' },
  { name: 'Gambia', dialCode: '+220' },
  { name: 'Georgia', dialCode: '+995' },
  { name: 'Germany', dialCode: '+49' },
  { name: 'Ghana', dialCode: '+233' },
  { name: 'Greece', dialCode: '+30' },
  { name: 'Grenada', dialCode: '+1473' },
  { name: 'Guatemala', dialCode: '+502' },
  { name: 'Guinea', dialCode: '+224' },
  { name: 'Guinea-Bissau', dialCode: '+245' },
  { name: 'Guyana', dialCode: '+592' },
  { name: 'Haiti', dialCode: '+509' },
  { name: 'Honduras', dialCode: '+504' },
  { name: 'Hungary', dialCode: '+36' },
  { name: 'Iceland', dialCode: '+354' },
  { name: 'India', dialCode: '+91' },
  { name: 'Indonesia', dialCode: '+62' },
  { name: 'Iran', dialCode: '+98' },
  { name: 'Iraq', dialCode: '+964' },
  { name: 'Ireland', dialCode: '+353' },
  { name: 'Israel', dialCode: '+972' },
  { name: 'Italy', dialCode: '+39' },
  { name: 'Jamaica', dialCode: '+1876' },
  { name: 'Japan', dialCode: '+81' },
  { name: 'Jordan', dialCode: '+962' },
  { name: 'Kazakhstan', dialCode: '+7' },
  { name: 'Kenya', dialCode: '+254' },
  { name: 'Kiribati', dialCode: '+686' },
  { name: 'Kosovo', dialCode: '+383' },
  { name: 'Kuwait', dialCode: '+965' },
  { name: 'Kyrgyzstan', dialCode: '+996' },
  { name: 'Laos', dialCode: '+856' },
  { name: 'Latvia', dialCode: '+371' },
  { name: 'Lebanon', dialCode: '+961' },
  { name: 'Lesotho', dialCode: '+266' },
  { name: 'Liberia', dialCode: '+231' },
  { name: 'Libya', dialCode: '+218' },
  { name: 'Liechtenstein', dialCode: '+423' },
  { name: 'Lithuania', dialCode: '+370' },
  { name: 'Luxembourg', dialCode: '+352' },
  { name: 'Madagascar', dialCode: '+261' },
  { name: 'Malawi', dialCode: '+265' },
  { name: 'Malaysia', dialCode: '+60' },
  { name: 'Maldives', dialCode: '+960' },
  { name: 'Mali', dialCode: '+223' },
  { name: 'Malta', dialCode: '+356' },
  { name: 'Marshall Islands', dialCode: '+692' },
  { name: 'Mauritania', dialCode: '+222' },
  { name: 'Mauritius', dialCode: '+230' },
  { name: 'Mexico', dialCode: '+52' },
  { name: 'Micronesia', dialCode: '+691' },
  { name: 'Moldova', dialCode: '+373' },
  { name: 'Monaco', dialCode: '+377' },
  { name: 'Mongolia', dialCode: '+976' },
  { name: 'Montenegro', dialCode: '+382' },
  { name: 'Morocco', dialCode: '+212' },
  { name: 'Mozambique', dialCode: '+258' },
  { name: 'Myanmar', dialCode: '+95' },
  { name: 'Namibia', dialCode: '+264' },
  { name: 'Nauru', dialCode: '+674' },
  { name: 'Nepal', dialCode: '+977' },
  { name: 'Netherlands', dialCode: '+31' },
  { name: 'New Zealand', dialCode: '+64' },
  { name: 'Nicaragua', dialCode: '+505' },
  { name: 'Niger', dialCode: '+227' },
  { name: 'Nigeria', dialCode: '+234' },
  { name: 'North Korea', dialCode: '+850' },
  { name: 'North Macedonia', dialCode: '+389' },
  { name: 'Norway', dialCode: '+47' },
  { name: 'Oman', dialCode: '+968' },
  { name: 'Pakistan', dialCode: '+92' },
  { name: 'Palau', dialCode: '+680' },
  { name: 'Palestine', dialCode: '+970' },
  { name: 'Panama', dialCode: '+507' },
  { name: 'Papua New Guinea', dialCode: '+675' },
  { name: 'Paraguay', dialCode: '+595' },
  { name: 'Peru', dialCode: '+51' },
  { name: 'Philippines', dialCode: '+63' },
  { name: 'Poland', dialCode: '+48' },
  { name: 'Portugal', dialCode: '+351' },
  { name: 'Qatar', dialCode: '+974' },
  { name: 'Romania', dialCode: '+40' },
  { name: 'Russia', dialCode: '+7' },
  { name: 'Rwanda', dialCode: '+250' },
  { name: 'Saint Kitts and Nevis', dialCode: '+1869' },
  { name: 'Saint Lucia', dialCode: '+1758' },
  { name: 'Saint Vincent and the Grenadines', dialCode: '+1784' },
  { name: 'Samoa', dialCode: '+685' },
  { name: 'San Marino', dialCode: '+378' },
  { name: 'Sao Tome and Principe', dialCode: '+239' },
  { name: 'Saudi Arabia', dialCode: '+966' },
  { name: 'Senegal', dialCode: '+221' },
  { name: 'Serbia', dialCode: '+381' },
  { name: 'Seychelles', dialCode: '+248' },
  { name: 'Sierra Leone', dialCode: '+232' },
  { name: 'Singapore', dialCode: '+65' },
  { name: 'Slovakia', dialCode: '+421' },
  { name: 'Slovenia', dialCode: '+386' },
  { name: 'Solomon Islands', dialCode: '+677' },
  { name: 'Somalia', dialCode: '+252' },
  { name: 'South Africa', dialCode: '+27' },
  { name: 'South Korea', dialCode: '+82' },
  { name: 'South Sudan', dialCode: '+211' },
  { name: 'Spain', dialCode: '+34' },
  { name: 'Sri Lanka', dialCode: '+94' },
  { name: 'Sudan', dialCode: '+249' },
  { name: 'Suriname', dialCode: '+597' },
  { name: 'Sweden', dialCode: '+46' },
  { name: 'Switzerland', dialCode: '+41' },
  { name: 'Syria', dialCode: '+963' },
  { name: 'Taiwan', dialCode: '+886' },
  { name: 'Tajikistan', dialCode: '+992' },
  { name: 'Tanzania', dialCode: '+255' },
  { name: 'Thailand', dialCode: '+66' },
  { name: 'Timor-Leste', dialCode: '+670' },
  { name: 'Togo', dialCode: '+228' },
  { name: 'Tonga', dialCode: '+676' },
  { name: 'Trinidad and Tobago', dialCode: '+1868' },
  { name: 'Tunisia', dialCode: '+216' },
  { name: 'Turkey', dialCode: '+90' },
  { name: 'Turkmenistan', dialCode: '+993' },
  { name: 'Tuvalu', dialCode: '+688' },
  { name: 'Uganda', dialCode: '+256' },
  { name: 'Ukraine', dialCode: '+380' },
  { name: 'United Arab Emirates', dialCode: '+971' },
  { name: 'United Kingdom', dialCode: '+44' },
  { name: 'United States', dialCode: '+1' },
  { name: 'Uruguay', dialCode: '+598' },
  { name: 'Uzbekistan', dialCode: '+998' },
  { name: 'Vanuatu', dialCode: '+678' },
  { name: 'Vatican City', dialCode: '+379' },
  { name: 'Venezuela', dialCode: '+58' },
  { name: 'Vietnam', dialCode: '+84' },
  { name: 'Yemen', dialCode: '+967' },
  { name: 'Zambia', dialCode: '+260' },
  { name: 'Zimbabwe', dialCode: '+263' },
];

// Multiple countries can share a dial code (e.g. +1 for US/Canada). First match wins for display.
const dialCodeToCountry = new Map(PHONE_COUNTRY_CODES.map((c) => [c.dialCode, c]));

// Sorted by dial code length descending so we try +1268 before +1
const dialCodesByLength = [...new Set(PHONE_COUNTRY_CODES.map((c) => c.dialCode))].sort(
  (a, b) => b.length - a.length
);

/** ISO 3166-1 alpha-2 region (e.g. from browser) -> E.164 dial code for default country selection */
export const REGION_TO_DIAL_CODE: Record<string, string> = {
  GB: '+44', US: '+1', CA: '+1', NG: '+234', IN: '+91', AU: '+61', DE: '+49', FR: '+33',
  KE: '+254', GH: '+233', ZA: '+27', EG: '+20', MA: '+212', DZ: '+213', TN: '+216',
  ET: '+251', TZ: '+255', UG: '+256', PK: '+92', BD: '+880', PH: '+63', VN: '+84',
  ID: '+62', MY: '+60', TH: '+66', CN: '+86', JP: '+81', KR: '+82', BR: '+55',
  MX: '+52', CO: '+57', AR: '+54', ES: '+34', IT: '+39', NL: '+31', PL: '+48',
  RU: '+7', TR: '+90', SA: '+966', AE: '+971', IE: '+353', PT: '+351', GR: '+30',
  RO: '+40', CZ: '+420', HU: '+36', SE: '+46', NO: '+47', DK: '+45', FI: '+358',
  CH: '+41', AT: '+43', BE: '+32', IL: '+972', NZ: '+64', SG: '+65', HK: '+852',
  CL: '+56', PE: '+51', EC: '+593', CM: '+237', CI: '+225', SN: '+221',
};

export function getCountryByDialCode(dialCode: string): PhoneCountry | undefined {
  return dialCodeToCountry.get(dialCode);
}

/**
 * Normalize local number to digits only, stripping leading trunk zero(s).
 * So 0650187931 and 650187931 both become 650187931 (one canonical form).
 */
export function normalizeLocalNumber(localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0+/, '') || '0';
}

/**
 * Format to strict E.164: dialCode + normalized local digits (no leading zeros).
 * Same number in different input formats (0650187931 vs 650187931) yields the same result.
 */
export function formatFullPhone(dialCode: string, localNumber: string): string {
  const normalized = normalizeLocalNumber(localNumber);
  if (!normalized) return '';
  return `${dialCode}${normalized}`;
}

/**
 * Parse and return canonical E.164 string for storage/comparison.
 * Use this when storing or checking duplicates so one format is always used.
 */
export function normalizePhoneToE164(fullPhone: string): string | null {
  const parsed = parseFullPhone(fullPhone);
  if (!parsed) return null;
  const normalized = normalizeLocalNumber(parsed.localNumber);
  if (!normalized) return null;
  return `${parsed.dialCode}${normalized}`;
}

export function parseFullPhone(fullPhone: string): { dialCode: string; localNumber: string } | null {
  if (!fullPhone || typeof fullPhone !== 'string') return null;
  const trimmed = fullPhone.trim();
  if (!trimmed.startsWith('+')) return null;
  for (const code of dialCodesByLength) {
    if (trimmed.startsWith(code)) {
      const rest = trimmed.substring(code.length).replace(/\D/g, '');
      return { dialCode: code, localNumber: rest };
    }
  }
  return null;
}

/** Language-only locale (e.g. "fr") -> dial code when region is not reported */
const LANGUAGE_TO_DIAL_CODE: Record<string, string> = {
  fr: '+33', de: '+49', en: '+44', es: '+34', it: '+39', pt: '+351', nl: '+31',
  pl: '+48', ru: '+7', ja: '+81', zh: '+86', ko: '+82', ar: '+966', tr: '+90',
  hi: '+91', el: '+30', ro: '+40', cs: '+420', hu: '+36', sv: '+46', no: '+47',
  da: '+45', fi: '+358', he: '+972', th: '+66', vi: '+84', id: '+62', ms: '+60',
};

/**
 * Default dial code based on visitor location (browser locale region or language).
 * e.g. "fr-FR" or "fr" -> +33, "en-GB" -> +44. Falls back to +33 (France) if unknown.
 */
export function getDefaultDialCodeFromBrowser(): string {
  if (typeof navigator === 'undefined' || !navigator.language) return '+33';
  try {
    const locale = new Intl.Locale(navigator.language);
    const region = (locale as Intl.Locale & { region?: string }).region;
    if (region && REGION_TO_DIAL_CODE[region]) return REGION_TO_DIAL_CODE[region];
    const lang = (locale.language || navigator.language.split('-')[0] || '').toLowerCase();
    if (lang && LANGUAGE_TO_DIAL_CODE[lang]) return LANGUAGE_TO_DIAL_CODE[lang];
  } catch {
    // Intl.Locale may not be available in older envs
  }
  const lang = navigator.language.split('-')[0]?.toLowerCase();
  if (lang && LANGUAGE_TO_DIAL_CODE[lang]) return LANGUAGE_TO_DIAL_CODE[lang];
  return '+33';
}
