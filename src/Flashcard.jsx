import React, { useState, useEffect } from 'react';

export default function Flashcard({ front, back }) {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); 
        setIsFlipped((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { setIsFlipped(false); }, [front, back]);

  return (
    <div 
      className={`flashcard-wrapper ${isFlipped ? 'flipped' : ''}`} 
      onClick={() => setIsFlipped(!isFlipped)}
      style={{ cursor: 'pointer' }}
    >
      <div className="flashcard-inner">
        
        {/* The Front of the Card */}
        <div className="flashcard-front">
          {front}
        </div>
        
        {/* The Back of the Card */}
        <div className="flashcard-back">
          {back}
        </div>
        
      </div>
    </div>
  );
}