import { useRef, useState } from 'react';
import { Camera, Upload, X, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

interface MobileFileCaptureProps {
  label: string;
  labelHe?: string;
  accept?: string;
  capture?: 'user' | 'environment';
  maxSizeMB?: number;
  storagePath: string;
  onUploaded: (url: string, fileName: string) => void;
  onClear?: () => void;
  hint?: string;
  required?: boolean;
  showCameraButton?: boolean;
  uploadedUrl?: string;
}

export function MobileFileCapture({
  label,
  labelHe,
  accept = 'image/*,application/pdf',
  capture,
  maxSizeMB = 15,
  storagePath,
  onUploaded,
  onClear,
  hint,
  required,
  showCameraButton = true,
  uploadedUrl,
}: MobileFileCaptureProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(!!uploadedUrl);
  const [fileName, setFileName] = useState('');

  const upload = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File too large. Max ${maxSizeMB}MB.`);
      return;
    }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
    setFileName(file.name);
    setUploading(true);
    setProgress(0);
    try {
      const path = `${storagePath}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);
      task.on(
        'state_changed',
        (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => { console.error(err); setUploading(false); alert('Upload failed. Try again.'); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          onUploaded(url, file.name);
          setDone(true);
          setUploading(false);
        }
      );
    } catch {
      setUploading(false);
    }
  };

  const clear = () => {
    setPreview(null);
    setDone(false);
    setFileName('');
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
    onClear?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-white">{label}</span>
        {labelHe && <span className="text-sm text-[#C6A35B]">{labelHe}</span>}
        {required && <span className="text-red-400 text-sm">*</span>}
      </div>
      {hint && <p className="text-xs text-white/50">{hint}</p>}

      {done ? (
        <div className="flex items-center gap-3 bg-green-900/30 border border-green-600/40 rounded-2xl p-4">
          {preview ? (
            <img src={preview} alt="preview" className="w-16 h-16 rounded-xl object-cover" />
          ) : (
            <FileText className="w-10 h-10 text-green-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-green-300 text-sm font-medium truncate">{fileName || 'Uploaded'}</span>
            </div>
            <p className="text-white/40 text-xs mt-0.5">Upload complete</p>
          </div>
          <button onClick={clear} className="text-white/30 hover:text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : uploading ? (
        <div className="bg-black/30 border border-[#C6A35B]/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#C6A35B] animate-spin" />
            <span className="text-white/70 text-sm">Uploading {fileName}…</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[#C6A35B] to-[#E7C978] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[#C6A35B] text-xs text-right">{progress}%</p>
        </div>
      ) : (
        <div className="flex gap-3">
          {showCameraButton && (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-2 bg-black/30 border border-[#C6A35B]/30 rounded-2xl p-5 active:bg-[#C6A35B]/10 transition-all"
            >
              <Camera className="w-7 h-7 text-[#C6A35B]" />
              <span className="text-white/70 text-xs font-medium">{capture === 'user' ? 'Selfie' : 'Camera'}</span>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture={capture || 'environment'}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
              />
            </button>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-2 bg-black/30 border border-white/10 rounded-2xl p-5 active:bg-white/5 transition-all"
          >
            <Upload className="w-7 h-7 text-white/50" />
            <span className="text-white/50 text-xs font-medium">Browse</span>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
          </button>
        </div>
      )}
    </div>
  );
}
