import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Download, RotateCcw, Sparkles, ChevronLeft, ScanLine } from 'lucide-react';

export const ArExperience: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const aiPhotoUrl = searchParams.get('img')
    ? decodeURIComponent(searchParams.get('img')!)
    : searchParams.get('photo')
    ? decodeURIComponent(searchParams.get('photo')!)
    : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Three.js refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cardGroupRef = useRef<THREE.Group | null>(null);
  const aiMeshRef = useRef<THREE.Mesh | null>(null);
  const glowMeshRef = useRef<THREE.Mesh | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Gyro smoothing
  const targetRot = useRef({ x: 0, y: 0 });
  const currentRot = useRef({ x: 0, y: 0 });

  // ── 1. Camera ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
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
      } catch {}
    })();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── 2. Gyroscope — auto-activate, no button ────────────────────────────────
  useEffect(() => {
    const applyOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      // beta = front-to-back tilt (-180 to 180), gamma = left-to-right (-90 to 90)
      // clamp to ±0.35 rad for subtle parallax
      targetRot.current.y = THREE.MathUtils.clamp(e.gamma * 0.018, -0.35, 0.35);
      targetRot.current.x = THREE.MathUtils.clamp((e.beta - 45) * 0.012, -0.3, 0.3);
    };

    const isIos = typeof (window as any).DeviceOrientationEvent?.requestPermission === 'function';
    if (!isIos) {
      // Android / desktop: just listen directly
      window.addEventListener('deviceorientation', applyOrientation);
      return () => window.removeEventListener('deviceorientation', applyOrientation);
    }

    // iOS: must request on user gesture — we hook into first touch anywhere
    const requestOnFirstTouch = async () => {
      try {
        const res = await (window as any).DeviceOrientationEvent.requestPermission();
        if (res === 'granted') {
          window.addEventListener('deviceorientation', applyOrientation);
        }
      } catch {}
      window.removeEventListener('touchstart', requestOnFirstTouch);
      window.removeEventListener('pointerdown', requestOnFirstTouch);
    };

    window.addEventListener('touchstart', requestOnFirstTouch, { once: true });
    window.addEventListener('pointerdown', requestOnFirstTouch, { once: true });

    return () => {
      window.removeEventListener('touchstart', requestOnFirstTouch);
      window.removeEventListener('pointerdown', requestOnFirstTouch);
      window.removeEventListener('deviceorientation', applyOrientation);
    };
  }, []);

  // ── 3. Load image via Canvas (CORS-safe for any host) ─────────────────────
  const loadTexture = (url: string): Promise<THREE.CanvasTexture> =>
    new Promise((resolve) => {
      const tryLoad = (src: string, useCrossOrigin: boolean) => {
        const img = new Image();
        if (useCrossOrigin) img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          c.getContext('2d')!.drawImage(img, 0, 0);
          const t = new THREE.CanvasTexture(c);
          t.colorSpace = THREE.SRGBColorSpace;
          resolve(t);
        };
        img.onerror = () => {
          if (useCrossOrigin) tryLoad(src, false);
          else {
            // solid fallback
            const c = document.createElement('canvas');
            c.width = 400; c.height = 300;
            const ctx = c.getContext('2d')!;
            const gr = ctx.createLinearGradient(0, 0, 400, 300);
            gr.addColorStop(0, '#2b060d'); gr.addColorStop(1, '#5c1020');
            ctx.fillStyle = gr; ctx.fillRect(0, 0, 400, 300);
            ctx.fillStyle = '#FF8800'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('AI Memory Photo', 200, 150);
            resolve(new THREE.CanvasTexture(c));
          }
        };
        img.src = src;
      };
      tryLoad(url, true);
    });

  // ── 4. Three.js scene ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const W = containerRef.current.clientWidth || window.innerWidth;
    const H = containerRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    cam.position.set(0, 0, 4.2);
    cameraRef.current = cam;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // fully transparent
    rendererRef.current = renderer;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.4);
    sun.position.set(3, 5, 5);
    scene.add(sun);
    const glow = new THREE.PointLight(0xff8800, 3, 7);
    glow.position.set(-1.5, 1, 3);
    scene.add(glow);

    // Card group — starts hidden
    const cardGroup = new THREE.Group();
    cardGroup.visible = false;
    scene.add(cardGroup);
    cardGroupRef.current = cardGroup;

    const CARD_W = 3.0;
    const CARD_H = 2.0;

    // ── Card base (white/cream frame) ──
    const frameGeo = new THREE.BoxGeometry(CARD_W, CARD_H, 0.04);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xfdf6ec, roughness: 0.5, metalness: 0.02 });
    cardGroup.add(new THREE.Mesh(frameGeo, frameMat));

    // ── AI photo popping out of the card ──
    // The photo fills most of the card (slightly inset)
    const PHOTO_W = CARD_W * 0.88;
    const PHOTO_H = CARD_H * 0.78;

    if (aiPhotoUrl) {
      loadTexture(aiPhotoUrl).then(tex => {
        // 1. Flat base photo (on card surface)
        const baseMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(PHOTO_W, PHOTO_H),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 })
        );
        baseMesh.position.set(0, 0.1, 0.025);
        cardGroup.add(baseMesh);

        // 2. Pop-out layer — slightly larger, elevated, transparent edges
        const popMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(PHOTO_W, PHOTO_H),
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.15,
            transparent: true,
            opacity: 0.95,
          })
        );
        popMesh.position.set(0, 0.1, 0.32); // floats above the card
        popMesh.scale.set(1.0, 1.0, 1);
        cardGroup.add(popMesh);
        aiMeshRef.current = popMesh;

        // 3. Soft glow halo behind pop-out
        const haloMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(PHOTO_W * 1.08, PHOTO_H * 1.08),
          new THREE.MeshBasicMaterial({
            color: 0xff7700,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
          })
        );
        haloMesh.position.set(0, 0.1, 0.28);
        cardGroup.add(haloMesh);
        glowMeshRef.current = haloMesh;

        // 4. Drop shadow between pop-out and card
        const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(PHOTO_W * 1.05, PHOTO_H * 1.05),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
        );
        shadowMesh.position.set(0.05, 0.05, 0.22);
        cardGroup.add(shadowMesh);
      });
    }

    // ── Gold border trim ──
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xffc247, metalness: 0.9, roughness: 0.12 });
    // top & bottom bars
    [CARD_H / 2, -CARD_H / 2].forEach(y => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, 0.06, 0.06), borderMat);
      bar.position.set(0, y, 0.02);
      cardGroup.add(bar);
    });
    // left & right bars
    [-CARD_W / 2, CARD_W / 2].forEach(x => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, CARD_H, 0.06), borderMat);
      bar.position.set(x, 0, 0.02);
      cardGroup.add(bar);
    });

    // ── Sparkle particles ──
    const N = 30;
    const pPos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * CARD_W * 1.2;
      pPos[i + 1] = (Math.random() - 0.5) * CARD_H * 1.2;
      pPos[i + 2] = Math.random() * 0.6 + 0.1;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0xffcc44, size: 0.035, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    }));
    cardGroup.add(particles);

    // ── Animation loop ──
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth gyro lerp
      currentRot.current.x += (targetRot.current.x - currentRot.current.x) * 0.06;
      currentRot.current.y += (targetRot.current.y - currentRot.current.y) * 0.06;

      if (cardGroupRef.current) {
        // Fixed position — no floating, no drifting
        cardGroupRef.current.position.set(0, 0, 0);
        // Gyro tilt gives the 3D illusion
        cardGroupRef.current.rotation.x = currentRot.current.x;
        cardGroupRef.current.rotation.y = currentRot.current.y;
      }

      // Pop-out photo breathes slightly (Z only)
      if (aiMeshRef.current) {
        aiMeshRef.current.position.z = 0.32 + Math.sin(t * 1.8) * 0.025;
      }
      if (glowMeshRef.current) {
        (glowMeshRef.current.material as THREE.MeshBasicMaterial).opacity =
          0.15 + Math.sin(t * 2.2) * 0.06;
      }

      // Rotate sparkles slowly
      particles.rotation.z = t * 0.04;

      renderer.render(scene, cam);
    };
    animate();

    // Resize handler
    const onResize = () => {
      if (!containerRef.current) return;
      const nW = containerRef.current.clientWidth || innerWidth;
      const nH = containerRef.current.clientHeight || innerHeight;
      cam.aspect = nW / nH;
      cam.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      renderer.dispose();
    };
  }, [aiPhotoUrl]);

  // ── Reveal card on tap ────────────────────────────────────────────────────
  const handleReveal = () => {
    if (cardGroupRef.current) cardGroupRef.current.visible = true;
    setCardVisible(true);
  };

  // ── Manual drag to rotate (when gyro unavailable) ─────────────────────────
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const onPointerDown = (e: React.PointerEvent) => {
    if (!cardVisible) return;
    isDragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    targetRot.current.y = THREE.MathUtils.clamp(targetRot.current.y + dx * 0.006, -0.55, 0.55);
    targetRot.current.x = THREE.MathUtils.clamp(targetRot.current.x + dy * 0.006, -0.45, 0.45);
  };
  const onPointerUp = () => { isDragging.current = false; };

  const handleDownload = async () => {
    if (!aiPhotoUrl) return;
    setIsDownloading(true);
    try {
      const a = document.createElement('a');
      a.href = aiPhotoUrl;
      a.download = `ai-memory-${Date.now()}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { window.open(aiPhotoUrl, '_blank'); }
    finally { setIsDownloading(false); }
  };

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden select-none font-sans touch-none"
      dir="rtl"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Camera stream */}
      <video
        ref={videoRef} playsInline muted autoPlay
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-700 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
      />
      {!cameraActive && (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1E050A] via-[#330812] to-[#120205]" />
      )}

      {/* Three.js canvas overlay */}
      <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none" />

      {/* ── BEFORE SCAN: viewfinder + big CTA ── */}
      {!cardVisible && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
          {/* Corner bracket viewfinder */}
          <div className="relative w-4/5 max-w-sm aspect-[1.5] mb-10">
            {['top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl',
              'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl',
              'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl',
              'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl'
            ].map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 border-[#FFA940] ${cls}`} />
            ))}
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-[#FFA940]/80 to-transparent animate-pulse" />
          </div>

          <button
            onClick={handleReveal}
            className="pointer-events-auto flex flex-col items-center gap-4 active:scale-95 transition-transform"
          >
            <div className="relative w-22 h-22 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#FF5C00]/30 animate-ping" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FFA940] flex items-center justify-center shadow-2xl shadow-[#FF5C00]/60">
                <ScanLine className="w-9 h-9 text-white" />
              </div>
            </div>
            <span className="text-white font-bold text-lg tracking-wide drop-shadow-lg">
              اكتشف ذكرياتك ✨
            </span>
            <span className="text-white/50 text-xs">وجّه الكاميرا على الكارت ثم اضغط</span>
          </button>
        </div>
      )}

      {/* ── TOP BAR (after scan) ── */}
      {cardVisible && (
        <header className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
          <a href="/" className="p-2.5 rounded-xl bg-black/40 border border-white/15 text-white/80 backdrop-blur-md active:scale-95 flex items-center gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" /><span>رجوع</span>
          </a>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF5C00] to-[#FFA940] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">AI 3D Memory</p>
              <p className="text-[10px] text-orange-200/60">حرّك هاتفك لتشعر بالعمق</p>
            </div>
          </div>
          <button onClick={() => { targetRot.current = { x: 0, y: 0 }; }}
            className="p-2.5 rounded-xl bg-black/40 border border-white/15 text-white/70 backdrop-blur-md active:scale-95">
            <RotateCcw className="w-4 h-4" />
          </button>
        </header>
      )}

      {/* ── BOTTOM: single download button (after scan) ── */}
      {cardVisible && (
        <footer className="absolute bottom-0 inset-x-0 z-30 p-5 pb-8 pointer-events-auto bg-gradient-to-t from-black/90 to-transparent flex justify-center">
          <button
            onClick={handleDownload}
            disabled={isDownloading || !aiPhotoUrl}
            className="w-full max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF5C00] to-[#FFA940] text-white font-bold text-base shadow-xl shadow-[#FF5C00]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            <span>{isDownloading ? 'جاري الحفظ...' : 'حفظ الصورة بجهازك'}</span>
          </button>
        </footer>
      )}
    </div>
  );
};
