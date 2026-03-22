import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';

export default function SubjectDashboard() {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  
  const [totalCount, setTotalCount] = useState(0);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const [mcqCount, setMcqCount] = useState(0);
  
  const [quizLimit, setQuizLimit] = useState(10);
  const [timeLimit, setTimeLimit] = useState(5); 
  const [rawQuestions, setRawQuestions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const docSnap = await getDoc(doc(db, "subjects", subjectId));
      if (docSnap.exists()) setSubject({ id: docSnap.id, ...docSnap.data() });

      const qSnap = await getDocs(collection(db, "subjects", subjectId, "questions"));
      let fCount = 0; let mCount = 0; 
      let allQuestions = [];
      
      qSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'flashcard') fCount++;
        if (data.type === 'mcq') mCount++;
        
        const { id, ...cleanData } = data;
        allQuestions.push(cleanData);
      });

      setRawQuestions(allQuestions);
      setTotalCount(qSnap.docs.length);
      setFlashcardCount(fCount);
      setMcqCount(mCount);
      setQuizLimit(mCount < 10 ? mCount : 10);
    };
    fetchData();
  }, [subjectId]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(rawQuestions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${subjectId}-synapse-export.json`;
    link.click();
  };

  if (!subject) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading Dashboard...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      
      <div className="card" style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>{subject.title}</h2>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 15px 0' }}>{subject.description}</p>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--accent)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold' }}>
            Total Items: {totalCount}
          </div>

          <Link to={`/manage/${subject.id}`}>
            <button style={{ padding: '5px 15px', fontSize: '0.85rem', borderRadius: '20px', backgroundColor: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
              Edit
            </button>
          </Link>

          <button onClick={handleExport} style={{ padding: '5px 15px', fontSize: '0.85rem', borderRadius: '20px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
             Export JSON
          </button>
        </div>
      </div>

      <h3 style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Study Modes</h3>
      <div style={{ display: 'grid', gap: '15px' }}>
        
        <Link to={`/study/${subject.id}/flashcards`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', transition: 'transform 0.2s', position: 'relative' }}>
          <div style={{ fontSize: '2rem', opacity: 0.8 }}>🗂️</div>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: 'var(--text)' }}>Review Flashcards</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Memorize terms and definitions.</p>
          </div>
          <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
            {flashcardCount} cards
          </div>
        </Link>

        <Link to={`/study/${subject.id}/mcq`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', transition: 'transform 0.2s', position: 'relative' }}>
          <div style={{ fontSize: '2rem', opacity: 0.8 }}>🎯</div>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: 'var(--text)' }}>Practice MCQs</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Continuous multiple choice review.</p>
          </div>
          <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
            {mcqCount} questions
          </div>
        </Link>

      </div>

      <h3 style={{ marginTop: '30px', marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Assessment</h3>
      <div style={{ display: 'grid', gap: '15px' }}>
        <div className="card" style={{ border: '1px solid var(--accent)', backgroundColor: '#211d1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ fontSize: '2rem', opacity: 0.8 }}>🏆</div>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: 'var(--accent)' }}>Test Your Knowledge</h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Take a formal, graded test based on MCQs.</p>
            </div>
          </div>
          
          <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', backgroundColor: 'var(--bg)', padding: '15px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text)' }}>Items:</label>
              <input type="number" min="1" max={mcqCount} value={quizLimit} onChange={(e) => setQuizLimit(Number(e.target.value))} style={{ width: '60px', padding: '6px', textAlign: 'center' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text)' }}>Minutes:</label>
              <input type="number" min="1" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} style={{ width: '60px', padding: '6px', textAlign: 'center' }} />
            </div>
            
            <Link to={`/study/${subject.id}/quiz?limit=${quizLimit}&time=${timeLimit}`} style={{ marginLeft: 'auto' }}>
              <button disabled={mcqCount === 0 || quizLimit < 1} style={{ padding: '10px 20px', margin: 0 }}>Begin Exam</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}