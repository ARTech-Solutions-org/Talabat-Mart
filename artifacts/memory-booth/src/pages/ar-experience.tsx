import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Download,
  RotateCcw,
  Sparkles,
  Smartphone,
  ChevronLeft,
  ScanLine,
} from 'lucide-react';

export const ArExperience: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const rawImgUrl = searchParams.get('img') || searchParams.get('photo');

  // Use the saved photo URL (external or local fallback)
  const aiPhotoUrl = rawImgUrl ? decodeURIComponent(rawImgUrl) : '/sample-ai.png';

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cardVisible, setCardVisible] = useState(false);  // Hidden until user taps
  const [needsIosPermission, setNeedsIosPermission] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cardGroupRef = useRef<THREE.Group | null>(null);
  const aiPhotoMeshRef = useRef<THREE.Mesh | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animFrameId = useRef<number | null>(null);

  const targetRotation = useRef({ x: 0.08, y: 0 });
  const currentRotation = useRef({ x: 0.08, y: 0 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });

  // ── 1. Rear Camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
        }
      } catch (err: any) {
        setCameraError(err.message || 'تعذر تشغيل الكاميرا');
      }
    };
    start();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── 2. Gyroscope ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      targetRotation.current.x = THREE.MathUtils.clamp((e.beta - 45) * 0.015, -0.45, 0.45);
      targetRotation.current.y = THREE.MathUtils.clamp(e.gamma * 0.02, -0.55, 0.55);
    };

    const ios = typeof (window as any).DeviceOrientationEvent?.requestPermission === 'function';
    if (ios) {
      setNeedsIosPermission(true);
    } else {
      window.addEventListener('deviceorientation', onOrientation);
      return () => window.removeEventListener('deviceorientation', onOrientation);
    }
    return undefined;
  }, []);

  const requestIosGyro = async () => {
    try {
      const res = await (window as any).DeviceOrientationEvent.requestPermission();
      if (res === 'granted') {
        window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
          if (e.gamma == null || e.beta == null) return;
          targetRotation.current.x = THREE.MathUtils.clamp((e.beta - 45) * 0.015, -0.45, 0.45);
          targetRotation.current.y = THREE.MathUtils.clamp(e.gamma * 0.02, -0.55, 0.55);
        });
        setNeedsIosPermission(false);
      }
    } catch {}
  };

  // ── 3. Load image via Canvas to bypass CORS (works for any URL) ──────────
  const loadTextureViaCanvas = (url: string): Promise<THREE.CanvasTexture> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const useCanvas = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      };

      img.onload = useCanvas;
      img.onerror = () => {
        // If the external URL fails, try without crossOrigin
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          img.src = ''; // discard first attempt
          const canvas = document.createElement('canvas');
          canvas.width = fallbackImg.naturalWidth || 600;
          canvas.height = fallbackImg.naturalHeight || 400;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(fallbackImg, 0, 0);
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        };
        fallbackImg.onerror = () => {
          // Generate a simple colored placeholder
          const canvas = document.createElement('canvas');
          canvas.width = 400; canvas.height = 300;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#2b060d';
          ctx.fillRect(0, 0, 400, 300);
          ctx.fillStyle = '#ff7700';
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('AI Memory Photo', 200, 150);
          resolve(new THREE.CanvasTexture(canvas));
        };
        fallbackImg.src = '/sample-ai.png';
      };

      img.src = url;
    });
  };

  // ── 4. Three.js 3D Scene ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const w = containerRef.current.clientWidth || window.innerWidth;
    const h = containerRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    cam.position.set(0, 0, 4.4);
    cameraRef.current = cam;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 2.2);
    dir.position.set(3, 5, 4);
    scene.add(dir);
    const gold = new THREE.PointLight(0xff9900, 2.8, 8);
    gold.position.set(-2, 1, 2.5);
    scene.add(gold);
    const bot = new THREE.PointLight(0xff5500, 1.2, 6);
    bot.position.set(0, -2, 2);
    scene.add(bot);

    const cardGroup = new THREE.Group();
    cardGroup.visible = false; // HIDDEN by default
    scene.add(cardGroup);
    cardGroupRef.current = cardGroup;

    const cardW = 3.1, cardH = 2.08;
    const photoW = 1.14, photoH = 1.03, posY = 0.17;
    const posX_left = -0.65, posX_right = 0.65;

    // Base card (frame)
    loadTextureViaCanvas('/print-frame-landscape.png').then(frameTex => {
      const geo = new THREE.PlaneGeometry(cardW, cardH);
      const mat = new THREE.MeshStandardMaterial({ map: frameTex, roughness: 0.35, side: THREE.DoubleSide });
      cardGroup.add(new THREE.Mesh(geo, mat));
      // Drop shadow
      const sh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }));
      sh.position.set(0, -0.06, -0.08);
      sh.scale.set(1.03, 1.03, 1);
      cardGroup.add(sh);
    });

    // Left slot: Original Photo (flat on card)
    const origUrl = searchParams.get('orig') ? decodeURIComponent(searchParams.get('orig')!) : '/sample-original.png';
    loadTextureViaCanvas(origUrl).then(origTex => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(photoW, photoH),
        new THREE.MeshStandardMaterial({ map: origTex, roughness: 0.3 })
      );
      mesh.position.set(posX_left, posY, 0.02);
      cardGroup.add(mesh);
    });

    // Right slot: AI Photo — DRAMATIC 3D POP-OUT
    loadTextureViaCanvas(aiPhotoUrl).then(aiTex => {
      const edgeMat = new THREE.MeshStandardMaterial({ color: 0xff8800, metalness: 0.9, roughness: 0.15 });
      const faceMat = new THREE.MeshStandardMaterial({ map: aiTex, roughness: 0.2, metalness: 0.05 });
      const materials = [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, edgeMat];

      const aiMesh = new THREE.Mesh(new THREE.BoxGeometry(photoW, photoH, 0.1), materials);
      aiMesh.position.set(posX_right, posY, 0.38);
      cardGroup.add(aiMesh);
      aiPhotoMeshRef.current = aiMesh;

      // Drop shadow from elevated photo
      const shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(photoW * 1.1, photoH * 1.1),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
      );
      shadowMesh.position.set(posX_right + 0.04, posY - 0.06, 0.03);
      cardGroup.add(shadowMesh);
      shadowMeshRef.current = shadowMesh;

      // Relief layer (further pop-out)
      const reliefMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(photoW * 0.96, photoH * 0.96),
        new THREE.MeshStandardMaterial({ map: aiTex, transparent: true, opacity: 0.9, roughness: 0.15 })
      );
      reliefMesh.position.set(posX_right, posY, 0.47);
      cardGroup.add(reliefMesh);
    });

    // Golden sparkles around card
    const pCount = 40;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * cardW * 1.1;
      pPos[i + 1] = (Math.random() - 0.5) * cardH * 1.1;
      pPos[i + 2] = Math.random() * 0.8 + 0.1;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0xffaa00, size: 0.04, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending,
    }));
    cardGroup.add(particles);
    particlesRef.current = particles;

    const clock = new THREE.Clock();
    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      currentRotation.current.x += (targetRotation.current.x - currentRotation.current.x) * 0.08;
      currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * 0.08;

      if (cardGroupRef.current) {
        cardGroupRef.current.position.y = Math.sin(t * 1.6) * 0.04;
        cardGroupRef.current.rotation.x = currentRotation.current.x + Math.sin(t * 1.2) * 0.015;
        cardGroupRef.current.rotation.y = currentRotation.current.y + Math.cos(t * 1.0) * 0.02;
      }

      if (aiPhotoMeshRef.current) {
        const floatZ = 0.38 + Math.sin(t * 2.2) * 0.04;
        aiPhotoMeshRef.current.position.z = floatZ;
        if (shadowMeshRef.current) {
          const s = 1 + (floatZ - 0.38) * 0.4;
          shadowMeshRef.current.scale.set(s, s, 1);
        }
      }

      if (particlesRef.current) particlesRef.current.rotation.z = t * 0.05;

      renderer.render(scene, cam);
    };
    animate();

    const onResize = () => {
      if (!containerRef.current) return;
      const nw = containerRef.current.clientWidth || window.innerWidth;
      const nh = containerRef.current.clientHeight || window.innerHeight;
      cam.aspect = nw / nh;
      cam.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      renderer.dispose();
    };
  }, [aiPhotoUrl]);

  // ── Show card when user taps the scan button ──────────────────────────────
  const handleReveal = () => {
    if (cardGroupRef.current) cardGroupRef.current.visible = true;
    setCardVisible(true);
  };

  // ── Touch drag to rotate card ─────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!cardVisible) return;
    isDragging.current = true;
    lastTouch.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastTouch.current.x;
    const dy = e.clientY - lastTouch.current.y;
    lastTouch.current = { x: e.clientX, y: e.clientY };
    targetRotation.current.y = THREE.MathUtils.clamp(targetRotation.current.y + dx * 0.007, -0.85, 0.85);
    targetRotation.current.x = THREE.MathUtils.clamp(targetRotation.current.x + dy * 0.007, -0.6, 0.6);
  };
  const handlePointerUp = () => { isDragging.current = false; };

  const handleReset = () => { targetRotation.current = { x: 0.08, y: 0 }; };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const a = document.createElement('a');
      a.href = aiPhotoUrl;
      a.download = `ai-memory-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(aiPhotoUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden select-none font-sans touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      dir="rtl"
    >
      {/* ── Camera Stream (always visible as background) ── */}
      <video
        ref={videoRef}
        playsInline muted autoPlay
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-700 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Dark ambient gradient when camera isn't available */}
      {!cameraActive && (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1E050A] via-[#330812] to-[#120205] flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-[#FFA940]">
            <Smartphone className="w-7 h-7 animate-pulse" />
          </div>
          <p className="text-sm text-white/70 text-center max-w-xs">
            {cameraError ? 'سيعمل العرض ثلاثي الأبعاد في الخلفية.' : 'جاري تشغيل الكاميرا...'}
          </p>
        </div>
      )}

      {/* ── Three.js Canvas ── */}
      <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none" />

      {/* ── BEFORE SCAN: Full-screen pulsing guide frame + CTA button ── */}
      {!cardVisible && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
          {/* Viewfinder frame */}
          <div className="relative w-4/5 max-w-xs aspect-[1.49] mb-8">
            {/* Animated corner brackets */}
            <div className="absolute -top-1 -right-1 w-7 h-7 border-t-[3px] border-r-[3px] border-[#FFA940] rounded-tr-lg" />
            <div className="absolute -top-1 -left-1 w-7 h-7 border-t-[3px] border-l-[3px] border-[#FFA940] rounded-tl-lg" />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-[3px] border-r-[3px] border-[#FFA940] rounded-br-lg" />
            <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-[3px] border-l-[3px] border-[#FFA940] rounded-bl-lg" />
            {/* Scanning line */}
            <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-[#FFA940] to-transparent shadow-[0_0_12px_#FFA940] animate-pulse" />
          </div>
          {/* Scan CTA */}
          <button
            onClick={handleReveal}
            className="pointer-events-auto flex flex-col items-center gap-3 active:scale-95 transition-transform"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FFA940] flex items-center justify-center shadow-2xl shadow-[#FF5C00]/50 animate-pulse">
              <ScanLine className="w-9 h-9 text-white" />
            </div>
            <span className="text-white font-bold text-base tracking-wide drop-shadow-lg">
              اكتشف ذكرياتك ✨
            </span>
          </button>
        </div>
      )}

      {/* ── Top Bar (only shown after scan) ── */}
      {cardVisible && (
        <header className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          <a href="/" className="p-2.5 rounded-xl bg-black/40 border border-white/15 text-white/80 backdrop-blur-md active:scale-95 flex items-center gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" />
            <span>رجوع</span>
          </a>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF5C00] to-[#FFA940] flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">AI 3D Memory</h1>
              <p className="text-[10px] text-orange-200/70">صورة مجسمة ثلاثية الأبعاد</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {needsIosPermission && (
              <button onClick={requestIosGyro} className="px-3 py-1.5 rounded-full bg-[#FF5C00] text-white text-xs font-bold flex items-center gap-1.5 active:scale-95">
                <Smartphone className="w-3.5 h-3.5" />
                <span>تفعيل الميلان</span>
              </button>
            )}
            <button onClick={handleReset} className="p-2.5 rounded-xl bg-black/40 border border-white/15 text-white/70 backdrop-blur-md active:scale-95">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* ── Hint (only after scan) ── */}
      {cardVisible && (
        <div className="absolute top-20 inset-x-0 z-20 pointer-events-none flex justify-center">
          <div className="px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs text-white/90 shadow-lg flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FFA940]" />
            <span>اسحب بإصبعك أو حرك هاتفك لمعاينة بروز الصورة 3D</span>
          </div>
        </div>
      )}

      {/* ── Bottom: Single Clean Download Button (only after scan) ── */}
      {cardVisible && (
        <footer className="absolute bottom-0 inset-x-0 z-30 p-5 pb-8 pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent flex justify-center">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF5C00] to-[#FFA940] text-white font-bold text-base shadow-xl shadow-[#FF5C00]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <Download className="w-5 h-5" />
            <span>{isDownloading ? 'جاري الحفظ...' : 'حفظ الصورة بجهازك'}</span>
          </button>
        </footer>
      )}
    </div>
  );
};
