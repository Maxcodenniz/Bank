import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Artist } from '../types';
import ArtistCard from './ArtistCard';
import SectionHeader from './SectionHeader';
import CategoryFilter from './CategoryFilter';
import { supabase } from '../lib/supabaseClient';
import { normalizeCountryName } from '../utils/countries';

const PAGE_SIZE = 12;
const REGION_CAP: Record<string, string> = {
  african: 'African',
  european: 'European',
  american: 'American',
  asian: 'Asian',
  maghreb: 'Maghreb',
};

interface ArtistsSectionProps {
  searchQuery: string;
}

const ArtistsSection: React.FC<ArtistsSectionProps> = ({ searchQuery }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const isInitialMount = useRef(true);

  const fetchCategories = useCallback(async () => {
    try {
      setError(null);

      const { data: artistsData, error: artistsError } = await supabase
        .from('profiles')
        .select('artist_type, region')
        .eq('user_type', 'artist');

      if (artistsError) {
        throw new Error(`Database error: ${artistsError.message}`);
      }

      const categoriesList: string[] = ['all'];

      const artistTypes = new Set<string>();
      artistsData?.forEach(artist => {
        if (artist.artist_type) {
          artistTypes.add(artist.artist_type.charAt(0).toUpperCase() + artist.artist_type.slice(1));
        }
      });
      if (artistTypes.has('Music')) categoriesList.push('music');
      if (artistTypes.has('Comedy')) categoriesList.push('comedy');

      const regionOrder = ['African', 'European', 'American', 'Asian', 'Maghreb'];
      const regions = new Set<string>();
      artistsData?.forEach(artist => {
        if (artist.region) regions.add(artist.region);
      });
      regionOrder.forEach(region => {
        if (regions.has(region)) categoriesList.push(region.toLowerCase());
      });

      setCategories(categoriesList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
      setCategories(['all', 'music', 'comedy', 'african', 'european', 'american', 'asian', 'maghreb']);
    }
  }, []);

  const fetchArtists = useCallback(async (pageNum: number) => {
    try {
      setError(null);
      const from = Math.max(0, (pageNum - 1) * PAGE_SIZE);
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('profiles')
        .select('id, username, avatar_url, genres, region, country, artist_type, bio', { count: 'exact' })
        .eq('user_type', 'artist')
        .order('username', { ascending: true, nullsFirst: false });

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(`username.ilike.${term},bio.ilike.${term}`);
      }

      if (activeCategory !== 'all') {
        const cat = activeCategory.toLowerCase();
        if (cat === 'music' || cat === 'comedy') {
          query = query.eq('artist_type', cat);
        } else if (REGION_CAP[cat]) {
          if (REGION_CAP[cat] === 'Maghreb') {
            query = query.or('region.eq.Maghreb,country.in.(Morocco,Algeria,Tunisia,Libya,Mauritania)');
          } else {
            query = query.eq('region', REGION_CAP[cat]);
          }
        }
      }

      const { data, error: supabaseError, count } = await query.range(from, to);

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      const raw = Array.isArray(data) ? data : [];
      // Enforce page size on client in case API returns more (e.g. default server limit)
      const pageData = raw.slice(0, PAGE_SIZE);
      const formattedArtists: Artist[] = pageData.map((profile: any) => ({
        id: profile.id,
        name: profile.username || '',
        imageUrl: profile.avatar_url || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
        genre: profile.genres?.[0] || 'Various',
        categories: [
          profile.region || '',
          normalizeCountryName(profile.country) || '',
          profile.artist_type === 'music' ? 'Music' : 'Comedy',
          ...(profile.genres || []),
        ].filter(Boolean),
        bio: profile.bio || 'No biography available.',
        socialLinks: {},
      }));

      setArtists(formattedArtists);
      setTotalCount(count ?? raw.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch artists');
      setArtists([]);
      setTotalCount(0);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        setError(null);
        const { error: testError } = await supabase
          .from('genres')
          .select('count', { count: 'exact', head: true });
        if (testError) throw new Error(`Connection test failed: ${testError.message}`);
        await Promise.all([fetchCategories(), fetchArtists(1)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize data');
      } finally {
        setLoading(false);
      }
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setPage(1);
    setLoading(true);
    fetchArtists(1).finally(() => setLoading(false));
  }, [activeCategory, searchQuery, fetchArtists]);

  useEffect(() => {
    if (page === 1) return;
    setLoading(true);
    fetchArtists(page).finally(() => setLoading(false));
  }, [page, fetchArtists]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const fromItem = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toItem = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <section className="relative py-20 bg-gradient-to-br from-gray-950 via-black to-gray-950 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <SectionHeader
          title="Featured Artists"
          icon={<Users className="h-6 w-6" />}
        />

        <CategoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        {error && (
          <div className="text-center py-4 mb-4">
            <div className="inline-block bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl">
              <p className="font-semibold">{error}</p>
              <span className="text-sm opacity-75 block mt-2">
                Please check your Supabase connection and try again.
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col justify-center items-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
              <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
            </div>
            <p className="mt-6 text-gray-400 font-medium">Loading artists...</p>
          </div>
        ) : artists.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {artists.map((artist, index) => (
                <div
                  key={artist.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="animate-fade-in"
                >
                  <ArtistCard artist={artist} />
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-gray-400 text-sm order-2 sm:order-1">
                  Showing {fromItem}–{toItem} of {totalCount} artists
                </p>
                <div className="flex items-center gap-2 order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/10"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  <span className="px-4 py-2 text-gray-300 font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/10"
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 max-w-md mx-auto border border-white/10 shadow-2xl">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                <Users className="w-10 h-10 text-purple-400" />
              </div>
              <p className="text-gray-300 text-xl font-semibold mb-2">No Artists Found</p>
              <p className="text-gray-500 text-sm">
                {searchQuery
                  ? `No artists found matching "${searchQuery}". Try using the search page for better results.`
                  : `No artists found in the "${activeCategory}" category`}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ArtistsSection;
