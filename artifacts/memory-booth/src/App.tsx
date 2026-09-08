import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

// ─── Shared Utility for Absolute Layouts ──────────────────────────────────
const pos = (x: number, y: number, w: number, h: number) => ({
  position: 'absolute' as const,
  left: `${(x / 1080) * 100}%`,
  top: `${(y / 1920) * 100}%`,
  width: `${(w / 1080) * 100}%`,
  height: `${(h / 1920) * 100}%`,
  objectFit: 'contain' as const,
});

// ─── Shared Page Transition Wrapper ────────────────────────────────────────

function PageTransition({ children, stepKey }: { children: ReactNode; stepKey: string }) {
  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {children}
    </motion.div>
  );
}

// ─── Screen 1 — Welcome ────────────────────────────────────────────────────

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="booth-screen" data-testid="display-welcome-art">
      <img src="/design-ref/frame1/bg%201.svg" alt="" className="booth-bg" />
      <motion.img 
        src="/design-ref/frame1/bag%201.svg" 
        style={pos(560, 232, 520, 1094)}
        initial={{ x: '50%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.1 }}
      />
      <motion.img 
        src="/design-ref/frame1/logo%201.svg" 
        style={pos(271, 83, 538, 391)}
        initial={{ y: '-50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.2 }}
      />
      <motion.img 
        src="/design-ref/frame1/text%201.svg" 
        style={pos(240, 497, 495, 843)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.3 }}
      />
      <motion.div 
        style={pos(289, 1584, 542, 163)}
        initial={{ y: '50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.4 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStart}
        className="cursor-pointer z-10"
        data-testid="button-start-memory"
      >
        <img src="/design-ref/frame1/start%20button%201.svg" alt="Start" className="w-full h-full object-contain" />
      </motion.div>
    </div>
  );
}

function SmileScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="booth-screen" data-testid="step-smile">
      <img src="/design-ref/frame4/bg.png" alt="" className="booth-bg" />

      <motion.img 
        src="/design-ref/frame4/logo.png" 
        style={pos(291, 107, 504, 108)}
        initial={{ y: '-50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.1 }}
      />

      <motion.img 
        src="/design-ref/frame4/char.png" 
        style={pos(312, 360, 509, 788)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.2 }}
      />

      <motion.img 
        src="/design-ref/frame4/smile.png" 
        style={pos(87, 1237, 913, 167)}
        initial={{ y: '50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.3 }}
      />

      <motion.img 
        src="/design-ref/frame4/stand%20inside%20text.png" 
        style={pos(87, 1591, 907, 70)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      />
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
        <AnimatePresence>
          {capturing && (
            <motion.span
              key={countdown}
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="cam-countdown"
              data-testid="capture-countdown"
            >
              {countdown}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Camera Flash Effect */}
      <AnimatePresence>
        {countdown === 0 && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'white',
              zIndex: 50,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

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
      <img src="/design-ref/frame2/bg.png" alt="" className="booth-bg" />

      <motion.img 
        src="/design-ref/frame2/logo.png" 
        style={pos(288, 92, 504, 108)}
        initial={{ y: '-50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.1 }}
      />
      
      <motion.img 
        src="/design-ref/frame2/title.png" 
        style={pos(88, 200, 907, 288)}
        initial={{ y: '-50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.2 }}
      />

      <motion.button
        type="button"
        style={pos(47, 680, 490, 854)}
        initial={{ x: '-20%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.3 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { onChange('younger'); setTimeout(onNext, 300); }}
        data-testid="choice-make-parent-younger"
      >
        <img src="/design-ref/frame2/photo1.png" alt="Younger" className="w-full h-full object-contain" />
      </motion.button>

      <motion.button
        type="button"
        style={pos(551, 680, 490, 854)}
        initial={{ x: '20%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.4 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { onChange('older'); setTimeout(onNext, 300); }}
        data-testid="choice-make-child-older"
      >
        <img src="/design-ref/frame2/photo2.png" alt="Older" className="w-full h-full object-contain" />
      </motion.button>

      <motion.img 
        src="/design-ref/frame2/text%20photo%201.png" 
        style={pos(47, 1654, 486, 115)}
        initial={{ y: '50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.5 }}
      />

      <motion.img 
        src="/design-ref/frame2/text%20photo%202.png" 
        style={pos(548, 1621, 500, 184)}
        initial={{ y: '50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.6 }}
      />
    </div>
  );
}

// ─── Screen 3 — Location ──────────────────────────────────────────────────

const locationItems: { id: LocationChoice; img: string; alt: string; x: number; y: number; w: number; h: number }[] = [
  { id: 'classroom',   img: '/design-ref/frame3/classroom.png',   alt: 'Classroom',           x: 156, y: 613, w: 282, h: 347 },
  { id: 'school-yard', img: '/design-ref/frame3/scool%20yard.png',  alt: 'School Yard',         x: 641, y: 613, w: 282, h: 347 },
  { id: 'lab-room',    img: '/design-ref/frame3/lab%20room.png',    alt: 'Lab Room',            x: 156, y: 996, w: 282, h: 347 },
  { id: 'library',     img: '/design-ref/frame3/library.png',     alt: 'Library',             x: 641, y: 999, w: 282, h: 347 },
  { id: 'graduation',  img: '/design-ref/frame3/gradiuation.png', alt: 'Graduation Ceremony', x: 156, y: 1387, w: 282, h: 347 },
  { id: 'trip',        img: '/design-ref/frame3/trip.png',        alt: 'Trip',                x: 641, y: 1400, w: 282, h: 347 },
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
      <img src="/design-ref/frame3/bg.png" alt="" className="booth-bg" />

      <motion.img 
        src="/design-ref/frame3/logo.png" 
        style={pos(289, 111, 504, 108)}
        initial={{ y: '-50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.1 }}
      />
      
      <motion.img 
        src="/design-ref/frame3/title.png" 
        style={pos(87, 224, 908, 281)}
        initial={{ y: '-50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.2 }}
      />

      {locationItems.map(({ id, img, alt, x, y, w, h }, idx) => (
        <motion.button
          key={id}
          type="button"
          style={pos(x, y, w, h)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.3 + idx * 0.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { onChange(id); setTimeout(onNext, 300); }}
          data-testid={`choice-location-${id}`}
        >
          <img src={img} alt={alt} className="w-full h-full object-contain" />
        </motion.button>
      ))}
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
      <img src="/design-ref/frame6/bg.png" alt="" className="booth-bg" />

      <motion.img 
        src="/design-ref/frame6/logo.png" 
        style={pos(285, 108, 504, 108)}
        initial={{ y: '-50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.1 }}
      />
      
      <motion.img 
        src="/design-ref/frame6/title.png" 
        style={pos(83, 411, 907, 217)}
        initial={{ y: '-50%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.2 }}
      />

      <motion.img 
        src="/design-ref/frame6/item.png" 
        style={pos(283, 709, 505, 563)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, y: [0, -20, 0] }}
        transition={{ 
          scale: { type: 'spring', damping: 20, stiffness: 100, delay: 0.3 },
          opacity: { delay: 0.3 },
          y: { repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }
        }}
      />

      <motion.div 
        style={{ ...pos(236, 1531, 602, 77), zIndex: 2 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="gen-bar-sprite state-1" style={{ position: 'absolute', inset: 0, opacity: 1 }} />
        <div className="gen-bar-sprite state-2" style={{ position: 'absolute', inset: 0, opacity: progress >= 33 ? 1 : 0, transition: 'opacity 0.8s ease' }} />
        <div className="gen-bar-sprite state-3" style={{ position: 'absolute', inset: 0, opacity: progress >= 66 ? 1 : 0, transition: 'opacity 0.8s ease' }} />
        <div className="gen-bar-sprite state-4" style={{ position: 'absolute', inset: 0, opacity: progress >= 95 ? 1 : 0, transition: 'opacity 0.8s ease' }} />
      </motion.div>
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
        <img src="/design-ref/frame7/bg.png" alt="" className="booth-bg" />

        <motion.img 
          src="/design-ref/frame7/logo.png" 
          style={pos(184, 125, 713, 153)}
          initial={{ y: '-50%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.1 }}
        />

        {/* NO ANIMATION FOR THE PHOTOS */}
        <div style={pos(51, 373, 463, 667)} className="rounded-[81px] overflow-hidden">
          <img src={origImage} alt="Original family photo" className="w-full h-full object-cover" data-testid="image-original" />
        </div>

        <div style={pos(589, 373, 463, 667)} className="rounded-[81px] overflow-hidden">
          <img src={aiImage} alt="AI generated memory" className="w-full h-full object-cover" data-testid="image-generated" />
        </div>

        <motion.img 
          src="/design-ref/frame7/orginal%20photo%20textr.png" 
          style={pos(55, 1087, 459, 109)}
          initial={{ y: '50%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.2 }}
        />

        <motion.img 
          src="/design-ref/frame7/ai%20genrated%20text.png" 
          style={pos(592, 1087, 459, 109)}
          initial={{ y: '50%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.3 }}
        />

        <motion.img 
          src="/design-ref/frame7/enjoy%20your%20memory.png" 
          style={pos(187, 1283, 706, 181)}
          initial={{ y: '50%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.4 }}
        />

        <motion.button
          type="button"
          style={pos(337, 1548, 406, 122)}
          whileTap={{ scale: 0.95 }}
          onClick={onSave}
          disabled={isUploading}
          initial={{ y: '50%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.5 }}
          data-testid="button-save-memory"
        >
          <img src="/design-ref/frame7/save%20memory.png" alt="Save" className="w-full h-full object-contain" />
          {isUploading && <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl">Saving...</span>}
        </motion.button>

        <motion.button
          type="button"
          style={pos(285, 1701, 510, 122)}
          whileTap={{ scale: 0.95 }}
          onClick={onPrint}
          initial={{ y: '50%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.6 }}
          data-testid="button-print-memory"
        >
          <img src="/design-ref/frame7/print%20the%20memory.png" alt="Print" className="w-full h-full object-contain" />
        </motion.button>

        <motion.button
          type="button"
          className="text-[#64412B] font-bold text-3xl uppercase tracking-wider"
          style={pos(285, 1840, 510, 50)}
          whileTap={{ scale: 0.95 }}
          onClick={onStartOver}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          data-testid="button-make-another"
        >
          Start Over
        </motion.button>
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
  const [isGenerating, setIsGenerating] = useState(false);
  // Tracks that generation was explicitly started (prevents premature completion)
  const generationStartedRef = React.useRef(false);

  useEffect(() => {
    if (step !== 'generating') {
      generationStartedRef.current = false;
      return;
    }
    // Increment progress smoothly up to 92% while waiting for API
    const t = setInterval(() => setProgress((p) => {
      if (p >= 92) return 92;
      return p + (92 - p) * 0.015; // Very smooth ease towards 92%
    }), 60);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    // Only advance when generation was started AND has now finished
    if (
      step === 'generating' &&
      generationStartedRef.current === true &&
      !isGenerating
    ) {
      setProgress(100);
      const t = setTimeout(() => setStep('result'), 800);
      return () => clearTimeout(t);
    }
  }, [isGenerating, step]);

  // Toast dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const goGenerate = async () => {
    setStep('generating');
    setProgress(0);
    setIsGenerating(true);
    generationStartedRef.current = true;

    if (photoDataUrl) {
      try {
        const response = await fetch('/api/memory/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: photoDataUrl,
            mimeType: 'image/jpeg',
            experience,
            location,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.imageBase64) {
          const mime = data.mimeType || 'image/jpeg';
          setGeneratedImage(`data:${mime};base64,${data.imageBase64}`);
        } else {
          setGeneratedImage(demoGeneratedPhoto);
        }
      } catch (error: any) {
        console.error('Generation failed:', error);
        setToast(error.message || 'Failed to generate. Using demo image.');
        setGeneratedImage(demoGeneratedPhoto);
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Fallback for demo mode
      setTimeout(() => {
        setGeneratedImage(demoGeneratedPhoto);
        setIsGenerating(false);
      }, 3000);
    }
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
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <PageTransition stepKey="welcome">
            <Welcome onStart={() => setStep('experience')} />
          </PageTransition>
        )}

        {step === 'experience' && (
          <PageTransition stepKey="experience">
            <ExperienceStep
              value={experience}
              onChange={setExperience}
              onNext={() => setStep('location')}
            />
          </PageTransition>
        )}

        {step === 'location' && (
          <PageTransition stepKey="location">
            <LocationStep
              value={location}
              onChange={setLocation}
              onNext={() => setStep('smile')}
            />
          </PageTransition>
        )}

        {step === 'smile' && (
          <PageTransition stepKey="smile">
            <SmileScreen onDone={() => setStep('photo')} />
          </PageTransition>
        )}

        {step === 'photo' && (
          <PageTransition stepKey="photo">
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
          </PageTransition>
        )}

        {step === 'generating' && (
          <PageTransition stepKey="generating">
            <GeneratingStep progress={progress} />
          </PageTransition>
        )}

        {step === 'result' && (
          <PageTransition stepKey="result">
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
          </PageTransition>
        )}
      </AnimatePresence>

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
