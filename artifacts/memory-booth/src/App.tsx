import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Check } from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type WizardStep = 'welcome' | 'smile' | 'photo' | 'experience' | 'location' | 'generating' | 'result';
type Experience = 'younger' | 'older';
type LocationChoice = 'classroom' | 'school-yard' | 'lab-room' | 'library' | 'graduation' | 'trip';
type PhotoMode = 'demo' | 'upload' | 'capture';

const demoPhoto =
  'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=85';
const demoGeneratedPhoto =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=85';

// ─── Screen 1 — Welcome ────────────────────────────────────────────────────

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="booth-screen" data-testid="display-welcome-art">
      <img src="/design-ref/frame1/Frame%201.svg" alt="Welcome" className="booth-bg" />
      <button
        type="button"
        className="booth-tap-zone"
        onClick={onStart}
        data-testid="button-start-memory"
        aria-label="Tap anywhere to start"
      />
    </div>
  );
}

// ─── Screen 4 — Smile (3s then go to camera) ──────────────────────────────

function SmileScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="booth-screen" data-testid="step-smile">
      <img src="/design-ref/Frame%204.svg" alt="" className="booth-bg" />
    </div>
  );
}

// ─── Screen 5 — Camera ────────────────────────────────────────────────────

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
}) {
  const capturing = countdown !== null;

  return (
    <div className="booth-screen" data-testid="step-photo">
      {/* Fixed orange-top background with curve */}
      <img src="/design-ref/Frame%205.svg" alt="" className="booth-bg" />

      {/* Camera live area — the cream area below the curve */}
      <div className={`cam-viewport ${capturing ? 'cam-capturing' : ''}`} data-testid="camera-preview">
        {cameraReady && !photoDataUrl ? (
          <video
            ref={cameraVideoRef}
            className="cam-feed"
            autoPlay
            playsInline
            muted
            aria-label="Live camera preview"
          />
        ) : photoDataUrl ? (
          <img className="cam-feed" src={photoDataUrl} alt="Captured photo" />
        ) : (
          <img className="cam-feed" src={demoPhoto} alt="Demo frame" />
        )}
        {cameraError && !cameraReady && (
          <div className="cam-error-msg" role="status">
            Allow camera access or upload a photo.
          </div>
        )}
        {capturing && (
          <span className="cam-countdown" data-testid="capture-countdown">{countdown}</span>
        )}
      </div>

      {/* Bottom UI text and icons are baked into the SVG frame */}
      <div className="cam-bottom">
        <div className="cam-controls-row">
          {/* Upload */}
          <label className="cam-ctrl-btn" htmlFor="photo-upload" aria-label="Upload photo" data-testid="label-upload-photo" />
          <input className="cam-hidden-file" id="photo-upload" type="file" accept="image/*" onChange={onUpload} data-testid="input-photo-upload" />

          {/* Shutter */}
          <button className="cam-shutter" type="button" onClick={onCapture} disabled={capturing} aria-label="Take photo" data-testid="button-capture-photo" />

          {/* Demo reset */}
          <button className="cam-ctrl-btn" type="button" onClick={onChooseDemo} aria-label="Use demo" data-testid="button-use-demo-photo" />
        </div>
        {fileName && <span className="cam-filename">{fileName}</span>}
      </div>
    </div>
  );
}

// ─── Screen 2 — Experience ────────────────────────────────────────────────

function ExperienceStep({
  value,
  onChange,
  onNext,
}: {
  value: Experience | null;
  onChange: (v: Experience) => void;
  onNext: () => void;
}) {
  return (
    <div className="booth-screen" data-testid="step-experience">
      <img src="/design-ref/Frame%202.svg" alt="" className="booth-bg" />

      {/* Two side-by-side cards in the cream zone */}
      <div className="exp-cards">
        <button
          type="button"
          className={`exp-card ${value === 'younger' ? 'is-selected' : ''}`}
          onClick={() => { onChange('younger'); onNext(); }}
          data-testid="choice-make-parent-younger"
          aria-label="Make parent younger"
        />

        <button
          type="button"
          className={`exp-card ${value === 'older' ? 'is-selected' : ''}`}
          onClick={() => { onChange('older'); onNext(); }}
          data-testid="choice-make-child-older"
          aria-label="Make child older & parent younger"
        />
      </div>
    </div>
  );
}

// ─── Screen 3 — Location ──────────────────────────────────────────────────

