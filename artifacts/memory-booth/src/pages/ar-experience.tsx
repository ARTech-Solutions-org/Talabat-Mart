import React, { useEffect, useRef, useState } from 'react';
import { Download, Sparkles, ChevronLeft, ScanLine, RotateCcw } from 'lucide-react';

// Extend Window to include MindAR globals
declare global {
  interface Window {
    MINDAR: any;
  }
}

// Physical card: 152 mm × 102 mm Landscape (2471 × 1658 px target)
const CARD_W = 1.0;
const CARD_H = 1658 / 2471;
const SLOT_W = 910 / 2471;                 // ≈ 0.3683
const SLOT_H = 823 / 2471;                 // ≈ 0.3331
const SLOT_X = (1307 + 910/2 - 2471/2) / 2471; // +0.2131
const SLOT_Y = (1658/2 - (275 + 823/2)) / 2471; // +0.0577

export const ArExperience: React.FC = () => {
  const params  = new URLSearchParams(window.location.search);
  const imgUrl  = params.get('img')   ? decodeURIComponent(params.get('img')!)  : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase]           = useState<'loading' | 'scanning' | 'tracking' | 'error'>('loading');
  const [errorMsg, setErrorMsg]     = useState('');
  const [isDownloading, setIsDL]    = useState(false);
  const mindarRef  = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // ── Load image via Canvas (CORS-safe) ────────────────────────────────────
  const loadTexture = (url: string, THREE: any): Promise<any> =>
    new Promise((resolve) => {
      const tryLoad = (crossOrigin: boolean) => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 910;
          c.height = img.naturalHeight || 823;
          c.getContext('2d')!.drawImage(img, 0, 0);
          const t = new THREE.CanvasTexture(c);
          if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
          if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
          t.minFilter = THREE.LinearFilter;
          t.magFilter = THREE.LinearFilter;
          resolve(t);
        };
        img.onerror = () => crossOrigin ? tryLoad(false) : resolve(makeFallback(THREE));
        img.src = url;
      };
      tryLoad(true);
    });

  const makeFallback = (THREE: any) => {
    const c = document.createElement('canvas');
    c.width = 910; c.height = 823;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2b060d'; ctx.fillRect(0, 0, 910, 823);
    ctx.fillStyle = '#FFA940'; ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('AI Memory', 455, 411);
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // ── Main AR init (runs after MindAR script is loaded) ────────────────────
  const initAR = async () => {
    if (!containerRef.current) return;
    if (!window.MINDAR?.IMAGE) {
      setErrorMsg('تعذّر تحميل مكتبة AR — تحقق من الاتصال بالإنترنت');
      setPhase('error');
      return;
    }
    try {
      const { MindARThree } = window.MINDAR.IMAGE;
      const THREE            = window.MINDAR.IMAGE.THREE;

      const mindarThree = new MindARThree({
        container:        containerRef.current,
        imageTargetSrc:   '/targets.mind',
        maxTrack:         1,
        filterMinCF:      0.001,
        filterBeta:       1000,
        missTolerance:    5,
        warmupTolerance:  3,
        uiLoading:  'no',
        uiScanning: 'no',
        uiError:    'no',
      });
      mindarRef.current = mindarThree;

      const { renderer, scene, camera } = mindarThree;
      const anchor = mindarThree.addAnchor(0);

      anchor.onTargetFound = () => setPhase('tracking');
      anchor.onTargetLost  = () => setPhase('scanning');

      // ── Clean 3D Photo Setup (No fake lights, No fake borders, 100% natural photo) ──
      const tex = imgUrl ? await loadTexture(imgUrl, THREE) : makeFallback(THREE);

      // 1. Soft realistic contact drop-shadow on the card surface
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = 256; shadowCanvas.height = 256;
      const sCtx = shadowCanvas.getContext('2d')!;
      const grad = sCtx.createRadialGradient(128, 128, 40, 128, 128, 120);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.40)');
      grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
      const shadowTex = new THREE.CanvasTexture(shadowCanvas);

      const shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(SLOT_W * 1.18, SLOT_H * 1.18),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
        })
      );
      shadowMesh.position.set(SLOT_X + 0.004, SLOT_Y - 0.006, 0.008);
      anchor.group.add(shadowMesh);

      // 2. Physical 3D Floating Photo Card (MeshBasicMaterial preserves 100% original photo pixels)
      const photoGeo = new THREE.BoxGeometry(SLOT_W, SLOT_H, 0.012);
      const photoMat = new THREE.MeshBasicMaterial({ map: tex });
      const edgeMat  = new THREE.MeshBasicMaterial({ color: 0xf8f8f8 }); // clean photo paper core

      const materials = [
        edgeMat,   // right (+X)
        edgeMat,   // left (-X)
        edgeMat,   // top (+Y)
        edgeMat,   // bottom (-Y)
        photoMat,  // front (+Z) — 100% original natural photo
        edgeMat,   // back (-Z)
      ];

      const photoPlateMesh = new THREE.Mesh(photoGeo, materials);
      photoPlateMesh.position.set(SLOT_X, SLOT_Y, 0.045);
      anchor.group.add(photoPlateMesh);

      // Animation loop (subtle floating elevation)
      let elapsed = 0;
      renderer.setAnimationLoop((delta: number) => {
        elapsed += (delta || 16) / 1000;
        photoPlateMesh.position.z = 0.045 + Math.sin(elapsed * 1.6) * 0.004;
        renderer.render(scene, camera);
      });

      await mindarThree.start();
      setPhase('scanning');

      cleanupRef.current = () => {
        try { mindarThree.stop(); renderer.setAnimationLoop(null); renderer.dispose(); } catch {}
      };
    } catch (err: any) {
      console.error('[AR]', err);
      setErrorMsg(err?.message || 'خطأ غير معروف');
      setPhase('error');
    }
  };

  // ── Inject MindAR script then init ────────────────────────────────────────
  useEffect(() => {
    if (window.MINDAR?.IMAGE) { initAR(); return; }

    const existing = document.querySelector('script[data-mindar]');
    if (existing) { existing.addEventListener('load', initAR); return; }

    const s = document.createElement('script');
    s.src = '/mindar-image-three.prod.js';
    s.setAttribute('data-mindar', '1');
    s.onload  = () => initAR();
    s.onerror = () => {
      const fb = document.createElement('script');
      fb.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.1.5/dist/mindar-image-three.prod.js';
      fb.onload = () => initAR();
      fb.onerror = () => {
        setErrorMsg('تعذّر تحميل مكتبة AR');
        setPhase('error');
      };
      document.head.appendChild(fb);
    };
    document.head.appendChild(s);

    return () => { cleanupRef.current?.(); };
  }, []);

  const handleDownload = async () => {
    if (!imgUrl) return;
    setIsDL(true);
    try {
      const a = document.createElement('a');
      a.href = imgUrl; a.download = `ai-memory-${Date.now()}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { window.open(imgUrl, '_blank'); }
    finally { setIsDL(false); }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" dir="rtl">
      {/* MindAR container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Loading */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-40 bg-[#0d0205] flex flex-col items-center justify-center gap-5">
          <div className="w-12 h-12 rounded-full border-[3px] border-[#FFA940]/20 border-t-[#FFA940] animate-spin" />
          <p className="text-white/60 text-sm">جاري تشغيل كاميرا AR...</p>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="absolute inset-0 z-40 bg-[#0d0205] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-red-400 text-base font-bold">تعذّر تشغيل الكاميرا</p>
          <p className="text-white/50 text-sm">{errorMsg}</p>
          <button onClick={() => location.reload()}
            className="mt-2 px-6 py-3 rounded-xl bg-[#FFA940] text-black font-bold text-sm">
            إعادة المحاولة
          </button>
          <a href="/" className="text-[#FFA940] text-sm">← رجوع</a>
        </div>
      )}

      {/* Scan guide */}
      {(phase === 'scanning') && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative mb-8" style={{ width: 'min(85vw, 320px)', aspectRatio: '152/102' }}>
            {['top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg',
              'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg',
              'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg',
              'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg'].map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 border-[#FFA940] ${cls}`} />
            ))}
            <div className="absolute inset-x-3 h-px bg-gradient-to-r from-transparent via-[#FFA940] to-transparent shadow-[0_0_8px_#FFA940] animate-pulse" style={{ top: '50%' }} />
          </div>
          <p className="text-white font-bold text-base drop-shadow-lg">وجّه الكاميرا على الكارت المطبوع</p>
          <p className="text-white/50 text-xs mt-2">اجعل الكارت داخل الإطار</p>
        </div>
      )}

      {/* Top bar (tracking) */}
      {phase === 'tracking' && (
        <header className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
          <a href="/" className="p-2.5 rounded-xl bg-black/40 border border-white/15 text-white/80 backdrop-blur-md flex items-center gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" /><span>رجوع</span>
          </a>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF5C00] to-[#FFA940] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">AI 3D Memory</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
                <p className="text-[10px] text-green-300">تم اكتشاف الكارت</p>
              </div>
            </div>
          </div>
          <div className="w-10" />
        </header>
      )}

      {/* Bottom download button (tracking) */}
      {phase === 'tracking' && (
        <footer className="absolute bottom-0 inset-x-0 z-30 p-5 pb-8 bg-gradient-to-t from-black/90 to-transparent flex justify-center pointer-events-auto">
          <button
            onClick={handleDownload}
            disabled={isDownloading || !imgUrl}
            className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-[#FF5C00] to-[#FFA940] text-white font-bold text-base shadow-xl shadow-[#FF5C00]/30 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            {isDownloading ? 'جاري الحفظ...' : 'حفظ الصورة بجهازك'}
          </button>
        </footer>
      )}

      {/* Status pill */}
      {(phase === 'scanning' || phase === 'tracking') && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/12 flex items-center gap-2 pointer-events-none">
          <div className={`w-2 h-2 rounded-full ${phase === 'tracking' ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-[#FFA940] animate-pulse'}`} />
          <span className="text-white text-xs font-semibold">
            {phase === 'tracking' ? 'الكارت مكتشف ✓' : 'جاري البحث عن الكارت...'}
          </span>
        </div>
      )}
    </div>
  );
};

export default ArExperience;
