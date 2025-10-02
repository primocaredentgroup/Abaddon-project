'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onImagesChange: (images: { name: string; url: string; type: string; size: number }[]) => void;
  existingImages?: { name: string; url: string; type: string; size: number }[];
}

export function ImageUploader({ onImagesChange, existingImages = [] }: ImageUploaderProps) {
  const [images, setImages] = useState<{ name: string; url: string; type: string; size: number }[]>(existingImages);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const newImages: { name: string; url: string; type: string; size: number }[] = [];

      for (const file of Array.from(files)) {
        // Valida tipo file
        if (!file.type.startsWith('image/')) {
          alert(`${file.name} non è un'immagine valida`);
          continue;
        }

        // Valida dimensione (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} è troppo grande (max 5MB)`);
          continue;
        }

        // Converti a base64 (in produzione usa un servizio di storage come AWS S3)
        const base64 = await fileToBase64(file);
        
        newImages.push({
          name: file.name,
          url: base64,
          type: file.type,
          size: file.size
        });
      }

      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onImagesChange(updatedImages);
    } catch (error) {
      console.error('Errore upload:', error);
      alert('Errore durante l\'upload delle immagini');
    } finally {
      setIsUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
        <input
          type="file"
          id="image-upload"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <label htmlFor="image-upload" className="cursor-pointer">
          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            {isUploading ? 'Caricamento...' : 'Clicca per caricare immagini'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PNG, JPG, GIF fino a 5MB
          </p>
        </label>
      </div>

      {/* Preview Images */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-32 object-cover rounded-lg border"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-xs text-gray-600 mt-1 truncate">{image.name}</p>
              <p className="text-xs text-gray-500">{(image.size / 1024).toFixed(1)} KB</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


