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

// Left Slot (Original Photo): x=254, y=275, w=910, h=823
const ORIG_SLOT_W = 910 / 2471;                  // ≈ 0.3683
const ORIG_SLOT_H = 823 / 2471;                  // ≈ 0.3331
const ORIG_SLOT_X = (254 + 910/2 - 2471/2) / 2471; // -0.2131
const ORIG_SLOT_Y = (1658/2 - (275 + 823/2)) / 2471; // +0.0577

// Right Slot (AI Memory Photo): x=1307, y=275, w=910, h=823
const AI_SLOT_W   = 910 / 2471;                  // ≈ 0.3683
const AI_SLOT_H   = 823 / 2471;                  // ≈ 0.3331
const AI_SLOT_X   = (1307 + 910/2 - 2471/2) / 2471; // +0.2131
const AI_SLOT_Y   = (1658/2 - (275 + 823/2)) / 2471; // +0.0577

// Talabat Mart Logo: x=879, y=83, w=713, h=153
const LOGO_W      = 713 / 2471;                  // ≈ 0.2885
const LOGO_H      = 153 / 2471;                  // ≈ 0.0619
const LOGO_X      = (879 + 713/2 - 2471/2) / 2471; // ≈ 0.0
const LOGO_Y      = (1658/2 - (83 + 153/2)) / 2471; // ≈ +0.2709

// Enjoy Your Memory Banner: x=781, y=1315, w=919, h=236
const BANNER_W    = 919 / 2471;                  // ≈ 0.3719
const BANNER_H    = 236 / 2471;                  // ≈ 0.0955
const BANNER_X    = (781 + 919/2 - 2471/2) / 2471; // ≈ 0.0
const BANNER_Y    = (1658/2 - (1315 + 236/2)) / 2471; // ≈ -0.2444

