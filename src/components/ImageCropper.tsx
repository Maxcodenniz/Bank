import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  X, 
  Check, 
  RotateCw, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw,
  Info,
  Maximize2,
  Square,
  Monitor,
  Smartphone,
  Calendar,
  AlertTriangle
} from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
  outputWidth?: number;
  outputHeight?: number;
  imageType?: 'event' | 'profile' | 'advertisement' | 'general';
}

interface AspectRatioPreset {
  name: string;
  ratio: number | undefined;
  icon: React.ReactNode;
  description: string;
  dimensions?: string;
  recommended?: boolean;
}

interface ImageRequirements {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  aspectRatio: number;
  fileSize: number; // in MB
}

const IMAGE_REQUIREMENTS: Record<string, ImageRequirements> = {
  event: {
    minWidth: 1200,
    minHeight: 675,
    maxWidth: 2400,
    maxHeight: 1350,
    aspectRatio: 16/9,
    fileSize: 5
  },
  profile: {
    minWidth: 400,
    minHeight: 400,
    maxWidth: 1200,
    maxHeight: 1200,
    aspectRatio: 1,
    fileSize: 3
  },
  advertisement: {
    minWidth: 800,
    minHeight: 400,
    maxWidth: 2400,
    maxHeight: 1200,
    aspectRatio: 2,
    fileSize: 8
  },
  general: {
    minWidth: 300,
    minHeight: 300,
    maxWidth: 2400,
    maxHeight: 2400,
    aspectRatio: 16/9,
    fileSize: 10
  }
};

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageUrl,
  onCropComplete,
  onCancel,
  aspectRatio,
  outputWidth = 1200,
  outputHeight = 675,
  imageType = 'general'
}) => {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [currentAspectRatio, setCurrentAspectRatio] = useState<number | undefined>(
    IMAGE_REQUIREMENTS[imageType]?.aspectRatio || aspectRatio
  );
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [imageValidation, setImageValidation] = useState<{
    isValid: boolean;
    warnings: string[];
    errors: string[];
  }>({ isValid: true, warnings: [], errors: [] });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const requirements = IMAGE_REQUIREMENTS[imageType];

  // Get presets based on image type
  const getAspectRatioPresets = (): AspectRatioPreset[] => {
    const basePresets: AspectRatioPreset[] = [
      { name: 'Square', ratio: 1, icon: <Square size={16} />, description: '1:1 (Profile pics)', dimensions: '400×400px min' },
      { name: 'Event Banner', ratio: 16/9, icon: <Calendar size={16} />, description: '16:9 (Event images)', dimensions: '1200×675px min', recommended: imageType === 'event' },
      { name: 'Wide Banner', ratio: 2, icon: <Monitor size={16} />, description: '2:1 (Advertisements)', dimensions: '800×400px min', recommended: imageType === 'advertisement' },
      { name: 'Landscape', ratio: 4/3, icon: <Monitor size={16} />, description: '4:3 (Standard photo)', dimensions: '800×600px min' },
      { name: 'Portrait', ratio: 9/16, icon: <Smartphone size={16} />, description: '9:16 (Mobile stories)', dimensions: '600×1067px min' }
    ];

    return basePresets;
  };

  const validateImage = useCallback((img: HTMLImageElement) => {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    const { naturalWidth, naturalHeight } = img;
    const imageAspectRatio = naturalWidth / naturalHeight;
    const targetAspectRatio = currentAspectRatio || requirements.aspectRatio;

    // Check minimum dimensions
    if (naturalWidth < requirements.minWidth) {
      errors.push(`Image width (${naturalWidth}px) is below minimum required (${requirements.minWidth}px)`);
    }
    if (naturalHeight < requirements.minHeight) {
      errors.push(`Image height (${naturalHeight}px) is below minimum required (${requirements.minHeight}px)`);
    }

    // Check maximum dimensions
    if (naturalWidth > requirements.maxWidth) {
      warnings.push(`Image width (${naturalWidth}px) exceeds recommended maximum (${requirements.maxWidth}px)`);
    }
    if (naturalHeight > requirements.maxHeight) {
      warnings.push(`Image height (${naturalHeight}px) exceeds recommended maximum (${requirements.maxHeight}px)`);
    }

    // Check aspect ratio deviation
    const aspectRatioDiff = Math.abs(imageAspectRatio - targetAspectRatio);
    if (aspectRatioDiff > 0.1) {
      warnings.push(`Image aspect ratio (${imageAspectRatio.toFixed(2)}) differs from target (${targetAspectRatio.toFixed(2)}). Cropping recommended.`);
    }

    // Quality recommendations
    if (naturalWidth < requirements.minWidth * 1.5) {
      warnings.push('Consider using a higher resolution image for better quality');
    }

    setImageValidation({
      isValid: errors.length === 0,
      warnings,
      errors
    });
  }, [currentAspectRatio, requirements]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height, naturalWidth, naturalHeight } = e.currentTarget;
    
    validateImage(e.currentTarget);
    
    // Auto-crop to recommended aspect ratio
    if (currentAspectRatio) {
      const imageAspectRatio = width / height;
      
      let cropWidth = 90;
      let cropHeight = 90;
      
      if (imageAspectRatio > currentAspectRatio) {
        cropHeight = 90;
        cropWidth = cropHeight * currentAspectRatio * (height / width);
      } else {
        cropWidth = 90;
        cropHeight = cropWidth / currentAspectRatio * (width / height);
      }
      
      setCrop({
        unit: '%',
        width: Math.min(cropWidth, 90),
        height: Math.min(cropHeight, 90),
        x: (100 - Math.min(cropWidth, 90)) / 2,
        y: (100 - Math.min(cropHeight, 90)) / 2
      });
    }
  }, [currentAspectRatio, validateImage]);

  const getCroppedImg = async (
    image: HTMLImageElement,
    pixelCrop: PixelCrop | null = null
  ): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (pixelCrop) {
      sourceX = pixelCrop.x * scaleX;
      sourceY = pixelCrop.y * scaleY;
      sourceWidth = pixelCrop.width * scaleX;
      sourceHeight = pixelCrop.height * scaleY;
    }

    // Use the specified output dimensions for the image type
    const finalWidth = outputWidth || requirements.minWidth;
    const finalHeight = outputHeight || requirements.minHeight;

    canvas.width = finalWidth;
    canvas.height = finalHeight;

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(finalWidth / 2, finalHeight / 2);
    
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }
    
    if (zoom !== 100) {
      ctx.scale(zoom / 100, zoom / 100);
    }

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -finalWidth / 2,
      -finalHeight / 2,
      finalWidth,
      finalHeight
    );

    ctx.restore();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          
          // Check final file size
          const fileSizeMB = blob.size / (1024 * 1024);
          if (fileSizeMB > requirements.fileSize) {
            console.warn(`File size (${fileSizeMB.toFixed(2)}MB) exceeds recommendation (${requirements.fileSize}MB)`);
          }
          
          resolve(blob);
        },
        'image/jpeg',
        0.95 // High quality for event images
      );
    });
  };

  const handleComplete = async () => {
    if (!imgRef.current || !imageValidation.isValid) return;

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      onCropComplete(croppedBlob);
    } catch (e) {
      console.error('Error creating crop:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCrop({
      unit: '%',
      width: 90,
      height: 90,
      x: 5,
      y: 5
    });
    setZoom(100);
    setRotation(0);
    setCurrentAspectRatio(requirements.aspectRatio);
  };

  const adjustZoom = (delta: number) => {
    setZoom(prev => Math.max(50, Math.min(200, prev + delta)));
  };

  const adjustRotation = (degrees: number) => {
    setRotation(prev => (prev + degrees) % 360);
  };

  const handleAspectRatioChange = (ratio: number | undefined) => {
    setCurrentAspectRatio(ratio);
    
    if (ratio && imgRef.current) {
      const { width, height } = imgRef.current;
      const imageAspectRatio = width / height;
      
      let cropWidth = 90;
      let cropHeight = 90;
      
      if (imageAspectRatio > ratio) {
        cropHeight = 90;
        cropWidth = cropHeight * ratio * (height / width);
      } else {
        cropWidth = 90;
        cropHeight = cropWidth / ratio * (width / height);
      }
      
      setCrop({
        unit: '%',
        width: Math.min(cropWidth, 90),
        height: Math.min(cropHeight, 90),
        x: (100 - Math.min(cropWidth, 90)) / 2,
        y: (100 - Math.min(cropHeight, 90)) / 2
      });
      
      // Re-validate with new aspect ratio
      validateImage(imgRef.current);
    }
  };

  const getImageTypeLabel = () => {
    const labels = {
      event: 'Event Image',
      profile: 'Profile Picture',
      advertisement: 'Advertisement Banner',
      general: 'General Image'
    };
    return labels[imageType] || 'Image';
  };

  const cropStyle = {
    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    transition: 'transform 0.2s ease-out'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-purple-400" />
            <div>
              <h3 className="text-2xl font-bold text-white">Optimize {getImageTypeLabel()}</h3>
              <p className="text-gray-400 text-sm">Required: {requirements.minWidth}×{requirements.minHeight}px minimum</p>
            </div>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`p-1 rounded transition-colors ${showInfo ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'}`}
            >
              <Info size={18} />
            </button>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Image Validation Results */}
        {(imageValidation.errors.length > 0 || imageValidation.warnings.length > 0) && (
          <div className="mx-6 mt-4 space-y-3">
            {imageValidation.errors.length > 0 && (
              <div className="bg-red-900 bg-opacity-50 border border-red-600 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-red-200 font-medium mb-2">Image Requirements Not Met:</h4>
                    <ul className="text-red-100 text-sm space-y-1">
                      {imageValidation.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {imageValidation.warnings.length > 0 && (
              <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Info size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-yellow-200 font-medium mb-2">Recommendations:</h4>
                    <ul className="text-yellow-100 text-sm space-y-1">
                      {imageValidation.warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Banner */}
        {showInfo && (
          <div className="bg-purple-900 bg-opacity-50 border border-purple-600 p-4 mx-6 mt-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="text-purple-100 text-sm">
                <p><strong>Event Image Guidelines:</strong></p>
                <ul className="mt-2 space-y-1">
                  <li>• Minimum size: {requirements.minWidth}×{requirements.minHeight}px</li>
                  <li>• Aspect ratio: {currentAspectRatio ? `${Math.round(currentAspectRatio * 100)/100}:1` : 'Flexible'}</li>
                  <li>• File size: Under {requirements.fileSize}MB recommended</li>
                  <li>• Use high-quality images for better display results</li>
                </ul>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-purple-400 hover:text-purple-300 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Aspect Ratio Presets */}
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">Choose Format:</span>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>Output: {outputWidth}×{outputHeight}px</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {getAspectRatioPresets().map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleAspectRatioChange(preset.ratio)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all relative ${
                  currentAspectRatio === preset.ratio
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={`${preset.description} - ${preset.dimensions || ''}`}
              >
                {preset.icon}
                <span>{preset.name}</span>
                {preset.recommended && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center space-x-6">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-300">Zoom:</span>
              <button
                onClick={() => adjustZoom(-10)}
                className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-sm text-gray-300 w-12 text-center">{zoom}%</span>
              <button
                onClick={() => adjustZoom(10)}
                className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
            </div>

            {/* Rotation Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-300">Rotate:</span>
              <button
                onClick={() => adjustRotation(-90)}
                className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                title="Rotate Left 90°"
              >
                <RotateCcw size={16} />
              </button>
              <span className="text-sm text-gray-300 w-12 text-center">{rotation}°</span>
              <button
                onClick={() => adjustRotation(90)}
                className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                title="Rotate Right 90°"
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            title="Reset all changes"
          >
            <RefreshCw size={16} />
            <span>Reset</span>
          </button>
        </div>

        {/* Crop Area */}
        <div className="flex-1 relative overflow-hidden bg-gray-800">
          <div 
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center p-4"
          >
            <div style={cropStyle} className="relative">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={currentAspectRatio}
                className="max-h-full max-w-full"
                ruleOfThirds
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: '60vh' }}
                />
              </ReactCrop>
            </div>
          </div>

          {/* Crop Info Overlay */}
          {completedCrop && (
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-400">Selection:</span>
                  <div>{Math.round(completedCrop.width)} × {Math.round(completedCrop.height)}px</div>
                </div>
                <div>
                  <span className="text-gray-400">Output:</span>
                  <div>{outputWidth} × {outputHeight}px</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {!imageValidation.isValid ? (
              <span className="text-red-400">Please fix image requirements before proceeding</span>
            ) : completedCrop ? (
              `Ready to optimize ${Math.round(completedCrop.width)}×${Math.round(completedCrop.height)}px selection`
            ) : (
              'Adjust crop area and settings as needed'
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={isProcessing || !imageValidation.isValid}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Check size={18} className="mr-2" />
                  Optimize Image
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;