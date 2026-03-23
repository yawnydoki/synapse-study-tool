import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, getDocs, doc,
  deleteDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { useParams, Link, useNavigate } from 'react-router-dom';

export default function ManageSubject() {
  const { subjectId }                         = useParams();
  const navigate                              = useNavigate();
  const [questions, setQuestions]             = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [searchTerm, setSearchTerm]           = useState('');
  const [editingId, setEditingId]             = useState(null);
  const [editForm, setEditForm]               = useState({});
  const [dangerOpen, setDangerOpen]           = useState(false);
  const [deleting, setDeleting]               = useState(false);

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

  // ── Individual item handlers ──────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this item?')) return;
    await deleteDoc(doc(db, 'subjects', subjectId, 'questions', id));
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item, options: item.options ? [...item.options] : [] });
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

  // ── Bulk delete helpers ───────────────────────────────────────────
  const batchDelete = async (predicate = null) => {
    const snap     = await getDocs(collection(db, 'subjects', subjectId, 'questions'));
    const toDelete = predicate ? snap.docs.filter((d) => predicate(d.data())) : snap.docs;
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return toDelete.length;
  };

  const handleDeleteType = async (type) => {
    const count = questions.filter((q) => q.type === type).length;
    const label = type === 'flashcard' ? 'flashcards' : 'MCQs';
    if (!window.confirm(`Delete all ${count} ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    await batchDelete((data) => data.type === type);
    setQuestions((prev) => prev.filter((q) => q.type !== type));
    setDeleting(false);
  };

  const handleDeleteByTag = async (tag) => {
    const count = questions.filter((q) => q.tag === tag).length;
    if (!window.confirm(`Delete all ${count} items tagged "${tag}"? This cannot be undone.`)) return;
    setDeleting(true);
    await batchDelete((data) => data.tag === tag);
    setQuestions((prev) => prev.filter((q) => q.tag !== tag));
    setDeleting(false);
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(`Delete all ${questions.length} items? This cannot be undone.`)) return;
    setDeleting(true);
    await batchDelete();
    setQuestions([]);
    setDeleting(false);
  };

  const handleDeleteSubject = async () => {
    if (!window.confirm(`Permanently delete this entire subject and all its items? This cannot be undone.`)) return;
    setDeleting(true);
    await batchDelete();
    await deleteDoc(doc(db, 'subjects', subjectId));
    navigate('/');
  };

  // ── Derived ───────────────────────────────────────────────────────
  const filtered = questions.filter((q) => {
    const t = searchTerm.toLowerCase();
    return (
      q.front?.toLowerCase().includes(t) ||
      q.back?.toLowerCase().includes(t)  ||
      q.question?.toLowerCase().includes(t)
    );
  });

  const flashcardCount = questions.filter((q) => q.type === 'flashcard').length;
  const mcqCount       = questions.filter((q) => q.type === 'mcq').length;
  const tags           = [...new Set(questions.map((q) => q.tag).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

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

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px',
        gap: '10px',
      }}>
        <h2 style={{ margin: 0 }}>
          Manage <span style={{ color: 'var(--accent)' }}>{subjectId}</span>
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setDangerOpen((v) => !v)}
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              background: dangerOpen ? '#3a0f0f' : '#2a1515',
              border: `1px solid ${dangerOpen ? '#a04040' : '#6e2a2a'}`,
              color: '#c08080',
            }}
          >
            Delete
          </button>
          <Link to={`/subject/${subjectId}`}>
            <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>
              Back
            </button>
          </Link>
        </div>
      </div>

      {/* ── Danger zone panel ── */}
      {dangerOpen && (
        <div
          className="fade-in"
          style={{
            marginBottom: '24px',
            border: '1px solid #6e2a2a',
            borderRadius: 'var(--radius)',
            padding: '18px 20px',
            background: '#1a1010',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Delete by type */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleDeleteType('flashcard')}
              disabled={deleting || flashcardCount === 0}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.8rem',
                background: '#2a1515',
                border: '1px solid #6e2a2a',
                color: flashcardCount === 0 ? 'var(--text-faint)' : '#c08080',
              }}
            >
              Delete flashcards ({flashcardCount})
            </button>
            <button
              onClick={() => handleDeleteType('mcq')}
              disabled={deleting || mcqCount === 0}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.8rem',
                background: '#2a1515',
                border: '1px solid #6e2a2a',
                color: mcqCount === 0 ? 'var(--text-faint)' : '#c08080',
              }}
            >
              Delete MCQs ({mcqCount})
            </button>
          </div>

          {/* Delete by tag */}
          {tags.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: '#9f5a5a',
                marginBottom: '8px',
              }}>
                Delete by tag
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleDeleteByTag(t)}
                    disabled={deleting}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      background: '#2a1515',
                      border: '1px solid #6e2a2a',
                      color: '#c08080',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid #3a1a1a', margin: '2px 0' }} />

          {/* Delete all items */}
          <button
            onClick={handleDeleteAll}
            disabled={deleting || questions.length === 0}
            style={{
              padding: '8px 12px',
              fontSize: '0.8rem',
              background: '#2a1515',
              border: '1px solid #8c3636',
              color: questions.length === 0 ? 'var(--text-faint)' : '#d09090',
            }}
          >
            Delete all {questions.length} items
          </button>

          {/* Delete subject */}
          <button
            onClick={handleDeleteSubject}
            disabled={deleting}
            style={{
              padding: '8px 12px',
              fontSize: '0.8rem',
              background: '#3a0f0f',
              border: '1px solid #a04040',
              color: '#e09090',
              fontWeight: 700,
            }}
          >
            {deleting ? 'Deleting…' : 'Delete entire subject'}
          </button>
        </div>
      )}

      {/* ── Search ── */}
      <div className="search-wrapper">
        <span className="search-icon" style={{ fontStyle: 'normal', fontSize: '0.9rem' }}>⌕</span>
        <input
          type="text"
          placeholder="Search terms, questions, definitions…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ── Item list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map((q) => (
          <div key={q.id} className="manage-item">

            <div className="manage-item-header">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="manage-item-type">
                  {q.type === 'flashcard' ? 'Flashcard' : 'MCQ'}
                </span>
                {q.tag && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    color: 'var(--accent-dim)',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    padding: '2px 8px',
                    borderRadius: '2px',
                  }}>
                    {q.tag}
                  </span>
                )}
              </div>
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
                                borderColor: opt.trim() === editForm.correctAnswer?.trim()
                                  ? 'var(--accent-dim)' : undefined,
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
                          <option key={i} value={opt}>{i + 1}. {opt}</option>
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
                <div>
                  <label>Tag</label>
                  <input
                    value={editForm.tag || ''}
                    onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
                    placeholder="e.g. Module 1 (optional)"
                    style={{ marginTop: '6px' }}
                  />
                </div>
              </div>

            ) : (
              /* VIEW MODE */
              <div>
                {q.type === 'flashcard' ? (
                  <>
                    <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '6px', color: 'var(--text)' }}>
                      {q.front}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      {q.back}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '10px', color: 'var(--text)' }}>
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
                            {isCorrect && <span style={{ marginLeft: '2px', opacity: 0.8 }}>✓</span>}
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