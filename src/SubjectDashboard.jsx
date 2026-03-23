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

      let fCount = 0, mCount = 0, dCount = 0, allQ = [];

      qSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.type === 'flashcard') fCount++;
        if (data.type === 'mcq') mCount++;
        const { id: _id, ...clean } = data;
        allQ.push(clean);
      });

      setRawQuestions(allQ);
      setTotalCount(qSnap.docs.length);
      setFlashcardCount(fCount);
      setMcqCount(mCount);
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
          <Link to={`/manage/${subject.id}`}>
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

      {/* ── Study Modes ── */}
      <div className="section-heading" style={{ marginBottom: '14px' }}>
        <h3>Study Modes</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>

        {flashcardCount > 0 && (
          <Link
            to={`/study/${subject.id}/spaced`}
            className="mode-card mode-flashcard"
          >
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

        {/* Free-form flashcard review */}
        <Link
          to={`/study/${subject.id}/flashcards`}
          className="mode-card mode-flashcard"
        >
          <div className="mode-glyph">▭</div>
          <div className="mode-body">
            <div className="mode-title">Review Flashcards</div>
            <div className="mode-desc">
              Free-form review of all cards, unscheduled.
            </div>
          </div>
          <div className="mode-badge">{flashcardCount} cards</div>
          <div className="mode-arrow">›</div>
        </Link>

        {/* MCQ practice */}
        <Link
          to={`/study/${subject.id}/mcq`}
          className="mode-card mode-mcq"
        >
          <div className="mode-glyph">◎</div>
          <div className="mode-body">
            <div className="mode-title">Practice MCQs</div>
            <div className="mode-desc">
              Continuous multiple-choice review, unscored.
            </div>
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
            <Link to={`/study/${subject.id}/quiz?limit=${quizLimit}&time=${timeLimit}`}>
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