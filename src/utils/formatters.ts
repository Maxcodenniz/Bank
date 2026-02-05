export const formatDate = (dateString: string): string => {
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

export const formatTime = (timeString: string): string => {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
};

export const formatCurrency = (price: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
};

export const calculateTimeRemaining = (targetDate: string, targetTime: string): { 
  days: string;
  hours: string; 
  minutes: string; 
  seconds: string;
  isExpired: boolean;
} => {
  const now = new Date();
  const [year, month, day] = targetDate.split('-');
  const [hours, minutes] = targetTime.split(':');
  
  const target = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10)
  );
  
  const diff = target.getTime() - now.getTime();
  
  // Check if the event has already started
  if (diff <= 0) {
    return {
      days: '00',
      hours: '00',
      minutes: '00',
      seconds: '00',
      isExpired: true
    };
  }
  
  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  
  return {
    days: totalDays.toString().padStart(2, '0'),
    hours: (totalHours % 24).toString().padStart(2, '0'),
    minutes: (totalMinutes % 60).toString().padStart(2, '0'),
    seconds: (totalSeconds % 60).toString().padStart(2, '0'),
    isExpired: false
  };
};