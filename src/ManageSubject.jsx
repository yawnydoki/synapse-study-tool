import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';

export default function ManageSubject() {
  const { subjectId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editing State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    const fetchQuestions = async () => {
      const querySnapshot = await getDocs(collection(db, "subjects", subjectId, "questions"));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuestions(data);
      setLoading(false);
    };
    fetchQuestions();
  }, [subjectId]);

  const handleDelete = async (id) => {
    if (window.confirm("Permanently delete this item?")) {
      await deleteDoc(doc(db, "subjects", subjectId, "questions", id));
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const handleSave = async (id) => {
    await updateDoc(doc(db, "subjects", subjectId, "questions", id), editForm);
    setQuestions(questions.map(q => q.id === id ? editForm : q));
    setEditingId(null);
  };

  const filteredQuestions = questions.filter(q => {
    const term = searchTerm.toLowerCase();
    return (
      q.front?.toLowerCase().includes(term) || 
      q.back?.toLowerCase().includes(term) || 
      q.question?.toLowerCase().includes(term)
    );
  });

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading the Archives...</div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Manage Subject: <span style={{ color: 'var(--accent)' }}>{subjectId}</span></h2>
        <Link to={`/subject/${subjectId}`}><button style={{ padding: '8px 15px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>Back to Dashboard</button></Link>
      </div>

      <input 
        type="text" 
        placeholder="Search for a term, question, or definition..." 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: '30px', padding: '12px', fontSize: '1rem', border: '1px solid var(--accent)', backgroundColor: 'var(--surface)' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredQuestions.map((q) => (
          <div key={q.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {q.type === 'flashcard' ? '🗂️ Flashcard' : '🎯 MCQ'}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {editingId === q.id ? (
                  <>
                    <button onClick={() => handleSave(q.id)} style={{ padding: '5px 10px', fontSize: '0.8rem', backgroundColor: '#2b3626', border: '1px solid var(--correct)' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: '5px 10px', fontSize: '0.8rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEditing(q)} style={{ padding: '5px 10px', fontSize: '0.8rem', backgroundColor: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>Edit</button>
                    <button onClick={() => handleDelete(q.id)} style={{ padding: '5px 10px', fontSize: '0.8rem', backgroundColor: '#381c1c', border: '1px solid var(--incorrect)', color: '#fff' }}>Delete</button>
                  </>
                )}
              </div>
            </div>

            {/* EDIT MODE */}
            {editingId === q.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {q.type === 'flashcard' ? (
                  <>
                    <input value={editForm.front} onChange={(e) => setEditForm({...editForm, front: e.target.value})} style={{ fontWeight: 'bold' }} />
                    <textarea value={editForm.back} onChange={(e) => setEditForm({...editForm, back: e.target.value})} style={{ minHeight: '80px' }} />
                  </>
                ) : (
                  <>
                    <input value={editForm.question} onChange={(e) => setEditForm({...editForm, question: e.target.value})} style={{ fontWeight: 'bold' }} />
                    <input value={editForm.correctAnswer} onChange={(e) => setEditForm({...editForm, correctAnswer: e.target.value})} style={{ border: '1px solid var(--correct)' }} title="Correct Answer" />
                  </>
                )}
              </div>
            ) : (
              /* VIEW MODE */
              <div>
                {q.type === 'flashcard' ? (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '5px', color: 'var(--text)' }}>{q.front}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{q.back}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '5px', color: 'var(--text)' }}>{q.question}</div>
                    <div style={{ color: 'var(--correct)', fontSize: '0.9rem' }}>✓ {q.correctAnswer}</div>
                  </>
                )}
              </div>
            )}

          </div>
        ))}
        {filteredQuestions.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No items match your search.</div>}
      </div>
    </div>
  );
}