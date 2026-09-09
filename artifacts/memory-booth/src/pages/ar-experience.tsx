import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Download,
  RotateCcw,
  Sparkles,
  Smartphone,
  ChevronLeft
} from 'lucide-react';

export const ArExperience: React.FC = () => {
  // Read query params
  const searchParams = new URLSearchParams(window.location.search);
  const rawImgUrl = searchParams.get('img') || searchParams.get('photo');
  const rawOrigUrl = searchParams.get('orig');

  // Reliable local fallbacks in public folder
  const aiPhotoUrl = rawImgUrl ? decodeURIComponent(rawImgUrl) : '/sample-ai.png';
  const origPhotoUrl = rawOrigUrl ? decodeURIComponent(rawOrigUrl) : '/sample-original.png';

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [needsIosPermission, setNeedsIosPermission] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cardGroupRef = useRef<THREE.Group | null>(null);
  const aiPhotoMeshRef = useRef<THREE.Mesh | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Interaction angles
  const targetRotation = useRef<{ x: number; y: number }>({ x: 0.1, y: 0 });
  const currentRotation = useRef<{ x: number; y: number }>({ x: 0.1, y: 0 });
  const isDragging = useRef<boolean>(false);
  const lastTouch = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Initialize Rear Camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('الكاميرا غير مدعومة');
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
        console.warn('Camera stream note:', err);
        setCameraError(err.message || 'تعذر تشغيل الكاميرا');
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

  // 2. Device Orientation (Gyroscope)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof (window as any).DeviceOrientationEvent !== 'undefined' &&
      typeof (window as any).DeviceOrientationEvent.requestPermission === 'function'
    ) {
      setNeedsIosPermission(true);
      return undefined;
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
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
          setNeedsIosPermission(false);
        }
      }
    } catch (e) {
      console.warn('Gyro permission error:', e);
    }
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    if (e.gamma !== null && e.beta !== null) {
      // Convert phone tilt to subtle 3D card tilt
      const xRot = THREE.MathUtils.clamp((e.beta - 45) * 0.015, -0.45, 0.45);
      const yRot = THREE.MathUtils.clamp(e.gamma * 0.02, -0.55, 0.55);
      targetRotation.current.x = xRot;
      targetRotation.current.y = yRot;
    }
  };

  // Helper to load textures reliably with fallback
  const loadTextureSafe = (url: string, fallbackUrl: string): Promise<THREE.Texture> => {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        () => {
          console.warn(`Failed to load ${url}, loading fallback ${fallbackUrl}`);
          loader.load(fallbackUrl, (fbTex) => {
            fbTex.colorSpace = THREE.SRGBColorSpace;
            resolve(fbTex);
          });
        }
      );
    });
  };

  // 3. Build 3D Pop-Out Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Enhanced Lighting to accentuate 3D bevels & pop-out
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const goldRimLight = new THREE.PointLight(0xff9900, 2.8, 8);
    goldRimLight.position.set(-2, 1, 2.5);
    scene.add(goldRimLight);

    const bottomLight = new THREE.PointLight(0xff5500, 1.2, 6);
    bottomLight.position.set(0, -2, 2);
    scene.add(bottomLight);

    // Main Card Group (Holds the entire 3D composition)
    const cardGroup = new THREE.Group();
    scene.add(cardGroup);
    cardGroupRef.current = cardGroup;

    // Standard card aspect ratio (152x102mm = 1.49)
    const cardW = 3.1;
    const cardH = 2.08;

    // Exact slot coordinates based on Frame 8.svg (w=2471, h=1658)
    const photoW = 1.14;
    const photoH = 1.03;
    const posY = 0.17;
    const posX_left = -0.65;  // Left slot: Original Photo
    const posX_right = 0.65;   // Right slot: AI Photo

    // 1) Base Printed Card
    loadTextureSafe('/print-frame-landscape.png', '/print-frame-landscape.png').then((frameTex) => {
      const baseGeo = new THREE.PlaneGeometry(cardW, cardH);
      const baseMat = new THREE.MeshStandardMaterial({
        map: frameTex,
        roughness: 0.35,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      cardGroup.add(baseMesh);

      // Paper drop shadow
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.4,
      });
      const shadowMesh = new THREE.Mesh(baseGeo, shadowMat);
      shadowMesh.position.set(0, -0.06, -0.08);
      shadowMesh.scale.set(1.03, 1.03, 1);
      cardGroup.add(shadowMesh);
    });

    // 2) Left Slot: Original Photo (Sits on card plane)
    loadTextureSafe(origPhotoUrl, '/sample-original.png').then((origTex) => {
      const origGeo = new THREE.PlaneGeometry(photoW, photoH);
      const origMat = new THREE.MeshStandardMaterial({
        map: origTex,
        roughness: 0.3,
        metalness: 0.05,
      });
      const origMesh = new THREE.Mesh(origGeo, origMat);
      origMesh.position.set(posX_left, posY, 0.02);
      cardGroup.add(origMesh);
    });

    // 3) Right Slot: AI Photo — DRAMATIC 3D POP-OUT!
    loadTextureSafe(aiPhotoUrl, '/sample-ai.png').then((aiTex) => {
      // 3D Extruded Box for physical thickness (Floating forward!)
      const popGeo = new THREE.BoxGeometry(photoW, photoH, 0.1);

      // Gold/Orange luxury beveled edges
      const edgeMat = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        metalness: 0.9,
        roughness: 0.15,
      });
      const faceMat = new THREE.MeshStandardMaterial({
        map: aiTex,
        roughness: 0.2,
        metalness: 0.05,
      });

      const materials = [
        edgeMat, // right
        edgeMat, // left
        edgeMat, // top
        edgeMat, // bottom
        faceMat, // front (Photo)
        edgeMat, // back
      ];

      const aiMesh = new THREE.Mesh(popGeo, materials);
      aiMesh.position.set(posX_right, posY, 0.38); // Elevated forward in 3D!
      cardGroup.add(aiMesh);
      aiPhotoMeshRef.current = aiMesh;

      // Realistic soft shadow cast from the elevated AI photo onto the card surface
      const shadowGeo = new THREE.PlaneGeometry(photoW * 1.1, photoH * 1.1);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.55,
      });
      const photoShadow = new THREE.Mesh(shadowGeo, shadowMat);
      photoShadow.position.set(posX_right + 0.04, posY - 0.06, 0.03);
      cardGroup.add(photoShadow);
      shadowMeshRef.current = photoShadow;

      // Golden 3D Glow Border around the floating photo
      const borderGeo = new THREE.RingGeometry(0.55, 0.57, 32);
      // Front relief layer for subject depth
      const reliefGeo = new THREE.PlaneGeometry(photoW * 0.96, photoH * 0.96);
      const reliefMat = new THREE.MeshStandardMaterial({
        map: aiTex,
        transparent: true,
        opacity: 0.9,
        roughness: 0.15,
      });
      const reliefMesh = new THREE.Mesh(reliefGeo, reliefMat);
      reliefMesh.position.set(posX_right, posY, 0.46); // Popping even further forward!
      cardGroup.add(reliefMesh);
    });

    // 4) Floating Golden Particles around the 3D Pop-Out
    const particleCount = 40;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * cardW * 1.1;
      particlePos[i + 1] = (Math.random() - 0.5) * cardH * 1.1;
      particlePos[i + 2] = Math.random() * 0.8 + 0.1;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.04,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    cardGroup.add(particles);
    particlesRef.current = particles;

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth damping rotation
      currentRotation.current.x += (targetRotation.current.x - currentRotation.current.x) * 0.08;
      currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * 0.08;

      if (cardGroupRef.current) {
        cardGroupRef.current.position.y = Math.sin(elapsed * 1.6) * 0.04;
        cardGroupRef.current.rotation.x = currentRotation.current.x + Math.sin(elapsed * 1.2) * 0.015;
        cardGroupRef.current.rotation.y = currentRotation.current.y + Math.cos(elapsed * 1.0) * 0.02;
      }

      // 3D breathing pop-out on the AI photo
      if (aiPhotoMeshRef.current) {
        const floatZ = 0.38 + Math.sin(elapsed * 2.2) * 0.04;
        aiPhotoMeshRef.current.position.z = floatZ;

        // Shadow moves naturally opposite to light/float
        if (shadowMeshRef.current) {
          shadowMeshRef.current.scale.set(
            1 + (floatZ - 0.38) * 0.4,
            1 + (floatZ - 0.38) * 0.4,
            1
          );
        }
      }

      // Sparkles rotate
      if (particlesRef.current) {
        particlesRef.current.rotation.z = elapsed * 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

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
  }, [aiPhotoUrl, origPhotoUrl]);

  // Touch & Drag to inspect in 3D
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastTouch.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastTouch.current.x;
    const deltaY = e.clientY - lastTouch.current.y;
    lastTouch.current = { x: e.clientX, y: e.clientY };

    targetRotation.current.y = THREE.MathUtils.clamp(targetRotation.current.y + deltaX * 0.007, -0.85, 0.85);
    targetRotation.current.x = THREE.MathUtils.clamp(targetRotation.current.x + deltaY * 0.007, -0.6, 0.6);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handleReset = () => {
    targetRotation.current = { x: 0.1, y: 0 };
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const a = document.createElement('a');
      a.href = aiPhotoUrl;
      a.download = `ai-memory-${Date.now()}.png`;
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
      {/* 1. Live Rear Camera Stream */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-700 ${
          cameraActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback ambient glow when camera is loading or unavailable */}
      {!cameraActive && (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1E050A] via-[#330812] to-[#120205] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-3 text-[#FFA940]">
            <Smartphone className="w-7 h-7 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">عرض الواقع المعزز 3D</h2>
          <p className="text-xs text-white/60 max-w-xs leading-relaxed">
            {cameraError ? 'يعمل العرض ثلاثي الأبعاد الآن في الفضاء الافتراضي.' : 'جاري تشغيل الكاميرا...'}
          </p>
        </div>
      )}

      {/* 2. Three.js 3D Pop-Out Canvas */}
      <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none" />

      {/* 3. Top Navigation & Header */}
      <header className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <a
          href="/"
          className="p-2.5 rounded-xl bg-black/40 border border-white/15 text-white/80 hover:text-white backdrop-blur-md active:scale-95 flex items-center gap-1 text-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>الرئيسية</span>
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
          {/* iOS Gyro Enable Button */}
          {needsIosPermission && (
            <button
              onClick={requestIosGyro}
              className="px-3 py-1.5 rounded-full bg-[#FF5C00] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تفعيل الميلان</span>
            </button>
          )}

          {/* Reset Angle */}
          <button
            onClick={handleReset}
            title="إعادة ضبط زاوية الرؤية"
            className="p-2.5 rounded-xl bg-black/40 border border-white/15 text-white/70 hover:text-white backdrop-blur-md active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 4. Interactive Hint (One simple prompt) */}
      <div className="absolute top-20 inset-x-0 z-20 pointer-events-none flex justify-center px-4">
        <div className="px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs text-white/90 shadow-lg flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#FFA940]" />
          <span>اسحب بإصبعك أو حرك هاتفك لمعاينة بروز الصورة ثلاثية الأبعاد</span>
        </div>
      </div>

      {/* 5. Minimal Bottom Action Bar — ONLY ONE CLEAN BUTTON */}
      <footer className="absolute bottom-0 inset-x-0 z-30 p-5 pb-8 pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent flex justify-center">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF5C00] to-[#FFA940] hover:from-[#FF6B1A] hover:to-[#FFB75E] text-white font-bold text-base shadow-xl shadow-[#FF5C00]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <Download className="w-5 h-5 text-white" />
          <span>{isDownloading ? 'جاري التحميل...' : 'حفظ الصورة بجهازك'}</span>
        </button>
      </footer>
    </div>
  );
};
