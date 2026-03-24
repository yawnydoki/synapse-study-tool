import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export default function DataEntry() {
  const [subjects, setSubjects]       = useState([]);
  const [subjectId, setSubjectId]     = useState('');
  const [type, setType]               = useState('flashcard');
  const [tag, setTag]                 = useState('');
  const [existingTags, setExistingTags] = useState([]);  // tags already used in this subject

  // Flashcard fields
  const [front, setFront]             = useState('');
  const [back, setBack]               = useState('');

  // MCQ fields
  const [question, setQuestion]       = useState('');
  const [optionCount, setOptionCount] = useState(4);
  const [options, setOptions]         = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      const snap = await getDocs(collection(db, 'subjects'));
      const subs = snap.docs.map((d) => ({ id: d.id, title: d.data().title }));
      setSubjects(subs);
      if (subs.length > 0) setSubjectId(subs[0].id);
    };
    fetchSubjects();
  }, []);

  // When subject changes, fetch existing tags for that subject
  useEffect(() => {
    if (!subjectId) return;
    const fetchTags = async () => {
      const snap = await getDocs(collection(db, 'subjects', subjectId, 'questions'));
      const tagSet = new Set();
      snap.docs.forEach((d) => {
        const t = d.data().tag;
        if (t) tagSet.add(t);
      });
      const sorted = [...tagSet].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );
      setExistingTags(sorted);
      setTag(''); // reset tag when subject changes
    };
    fetchTags();
  }, [subjectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return;

    const colRef = collection(db, 'subjects', subjectId, 'questions');
    const tagValue = tag.trim() || null;

    const base = tagValue ? { tag: tagValue } : {};

    if (type === 'flashcard') {
      await addDoc(colRef, { ...base, type: 'flashcard', front, back });
    } else {
      await addDoc(colRef, { ...base, type: 'mcq', question, options: options.slice(0, optionCount), correctAnswer });
    }

    // Reset fields but keep subject, type, and tag for rapid entry
    setFront(''); setBack('');
    setQuestion(''); setOptions(['', '', '', '']); setCorrectAnswer('');

    // If this was a new tag, add it to the existing list
    if (tagValue && !existingTags.includes(tagValue)) {
      setExistingTags((prev) =>
        [...prev, tagValue].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        )
      );
    }

    alert('Added to Synapse!');
  };

  const handleOptionCount = (count) => {
    setOptionCount(count);
    setOptions((prev) => {
      const next = [...prev];
      // Grow or shrink the array
      while (next.length < count) next.push('');
      return next.slice(0, count);
    });
    setCorrectAnswer(''); // reset since options changed
  };

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex', flexDirection: 'column', gap: '18px',
      maxWidth: '480px', margin: '0 auto',
    }}>
      <h2 style={{ margin: 0 }}>Add New Item</h2>

      {/* Subject */}
      <div>
        <label>Subject</label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          style={{ marginTop: '6px' }}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      {/* Type */}
      <div>
        <label>Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ marginTop: '6px' }}
        >
          <option value="flashcard">Flashcard</option>
          <option value="mcq">Multiple Choice</option>
        </select>
      </div>

      {/* Tag */}
      <div>
        <label>
          Tag{' '}
          <span style={{
            color: 'var(--text-faint)', fontWeight: 400,
            textTransform: 'none', letterSpacing: 0,
          }}>
            (optional)
          </span>
        </label>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. Module 1"
          list="existing-tags"
          style={{ marginTop: '6px' }}
        />
        {/* Datalist gives autocomplete from existing tags — no extra UI needed */}
        <datalist id="existing-tags">
          {existingTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        {existingTags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {existingTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                style={{
                  padding: '3px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.8px',
                  background: tag === t ? 'var(--primary)' : 'transparent',
                  border: `1px solid ${tag === t ? 'var(--accent-dim)' : 'var(--border-light)'}`,
                  color: tag === t ? '#e8e4c9' : 'var(--text-muted)',
                  borderRadius: '2px',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Flashcard fields */}
      {type === 'flashcard' && (
        <>
          <div>
            <label>Front</label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Question or term"
              required
              style={{ marginTop: '6px', minHeight: '80px' }}
            />
          </div>
          <div>
            <label>Back</label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Answer or definition"
              required
              style={{ marginTop: '6px', minHeight: '80px' }}
            />
          </div>
        </>
      )}

      {/* MCQ fields */}
      {type === 'mcq' && (
        <>
          <div>
            <label>Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question text"
              required
              style={{ marginTop: '6px', minHeight: '80px' }}
            />
          </div>
          {/* Option count selector */}
          <div>
            <label>Number of Options</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleOptionCount(n)}
                  style={{
                    padding: '6px 16px',
                    fontSize: '0.82rem',
                    background: optionCount === n ? 'var(--primary)' : 'transparent',
                    border: `1px solid ${optionCount === n ? 'var(--accent-dim)' : 'var(--border-light)'}`,
                    color: optionCount === n ? '#e8e4c9' : 'var(--text-muted)',
                    borderRadius: '2px',
                    transition: 'all 0.15s',
                  }}
                >
                  {n === 2 ? '2 — True / False' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Quick-fill for True/False */}
          {optionCount === 2 && (
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: '0.8rem', padding: '7px 14px', alignSelf: 'flex-start' }}
              onClick={() => setOptions(['True', 'False'])}
            >
              Fill True / False
            </button>
          )}

          {options.slice(0, optionCount).map((opt, i) => (
            <div key={i}>
              <label>Option {i + 1}</label>
              <input
                value={opt}
                onChange={(e) => handleOptionChange(i, e.target.value)}
                placeholder={optionCount === 2 ? (i === 0 ? 'True' : 'False') : `Option ${i + 1}`}
                required
                style={{ marginTop: '6px' }}
              />
            </div>
          ))}
          <div>
            <label>Correct Answer</label>
            <select
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              required
              style={{ marginTop: '6px' }}
            >
              <option value="">— select the correct option —</option>
              {options.slice(0, optionCount).map((opt, i) => (
                <option key={i} value={opt}>{i + 1}. {opt}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <button type="submit" disabled={!subjectId} style={{ marginTop: '4px' }}>
        Add to Synapse
      </button>
    </form>
  );
}