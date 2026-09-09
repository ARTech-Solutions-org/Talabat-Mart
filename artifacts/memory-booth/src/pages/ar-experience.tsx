import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Camera,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  HelpCircle,
  Eye,
  Smartphone,
  ChevronRight,
  Maximize2
} from 'lucide-react';

export const ArExperience: React.FC = () => {
  // Read query params
  const searchParams = new URLSearchParams(window.location.search);
  const rawImgUrl = searchParams.get('img') || searchParams.get('photo');
  const demoFallback = '/design-ref/demo-younger-graduation.png';
  const photoUrl = rawImgUrl ? decodeURIComponent(rawImgUrl) : demoFallback;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [depthMode, setDepthMode] = useState<'normal' | 'deep' | 'hologram'>('deep');
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [gyroEnabled, setGyroEnabled] = useState<boolean>(false);
  const [needsIosPermission, setNeedsIosPermission] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cardGroupRef = useRef<THREE.Group | null>(null);
  const photoMeshRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Interaction angles
  const targetRotation = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentRotation = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDragging = useRef<boolean>(false);
  const lastTouch = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Initialize Camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('الكاميرا غير مدعومة في هذا المتصفح');
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Camera access fallback:', err);
        setCameraError(err.message || 'تعذر الوصول للكاميرا');
        setCameraActive(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 2. Check iOS DeviceOrientation Permission
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof (window as any).DeviceOrientationEvent !== 'undefined' &&
      typeof (window as any).DeviceOrientationEvent.requestPermission === 'function'
    ) {
      setNeedsIosPermission(true);
      return undefined;
    } else {
      // Auto enable on Android & standard browsers
      window.addEventListener('deviceorientation', handleOrientation);
      setGyroEnabled(true);
      return () => {
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    }
  }, []);

  const requestIosGyro = async () => {
    try {
      if (
        typeof (window as any).DeviceOrientationEvent !== 'undefined' &&
        typeof (window as any).DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const response = await (window as any).DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          setGyroEnabled(true);
          setNeedsIosPermission(false);
        }
      }
    } catch (e) {
      console.warn('Gyro permission error:', e);
    }
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    if (e.gamma !== null && e.beta !== null) {
      // Map tilt to gentle rotation
      const xRot = THREE.MathUtils.clamp((e.beta - 45) * 0.015, -0.4, 0.4);
      const yRot = THREE.MathUtils.clamp(e.gamma * 0.02, -0.5, 0.5);
      targetRotation.current.x = xRot;
      targetRotation.current.y = yRot;
    }
  };

  // 3. Initialize Three.js 3D Pop-Out Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    cameraRef.current = camera;

    // Renderer (Transparent so camera video is visible behind)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    const warmLight = new THREE.PointLight(0xff7700, 2.0, 10);
    warmLight.position.set(-2, 1, 2);
    scene.add(warmLight);

    // Main 3D Card Group
    const cardGroup = new THREE.Group();
    scene.add(cardGroup);
    cardGroupRef.current = cardGroup;

    // Dimensions for 152x102mm aspect ratio (~1.49)
    const cardW = 3.0;
    const cardH = 2.01;

    const textureLoader = new THREE.TextureLoader();

    // 1) Base Print Card (Paper)
    textureLoader.load(
      '/print-frame-landscape.png',
      (frameTex) => {
        frameTex.colorSpace = THREE.SRGBColorSpace;
        const baseGeo = new THREE.PlaneGeometry(cardW, cardH);
        const baseMat = new THREE.MeshStandardMaterial({
          map: frameTex,
          roughness: 0.4,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.z = 0;
        cardGroup.add(baseMesh);

        // Soft drop shadow beneath card
        const shadowMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.35,
        });
        const shadowMesh = new THREE.Mesh(baseGeo, shadowMat);
        shadowMesh.position.set(0, -0.05, -0.08);
        shadowMesh.scale.set(1.03, 1.03, 1);
        cardGroup.add(shadowMesh);
      },
      undefined,
      () => {
        // Fallback card if overlay image fails
        const baseGeo = new THREE.PlaneGeometry(cardW, cardH);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b060d, roughness: 0.5 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        cardGroup.add(baseMesh);
      }
    );

    // 2) 3D Pop-Out Layer (The Floating AI Generated Photo)
    textureLoader.load(photoUrl, (photoTex) => {
      photoTex.colorSpace = THREE.SRGBColorSpace;

      // The AI photo sits on the right side of the print frame (Blue slot in Frame 8.svg)
      // w = 910/2471 * 3.0 = 1.10, h = 823/1658 * 2.01 = 1.00
      const photoW = 1.12;
      const photoH = 1.02;
      const posX = 0.58; // Positioned over right slot
      const posY = 0.18;

      // 3D Extruded Box for thickness
      const photoGeo = new THREE.BoxGeometry(photoW, photoH, 0.08);
      
      // Multi-material: Front has photo, sides have glossy gold/amber frame
      const frameSideMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        metalness: 0.85,
        roughness: 0.2,
      });
      const photoFaceMat = new THREE.MeshStandardMaterial({
        map: photoTex,
        roughness: 0.25,
        metalness: 0.05,
      });

      const materials = [
        frameSideMat, // right
        frameSideMat, // left
        frameSideMat, // top
        frameSideMat, // bottom
        photoFaceMat, // front
        frameSideMat, // back
      ];

      const photoMesh = new THREE.Mesh(photoGeo, materials);
      photoMesh.position.set(posX, posY, 0.28); // Elevated in 3D (Pop out effect!)
      cardGroup.add(photoMesh);
      photoMeshRef.current = photoMesh;

      // Secondary floating cutout (Subject Pop-Out relief layer)
      const reliefGeo = new THREE.PlaneGeometry(photoW * 0.94, photoH * 0.94);
      const reliefMat = new THREE.MeshStandardMaterial({
        map: photoTex,
        transparent: true,
        opacity: 0.85,
        roughness: 0.2,
      });
      const reliefMesh = new THREE.Mesh(reliefGeo, reliefMat);
      reliefMesh.position.set(posX, posY, 0.38); // Even higher pop-out!
      cardGroup.add(reliefMesh);

      // Cast shadow from photo onto base paper
      const innerShadowGeo = new THREE.PlaneGeometry(photoW * 1.05, photoH * 1.05);
      const innerShadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.45,
      });
      const innerShadow = new THREE.Mesh(innerShadowGeo, innerShadowMat);
      innerShadow.position.set(posX + 0.02, posY - 0.04, 0.02);
      cardGroup.add(innerShadow);
    });

    // 3) Sparkle & Ambient Particle System
    const particleCount = 45;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * cardW * 1.2;
      particlePos[i + 1] = (Math.random() - 0.5) * cardH * 1.2;
      particlePos[i + 2] = Math.random() * 0.8 + 0.1;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xffb703,
      size: 0.04,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    cardGroup.add(particles);
    particlesRef.current = particles;

    // Initial gentle card tilt
    cardGroup.rotation.x = 0.08;

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth damping rotation toward target
      currentRotation.current.x += (targetRotation.current.x - currentRotation.current.x) * 0.08;
      currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * 0.08;

      if (cardGroupRef.current) {
        // Floating breathe motion
        cardGroupRef.current.position.y = Math.sin(elapsed * 1.5) * 0.05;
        cardGroupRef.current.rotation.x = currentRotation.current.x + Math.sin(elapsed * 1.2) * 0.015;
        cardGroupRef.current.rotation.y = currentRotation.current.y + Math.cos(elapsed * 1.0) * 0.02;
      }

      // Hover pulse on photo layer
      if (photoMeshRef.current) {
        const depthElev = depthMode === 'deep' ? 0.35 : depthMode === 'hologram' ? 0.48 : 0.22;
        photoMeshRef.current.position.z = depthElev + Math.sin(elapsed * 2.0) * 0.03;
      }

      // Animate particles
      if (particlesRef.current) {
        particlesRef.current.rotation.z = elapsed * 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth || window.innerWidth;
      const newH = containerRef.current.clientHeight || window.innerHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      renderer.dispose();
    };
  }, [photoUrl, depthMode]);

  // Touch & Pointer interactions (Drag to inspect 3D)
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastTouch.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastTouch.current.x;
    const deltaY = e.clientY - lastTouch.current.y;
    lastTouch.current = { x: e.clientX, y: e.clientY };

    targetRotation.current.y = THREE.MathUtils.clamp(targetRotation.current.y + deltaX * 0.006, -0.8, 0.8);
    targetRotation.current.x = THREE.MathUtils.clamp(targetRotation.current.x + deltaY * 0.006, -0.6, 0.6);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handleReset = () => {
    targetRotation.current = { x: 0, y: 0 };
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const a = document.createElement('a');
      a.href = photoUrl;
      a.download = `ai-memory-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(photoUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden select-none font-sans"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      dir="rtl"
    >
      {/* 1. Live Camera Feed (Background) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-700 ${
          cameraActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback ambient gradient if camera is off / denied */}
      {!cameraActive && (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1C0509] via-[#380814] to-[#120205] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-[#FFA940]">
            <Smartphone className="w-8 h-8 animate-bounce" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">وضع العرض المجسم 3D</h2>
          <p className="text-xs text-white/70 max-w-xs leading-relaxed">
            {cameraError
              ? 'تم تشغيل العرض المجسم ثلاثي الأبعاد مباشرة بدون كاميرا.'
              : 'جاري تفعيل كاميرا الواقع المعزز...'}
          </p>
        </div>
      )}

      {/* 2. Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none" />

      {/* 3. AR Viewfinder Card Guide Overlay */}
      {showGuide && cameraActive && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center p-6">
          <div className="relative w-full max-w-sm aspect-[1.49] border-2 border-[#FF7700]/70 rounded-2xl shadow-[0_0_30px_rgba(255,119,0,0.3)] animate-pulse flex items-center justify-center">
            {/* Corner brackets */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />

            {/* Scanning line animation */}
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#FFA940] to-transparent shadow-[0_0_15px_#FFA940]" />

            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-center">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#FFA940]" />
                وجّه الكاميرا نحو صورتك المطبوعة
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Top Header Bar */}
      <header className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF5C00] to-[#FFA940] flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">AI 3D Memory</h1>
            <p className="text-[10px] text-orange-200/70">واقع معزز ثلاثي الأبعاد</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* iOS Gyro Enable Button if needed */}
          {needsIosPermission && (
            <button
              onClick={requestIosGyro}
              className="px-3 py-1.5 rounded-full bg-[#FF5C00] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تفعيل الحساس</span>
            </button>
          )}

          {/* Toggle Viewfinder */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            title="إخفاء/إظهار إطار المحاذاة"
            className={`p-2.5 rounded-xl border transition-colors ${
              showGuide
                ? 'bg-[#FF5C00]/20 border-[#FF5C00] text-[#FFA940]'
                : 'bg-black/40 border-white/20 text-white/70'
            } backdrop-blur-md`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Reset Rotation */}
          <button
            onClick={handleReset}
            title="إعادة ضبط الزاوية"
            className="p-2.5 rounded-xl bg-black/40 border border-white/20 text-white/70 hover:text-white backdrop-blur-md active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 5. Floating Hint / Gesture Tip */}
      <div className="absolute top-20 inset-x-0 z-20 pointer-events-none flex justify-center px-4">
        <div className="px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] text-white/80 shadow-lg flex items-center gap-1.5">
          <span>👆 اسحب بإصبعك أو حرك هاتفك لرؤية بروز المجسم من زوايا مختلفة</span>
        </div>
      </div>

      {/* 6. Bottom Controls Bar */}
      <footer className="absolute bottom-0 inset-x-0 z-30 p-5 pb-8 pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-3">
        {/* Depth Mode Selector */}
        <div className="flex items-center justify-center gap-2 bg-black/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 max-w-xs mx-auto w-full">
          <button
            onClick={() => setDepthMode('normal')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              depthMode === 'normal'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            عمق خفيف
          </button>
          <button
            onClick={() => setDepthMode('deep')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              depthMode === 'deep'
                ? 'bg-gradient-to-r from-[#FF5C00] to-[#FFA940] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            مجسم بارز ⭐
          </button>
          <button
            onClick={() => setDepthMode('hologram')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              depthMode === 'hologram'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            هولوجرام
          </button>
        </div>

        {/* Download Action */}
        <div className="flex items-center gap-2 max-w-xs mx-auto w-full">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-white text-black hover:bg-neutral-100 font-bold text-sm shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Download className="w-4 h-4 text-[#FF5C00]" />
            <span>{isDownloading ? 'جاري التحميل...' : 'حفظ الصورة بالجهاز'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