const locationItems: { id: LocationChoice; img: string; alt: string }[] = [
  { id: 'classroom',   img: '/design-ref/frame3/classroom.png',   alt: 'Classroom' },
  { id: 'school-yard', img: '/design-ref/frame3/scool yard.png',  alt: 'School Yard' },
  { id: 'lab-room',    img: '/design-ref/frame3/lab room.png',    alt: 'Lab Room' },
  { id: 'library',     img: '/design-ref/frame3/library.png',     alt: 'Library' },
  { id: 'graduation',  img: '/design-ref/frame3/gradiuation.png', alt: 'Graduation Ceremony' },
  { id: 'trip',        img: '/design-ref/frame3/trip.png',        alt: 'Trip' },
];

function LocationStep({
  value,
  onChange,
  onNext,
}: {
  value: LocationChoice | null;
  onChange: (v: LocationChoice) => void;
  onNext: () => void;
}) {
  return (
    <div className="booth-screen" data-testid="step-location">
      <img src="/design-ref/Frame%203.svg" alt="" className="booth-bg" />

      <div className="loc-grid">
        {locationItems.map(({ id, alt }) => (
          <button
            key={id}
            type="button"
            className={`loc-card ${value === id ? 'is-selected' : ''}`}
            onClick={() => { onChange(id); onNext(); }}
            data-testid={`choice-location-${id}`}
            aria-label={alt}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Screen 6 — Generating ───────────────────────────────────────────────

function GeneratingStep({ progress }: { progress: number }) {
  // Map progress to the 4 states of the loading bar sprite
  let state = 1;
  if (progress >= 95) state = 4;
  else if (progress >= 65) state = 3;
  else if (progress >= 35) state = 2;

  return (
    <div className="booth-screen" data-testid="step-generating">
      <img src="/design-ref/Frame%206.svg" alt="" className="booth-bg" />

      {/* Loading bar sprite exactly placed over the SVG placeholder */}
      <div className={`gen-bar-sprite state-${state}`} data-testid="status-generation-progress" />
    </div>
  );
}

// ─── Screen 7 — Result ────────────────────────────────────────────────────

function ResultStep({
  saved,
  isUploading,
  qrUrl,
  generatedImage,
  originalPhoto,
  onSave,
  onPrint,
  onStartOver,
  onCloseQR,
}: {
  saved: boolean;
  isUploading: boolean;
  qrUrl: string | null;
  generatedImage: string | null;
  originalPhoto: string | null;
  onSave: () => void;
  onPrint: () => void;
  onStartOver: () => void;
  onCloseQR: () => void;
}) {
  const aiImage = generatedImage ?? demoGeneratedPhoto;
  const origImage = originalPhoto ?? demoPhoto;

  return (
    <>
      <div className="booth-screen no-print" data-testid="step-result">
        <img src="/design-ref/Frame%207.svg" alt="" className="booth-bg" />

        {/* Photos — exact placement over SVG placeholders */}
        <div className="result-photos">
          <img src={origImage} alt="Original family photo" className="result-photo-orig" />
          <img src={aiImage} alt="AI generated memory" className="result-photo-ai" />
        </div>

        {/* ENJOY YOUR MEMORY title is baked into the SVG */}

        {/* Buttons */}
        <div className="result-actions">
          <button
            type="button"
            className="result-action-btn"
            onClick={onSave}
            disabled={isUploading}
            data-testid="button-save-memory"
            aria-label="Save Memory"
          >
            {isUploading && <span className="result-uploading">Uploading…</span>}
          </button>

          <button
            type="button"
            className="result-action-btn"
            onClick={onPrint}
            data-testid="button-print-memory"
            aria-label="Print the Memory"
          />

          <button
            type="button"
            className="result-restart-btn"
            onClick={onStartOver}
            data-testid="button-make-another"
            aria-label="Make Another"
          />
        </div>
      </div>

      {/* Print area */}
      <div className="print-area">
        <div className="print-container">
          <img src={aiImage} alt="Memory" className="print-photo" />
          <img src="/frame-transparent.png" alt="Frame" className="print-frame-overlay" />
        </div>
      </div>

      {/* QR Modal */}
      {saved && qrUrl && (
        <>
          <div className="qr-backdrop no-print" onClick={onCloseQR} />
          <div className="qr-modal no-print">
            <h2>Scan to Download</h2>
            <QRCodeSVG value={qrUrl} size={200} bgColor="#ffffff" fgColor="#3D0C17" level="Q" />
            <p>Point your phone's camera at this code to download your memory.</p>
            <button className="qr-close-btn" onClick={onCloseQR}>Close</button>
          </div>
        </>
      )}
    </>
  );
}

// ─── Canvas framing helper ────────────────────────────────────────────────

const createFramedImageBase64 = (rawBase64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const frameImg = new Image();
    frameImg.crossOrigin = 'anonymous';
    frameImg.onload = () => {
      const photoImg = new Image();
      photoImg.crossOrigin = 'anonymous';
      photoImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 1080, 1350);
        const targetX = 150, targetY = 277, targetW = 780, targetH = 740;
        const imgRatio = photoImg.width / photoImg.height;
        const targetRatio = targetW / targetH;
        let drawW = photoImg.width, drawH = photoImg.height, sx = 0, sy = 0;
        if (imgRatio > targetRatio) { drawW = photoImg.height * targetRatio; sx = (photoImg.width - drawW) / 2; }
        else { drawH = photoImg.width / targetRatio; sy = (photoImg.height - drawH) / 2; }
        ctx.save();
        ctx.drawImage(photoImg, sx, sy, drawW, drawH, targetX, targetY, targetW, targetH);
        ctx.restore();
        ctx.drawImage(frameImg, 0, 0, 1080, 1350);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      photoImg.onerror = reject;
      photoImg.src = rawBase64;
    };
    frameImg.onerror = reject;
    frameImg.src = '/frame-transparent.png';
  });
};

// ─── Home (state machine) ─────────────────────────────────────────────────

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
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Camera lifecycle — only active on 'photo' step
  useEffect(() => {
    if (step !== 'photo') return;
    let cancelled = false;
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCameraError('Camera not supported.'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        setCameraStream(stream);
        setCameraError(null);
      } catch {
        setCameraError('Camera access denied.');
      }
    };
    setCameraError(null);
    void startCamera();
    return () => {
      cancelled = true;
      setCameraStream((s) => { s?.getTracks().forEach((t) => t.stop()); return null; });
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    };
  }, [step]);

  useEffect(() => {
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  // Countdown tick
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 900);
    return () => clearTimeout(t);
  }, [countdown]);

  // Capture on countdown=0
  useEffect(() => {
    if (countdown !== 0) return;
    const video = cameraVideoRef.current;
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.92));
      setFileName(null);
    }
    setCountdown(null);
    setPhotoMode('capture');
    setToast('Photo captured!');
  }, [countdown]);

  // Auto-advance after capture
  useEffect(() => {
    if (step !== 'photo' || photoMode !== 'capture' || countdown !== null) return;
    const t = setTimeout(() => void goGenerate(), 500);
    return () => clearTimeout(t);
  }, [photoMode, step, countdown]);

  // Generation progress
  useEffect(() => {
    if (step !== 'generating') return;
    const t = setInterval(() => setProgress((p) => Math.min(100, p + 8)), 250);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (step !== 'generating' || progress < 100) return;
    const t = setTimeout(() => setStep('result'), 600);
    return () => clearTimeout(t);
  }, [progress, step]);

  // Toast dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const goGenerate = async () => {
    setGeneratedImage(demoGeneratedPhoto); // will be replaced by real API call
    setStep('generating');
    setProgress(0);
  };

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
    setQrUrl(null);
    setIsUploading(false);
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      setPhotoDataUrl(typeof reader.result === 'string' ? reader.result : null);
      setPhotoMode('upload');
      setToast('Photo uploaded!');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (qrUrl) { setSaved(true); return; }
    setIsUploading(true);
    try {
      const rawImg = generatedImage ?? photoDataUrl ?? demoGeneratedPhoto;
      const framedBase64 = await createFramedImageBase64(rawImg);
      const res = await fetch('/api/memory/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: framedBase64 }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setQrUrl(data.url);
      setSaved(true);
      setToast('Memory saved! Scan to download.');
    } catch (err: any) {
      setToast(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="booth-shell">
      {step === 'welcome' && (
        <Welcome onStart={() => setStep('experience')} />
      )}

      {step === 'experience' && (
        <ExperienceStep
          value={experience}
          onChange={setExperience}
          onNext={() => setStep('location')}
        />
      )}

      {step === 'location' && (
        <LocationStep
          value={location}
          onChange={setLocation}
          onNext={() => setStep('smile')}
        />
      )}

      {step === 'smile' && (
        <SmileScreen onDone={() => setStep('photo')} />
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
          onChooseDemo={() => { setFileName(null); setPhotoDataUrl(null); setPhotoMode('demo'); setToast('Demo loaded.'); }}
          onUpload={handleUpload}
          onCapture={() => setCountdown(3)}
        />
      )}

      {step === 'generating' && (
        <GeneratingStep progress={progress} />
      )}

      {step === 'result' && (
        <ResultStep
          saved={saved}
          isUploading={isUploading}
          qrUrl={qrUrl}
          generatedImage={generatedImage}
          originalPhoto={photoDataUrl}
          onSave={handleSave}
          onPrint={() => { window.print(); setToast('Print dialog opened.'); }}
          onStartOver={startOver}
          onCloseQR={() => setSaved(false)}
        />
      )}

      {toast && (
        <div className="booth-toast" role="status" data-testid="status-toast">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

// ─── Router ────────────────────────────────────────────────────────────────

function Router() {
  return (
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