export const ArExperience: React.FC = () => {
  const params  = new URLSearchParams(window.location.search);
  const imgUrl  = params.get('img')   ? decodeURIComponent(params.get('img')!)  : null;
  const origUrl = params.get('orig')  ? decodeURIComponent(params.get('orig')!) : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase]           = useState<'loading' | 'scanning' | 'tracking' | 'error'>('loading');
  const [errorMsg, setErrorMsg]     = useState('');
  const [isDownloading, setIsDL]    = useState(false);
  const mindarRef  = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const loadHTMLImage = (url: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const tryLoad = (crossOrigin: boolean) => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          if (crossOrigin) tryLoad(false);
          else resolve(null);
        };
        img.src = url;
      };
      tryLoad(true);
    });

  const createTextureFromCanvas = (canvas: HTMLCanvasElement, THREE: any) => {
    const t = new THREE.CanvasTexture(canvas);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  };

  const drawCoverToCanvas = (
    img: HTMLImageElement,
    sx: number, sy: number, sw: number, sh: number,
    targetW: number, targetH: number
  ) => {
    const c = document.createElement('canvas');
    c.width = targetW;
    c.height = targetH;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
    return c;
  };

  const makeFallback = (text: string, THREE: any) => {
    const c = document.createElement('canvas');
    c.width = 910; c.height = 823;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2b060d'; ctx.fillRect(0, 0, 910, 823);
    ctx.fillStyle = '#FFA940'; ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(text, 455, 411);
    return createTextureFromCanvas(c, THREE);
  };

  const loadPhotoTextures = async (THREE: any) => {
    let aiTex   = null;
    let origTex = null;

    const mainImg = imgUrl ? await loadHTMLImage(imgUrl) : null;
    if (mainImg) {
      const aspect = mainImg.naturalWidth / mainImg.naturalHeight;
      if (aspect > 1.35) {
        const w = mainImg.naturalWidth;
        const h = mainImg.naturalHeight;
        const origC = drawCoverToCanvas(
          mainImg,
          (254 / 2471) * w, (275 / 1658) * h,
          (910 / 2471) * w, (823 / 1658) * h,
          910, 823
        );
        origTex = createTextureFromCanvas(origC, THREE);

        const aiC = drawCoverToCanvas(
          mainImg,
          (1307 / 2471) * w, (275 / 1658) * h,
          (910 / 2471) * w, (823 / 1658) * h,
          910, 823
        );
        aiTex = createTextureFromCanvas(aiC, THREE);
      } else {
        const aiC = drawCoverToCanvas(mainImg, 0, 0, mainImg.naturalWidth, mainImg.naturalHeight, 910, 823);
        aiTex = createTextureFromCanvas(aiC, THREE);
      }
    }

    if (!origTex) {
      const origSource = origUrl || '/sample-original.png';
      const origImg = await loadHTMLImage(origSource);
      if (origImg) {
        const c = drawCoverToCanvas(origImg, 0, 0, origImg.naturalWidth, origImg.naturalHeight, 910, 823);
        origTex = createTextureFromCanvas(c, THREE);
      } else {
        origTex = makeFallback('Original Photo', THREE);
      }
    }

    if (!aiTex) {
      const sampleAiImg = await loadHTMLImage('/sample-ai.png');
      if (sampleAiImg) {
        const c = drawCoverToCanvas(sampleAiImg, 0, 0, sampleAiImg.naturalWidth, sampleAiImg.naturalHeight, 910, 823);
        aiTex = createTextureFromCanvas(c, THREE);
      } else {
        aiTex = makeFallback('AI Memory Photo', THREE);
      }
    }

    return { aiTex, origTex };
  };

  const loadLogoTexture = async (THREE: any) => {
    const img = await loadHTMLImage('/talabat-logo.png');
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 713;
    c.height = img.naturalHeight || 153;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return createTextureFromCanvas(c, THREE);
  };

  const loadBannerTexture = async (THREE: any) => {
    const img = await loadHTMLImage('/enjoy-memory.png');
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 919;
    c.height = img.naturalHeight || 236;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return createTextureFromCanvas(c, THREE);
  };

  const createShadowTexture = (THREE: any) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 128, 40, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.18)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  };

  const createPhotoSlab = (THREE: any, tex: any, w: number, h: number, thickness: number) => {
    const photoGeo = new THREE.BoxGeometry(w, h, thickness);
    const photoMat = new THREE.MeshBasicMaterial({ map: tex });
    const edgeMat  = new THREE.MeshBasicMaterial({ color: 0xfcfcfc });
    const backMat  = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });

    const materials = [
      edgeMat,  // right (+X)
      edgeMat,  // left (-X)
      edgeMat,  // top (+Y)
      edgeMat,  // bottom (-Y)
      photoMat, // front (+Z)
      backMat,  // back (-Z)
    ];
    return new THREE.Mesh(photoGeo, materials);
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

      // ── Clean 3D Multi-Element Pop-Out Setup ──
      const [photos, logoTex, bannerTex] = await Promise.all([
        loadPhotoTextures(THREE),
        loadLogoTexture(THREE),
        loadBannerTexture(THREE),
      ]);

      const sharedShadowTex = createShadowTexture(THREE);

      // 1. Right Slot (AI Memory Photo - Hero Pop-Out at Z=0.052)
      const aiShadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(AI_SLOT_W * 1.18, AI_SLOT_H * 1.18),
        new THREE.MeshBasicMaterial({ map: sharedShadowTex, transparent: true, depthWrite: false, opacity: 0.90 })
      );
      aiShadowMesh.position.set(AI_SLOT_X + 0.005, AI_SLOT_Y - 0.007, 0.008);
      anchor.group.add(aiShadowMesh);

      const aiPhotoMesh = createPhotoSlab(THREE, photos.aiTex, AI_SLOT_W, AI_SLOT_H, 0.012);
      aiPhotoMesh.position.set(AI_SLOT_X, AI_SLOT_Y, 0.052);
      anchor.group.add(aiPhotoMesh);

      // 2. Left Slot (Original Photo - Elevated Pop-Out at Z=0.038)
      const origShadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(ORIG_SLOT_W * 1.18, ORIG_SLOT_H * 1.18),
        new THREE.MeshBasicMaterial({ map: sharedShadowTex, transparent: true, depthWrite: false, opacity: 0.85 })
      );
      origShadowMesh.position.set(ORIG_SLOT_X + 0.004, ORIG_SLOT_Y - 0.006, 0.008);
      anchor.group.add(origShadowMesh);

      const origPhotoMesh = createPhotoSlab(THREE, photos.origTex, ORIG_SLOT_W, ORIG_SLOT_H, 0.012);
      origPhotoMesh.position.set(ORIG_SLOT_X, ORIG_SLOT_Y, 0.038);
      anchor.group.add(origPhotoMesh);

      // 3. Talabat Mart Logo (Top Center Elevated Badge at Z=0.032)
      let logoMesh: any = null;
      let logoShadowMesh: any = null;
      if (logoTex) {
        logoShadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(LOGO_W * 1.12, LOGO_H * 1.35),
          new THREE.MeshBasicMaterial({ map: sharedShadowTex, transparent: true, depthWrite: false, opacity: 0.85 })
        );
        logoShadowMesh.position.set(LOGO_X + 0.003, LOGO_Y - 0.005, 0.007);
        anchor.group.add(logoShadowMesh);

        logoMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(LOGO_W, LOGO_H),
          new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: true, alphaTest: 0.05 })
        );
        logoMesh.position.set(LOGO_X, LOGO_Y, 0.032);
        anchor.group.add(logoMesh);
      }

      // 4. "ENJOY YOUR MEMORY!" Banner (Bottom Center Elevated Badge at Z=0.024)
      let bannerMesh: any = null;
      let bannerShadowMesh: any = null;
      if (bannerTex) {
        bannerShadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(BANNER_W * 1.10, BANNER_H * 1.25),
          new THREE.MeshBasicMaterial({ map: sharedShadowTex, transparent: true, depthWrite: false, opacity: 0.80 })
        );
        bannerShadowMesh.position.set(BANNER_X + 0.003, BANNER_Y - 0.005, 0.007);
        anchor.group.add(bannerShadowMesh);

        bannerMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(BANNER_W, BANNER_H),
          new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true, depthWrite: true, alphaTest: 0.05 })
        );
        bannerMesh.position.set(BANNER_X, BANNER_Y, 0.024);
        anchor.group.add(bannerMesh);
      }

      // Animation loop (Harmonic Parallax & Differential Floating)
      let elapsed = 0;
      renderer.setAnimationLoop((delta: number) => {
        elapsed += (delta || 16) / 1000;

        if (aiPhotoMesh) {
          const floatZ = Math.sin(elapsed * 1.5) * 0.0035;
          aiPhotoMesh.position.z = 0.052 + floatZ;
          if (aiShadowMesh) aiShadowMesh.material.opacity = 0.90 - floatZ * 15.0;
        }

        if (origPhotoMesh) {
          const floatZ = Math.sin(elapsed * 1.5 + 0.8) * 0.0030;
          origPhotoMesh.position.z = 0.038 + floatZ;
          if (origShadowMesh) origShadowMesh.material.opacity = 0.85 - floatZ * 15.0;
        }

        if (logoMesh) {
          const floatZ = Math.sin(elapsed * 1.8 + 1.5) * 0.0018;
          logoMesh.position.z = 0.032 + floatZ;
          if (logoShadowMesh) logoShadowMesh.material.opacity = 0.85 - floatZ * 20.0;
        }

        if (bannerMesh) {
          const floatZ = Math.sin(elapsed * 1.3 + 2.5) * 0.0015;
          bannerMesh.position.z = 0.024 + floatZ;
          if (bannerShadowMesh) bannerShadowMesh.material.opacity = 0.80 - floatZ * 20.0;
        }

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
