import React, { useState, useCallback } from 'react';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageUploadModalProps {
  type: 'profile' | 'cover';
  onSave: (file: Blob) => void;
  onClose: () => void;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ type, onSave, onClose }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  
  const aspect = type === 'profile' ? 1 : 16/9;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSrc(URL.createObjectURL(e.target.files[0]));
    }
  };

  const onImageLoad = (img: HTMLImageElement) => {
    setImage(img);
    // Set initial crop to center square for profile, full width for cover
    if (type === 'profile') {
      const size = Math.min(img.width, img.height);
      setCrop({
        unit: 'px',
        width: size,
        height: size,
        x: (img.width - size) / 2,
        y: (img.height - size) / 2,
      });
    } else {
      setCrop({
        unit: '%',
        width: 100,
        aspect,
      });
    }
  };

  const getCroppedImage = useCallback(() => {
    if (!image || !completedCrop) return;
    
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = completedCrop.width!;
    canvas.height = completedCrop.height!;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(
      image,
      completedCrop.x! * scaleX,
      completedCrop.y! * scaleY,
      completedCrop.width! * scaleX,
      completedCrop.height! * scaleY,
      0,
      0,
      completedCrop.width!,
      completedCrop.height!
    );

    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  }, [completedCrop, image]);

  const handleSave = async () => {
    const croppedImage = await getCroppedImage();
    if (croppedImage) {
      onSave(croppedImage);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            Edit {type === 'profile' ? 'Profile Picture' : 'Cover Photo'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {!src ? (
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
            <label className="flex flex-col items-center justify-center cursor-pointer">
              <Upload size={48} className="text-gray-400 mb-4" />
              <span className="text-lg text-white">Select an image</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={onFileChange}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={aspect}
                circularCrop={type === 'profile'}
              >
                <img
                  src={src}
                  onLoad={(e) => onImageLoad(e.currentTarget)}
                  alt="Crop preview"
                />
              </ReactCrop>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSrc(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white"
              >
                Change Image
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};