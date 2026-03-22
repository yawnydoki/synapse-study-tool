import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore'; 
import { useParams, Link, useSearchParams } from 'react-router-dom';
import Flashcard from './Flashcard';
import MultipleChoice from './MultipleChoice';

export default function StudyDeck() {
  const { subjectId, mode } = useParams();
  const [searchParams] = useSearchParams();
  const limitParam = searchParams.get('limit'); 
  const timeParam = searchParams.get('time'); 
  
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState(timeParam ? Number(timeParam) * 60 : null);
  const [missedQuestions, setMissedQuestions] = useState([]);
  const [showAnswers, setShowAnswers] = useState(false); // <-- Toggle for answers

  useEffect(() => {
    const fetchQuestions = async () => {
      const querySnapshot = await getDocs(collection(db, "subjects", subjectId, "questions"));
      let data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (mode === 'flashcards') data = data.filter(q => q.type === 'flashcard');
      if (mode === 'mcq' || mode === 'quiz') data = data.filter(q => q.type === 'mcq');

      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]];
      }

      if (mode === 'quiz' && limitParam) {
        data = data.slice(0, Number(limitParam));
      }

      setQuestions(data);
      setLoading(false);
    };
    fetchQuestions();
  }, [subjectId, mode, limitParam]);

  useEffect(() => {
    if (timeLeft === null || isFinished) return;
    if (timeLeft <= 0) {
      setIsFinished(true); 
      return;
    }
    const timerId = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, isFinished]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to permanently delete this item?")) {
      const itemToDelete = questions[currentIndex];
      await deleteDoc(doc(db, "subjects", subjectId, "questions", itemToDelete.id));
      
      const updatedQuestions = questions.filter(q => q.id !== itemToDelete.id);
      setQuestions(updatedQuestions);
      
      if (updatedQuestions.length === 0) setIsFinished(true);
      else if (currentIndex >= updatedQuestions.length) setCurrentIndex(updatedQuestions.length - 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = async (isCorrect = false) => {
    const currentItem = questions[currentIndex];

    // Only track missed questions locally during the quiz
    if (!isCorrect && mode === 'quiz') { 
      setMissedQuestions(prev => [...prev, currentItem]);
    }

    if (mode === 'quiz' && isCorrect) setScore(score + 1);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      if (mode === 'quiz') setIsFinished(true); 
      else {
        setCurrentIndex(0);
        setQuestions([...questions].sort(() => Math.random() - 0.5));
      }
    }
  };

  const handleRetakeMissed = () => {
    setQuestions(missedQuestions);
    setMissedQuestions([]);
    setShowAnswers(false); // reset toggle
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    setTimeLeft(null); 
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
  if (questions.length === 0) return <div style={{ textAlign: 'center', marginTop: '50px' }}>No {mode} found for this subject.</div>;

  if (isFinished && mode === 'quiz') {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="card" style={{ textAlign: 'center', marginTop: '40px' }}>
        <h2>Examination Complete</h2>
        <div style={{ fontSize: '4rem', fontWeight: 'bold', color: percentage >= 70 ? 'var(--correct)' : 'var(--incorrect)', margin: '20px 0' }}>
          {percentage}%
        </div>
        <p style={{ fontSize: '1.1rem' }}>You scored {score} out of {questions.length}.</p>
        {timeLeft <= 0 && <p style={{ color: 'var(--incorrect)', fontWeight: 'bold' }}>Time Expired!</p>}
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px', flexWrap: 'wrap' }}>
          {missedQuestions.length > 0 && (
            <button onClick={handleRetakeMissed} style={{ backgroundColor: 'var(--primary)', color: '#e8e4c9', border: '1px solid var(--accent)' }}>
              Retake Missed ({missedQuestions.length})
            </button>
          )}
          <button onClick={() => window.location.reload()} style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>Retake Full Exam</button>
          <Link to={`/subject/${subjectId}`}><button style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>Dashboard</button></Link>
        </div>

        {missedQuestions.length > 0 && (
          <div style={{ marginTop: '40px', textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            
            {/* Missed Questions Header & Reveal Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ color: 'var(--incorrect)', margin: 0 }}>Missed Questions</h3>
              <button 
                onClick={() => setShowAnswers(!showAnswers)}
                style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {showAnswers ? 'Hide Answers' : 'Reveal Answers 👁️'}
              </button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {missedQuestions.map((q, idx) => (
                <div key={idx} style={{ backgroundColor: 'var(--bg)', padding: '15px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: 'var(--text)' }}>{q.question}</p>
                  
                  {/* Conditional Rendering of the Answer */}
                  {showAnswers ? (
                    <p style={{ margin: 0, color: 'var(--correct)', fontSize: '0.95rem' }}>✓ {q.correctAnswer}</p>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', fontStyle: 'italic' }}>Answer hidden...</p>
                  )}

                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentItem = questions[currentIndex];

  return (
    <div style={{ maxWidth: '500px', margin: '20px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Item {currentIndex + 1} of {questions.length}</h3>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {mode === 'quiz' && timeLeft !== null && (
            <span style={{ fontWeight: 'bold', color: timeLeft < 60 ? 'var(--incorrect)' : 'var(--accent)', fontFamily: 'monospace', fontSize: '1.2rem' }}>
              ⏳ {formatTime(timeLeft)}
            </span>
          )}
          
          {mode !== 'quiz' && (
            <button onClick={handleDelete} title="Delete Item" style={{ padding: '6px 10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              🗑️
            </button>
          )}
        </div>
      </div>
      
      {currentItem.type === 'mcq' ? (
        <>
          <MultipleChoice 
            key={currentItem.id}
            question={currentItem.question} 
            options={currentItem.options} 
            correctAnswer={currentItem.correctAnswer}
            onNext={handleNext} 
          />
          {mode !== 'quiz' && currentIndex > 0 && (
            <div style={{ textAlign: 'center', marginTop: '15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Press <strong>← Left Arrow</strong> to revisit the previous question
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Flashcard key={currentItem.id} front={currentItem.front} back={currentItem.back} />
          
          <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
            {mode !== 'quiz' && (
              <button 
                onClick={handlePrevious} 
                disabled={currentIndex === 0}
                style={{ 
                  flex: 1, 
                  backgroundColor: 'var(--surface)', 
                  border: '1px solid var(--border)', 
                  color: currentIndex === 0 ? 'var(--border)' : 'var(--text)',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>(← Left Arrow)</div>
                Previous
              </button>
            )}
            
            <button onClick={() => handleNext()} style={{ flex: mode !== 'quiz' ? 1 : '100%' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '4px', color: '#e8e4c9' }}>(Right Arrow →)</div>
              Next Card
            </button>
          </div>

        </div>
      )}
    </div>
  );
}