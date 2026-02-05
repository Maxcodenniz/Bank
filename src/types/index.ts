export interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  genre: string;
  categories: string[];
  bio: string;
  socialLinks: {
    instagram?: string;
    twitter?: string;
    spotify?: string;
    youtube?: string;
  };
  upcoming?: boolean;
  streamKey?: string;
}

export interface Concert {
  id: string;
  artistId: string;
  title: string;
  date: string;
  time: string;
  imageUrl: string;
  description: string;
  categories: string[];
  duration: number;
  isLive: boolean;
  price: number;
  maxTickets: number;
  soldTickets: number;
  streamUrl?: string;
}

export interface Ticket {
  id: string;
  concertId: string;
  userId: string;
  purchaseDate: string;
  price: number;
  status: 'active' | 'used' | 'cancelled';
}

export interface User {
  id: string;
  email: string;
  name: string;
  isArtist: boolean;
  artistId?: string;
}

export interface StreamSession {
  id: string;
  concertId: string;
  artistId: string;
  startTime: string;
  endTime?: string;
  status: 'scheduled' | 'live' | 'ended';
  viewerCount: number;
}