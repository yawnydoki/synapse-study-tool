import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export default function DataEntry() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  
  const [type, setType] = useState('flashcard');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');

  useEffect(() => {
    const fetchSubjects = async () => {
      const snap = await getDocs(collection(db, "subjects"));
      const subs = snap.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
      setSubjects(subs);
      if (subs.length > 0) setSubjectId(subs[0].id);
    };
    fetchSubjects();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return alert("Please select a Subject.");

    const colRef = collection(db, "subjects", subjectId, "questions");
    
    if (type === 'flashcard') {
      await addDoc(colRef, { type: 'flashcard', front, back });
    } else {
      await addDoc(colRef, { type: 'mcq', question, options, correctAnswer });
    }
    
    setFront(''); setBack(''); setQuestion(''); setOptions(['', '', '', '']); setCorrectAnswer('');
    alert('Added to Synapse!');
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', margin: '20px auto' }}>
      <h3>Add New Item</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Subject</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
          {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.title}</option>)}
        </select>
      </div>

      <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: '10px', marginTop: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
        <option value="flashcard">Flashcard</option>
        <option value="mcq">Multiple Choice</option>
      </select>

      {type === 'flashcard' ? (
        <>
          <textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front (Question)" required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back (Answer)" required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
        </>
      ) : (
        <>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question" required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
          {options.map((opt, i) => (
            <input key={i} value={opt} onChange={(e) => handleOptionChange(i, e.target.value)} placeholder={`Option ${i + 1}`} required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
          ))}
          <input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="Exact Correct Answer Text" required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
        </>
      )}
      <button type="submit" disabled={!subjectId} style={{ padding: '12px', cursor: subjectId ? 'pointer' : 'not-allowed', backgroundColor: subjectId ? '#333' : '#999', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', marginTop: '10px' }}>
        Add to Database
      </button>
    </form>
  );
}