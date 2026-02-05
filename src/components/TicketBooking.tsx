import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Concert, Ticket } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency } from '../utils/formatters';

interface TicketBookingProps {
  concert: Concert;
  onClose: () => void;
}

const TicketBooking: React.FC<TicketBookingProps> = ({ concert, onClose }) => {
  const { user, addTicket } = useStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBooking = async () => {
    if (!user) {
      setError('Please sign in to book tickets');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Redirect to Stripe payment link
      window.location.href = 'https://buy.stripe.com/7sYaEXfNC19DbpXgfT9bO01';
    } catch (err) {
      setError('Failed to process booking. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Book Ticket</h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <h3 className="font-semibold">{concert.title}</h3>
            <p className="text-gray-600">€1.00</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">
              Tickets Available: {concert.maxTickets - concert.soldTickets}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBooking}
            disabled={isProcessing}
            className={`flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isProcessing ? 'Processing...' : 'Buy your Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketBooking;