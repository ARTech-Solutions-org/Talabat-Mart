import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  Fingerprint,
  Heart,
  ImagePlus,
  Library,
  LockKeyhole,
  MapPin,
  Printer,
  QrCode,
  RotateCcw,
  ScanFace,
  School,
  ShieldCheck,
  Sparkles,
  Star,
  TreePine,
  Upload,
  WandSparkles,
  House,
  X,
  Zap,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type WizardStep = 'welcome' | 'experience' | 'location' | 'photo' | 'generating' | 'result';
type Experience = 'younger' | 'older';
type LocationChoice = 'classroom' | 'school-yard' | 'reading-room' | 'sunny-garden';
type PhotoMode = 'demo' | 'upload' | 'capture';

const demoPhoto =
  'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=85';

const locationImages: Record<LocationChoice, string> = {
  classroom:
    'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=900&q=85',
  'school-yard':
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=85',
  'reading-room':
    'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=85',
  'sunny-garden':
    'https://images.unsplash.com/photo-1473445361085-b9a07f55608b?auto=format&fit=crop&w=900&q=85',
};

const steps: Array<{ id: WizardStep; label: string }> = [
  { id: 'welcome', label: 'Screensaver' },
  { id: 'experience', label: 'Choose experience' },
  { id: 'location', label: 'Choose location' },
  { id: 'photo', label: 'Camera screen' },
  { id: 'generating', label: 'Generating' },
  { id: 'result', label: 'Result' },
];

const locationDetails: Record<LocationChoice, { title: string; note: string; number: string }> = {
  classroom: { title: 'Classroom', note: 'Chalk dust & first days', number: '01' },
  'school-yard': { title: 'School yard', note: 'Sun on the pavement', number: '02' },
  'reading-room': { title: 'Locker room', note: 'After-school stories', number: '03' },
  'sunny-garden': { title: 'Library', note: 'Stories between shelves', number: '04' },
};

function MemoryIllustration({ generated = false }: { generated?: boolean }) {
  return (
    <div className={`memory-card ${generated ? 'generated-memory' : ''}`} data-testid={`visual-memory-${generated ? 'generated' : 'original'}`}>
      <div className="memory-topline">
        <span>{generated ? 'AI generated photo' : 'original photo'}</span>
        <span className="mini-talabat">talabat</span>
      </div>
      <img src={demoPhoto} alt={generated ? 'AI generated family memory' : 'Original family photo'} />
      <div className="memory-caption">
        <div>
          <strong>{generated ? 'Same moment, new chapter.' : 'Your original moment'}</strong>
          <span>{generated ? 'Age transformed • background refreshed' : 'Pose and framing preserved'}</span>
        </div>
        <Heart size={17} strokeWidth={1.6} />
      </div>
    </div>
  );
}

function JourneyBar({ current }: { current: WizardStep }) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return (
    <div className="journey-bar" aria-label="Memory making progress">
      <div className="journey-track">
        {steps.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div
              className={`journey-stop ${complete ? 'is-complete' : ''} ${active ? 'is-active' : ''}`}
              key={step.id}
              data-testid={`progress-step-${step.id}`}
            >
              <span className="journey-dot">{complete ? <Check size={12} /> : index + 1}</span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="booth-header">
      <div className="brand-lockup" data-testid="brand-memory-booth">
        <span className="talabat-logo">talabat</span>
        <span className="brand-name">AI PHOTOBOOTH EXPERIENCE FLOW</span>
      </div>
      <div className="header-note">
        <span>6 steps</span>
      </div>
    </header>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <main className="booth-main">
      <div className="screensaver-wrap">
        <section className="screensaver-card" data-testid="display-welcome-art">
          <div className="screensaver-decor screensaver-decor-top" aria-hidden="true">
            <Star className="decor-star decor-star-one" />
            <Sparkles className="decor-spark decor-spark-one" />
            <Heart className="decor-heart decor-heart-one" />
            <Camera className="decor-camera" />
            <Sparkles className="decor-spark decor-spark-two" />
            <Star className="decor-star decor-star-two" />
            <Sparkles className="decor-spark decor-spark-three" />
          </div>
          <div className="screensaver-brand">
            <span className="talabat-logo">talabat</span>
          </div>
          <h1 className="screensaver-title">
            <span>Hop on.</span>
            <span>Play.</span>
            <span>Win.</span>
            <span>Get</span>
            <em>school</em>
            <em>ready!</em>
          </h1>
          <div className="screensaver-underline" aria-hidden="true" />
          <div className="screensaver-decor screensaver-decor-bottom" aria-hidden="true">
            <Star className="decor-star decor-star-three" />
            <Heart className="decor-heart decor-heart-two" />
            <Star className="decor-star decor-star-four" />
          </div>
          <button className="screensaver-start" type="button" onClick={onStart} data-testid="button-start-memory">
            Tap to start <ChevronRight size={19} />
          </button>
          <span className="screensaver-rays" aria-hidden="true" />
        </section>
      </div>
    </main>
  );
}

function ExperienceStep({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: Experience | null;
  onChange: (value: Experience) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <main className="booth-main">
      <section className="portrait-step-card experience-screen" data-testid="step-experience">
        <div className="portrait-step-heading">
          <Sparkles className="heading-spark heading-spark-left" aria-hidden="true" />
          <h1>Choose your<br />experience</h1>
          <Sparkles className="heading-spark heading-spark-right" aria-hidden="true" />
        </div>
        <div className="experience-card-stack">
          <button
            type="button"
            className={`choice-card choice-card-coral ${value === 'younger' ? 'is-selected' : ''}`}
            onClick={() => { onChange('younger'); onNext(); }}
            data-testid="choice-make-parent-younger"
          >
            <img className="choice-image" src={demoPhoto} alt="" />
            <span className="choice-icon"><ScanFace size={21} /></span>
            <div>
              <h2>Make the<br />parent<br />younger</h2>
            </div>
            <span className="choice-check">{value === 'younger' ? <Check size={13} /> : '01'}</span>
          </button>
          <button
            type="button"
            className={`choice-card ${value === 'older' ? 'is-selected' : ''}`}
            onClick={() => { onChange('older'); onNext(); }}
            data-testid="choice-make-child-older"
          >
            <img className="choice-image" src="https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=900&q=85" alt="" />
            <span className="choice-icon"><Sparkles size={21} /></span>
            <div>
              <h2>Make the<br />child<br />older</h2>
            </div>
            <span className="choice-check">{value === 'older' ? <Check size={13} /> : '02'}</span>
          </button>
        </div>
      </section>
    </main>
  );
}

function LocationStep({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: LocationChoice | null;
  onChange: (value: LocationChoice) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <main className="booth-main">
      <section className="portrait-step-card location-screen" data-testid="step-location">
        <div className="portrait-step-heading location-heading">
          <Sparkles className="heading-spark heading-spark-left" aria-hidden="true" />
          <h1>Choose your<br />location</h1>
          <Sparkles className="heading-spark heading-spark-right" aria-hidden="true" />
        </div>
        <div className="location-kiosk-grid">
          {(Object.keys(locationDetails) as LocationChoice[]).map((location) => {
            const detail = locationDetails[location];
            const Icon = location === 'classroom' ? School : location === 'school-yard' ? MapPin : location === 'reading-room' ? Library : TreePine;
            return (
              <button
                type="button"
                key={location}
                className={`location-card ${value === location ? 'is-selected' : ''}`}
                onClick={() => { onChange(location); onNext(); }}
                data-testid={`choice-location-${location}`}
              >
                <div className="location-content">
                  <img className="location-image" src={locationImages[location]} alt="" />
                  <span className="location-number"><b>{detail.number}</b> {detail.title}</span>
                  <Icon className="location-tile-icon" size={12} aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
        <div className="location-instruction">
          <MapPin size={21} />
          <span>Tap on a location<br />to choose your backdrop</span>
        </div>
      </section>
    </main>
  );
}

function PhotoStep({
  mode,
  fileName,
  photoDataUrl,
  countdown,
  cameraVideoRef,
  cameraReady,
  cameraError,
  onChooseDemo,
  onUpload,
  onCapture,
  onNext,
  onBack,
}: {
  mode: PhotoMode;
  fileName: string | null;
  photoDataUrl: string | null;
  countdown: number | null;
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  cameraReady: boolean;
  cameraError: string | null;
  onChooseDemo: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onCapture: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const capturing = countdown !== null;
  return (
    <main className="booth-main">
      <section className="portrait-step-card camera-screen" data-testid="step-photo">
        <div className="camera-topbar">
          <button type="button" onClick={onBack} aria-label="Back to locations" data-testid="button-back-location">
            <X size={22} />
          </button>
          <span className="camera-talabat">talabat</span>
          <Zap size={21} fill="currentColor" aria-label="Flash" />
        </div>
        <div className={`camera-preview-kiosk ${capturing ? 'capture-state' : ''}`} data-testid="camera-preview">
          {cameraReady && !photoDataUrl ? (
            <video
              ref={cameraVideoRef}
              className="camera-kiosk-video"
              autoPlay
              playsInline
              muted
              aria-label="Live camera preview"
            />
          ) : photoDataUrl ? (
            <img className="camera-kiosk-photo" src={photoDataUrl} alt="Uploaded family frame" />
          ) : (
            <img className="camera-kiosk-photo" src={demoPhoto} alt="Demo family frame" />
          )}
          {cameraError && !cameraReady && (
            <div className="camera-permission-note" role="status">
              Camera access is unavailable. Allow camera access or upload a photo.
            </div>
          )}
          {capturing && <span className="capture-count" data-testid="capture-countdown">{countdown}</span>}
          <div className="camera-message">
            {capturing ? 'Hold still...' : 'Stand in the center'}<br />{capturing ? 'We are capturing your moment' : 'for the best result'}
          </div>
        </div>
        <div className="camera-bottom-bar">
          <label className="camera-control camera-control-side" htmlFor="photo-upload" aria-label="Upload a photo" data-testid="label-upload-photo">
            <ImagePlus size={22} />
          </label>
          <input className="file-input" id="photo-upload" type="file" accept="image/*" onChange={onUpload} data-testid="input-photo-upload" />
          <button className="camera-shutter" type="button" onClick={onCapture} disabled={capturing} aria-label="Capture this moment" data-testid="button-capture-photo">
            <span />
          </button>
          <button className="camera-control camera-control-side" type="button" onClick={onChooseDemo} aria-label="Use demo frame" data-testid="button-use-demo-photo">
            <Camera size={22} />
          </button>
          {fileName && <span className="camera-file-name">{fileName}</span>}
        </div>
      </section>
    </main>
  );
}

function GeneratingStep({ progress }: { progress: number }) {
  const currentMessage = progress < 35 ? 'Reading the original frame' : progress < 70 ? 'Changing the chapter, not the pose' : 'Adding a new place to the story';
  return (
    <main className="booth-main">
      <section className="step-panel generating-wrap" data-testid="step-generating">
        <div className="generating-art" aria-hidden="true">
          <img src={demoPhoto} alt="" />
          <div className="booth-orb"><Camera size={35} strokeWidth={1.5} /></div>
        </div>
        <div className="generation-copy">
          <span className="eyebrow">05 / generating</span>
          <h1>Creating your memory...</h1>
          <p data-testid="status-generation-message">{currentMessage}. The original composition stays locked while the age and background transform around it.</p>
          <div className="progress-shell">
            <div className="progress-meta"><span>Creating your memory</span><span data-testid="status-generation-progress">{progress}%</span></div>
            <div className="progress-rail"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="generation-list">
            <div className={`generation-item ${progress >= 20 ? 'is-done' : 'is-current'}`}>{progress >= 20 ? <Check size={15} /> : <Fingerprint size={15} />} Preserve the pose and framing</div>
            <div className={`generation-item ${progress >= 55 ? 'is-done' : progress >= 20 ? 'is-current' : ''}`}>{progress >= 55 ? <Check size={15} /> : <Sparkles size={15} />} Transform the age story</div>
            <div className={`generation-item ${progress >= 90 ? 'is-done' : progress >= 55 ? 'is-current' : ''}`}>{progress >= 90 ? <Check size={15} /> : <MapPin size={15} />} Set the new backdrop</div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ResultStep({
  saved,
  isUploading,
  qrUrl,
  generatedImage,
  onSave,
  onPrint,
  onStartOver,
  onCloseQR,
}: {
  saved: boolean;
  isUploading: boolean;
  qrUrl: string | null;
  generatedImage: string | null;
  onSave: () => void;
  onPrint: () => void;
  onStartOver: () => void;
  onCloseQR: () => void;
}) {
  const resultImage = generatedImage ?? demoPhoto;

  return (
    <>
      <main className="booth-main no-print">
        <section className="portrait-step-card result-screen" data-testid="step-result">
          <div className="result-topbar">
            <button type="button" onClick={onStartOver} aria-label="Start another memory" data-testid="button-make-another">
              <ChevronLeft size={23} />
            </button>
            <span className="camera-talabat">talabat</span>
            <House size={21} aria-hidden="true" />
          </div>
          <div className="result-kiosk-content">
            <div className="result-kiosk-heading">
              <Sparkles aria-hidden="true" />
              <h1>Here&apos;s your<br />memory!</h1>
              <Sparkles aria-hidden="true" />
              <Heart aria-hidden="true" />
            </div>
            <div className="result-photo-block">
              <span>Original photo</span>
              <img src={demoPhoto} alt="Original family photo" />
            </div>
            <div className="result-photo-block">
              <span>AI generated photo</span>
              <img src={resultImage} alt="AI generated family memory" />
            </div>
            <div className="result-kiosk-actions">
              <button className="result-save-button" type="button" onClick={onSave} disabled={isUploading} data-testid="button-save-memory">
                {isUploading ? 'Uploading...' : saved ? 'Show QR Code' : 'Save memory'}
                <QrCode size={25} />
              </button>
              <button className="result-print-button" type="button" onClick={onPrint} data-testid="button-print-memory">
                Print the memory
                <Printer size={27} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <div className="print-area">
        <div className="print-container">
          <img 
            src={generatedImage ?? photoDataUrl ?? demoPhoto} 
            alt="Memory" 
            className="print-photo"
          />
          <img 
            src="/frame-transparent.png" 
            alt="Frame" 
            className="print-frame-overlay" 
          />
        </div>
      </div>

      {saved && qrUrl && (
        <>
          <div className="qr-modal-backdrop no-print" onClick={onCloseQR} />
          <div className="qr-modal no-print">
            <h2>Scan to Download</h2>
            <QRCodeSVG value={qrUrl} size={180} bgColor={"#ffffff"} fgColor={"#7d1f35"} level={"Q"} />
            <p>Point your phone's camera at this QR code to download your memory.</p>
            <button className="booth-button booth-button-ghost" onClick={onCloseQR}>Close</button>
          </div>
        </>
      )}
    </>
  );
}

const createFramedImageBase64 = (rawBase64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const frameImg = new Image();
    frameImg.crossOrigin = "anonymous";
    frameImg.onload = () => {
      const photoImg = new Image();
      photoImg.crossOrigin = "anonymous";
      photoImg.onload = () => {
        const canvas = document.createElement("canvas");
        // Canvas size matches the frame provided by the user (1080x1350)
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No canvas context"));

        // Fill background with white to avoid transparent PNG background issues
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 1080, 1350);

        // Target bounds for the photo inside the frame
        // Expanded slightly to ensure it bleeds under the skewed cutout without white gaps
        const targetX = 150;
        const targetY = 260;
        const targetW = 770;
        const targetH = 760;

        const imgRatio = photoImg.width / photoImg.height;
        const targetRatio = targetW / targetH;
        let drawW = photoImg.width;
        let drawH = photoImg.height;
        let sx = 0;
        let sy = 0;
        
        if (imgRatio > targetRatio) {
          drawW = photoImg.height * targetRatio;
          sx = (photoImg.width - drawW) / 2;
        } else {
          drawH = photoImg.width / targetRatio;
          sy = (photoImg.height - drawH) / 2;
        }
        
        ctx.save();
        ctx.drawImage(photoImg, sx, sy, drawW, drawH, targetX, targetY, targetW, targetH);
        ctx.restore();

        // Draw the transparent frame overlay
        ctx.drawImage(frameImg, 0, 0, 1080, 1350);

        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      photoImg.onerror = reject;
      photoImg.src = rawBase64;
    };
    frameImg.onerror = reject;
    frameImg.src = "/frame-transparent.png";
  });
};

function Home() {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [experience, setExperience] = useState<Experience | null>(null);
  const [location, setLocation] = useState<LocationChoice | null>(null);
  const [photoMode, setPhotoMode] = useState<PhotoMode>('demo');
  const [fileName, setFileName] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'photo') return;
    let cancelled = false;

    const requestCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user' },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        setCameraStream(stream);
        setCameraError(null);
      } catch {
        setCameraError('Camera access was not granted.');
      }
    };

    setCameraError(null);
    void requestCamera();

    return () => {
      cancelled = true;
      setCameraStream((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return null;
      });
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    };
  }, [step]);

  useEffect(() => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((current) => (current === null ? null : current - 1));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) {
      const video = cameraVideoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.92));
        setFileName(null);
      }
      setCountdown(null);
      setPhotoMode('capture');
      setToast('Captured. That was the one.');
    }
  }, [countdown]);

  useEffect(() => {
    if (step !== 'generating') return;
    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(90, current + 10));
    }, 240);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 'generating' || progress < 100) return;
    const timer = window.setTimeout(() => setStep('result'), 550);
    return () => window.clearTimeout(timer);
  }, [progress, step]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const startOver = () => {
    setStep('welcome');
    setExperience(null);
    setLocation(null);
    setPhotoMode('demo');
    setFileName(null);
    setPhotoDataUrl(null);
    setCountdown(null);
    setProgress(0);
    setSaved(false);
    setGeneratedImage(null);
    setGenerationError(null);
    setQrUrl(null);
    setIsUploading(false);
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      setPhotoDataUrl(typeof reader.result === 'string' ? reader.result : null);
      setPhotoMode('upload');
      setToast('Your frame is ready for the booth.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMemory = async () => {
    if (qrUrl) {
      setSaved(true);
      return;
    }
    
    setIsUploading(true);
    try {
      const rawImg = generatedImage ?? photoDataUrl ?? demoPhoto;
      const framedBase64 = await createFramedImageBase64(rawImg);
      
      const response = await fetch('/api/memory/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: framedBase64 }),
      });
      const text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}: ${text.slice(0, 100)}...`);
      setQrUrl(data.url);
      setSaved(true);
      setToast('Memory saved. Scan the QR code to download it.');
    } catch (err: any) {
      setToast(err.message || 'Failed to upload memory. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const goGenerate = async () => {
    setGenerationError(null);
    setGeneratedImage(photoDataUrl ?? demoPhoto);
    setStep('result');
  };

  useEffect(() => {
    if (step !== 'photo' || countdown !== null || photoMode !== 'capture') return;
    const timer = window.setTimeout(() => { void goGenerate(); }, 420);
    return () => window.clearTimeout(timer);
  }, [countdown, photoMode, step]);

  const beginCapture = () => {
    setCountdown(3);
    setToast('Camera ready. Three little seconds.');
  };

  const retryGeneration = () => {
    setGenerationError(null);
    void goGenerate();
  };

  return (
    <div className="booth-shell">
      <div className="booth-grain" />
      {step === 'welcome' && <Welcome onStart={() => setStep('experience')} />}
      {step === 'experience' && (
        <ExperienceStep value={experience} onChange={setExperience} onNext={() => setStep('location')} onBack={() => setStep('welcome')} />
      )}
      {step === 'location' && (
        <LocationStep value={location} onChange={setLocation} onNext={() => setStep('photo')} onBack={() => setStep('experience')} />
      )}
      {step === 'photo' && (
        <PhotoStep
          mode={photoMode}
          fileName={fileName}
          photoDataUrl={photoDataUrl}
          countdown={countdown}
          cameraVideoRef={cameraVideoRef}
          cameraReady={Boolean(cameraStream)}
          cameraError={cameraError}
          onChooseDemo={() => { setFileName(null); setPhotoDataUrl(null); setPhotoMode('demo'); setToast('Demo frame loaded.'); }}
          onUpload={handleUpload}
          onCapture={beginCapture}
          onNext={goGenerate}
          onBack={() => setStep('location')}
        />
      )}
      {step === 'generating' && generationError ? (
        <main className="booth-main">
          <section className="step-panel generating-wrap generation-error-panel" data-testid="step-generation-error">
            <div className="generating-art" aria-hidden="true">
              <div className="booth-orb"><WandSparkles size={35} strokeWidth={1.5} /></div>
            </div>
            <div className="generation-copy">
              <span className="eyebrow">04 / a small pause</span>
              <h1>That memory needs another try.</h1>
              <p data-testid="status-generation-error">{generationError}</p>
              <div className="action-footer">
                <button className="booth-button booth-button-ghost" type="button" onClick={() => setStep('photo')} data-testid="button-back-to-photo">
                  <ChevronLeft size={16} /> Back to photo
                </button>
                <button className="booth-button booth-button-primary" type="button" onClick={retryGeneration} data-testid="button-retry-generation">
                  Try again <WandSparkles size={16} />
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : step === 'generating' ? <GeneratingStep progress={progress} /> : null}
      {step === 'result' && (
        <ResultStep
          saved={saved}
          isUploading={isUploading}
          qrUrl={qrUrl}
          generatedImage={generatedImage}
          onSave={handleSaveMemory}
          onPrint={() => { window.print(); setToast('Print view opened.'); }}
          onStartOver={startOver}
          onCloseQR={() => setSaved(false)}
        />
      )}
      {toast && <div className="toast-message" role="status" data-testid="status-toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
