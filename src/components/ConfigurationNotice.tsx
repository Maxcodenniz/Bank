import React from 'react';
import { AlertTriangle, Settings, ExternalLink } from 'lucide-react';

const ConfigurationNotice: React.FC = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const agoraAppId = import.meta.env.VITE_AGORA_APP_ID;
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

  const missingConfigs = [];
  if (!supabaseUrl) missingConfigs.push('Supabase');
  if (!agoraAppId) missingConfigs.push('Agora');
  if (!stripeKey) missingConfigs.push('Stripe');

  // Show configuration notice in development mode only
  if (missingConfigs.length === 0 || import.meta.env.PROD) return null;

  return (
    <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 text-yellow-500 px-6 py-4 rounded-lg mb-6">
      <div className="flex items-start">
        <AlertTriangle className="h-6 w-6 mr-3 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-semibold text-lg mb-1">Configuration Required</h3>
          <p className="mb-3">
            The following services need to be configured for full functionality:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-4">
            {missingConfigs.map(service => (
              <li key={service}>{service} configuration missing</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {missingConfigs.includes('Supabase') && (
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Setup Supabase
              </a>
            )}
            {missingConfigs.includes('Agora') && (
              <a
                href="https://agora.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Setup Agora
              </a>
            )}
            {missingConfigs.includes('Stripe') && (
              <a
                href="https://stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Setup Stripe
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationNotice;