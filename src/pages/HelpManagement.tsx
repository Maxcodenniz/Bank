import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Upload, 
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  BookOpen,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileText,
  Layers
} from 'lucide-react';

interface HelpContent {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  section: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const HelpManagement: React.FC = () => {
  const { userProfile } = useStore();
  const [helpContent, setHelpContent] = useState<HelpContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image_url: '',
    section: 'General',
    display_order: 1
  });

  const sections = [
    'General',
    'Getting Started',
    'Tickets',
    'Payments',
    'Technical',
    'Policies',
    'Streaming',
    'Account',
    'Troubleshooting'
  ];

  useEffect(() => {
    fetchHelpContent();
  }, []);

  const fetchHelpContent = async () => {
    try {
      const { data, error } = await supabase
        .from('help_content')
        .select('*')
        .order('section', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;
      setHelpContent(data || []);
    } catch (err) {
      console.error('Error fetching help content:', err);
      setError('Failed to fetch help content');
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
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `help/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userProfile?.user_type !== 'global_admin') return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let imageUrl = formData.image_url;

      if (fileInputRef.current?.files?.[0]) {
        imageUrl = await uploadImage(fileInputRef.current.files[0]);
      }

      const contentData = {
        ...formData,
        image_url: imageUrl
      };

      if (editingItem) {
        const { error } = await supabase
          .from('help_content')
          .update(contentData)
          .eq('id', editingItem);

        if (error) throw error;
        setSuccess('Help content updated successfully!');
      } else {
        const { error } = await supabase
          .from('help_content')
          .insert(contentData);

        if (error) throw error;
        setSuccess('Help content created successfully!');
      }

      setFormData({
        title: '',
        content: '',
        image_url: '',
        section: 'General',
        display_order: 1
      });
      setPreviewUrl(null);
      setEditingItem(null);
      setShowAddForm(false);
      await fetchHelpContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save help content');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: HelpContent) => {
    setEditingItem(item.id);
    setFormData({
      title: item.title,
      content: item.content,
      image_url: item.image_url || '',
      section: item.section,
      display_order: item.display_order
    });
    setPreviewUrl(item.image_url || null);
    setShowAddForm(true);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this help content?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('help_content')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      await fetchHelpContent();
      setSuccess('Help content deleted successfully!');
    } catch (error) {
      console.error('Error deleting help content:', error);
      setError('Failed to delete help content');
    } finally {
      setLoading(false);
    }
  };

  const updateDisplayOrder = async (itemId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('help_content')
        .update({ display_order: newOrder })
        .eq('id', itemId);

      if (error) throw error;
      await fetchHelpContent();
    } catch (error) {
      console.error('Error updating display order:', error);
      setError('Failed to update order');
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setFormData({ ...formData, image_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setShowAddForm(false);
    setFormData({
      title: '',
      content: '',
      image_url: '',
      section: 'General',
      display_order: 1
    });
    setPreviewUrl(null);
    setError(null);
  };

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

  const groupedContent = helpContent.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, HelpContent[]>);

  const totalItems = helpContent.length;
  const totalSections = Object.keys(groupedContent).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-24 px-6 relative overflow-x-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto relative z-10">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-blue-300 to-purple-300 bg-clip-text text-transparent mb-2 flex items-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mr-3 shadow-xl shadow-purple-500/30">
                  <HelpCircle className="w-7 h-7 text-white" />
                </div>
                Help Content Management
              </h1>
              <p className="text-gray-400 text-lg mt-2">Manage help articles and support content</p>
            </div>
            
            {/* Stats Cards */}
            <div className="flex flex-wrap gap-4">
              <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-purple-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Articles</p>
                    <p className="text-2xl font-bold text-white">{totalItems}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-blue-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Sections</p>
                    <p className="text-2xl font-bold text-white">{totalSections}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 flex items-center space-x-2 shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-105"
            >
              <Plus className="h-5 w-5" />
              <span>Add Help Content</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl mb-6 shadow-xl flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-semibold">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-red-300 hover:text-white transition-all duration-300 flex items-center justify-center group"
            >
              <X size={16} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-gradient-to-r from-green-600/20 via-green-500/20 to-green-600/20 backdrop-blur-sm border-2 border-green-500/50 text-green-300 px-6 py-4 rounded-2xl mb-6 shadow-xl flex justify-between items-center">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="font-semibold">{success}</span>
            </div>
            <button 
              onClick={() => setSuccess(null)} 
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-green-300 hover:text-white transition-all duration-300 flex items-center justify-center group"
            >
              <X size={16} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Content Form */}
        {showAddForm && (
          <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/50 flex items-center justify-center">
                  {editingItem ? <Edit className="w-5 h-5 text-purple-400" /> : <Plus className="w-5 h-5 text-purple-400" />}
                </div>
                {editingItem ? 'Edit Help Content' : 'Add New Help Content'}
              </h2>
              <button
                onClick={cancelEdit}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all duration-300 flex items-center justify-center group"
              >
                <X size={20} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Image Upload */}
              <div className="flex flex-col items-center space-y-4">
                <div className="relative w-full">
                  {previewUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl">
                      <img
                        src={previewUrl}
                        alt="Help content preview"
                        className="w-full h-64 object-cover"
                        style={{ objectPosition: 'center top' }}
                      />
                      <button
                        type="button"
                        onClick={clearPreview}
                        className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/90 to-rose-500/90 hover:from-red-600 hover:to-rose-600 text-white shadow-xl flex items-center justify-center transition-all duration-300 group"
                      >
                        <X size={18} className="group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gradient-to-br from-gray-800/60 to-gray-700/40 backdrop-blur-sm rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                          <ImageIcon size={32} className="text-purple-400" />
                        </div>
                        <p className="text-gray-400 text-sm">No image selected</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
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
                    className="px-5 py-3 bg-gradient-to-r from-purple-600/30 to-blue-600/30 hover:from-purple-600/40 hover:to-blue-600/40 border border-purple-500/30 text-white rounded-xl font-semibold flex items-center space-x-2 transition-all duration-300 shadow-lg"
                  >
                    <Upload size={18} />
                    <span>Upload Image (Optional)</span>
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
                  required
                  placeholder="Enter help article title"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Section</label>
                <select
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                >
                  {sections.map(section => (
                    <option key={section} value={section} className="bg-gray-800">{section}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl resize-none"
                  rows={8}
                  required
                  placeholder="Enter the help content..."
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 px-6 py-3 bg-gradient-to-br from-gray-600/30 to-gray-700/30 hover:from-gray-600/40 hover:to-gray-700/40 border border-gray-500/30 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 shadow-xl ${
                    loading 
                      ? 'bg-gray-600/50 cursor-not-allowed border border-gray-500/30' 
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-105'
                  }`}
                >
                  <Save className="h-5 w-5" />
                  <span>{loading ? 'Saving...' : editingItem ? 'Update Content' : 'Create Content'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Content List */}
        <div className={showAddForm ? '' : 'lg:col-span-2'}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/50 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-400" />
              </div>
              Current Help Content
            </h2>
            <button
              onClick={fetchHelpContent}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all duration-300 flex items-center justify-center"
              title="Refresh content"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          
          {loading && !showAddForm ? (
            <div className="flex flex-col justify-center items-center py-16 bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/10">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500/30 border-t-purple-500"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-2 border-purple-500/20"></div>
              </div>
              <p className="text-gray-400 mt-4 text-sm">Loading help content...</p>
            </div>
          ) : Object.keys(groupedContent).length > 0 ? (
            <div className="space-y-8">
              {Object.entries(groupedContent).map(([section, items]) => (
                <div key={section} className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/50 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      {section}
                    </h3>
                    <span className="ml-auto px-3 py-1 bg-white/5 rounded-xl text-gray-400 text-sm font-semibold">
                      {items.length} {items.length === 1 ? 'article' : 'articles'}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div key={item.id} className="bg-gradient-to-br from-gray-800/60 via-gray-700/40 to-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.01]">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <h4 className="text-xl font-bold text-white">{item.title}</h4>
                              <span className="px-3 py-1 bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold rounded-xl">
                                Order: {item.display_order}
                              </span>
                            </div>
                            
                            {item.image_url && (
                              <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
                                <img
                                  src={item.image_url}
                                  alt={item.title}
                                  className="w-48 h-32 object-cover"
                                  style={{ objectPosition: 'center top' }}
                                />
                              </div>
                            )}
                            
                            <p className="text-gray-300 mb-4 line-clamp-3 leading-relaxed">{item.content}</p>
                            <div className="flex items-center gap-4 text-gray-500 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>
                              </div>
                              {item.updated_at !== item.created_at && (
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                  <span>Updated: {new Date(item.updated_at).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 ml-4">
                            <div className="flex flex-col space-y-2">
                              <button
                                onClick={() => updateDisplayOrder(item.id, item.display_order - 1)}
                                disabled={index === 0}
                                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center group"
                                title="Move up"
                              >
                                <ArrowUp size={16} className="group-hover:scale-110 transition-transform" />
                              </button>
                              <button
                                onClick={() => updateDisplayOrder(item.id, item.display_order + 1)}
                                disabled={index === items.length - 1}
                                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center group"
                                title="Move down"
                              >
                                <ArrowDown size={16} className="group-hover:scale-110 transition-transform" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleEdit(item)}
                              className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-blue-400 hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 flex items-center justify-center group"
                              title="Edit"
                            >
                              <Edit size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 text-red-400 hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-300 flex items-center justify-center group"
                              title="Delete"
                            >
                              <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                <HelpCircle className="w-10 h-10 text-purple-400" />
              </div>
              <p className="text-gray-300 text-xl font-semibold mb-2">No help content available</p>
              <p className="text-gray-500 text-sm">Click "Add Help Content" to get started</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default HelpManagement;