import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';

export default function SubjectDashboard() {
  const { subjectId } = useParams();
  const [subject, setSubject]               = useState(null);
  const [totalCount, setTotalCount]         = useState(0);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const [mcqCount, setMcqCount]             = useState(0);
  const [tags, setTags]                     = useState([]);       // sorted unique tags
  const [activeTag, setActiveTag]           = useState('');       // '' = All
  const [quizLimit, setQuizLimit]           = useState(10);
  const [timeLimit, setTimeLimit]           = useState(5);
  const [rawQuestions, setRawQuestions]     = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const docSnap = await getDoc(doc(db, 'subjects', subjectId));
      if (docSnap.exists()) setSubject({ id: docSnap.id, ...docSnap.data() });

      const qSnap = await getDocs(
        collection(db, 'subjects', subjectId, 'questions')
      );

      let fCount = 0, mCount = 0, allQ = [];
      const tagSet = new Set();

      qSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.type === 'flashcard') fCount++;
        if (data.type === 'mcq')       mCount++;
        if (data.tag)                  tagSet.add(data.tag);
        const { id: _id, ...clean } = data;
        allQ.push(clean);
      });

      // Sort tags naturally so "Module 2" < "Module 10"
      const sortedTags = [...tagSet].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );

      setRawQuestions(allQ);
      setTotalCount(qSnap.docs.length);
      setFlashcardCount(fCount);
      setMcqCount(mCount);
      setTags(sortedTags);
      setQuizLimit(Math.min(mCount, 10));
    };
    fetchData();
  }, [subjectId]);

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify(rawQuestions, null, 2)],
      { type: 'application/json' }
    );
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `${subjectId}-synapse-export.json`;
    link.click();
  };

  // Build URL query string — appends tag param when a filter is active
  const studyUrl = (mode, extra = '') => {
    const params = new URLSearchParams();
    if (activeTag) params.set('tag', activeTag);
    if (extra)     extra.split('&').forEach((p) => { const [k,v] = p.split('='); params.set(k,v); });
    const qs = params.toString();
    return `/study/${subjectId}/${mode}${qs ? `?${qs}` : ''}`;
  };

  if (!subject) {
    return (
      <div className="empty-state">
        <span className="empty-state-glyph">⧗</span>
        <p className="empty-state-quote">Loading the dashboard…</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '640px', margin: '0 auto' }}>

      {/* ── Hero ── */}
      <div className="dashboard-hero">
        <div className="dashboard-title">{subject.title}</div>
        {subject.description && (
          <div className="dashboard-desc">{subject.description}</div>
        )}

        <div className="dashboard-stats">
          <div className="stat-chip">
            <span className="stat-chip-value">{totalCount}</span>
            <span className="stat-chip-label">Total Items</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-chip">
            <span className="stat-chip-value">{flashcardCount}</span>
            <span className="stat-chip-label">Flashcards</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-chip">
            <span className="stat-chip-value">{mcqCount}</span>
            <span className="stat-chip-label">MCQs</span>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px',
        }}>
          <Link to={`/manage/${subjectId}`}>
            <button className="btn-accent" style={{ padding: '7px 16px', fontSize: '0.8rem' }}>
              Edit Items
            </button>
          </Link>
          <button
            className="btn-ghost"
            onClick={handleExport}
            style={{ padding: '7px 16px', fontSize: '0.8rem' }}
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* ── Tag filter ── */}
      {tags.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: '10px',
          }}>
            Filter by tag
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>

            {/* All */}
            <button
              onClick={() => setActiveTag('')}
              style={{
                padding: '5px 14px',
                fontSize: '0.78rem',
                fontWeight: activeTag === '' ? 700 : 400,
                background: activeTag === '' ? 'var(--primary)' : 'transparent',
                border: `1px solid ${activeTag === '' ? 'var(--accent-dim)' : 'var(--border-light)'}`,
                color: activeTag === '' ? '#e8e4c9' : 'var(--text-muted)',
                borderRadius: '2px',
                transition: 'all 0.15s',
              }}
            >
              All
            </button>

            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(activeTag === t ? '' : t)}
                style={{
                  padding: '5px 14px',
                  fontSize: '0.78rem',
                  fontWeight: activeTag === t ? 700 : 400,
                  background: activeTag === t ? 'var(--primary)' : 'transparent',
                  border: `1px solid ${activeTag === t ? 'var(--accent-dim)' : 'var(--border-light)'}`,
                  color: activeTag === t ? '#e8e4c9' : 'var(--text-muted)',
                  borderRadius: '2px',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTag && (
            <p style={{
              marginTop: '10px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}>
              Study modes below will only include items tagged "{activeTag}".
            </p>
          )}
        </div>
      )}

      {/* ── Study Modes ── */}
      <div className="section-heading" style={{ marginBottom: '14px' }}>
        <h3>Study Modes</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>

        {flashcardCount > 0 && (
          <Link to={studyUrl('spaced')} className="mode-card mode-flashcard">
            <div className="mode-glyph">◈</div>
            <div className="mode-body">
              <div className="mode-title">Spaced Review</div>
              <div className="mode-desc">
                Review cards using spaced repetition — Again, Good, Easy.
              </div>
            </div>
            <div className="mode-badge">{flashcardCount} cards</div>
            <div className="mode-arrow">›</div>
          </Link>
        )}

        <Link to={studyUrl('flashcards')} className="mode-card mode-flashcard">
          <div className="mode-glyph">▭</div>
          <div className="mode-body">
            <div className="mode-title">Review Flashcards</div>
            <div className="mode-desc">Free-form review of all cards, unscheduled.</div>
          </div>
          <div className="mode-badge">{flashcardCount} cards</div>
          <div className="mode-arrow">›</div>
        </Link>

        <Link to={studyUrl('mcq')} className="mode-card mode-mcq">
          <div className="mode-glyph">◎</div>
          <div className="mode-body">
            <div className="mode-title">Practice MCQs</div>
            <div className="mode-desc">Continuous multiple-choice review, unscored.</div>
          </div>
          <div className="mode-badge">{mcqCount} questions</div>
          <div className="mode-arrow">›</div>
        </Link>

      </div>

      {/* ── Assessment ── */}
      <div className="section-heading" style={{ marginBottom: '14px' }}>
        <h3>Assessment</h3>
        <span className="section-count">Formal · Graded · Timed</span>
      </div>

      <div
        className="mode-card mode-exam"
        style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '4px' }}>
          <div className="mode-glyph">✦</div>
          <div className="mode-body">
            <div className="mode-title" style={{ color: 'var(--accent)' }}>
              Test Your Knowledge
            </div>
            <div className="mode-desc">
              A formal, graded examination drawn from the MCQ pool.
              {activeTag && (
                <span style={{ color: 'var(--accent-dim)', marginLeft: '6px' }}>
                  · {activeTag} only
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="exam-config">
          <div className="exam-config-field">
            <label>Items</label>
            <input
              type="number"
              min="1"
              max={mcqCount}
              value={quizLimit}
              onChange={(e) => setQuizLimit(Number(e.target.value))}
            />
          </div>
          <div className="exam-config-field">
            <label>Minutes</label>
            <input
              type="number"
              min="1"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
            />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Link to={studyUrl('quiz', `limit=${quizLimit}&time=${timeLimit}`)}>
              <button disabled={mcqCount === 0 || quizLimit < 1}>
                Begin Exam →
              </button>
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}