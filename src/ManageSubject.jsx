import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';

export default function ManageSubject() {
  const { subjectId } = useParams();
  const [questions, setQuestions]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState({});

  useEffect(() => {
    const fetchQuestions = async () => {
      const snap = await getDocs(
        collection(db, 'subjects', subjectId, 'questions')
      );
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchQuestions();
  }, [subjectId]);

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this item?')) return;
    await deleteDoc(doc(db, 'subjects', subjectId, 'questions', id));
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditForm({
      ...item,
      options: item.options ? [...item.options] : [],
    });
  };

  const handleSave = async (id) => {
    if (editForm.type === 'mcq') {
      const trimmedOptions = editForm.options.map((o) => o.trim());
      const trimmedAnswer  = editForm.correctAnswer?.trim();
      if (!trimmedOptions.includes(trimmedAnswer)) {
        alert('The correct answer must exactly match one of the four options.');
        return;
      }
      const cleaned = { ...editForm, options: trimmedOptions, correctAnswer: trimmedAnswer };
      await updateDoc(doc(db, 'subjects', subjectId, 'questions', id), cleaned);
      setQuestions((prev) => prev.map((q) => (q.id === id ? cleaned : q)));
    } else {
      await updateDoc(doc(db, 'subjects', subjectId, 'questions', id), editForm);
      setQuestions((prev) => prev.map((q) => (q.id === id ? editForm : q)));
    }
    setEditingId(null);
  };

  const handleOptionChange = (index, value) => {
    const updated = [...editForm.options];
    updated[index] = value;
    setEditForm({ ...editForm, options: updated });
  };

  const filtered = questions.filter((q) => {
    const t = searchTerm.toLowerCase();
    return (
      q.front?.toLowerCase().includes(t) ||
      q.back?.toLowerCase().includes(t)  ||
      q.question?.toLowerCase().includes(t)
    );
  });

  if (loading) {
    return (
      <div className="empty-state">
        <span className="empty-state-glyph">⧗</span>
        <p className="empty-state-quote">Loading the archives…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }} className="fade-in">

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px',
      }}>
        <h2 style={{ margin: 0 }}>
          Manage <span style={{ color: 'var(--accent)' }}>{subjectId}</span>
        </h2>
        <Link to={`/subject/${subjectId}`}>
          <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>
            Back
          </button>
        </Link>
      </div>

      <div className="search-wrapper">
        <span className="search-icon" style={{ fontStyle: 'normal', fontSize: '0.9rem' }}>⌕</span>
        <input
          type="text"
          placeholder="Search terms, questions, definitions…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map((q) => (
          <div key={q.id} className="manage-item">

            <div className="manage-item-header">
              <span className="manage-item-type">
                {q.type === 'flashcard' ? 'Flashcard' : 'MCQ'}
              </span>
              <div className="manage-item-actions">
                {editingId === q.id ? (
                  <>
                    <button
                      onClick={() => handleSave(q.id)}
                      className="btn-accent"
                      style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-ghost"
                      style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEditing(q)}
                      className="btn-accent"
                      style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.78rem',
                        background: '#2a1515',
                        border: '1px solid #6e2a2a',
                        color: '#c08080',
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* EDIT MODE */}
            {editingId === q.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {q.type === 'flashcard' ? (
                  <>
                    <div>
                      <label>Front</label>
                      <input
                        value={editForm.front}
                        onChange={(e) => setEditForm({ ...editForm, front: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Back</label>
                      <textarea
                        value={editForm.back}
                        onChange={(e) => setEditForm({ ...editForm, back: e.target.value })}
                        style={{ minHeight: '80px' }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label>Question</label>
                      <textarea
                        value={editForm.question}
                        onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                        style={{ minHeight: '70px' }}
                      />
                    </div>

                    <div>
                      <label>Options</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '6px' }}>
                        {(editForm.options || []).map((opt, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              fontFamily: 'var(--font-display)',
                              fontStyle: 'italic',
                              color: 'var(--accent-dim)',
                              fontSize: '0.85rem',
                              width: '18px',
                              flexShrink: 0,
                              textAlign: 'center',
                            }}>
                              {i + 1}.
                            </span>
                            <input
                              value={opt}
                              onChange={(e) => handleOptionChange(i, e.target.value)}
                              style={{
                                flex: 1,
                                borderColor:
                                  opt.trim() === editForm.correctAnswer?.trim()
                                    ? 'var(--accent-dim)'
                                    : undefined,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label>Correct Answer</label>
                      <select
                        value={editForm.correctAnswer}
                        onChange={(e) => setEditForm({ ...editForm, correctAnswer: e.target.value })}
                        style={{ borderColor: 'var(--accent-dim)', marginTop: '6px' }}
                      >
                        <option value="">— select the correct option —</option>
                        {(editForm.options || []).map((opt, i) => (
                          <option key={i} value={opt}>
                            {i + 1}. {opt}
                          </option>
                        ))}
                      </select>
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '6px',
                        fontStyle: 'italic',
                      }}>
                        Edit the option text above first, then pick the correct one here.
                      </p>
                    </div>
                  </>
                )}
              </div>

            ) : (
              /* VIEW MODE */
              <div>
                {q.type === 'flashcard' ? (
                  <>
                    <div style={{
                      fontWeight: '600',
                      fontSize: '1rem',
                      marginBottom: '6px',
                      color: 'var(--text)',
                    }}>
                      {q.front}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      {q.back}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      fontWeight: '600',
                      fontSize: '1rem',
                      marginBottom: '10px',
                      color: 'var(--text)',
                    }}>
                      {q.question}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(q.options || []).map((opt, i) => {
                        const isCorrect = opt === q.correctAnswer;
                        return (
                          <div key={i} style={{
                            display: 'flex',
                            gap: '8px',
                            fontSize: '0.88rem',
                            color: isCorrect ? '#6a9f5a' : 'var(--text-muted)',
                            fontWeight: isCorrect ? '600' : '400',
                          }}>
                            <span style={{
                              fontFamily: 'var(--font-display)',
                              fontStyle: 'italic',
                              color: isCorrect ? '#6a9f5a' : 'var(--text-faint)',
                              flexShrink: 0,
                              width: '18px',
                              textAlign: 'center',
                            }}>
                              {i + 1}.
                            </span>
                            {opt}
                            {isCorrect && (
                              <span style={{ marginLeft: '2px', opacity: 0.8 }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        ))}

        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <p className="empty-state-quote">No items match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}