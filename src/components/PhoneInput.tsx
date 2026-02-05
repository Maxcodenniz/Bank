import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Phone } from 'lucide-react';
import { PHONE_COUNTRY_CODES, formatFullPhone, parseFullPhone, normalizeLocalNumber, getDefaultDialCodeFromBrowser, type PhoneCountry } from '../utils/phoneCountryCodes';

export interface PhoneValue {
  dialCode: string;
  localNumber: string;
}

interface PhoneInputProps {
  value: PhoneValue | string;
  onChange: (value: PhoneValue, fullPhone: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  label?: string;
  id?: string;
}

function getDefaultDialCode(): string {
  return getDefaultDialCodeFromBrowser();
}

function getValue(value: PhoneValue | string): PhoneValue {
  const defaultDialCode = getDefaultDialCode();
  const defaultCountry = PHONE_COUNTRY_CODES.find((c) => c.dialCode === defaultDialCode) ?? PHONE_COUNTRY_CODES[0];
  if (typeof value === 'string') {
    const parsed = parseFullPhone(value);
    if (parsed) {
      const normalized = normalizeLocalNumber(parsed.localNumber);
      return { dialCode: parsed.dialCode, localNumber: normalized };
    }
    return { dialCode: defaultDialCode, localNumber: normalizeLocalNumber(value) };
  }
  const dial = value.dialCode || defaultDialCode;
  const local = value.localNumber ? normalizeLocalNumber(value.localNumber) : '';
  return { dialCode: dial, localNumber: local };
}

function getDefaultCountry(): PhoneCountry {
  const defaultDialCode = getDefaultDialCode();
  return PHONE_COUNTRY_CODES.find((c) => c.dialCode === defaultDialCode) ?? PHONE_COUNTRY_CODES[0];
}

function getCountry(dialCode: string): PhoneCountry {
  return PHONE_COUNTRY_CODES.find((c) => c.dialCode === dialCode) ?? getDefaultCountry();
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  placeholder = 'Phone number',
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  label,
  id = 'phone-input',
}) => {
  const parsed = getValue(value);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedCountry = getCountry(dialCode);

  useEffect(() => {
    const v = getValue(value);
    setDialCode(v.dialCode);
    setLocalNumber(v.localNumber);
  }, [value]);

  const filteredCountries = search.trim()
    ? PHONE_COUNTRY_CODES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dialCode.includes(search)
      )
    : PHONE_COUNTRY_CODES;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setShowDropdown(false);
        setSearch('');
      }
    };
    if (showDropdown) {
      // Use a slight delay to avoid immediate closure
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true);
      }, 0);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showDropdown]);

  const handleDialCodeChange = (country: PhoneCountry) => {
    setDialCode(country.dialCode);
    setShowDropdown(false);
    setSearch('');
    const next: PhoneValue = { dialCode: country.dialCode, localNumber };
    onChange(next, formatFullPhone(country.dialCode, localNumber));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 15);
    const normalized = normalizeLocalNumber(digitsOnly);
    setLocalNumber(normalized);
    const next: PhoneValue = { dialCode, localNumber: normalized };
    onChange(next, formatFullPhone(dialCode, normalized));
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-gray-300 mb-2">
          {label}
          {required && <span className="text-red-400"> *</span>}
        </label>
      )}
      <div className="flex rounded-lg overflow-visible bg-gray-800 border border-gray-700 focus-within:border-purple-500">
        <div className="relative flex-shrink-0">
          <button
            ref={triggerRef}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDropdown(!showDropdown);
              if (!showDropdown) {
                setSearch('');
              }
            }}
            disabled={disabled}
            className="flex items-center gap-1.5 px-2.5 py-2 text-white w-auto bg-gray-800 hover:bg-gray-700 border-r border-gray-700 focus:outline-none disabled:opacity-50 transition-colors"
            aria-label="Select country code"
            aria-expanded={showDropdown}
          >
            <span className="text-sm font-medium whitespace-nowrap">{selectedCountry.dialCode}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute left-0 top-full z-[100] mt-1 w-64 max-h-64 overflow-hidden bg-gray-800 border border-gray-700 rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-2 z-10">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSearch(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Search country or code..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto custom-scrollbar">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((c) => (
                    <button
                      key={c.name + c.dialCode}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDialCodeChange(c);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-purple-600 transition-colors flex justify-between items-center border-b border-gray-700/50 last:border-b-0 cursor-pointer ${
                        c.dialCode === dialCode 
                          ? 'bg-purple-600/40 text-white font-medium' 
                          : 'text-gray-200 hover:text-white'
                      }`}
                    >
                      <span className="truncate flex-1 text-left">{c.name}</span>
                      <span className={`ml-2 font-mono text-xs flex-shrink-0 ${c.dialCode === dialCode ? 'text-purple-300' : 'text-gray-400'}`}>
                        {c.dialCode}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-gray-400 text-sm text-center">
                    No countries found matching "{search}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="relative flex-1 flex items-center">
          <Phone className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            value={localNumber}
            onChange={handleNumberChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={`flex-1 w-full pl-10 pr-4 py-2 bg-gray-800 text-white placeholder-gray-500 focus:outline-none ${inputClassName}`}
          />
        </div>
      </div>
    </div>
  );
};

export default PhoneInput;
