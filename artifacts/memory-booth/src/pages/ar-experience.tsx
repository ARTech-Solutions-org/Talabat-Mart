import React, { useEffect } from 'react';

export function ArExperience() {
  useEffect(() => {
    // AR is currently disabled — redirect to save page
    const search = window.location.search;
    window.location.replace('/save.html' + search);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#F7EEE3',
      color: '#3D0C17',
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontWeight: 'bold',
      direction: 'rtl'
    }}>
      جارٍ الانتقال لصفحة حفظ الصورة...
    </div>
  );
}
