import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { Image, Link as LinkIcon, Calendar, Upload, X, Plus, Pencil, Trash2, Loader2, AlertCircle, Megaphone, TrendingUp, CheckCircle, RefreshCw, Clock } from 'lucide-react';
import ImageCropper from '../components/ImageCropper';

interface Advertisement {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const Advertisements: React.FC = () => {
  const { userProfile } = useStore();
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingAd, setEditingAd] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    link: '',
    start_date: '',
    end_date: '',
    is_active: true
  });

  useEffect(() => {
    fetchAdvertisements();
  }, []);

  const fetchAdvertisements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdvertisements(data || []);
    } catch (err) {
      console.error('Error fetching advertisements:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch advertisements');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Image size should be less than 10MB');
        return;
      }

      // Create object URL for the cropper
      const objectUrl = URL.createObjectURL(file);
      setSelectedImage(objectUrl);
      setShowCropper(true);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(croppedBlob);
      setPreviewUrl(previewUrl);

      // Store the cropped image in the file input
      const croppedFile = new File([croppedBlob], 'cropped.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      // Create a new FileList-like object
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(croppedFile);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
      }

      // Clean up and close cropper
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage);
      }
      setSelectedImage(null);
      setShowCropper(false);
    } catch (err) {
      console.error('Error handling cropped image:', err);
      setError('Failed to process cropped image');
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = 'jpg'; // Always use jpg for consistency
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `advertisements/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, { 
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
    if (!isAdmin) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let imageUrl = formData.image_url;

      if (fileInputRef.current?.files?.[0]) {
        imageUrl = await uploadImage(fileInputRef.current.files[0]);
      }

      if (!imageUrl) {
        throw new Error('Please upload an image');
      }

      const adData = {
        ...formData,
        image_url: imageUrl
      };

      if (editingAd) {
        const { error } = await supabase
          .from('advertisements')
          .update(adData)
          .eq('id', editingAd);

        if (error) throw error;
        setSuccess('Advertisement updated successfully!');
      } else {
        const { error } = await supabase
          .from('advertisements')
          .insert(adData);

        if (error) throw error;
        setSuccess('Advertisement created successfully!');
      }

      setFormData({
        title: '',
        description: '',
        image_url: '',
        link: '',
        start_date: '',
        end_date: '',
        is_active: true
      });
      setPreviewUrl(null);
      setEditingAd(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await fetchAdvertisements();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save advertisement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ad: Advertisement) => {
    setEditingAd(ad.id);
    setFormData({
      title: ad.title,
      description: ad.description || '',
      image_url: ad.image_url,
      link: ad.link,
      start_date: ad.start_date,
      end_date: ad.end_date,
      is_active: ad.is_active
    });
    setPreviewUrl(ad.image_url);
  };

  const handleDelete = async (adId: string) => {
    if (!confirm('Are you sure you want to delete this advertisement?')) return;

    try {
      setDeleting(adId);
      setError(null);
      
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', adId);

      if (error) throw error;
      await fetchAdvertisements();
      setSuccess('Advertisement deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error deleting advertisement:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete advertisement');
    } finally {
      setDeleting(null);
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setFormData({ ...formData, image_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeAds = advertisements.filter(ad => ad.is_active).length;
  const expiredAds = advertisements.filter(ad => ad.end_date && new Date(ad.end_date) < new Date()).length;

  // Check admin access - show loading while checking
  if (loading && advertisements.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <div className="text-center relative z-10">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500 mx-auto mb-4"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
          </div>
          <p className="text-gray-400 font-medium">Loading advertisements...</p>
        </div>
      </div>
    );
  }

  // ✅ FIXED: Proper admin access check - allow both global_admin and super_admin
  const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
  if (!userProfile || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 border border-red-500/30 shadow-2xl max-w-md text-center relative z-10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center border-4 border-red-500/30">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            Access Denied
          </h2>
          <p className="text-gray-400 text-lg">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-24 px-6 relative overflow-x-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto relative z-10">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-2 flex items-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-3 shadow-xl shadow-purple-500/30">
                  <Megaphone className="w-7 h-7 text-white" />
                </div>
                {editingAd ? 'Edit Advertisement' : 'Create Advertisement'}
              </h1>
              <p className="text-gray-400 text-lg mt-2">Manage platform advertisements and campaigns</p>
            </div>
            
            {/* Stats Cards */}
            <div className="flex flex-wrap gap-4">
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-purple-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Ads</p>
                    <p className="text-2xl font-bold text-white">{advertisements.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-green-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Active</p>
                    <p className="text-2xl font-bold text-white">{activeAds}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Advertisement Form */}
        <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
          {error && (
            <div className="bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl mb-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-gradient-to-r from-green-600/20 via-emerald-500/20 to-green-600/20 backdrop-blur-sm border-2 border-green-500/50 text-green-300 px-6 py-4 rounded-2xl mb-6 shadow-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="font-semibold">{success}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-full">
                {previewUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl">
                    <img
                      src={previewUrl}
                      alt="Advertisement preview"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearPreview}
                      className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/90 to-rose-500/90 text-white hover:from-red-600 hover:to-rose-600 transition-all duration-300 flex items-center justify-center shadow-xl group"
                    >
                      <X size={18} className="group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-gray-800/60 to-gray-700/60 backdrop-blur-sm rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center">
                    <div className="text-center">
                      <Image size={40} className="text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No image selected</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2 w-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/40 hover:to-pink-600/40 border border-purple-500/30 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-purple-500/30"
                >
                  <Upload size={20} />
                  <span>Upload Image</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-semibold">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                placeholder="Enter advertisement title"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-semibold">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl resize-none"
                rows={3}
                placeholder="Enter advertisement description (optional)"
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-semibold">Link URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                  placeholder="https://example.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" size={18} />
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" size={18} />
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
              />
              <label htmlFor="is_active" className="text-gray-300 font-semibold cursor-pointer">Active Advertisement</label>
            </div>

            <div className="flex space-x-4 pt-4">
              {editingAd && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAd(null);
                    setFormData({
                      title: '',
                      description: '',
                      image_url: '',
                      link: '',
                      start_date: '',
                      end_date: '',
                      is_active: true
                    });
                    setPreviewUrl(null);
                  }}
                  className="flex-1 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white py-3 rounded-xl font-bold transition-all duration-300 shadow-lg border border-white/10"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 flex items-center justify-center shadow-xl ${
                  submitting 
                    ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 transform hover:scale-105'
                } text-white`}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  editingAd ? 'Update Advertisement' : 'Create Advertisement'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Advertisements List */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
              All Advertisements
            </h2>
            <button
              onClick={fetchAdvertisements}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-300 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          
          {loading && advertisements.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-800 p-6 rounded-lg animate-pulse">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-6 bg-gray-700 rounded w-1/3"></div>
                    <div className="flex space-x-2">
                      <div className="w-8 h-8 bg-gray-700 rounded"></div>
                      <div className="w-8 h-8 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="flex space-x-4 mb-4">
                    <div className="w-32 h-32 bg-gray-700 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                      <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {advertisements.map((ad) => (
                <div key={ad.id} className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{ad.title || 'Untitled Advertisement'}</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(ad)}
                        disabled={submitting}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Edit advertisement"
                      >
                        <Pencil size={18} className="group-hover:scale-110 transition-transform" />
                      </button>
                      <button
                        onClick={() => handleDelete(ad.id)}
                        disabled={deleting === ad.id || submitting}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 text-red-400 hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete advertisement"
                      >
                        {deleting === ad.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex space-x-4 mb-4">
                    <div className="relative w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden border-2 border-white/10 shadow-lg">
                      {imageErrors.has(ad.id) ? (
                        <div className="w-full h-full bg-gradient-to-br from-gray-700/60 to-gray-600/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                          <Image size={24} className="text-gray-500" />
                        </div>
                      ) : (
                        <img
                          src={ad.image_url}
                          alt={ad.title || 'Advertisement'}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setImageErrors(prev => new Set(prev).add(ad.id));
                          }}
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {ad.description && (
                        <p className="text-gray-300 mb-3 line-clamp-3">{ad.description}</p>
                      )}
                      {ad.link && (
                        <a
                          href={ad.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/30 text-purple-300 rounded-xl font-semibold transition-all duration-300"
                        >
                          <LinkIcon size={16} />
                          View Link
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                    <div className="text-gray-400">
                      <span className="font-medium">Start:</span>{' '}
                      {ad.start_date ? (
                        new Date(ad.start_date).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      ) : (
                        <span className="text-gray-500">Not set</span>
                      )}
                    </div>
                    <div className="text-gray-400">
                      <span className="font-medium">End:</span>{' '}
                      {ad.end_date ? (
                        new Date(ad.end_date).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      ) : (
                        <span className="text-gray-500">Not set</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <span className={`px-4 py-1.5 text-xs font-bold rounded-xl ${
                      ad.is_active 
                        ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {ad.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {ad.start_date && ad.end_date && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-400">
                          {new Date(ad.end_date) > new Date() 
                            ? `${Math.ceil((new Date(ad.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining`
                            : 'Expired'
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {advertisements.length === 0 && !loading && (
                <div className="text-center py-16 bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                    <Plus className="w-10 h-10 text-purple-400" />
                  </div>
                  <p className="text-gray-300 text-xl font-semibold mb-2">No advertisements yet.</p>
                  <p className="text-gray-500 text-sm">Create your first advertisement using the form on the left.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Image Cropper Modal */}
      {showCropper && selectedImage && (
        <ImageCropper
          imageUrl={selectedImage}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            if (selectedImage) {
              URL.revokeObjectURL(selectedImage);
            }
            setSelectedImage(null);
            setShowCropper(false);
          }}
        />
      )}
    </div>
  );
};

export default Advertisements;