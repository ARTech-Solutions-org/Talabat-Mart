import { useEffect } from 'react';

/**
 * ArExperience — redirects to the standalone MindAR WebAR page.
 *
 * The MindAR experience is a plain HTML page (public/ar.html) because
 * MindAR takes full control of the camera, canvas, and render loop —
 * React is not needed there and would only add overhead.
 *
 * All URL params (?img=...&orig=...) are forwarded as-is.
 */
export const ArExperience: React.FC = () => {
  useEffect(() => {
    // Forward all search params to the standalone AR page
    window.location.replace(`/ar.html${window.location.search}`);
  }, []);

  // Brief loading state while redirect happens
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0d0205', gap: 20,
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid rgba(255,169,64,.2)',
        borderTopColor: '#FFA940',
        animation: 'spin .8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14 }}>
        جاري تشغيل تجربة الواقع المعزز...
      </p>
    </div>
  );
};

// Keep default export too for flexibility
export default ArExperience;
