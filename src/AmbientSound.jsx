import React, { useState, useRef, useEffect } from 'react';

export default function AmbientSound() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // We start at a low volume so it's a subtle background texture
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
    }
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {/* Public domain rain audio */}
      <audio 
        ref={audioRef} 
        loop 
        src="https://upload.wikimedia.org/wikipedia/commons/4/41/Rain_on_roof_1.ogg" 
      />
      
      <button 
        onClick={togglePlay} 
        title={isPlaying ? "Mute Ambience" : "Play Rain Sounds"}
        style={{ 
          background: 'transparent', 
          border: '1px solid var(--border)', 
          padding: '8px 12px', 
          borderRadius: 'var(--radius)', 
          cursor: 'pointer',
          color: isPlaying ? 'var(--accent)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: 'none'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>{isPlaying ? '🌧️' : '🌂'}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
          {isPlaying ? 'Ambience On' : 'Ambience Off'}
        </span>
      </button>
    </div>
  );
}