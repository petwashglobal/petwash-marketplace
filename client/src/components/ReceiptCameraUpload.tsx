/**
 * Receipt Camera Upload Component
 * Camera-First UI/UX Mandate Implementation
 * Features: Camera capture, Auto-crop, OCR Smart-Fill
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ReceiptData {
  date?: string;
  amount?: number;
  vendorName?: string;
  taxId?: string;
  rawText: string;
  confidence: number;
}

interface ReceiptCameraUploadProps {
  onDataExtracted: (data: ReceiptData) => void;
  language?: 'he' | 'en';
}

export function ReceiptCameraUpload({ onDataExtracted, language = 'en' }: ReceiptCameraUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isHebrew = language === 'he';

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setExtractedData(null);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto-crop and optimize image
      const optimizedFile = await autoCropAndOptimize(file);

      // Send to OCR endpoint
      const formData = new FormData();
      formData.append('receipt', optimizedFile);

      const response = await apiRequest('/api/expenses/ocr-receipt', {
        method: 'POST',
        body: formData,
      });

      if (response.success && response.data) {
        setExtractedData(response.data);
        onDataExtracted(response.data);
      } else {
        throw new Error(response.error || 'Failed to extract data');
      }
    } catch (err: any) {
      console.error('OCR processing error:', err);
      setError(err.message || 'Failed to process receipt');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Auto-crop and optimize receipt image
   * Uses canvas to resize and enhance quality
   */
  const autoCropAndOptimize = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }

        // Max dimensions for optimal OCR
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1600;

        let width = img.width;
        let height = img.height;

        // Scale down if too large
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Apply image enhancements for better OCR
        ctx.drawImage(img, 0, 0, width, height);

        // Increase contrast slightly for better text recognition
        ctx.filter = 'contrast(1.1) brightness(1.05)';
        ctx.drawImage(canvas, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optimizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(optimizedFile);
            } else {
              reject(new Error('Failed to create optimized image'));
            }
          },
          'image/jpeg',
          0.92
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Camera-First Primary Button */}
        <Button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-6 shadow-lg"
          data-testid="button-camera-capture"
        >
          <Camera className="w-5 h-5 mr-2" />
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isHebrew ? 'מעבד...' : 'Processing...'}
            </>
          ) : (
            isHebrew ? '📸 צלם קבלה' : '📸 Capture Receipt'
          )}
        </Button>

        {/* Secondary Upload Button */}
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex-1 border-2 border-gray-700 dark:border-gray-300 font-semibold py-6"
          data-testid="button-upload-receipt"
        >
          <Upload className="w-5 h-5 mr-2" />
          {isHebrew ? 'העלה מהגלריה' : 'Upload from Gallery'}
        </Button>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraCapture}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4">
          <img
            src={preview}
            alt="Receipt preview"
            className="w-full h-auto max-h-64 object-contain rounded"
          />
        </div>
      )}

      {/* Extracted Data Display */}
      {extractedData && (
        <Alert className="bg-green-50 dark:bg-green-950 border-2 border-green-500">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-bold text-green-800 dark:text-green-200">
                {isHebrew ? '✅ קבלה נסרקה בהצלחה!' : '✅ Receipt scanned successfully!'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {extractedData.date && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'תאריך:' : 'Date:'}</span>
                    <span className="font-bold ml-2">{extractedData.date}</span>
                  </div>
                )}
                {extractedData.amount && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'סכום:' : 'Amount:'}</span>
                    <span className="font-bold ml-2">₪{extractedData.amount.toFixed(2)}</span>
                  </div>
                )}
                {extractedData.vendorName && (
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'ספק:' : 'Vendor:'}</span>
                    <span className="font-bold ml-2">{extractedData.vendorName}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {isHebrew ? 'הנתונים מולאו אוטומטית בטופס' : 'Data auto-filled in form'}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert className="bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-500">
          <XCircle className="w-5 h-5 text-yellow-600" />
          <AlertDescription>
            <p className="font-bold text-yellow-800 dark:text-yellow-200">
              {isHebrew ? '⚠️ שגיאה בסריקה' : '⚠️ Scanning Error'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{error}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              {isHebrew 
                ? 'אנא ודא שהקבלה ברורה ומוארת היטב, ונסה שוב.'
                : 'Please ensure the receipt is clear and well-lit, then try again.'}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Info */}
      {!preview && !error && (
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isHebrew 
              ? '💡 צלם את הקבלה כדי למלא אוטומטית את הטופס'
              : '💡 Capture your receipt to auto-fill the form'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {isHebrew
              ? 'התמונה תנותח באמצעות AI ותאריך, סכום וספק ימולאו אוטומטית'
              : 'Image will be analyzed by AI and date, amount, vendor will be auto-filled'}
          </p>
        </div>
      )}
    </div>
  );
}
