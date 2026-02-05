import React, { useRef } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

interface ImageUploadProps {
  previewUrl: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ previewUrl, onFileChange, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-full">
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Event preview"
              className="w-full h-48 object-cover rounded-lg"
              style={{ objectPosition: 'center top' }}
            />
            <button
              type="button"
              onClick={onClear}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-48 bg-gray-700 rounded-lg flex flex-col items-center justify-center cursor-pointer group hover:bg-gray-600 transition-all duration-300 border-2 border-dashed border-gray-600 hover:border-purple-500"
          >
            <div className="transform group-hover:scale-110 transition-transform duration-300">
              <ImageIcon size={40} className="text-gray-400 mb-2" />
              <p className="text-gray-400 text-sm">Click to upload event image</p>
              <p className="text-gray-500 text-xs mt-1">PNG, JPG up to 5MB</p>
            </div>
          </div>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept="image/*"
        className="hidden"
      />
      
      {!previewUrl && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors shadow-lg group"
        >
          <Upload size={20} className="transform group-hover:translate-y-[-2px] transition-transform" />
          <span>Upload Image</span>
        </button>
      )}
    </div>
  );
};

export default ImageUpload;