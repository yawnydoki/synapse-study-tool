import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from './firebase';
import {
  collection, getDocs, doc,
  deleteDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import Flashcard from './Flashcard';
import MultipleChoice from './MultipleChoice';
import { calculateNextReview, isDue, sortByDue } from './spacedRepetition';

// ── Quiz remarks ──────────────────────────────────────────────────
const REMARKS = [
  { floor: 90, text: 'Exemplary. The material is yours.'                },
  { floor: 75, text: 'Well done. A solid command of the subject.'       },
  { floor: 60, text: 'Satisfactory. A second reading would not go amiss.' },
  { floor: 40, text: 'Needs revision. Return to your notes.'            },
  { floor:  0, text: 'The work begins anew. Do not be discouraged.'     },
];
function getRemark(pct) {
  return REMARKS.find((r) => pct >= r.floor)?.text ?? REMARKS[REMARKS.length - 1].text;
}

// ── Keyboard legend ───────────────────────────────────────────────
function KeyLegend({ items }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: '14px',
      marginTop: '20px',
    }}>
      {items.map(({ key, label }) => (
        <span key={key} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-body)',
        }}>
          <kbd style={{
            fontFamily: 'inherit',
            fontSize: '0.7rem',
            padding: '2px 6px',
            border: '1px solid var(--border-light)',
            borderRadius: '3px',
            background: 'var(--bg-deep)',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}>
            {key}
          </kbd>
          <span style={{ fontStyle: 'italic' }}>{label}</span>
        </span>
      ))}
    </div>
  );
}

// ── Flashcard session summary ─────────────────────────────────────
function FlashcardSummary({ total, elapsed, onContinue, dashboardPath, isSpaced }) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  // Any key to go to dashboard (spaced) or continue (free-form)
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!isSpaced) onContinue();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSpaced, onContinue]);

  return (
    <div className="card results-card fade-in">
      <div className="results-ornament">
        {isSpaced ? '— Review Complete —' : '— Pass Complete —'}
      </div>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '4rem',
        fontWeight: 900,
        color: 'var(--accent)',
        lineHeight: 1,
        margin: '16px 0 10px',
      }}>
        {total}
      </div>

      <p className="results-remark">
        {total === 1 ? 'card reviewed' : 'cards reviewed'}
      </p>
      <p className="results-sub" style={{ marginBottom: '32px' }}>
        Session time: {timeStr}
      </p>

      <div className="results-actions">
        {!isSpaced && (
          <button onClick={onContinue}>Another Pass →</button>
        )}
        <Link to={dashboardPath}>
          <button className={isSpaced ? '' : 'btn-ghost'}>Dashboard</button>
        </Link>
      </div>

      {!isSpaced && (
        <KeyLegend items={[{ key: 'Space / Enter', label: 'another pass' }]} />
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function StudyDeck() {
  const { subjectId, mode } = useParams();
  const [searchParams]       = useSearchParams();
  const limitParam           = searchParams.get('limit');
  const timeParam            = searchParams.get('time');

  const isSpaced = mode === 'spaced';

  const [questions, setQuestions]             = useState([]);
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [loading, setLoading]                 = useState(true);

  // Quiz state
  const [score, setScore]                     = useState(0);
  const [isFinished, setIsFinished]           = useState(false);
  const [timeLeft, setTimeLeft]               = useState(
    timeParam ? Number(timeParam) * 60 : null
  );
  const [missedQuestions, setMissedQuestions] = useState([]);
  const [showAnswers, setShowAnswers]         = useState(false);

  // Flashcard session summary
  const [showSummary, setShowSummary]         = useState(false);
  const [sessionTotal, setSessionTotal]       = useState(0);
  const sessionStartRef                       = useRef(Date.now());

  // ── Fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchQuestions = async () => {
      const snap = await getDocs(
        collection(db, 'subjects', subjectId, 'questions')
      );
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (mode === 'flashcards' || isSpaced) {
        data = data.filter((q) => q.type === 'flashcard');
      }
      if (mode === 'mcq' || mode === 'quiz') {
        data = data.filter((q) => q.type === 'mcq');
      }

      if (isSpaced) {
        const due = sortByDue(data.filter(isDue));
        setQuestions(due);
      } else {
        for (let i = data.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [data[i], data[j]] = [data[j], data[i]];
        }
        if (mode === 'quiz' && limitParam) data = data.slice(0, Number(limitParam));
        setQuestions(data);
      }

      setLoading(false);
      sessionStartRef.current = Date.now();

      updateDoc(doc(db, 'subjects', subjectId), {
        lastStudied: serverTimestamp(),
      }).catch(() => {});
    };
    fetchQuestions();
  }, [subjectId, mode, limitParam]);

  // ── Timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === null || isFinished) return;
    if (timeLeft <= 0) { setIsFinished(true); return; }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft, isFinished]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Handlers (useCallback so keyboard effect sees fresh values) ───
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  const handleNext = useCallback((isCorrect = false) => {
    if (!isCorrect && mode === 'quiz') {
      setMissedQuestions((prev) => [...prev, questions[currentIndex]]);
    }
    if (mode === 'quiz' && isCorrect) setScore((s) => s + 1);

    const isLast = currentIndex === questions.length - 1;

    if (!isLast) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    if (mode === 'quiz') {
      setIsFinished(true);
    } else if (mode === 'flashcards') {
      setSessionTotal(questions.length);
      setShowSummary(true);
    } else {
      setCurrentIndex(0);
      setQuestions((q) => [...q].sort(() => Math.random() - 0.5));
    }
  }, [currentIndex, questions, mode]);

  const handleRate = useCallback(async (rating) => {
    const card     = questions[currentIndex];
    const srFields = calculateNextReview(card, rating);
    updateDoc(
      doc(db, 'subjects', subjectId, 'questions', card.id),
      srFields
    ).catch(() => {});

    const isLast = currentIndex === questions.length - 1;
    if (!isLast) {
      setCurrentIndex((i) => i + 1);
    } else {
      setSessionTotal(questions.length);
      setShowSummary(true);
    }
  }, [currentIndex, questions, subjectId]);

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this item?')) return;
    const item    = questions[currentIndex];
    await deleteDoc(doc(db, 'subjects', subjectId, 'questions', item.id));
    const updated = questions.filter((q) => q.id !== item.id);
    setQuestions(updated);
    if (updated.length === 0) setIsFinished(true);
    else if (currentIndex >= updated.length) setCurrentIndex(updated.length - 1);
  };

  const handleContinueFlashcards = useCallback(() => {
    setQuestions((q) => [...q].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setShowSummary(false);
    sessionStartRef.current = Date.now();
  }, []);

  const handleRetakeMissed = () => {
    setQuestions(missedQuestions);
    setMissedQuestions([]);
    setShowAnswers(false);
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    setTimeLeft(null);
  };

  // ── Keyboard handler ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (showSummary || isFinished || loading) return;

      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const item = questions[currentIndex];
      const isFlashcard = item?.type === 'flashcard';
      const isMCQ       = item?.type === 'mcq';

      switch (e.code) {
        // ── Navigation ──
        case 'ArrowRight':
        case 'Enter':
          // Enter advances flashcards (not spaced — rating buttons handle that)
          if (!isSpaced && isFlashcard) { e.preventDefault(); handleNext(); }
          break;

        case 'ArrowLeft':
        case 'Backspace':
          if (!isSpaced && isFlashcard && !isMCQ) {
            e.preventDefault();
            handlePrevious();
          }
          break;

        // ── MCQ options 1-4 already handled in MultipleChoice.jsx ──
        // ── SR ratings 1-3 already handled in Flashcard.jsx ──

        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    currentIndex, questions, mode, isSpaced,
    showSummary, isFinished, loading,
    handleNext, handlePrevious,
  ]);

  // ── Quiz results keyboard ─────────────────────────────────────────
  useEffect(() => {
    if (!isFinished || mode !== 'quiz') return;
    const handler = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFinished, mode]);

  // ── Guards ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="empty-state">
        <span className="empty-state-glyph">⧗</span>
        <p className="empty-state-quote">Preparing your session…</p>
      </div>
    );
  }

  if (isSpaced && questions.length === 0) {
    return (
      <div className="empty-state fade-in">
        <span className="empty-state-glyph">✦</span>
        <p className="empty-state-quote">Nothing due for review. Come back later.</p>
        <p className="empty-state-attr" style={{ marginTop: '8px' }}>
          All cards are scheduled for a future date.
        </p>
        <div style={{ marginTop: '28px' }}>
          <Link to={`/subject/${subjectId}`}>
            <button className="btn-ghost">Dashboard</button>
          </Link>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="empty-state fade-in">
        <span className="empty-state-glyph">∅</span>
        <p className="empty-state-quote">No {mode} items found for this subject.</p>
        <div style={{ marginTop: '24px' }}>
          <Link to={`/subject/${subjectId}`}>
            <button className="btn-ghost">Return to Dashboard</button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Session summary ───────────────────────────────────────────────
  if (showSummary) {
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    return (
      <FlashcardSummary
        total={sessionTotal}
        elapsed={elapsed}
        onContinue={handleContinueFlashcards}
        dashboardPath={`/subject/${subjectId}`}
        isSpaced={isSpaced}
      />
    );
  }

  // ── Quiz results ──────────────────────────────────────────────────
  if (isFinished && mode === 'quiz') {
    const pct    = Math.round((score / questions.length) * 100);
    const passed = pct >= 60;

    return (
      <div className="card results-card fade-in">
        <div className="results-ornament">— Examination Complete —</div>
        <div className={`results-grade ${passed ? 'pass' : 'fail'}`}>{pct}%</div>
        <p className="results-remark">{getRemark(pct)}</p>
        <p className="results-sub">
          {score} correct out of {questions.length} questions
          {timeLeft !== null && timeLeft <= 0 && (
            <span style={{ color: '#9f5a5a' }}> · Time expired</span>
          )}
        </p>

        <div className="results-actions">
          {missedQuestions.length > 0 && (
            <button onClick={handleRetakeMissed}>
              Retake Missed ({missedQuestions.length})
            </button>
          )}
          <button className="btn-ghost" onClick={() => window.location.reload()}>
            Retake Full Exam
          </button>
          <Link to={`/subject/${subjectId}`}>
            <button className="btn-ghost">Dashboard</button>
          </Link>
        </div>

        <KeyLegend items={[{ key: 'Space / Enter', label: 'retake full exam' }]} />

        {missedQuestions.length > 0 && (
          <div style={{ marginTop: '8px', textAlign: 'left' }}>
            <div className="missed-header">
              <h3>Missed Questions</h3>
              <button
                className="btn-ghost"
                onClick={() => setShowAnswers((v) => !v)}
                style={{ padding: '5px 12px', fontSize: '0.78rem' }}
              >
                {showAnswers ? 'Hide Answers' : 'Reveal Answers'}
              </button>
            </div>
            <div className="missed-list">
              {missedQuestions.map((q, idx) => (
                <div key={idx} className="missed-item">
                  <div className="missed-item-q">{q.question}</div>
                  {showAnswers
                    ? <div className="missed-item-a">✓ {q.correctAnswer}</div>
                    : <div className="missed-item-hidden">Answer concealed…</div>
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Active study ──────────────────────────────────────────────────
  const currentItem = questions[currentIndex];
  const progress    = ((currentIndex + 1) / questions.length) * 100;
  const isFlashcard = currentItem?.type === 'flashcard';

  // Legend items change based on mode and card type
  const legendItems = isSpaced
    ? [
        { key: 'Space',   label: 'flip'  },
        { key: '1',       label: 'again' },
        { key: '2',       label: 'good'  },
        { key: '3',       label: 'easy'  },
      ]
    : isFlashcard
    ? [
        { key: 'Space',             label: 'flip'     },
        { key: '→ / Enter',         label: 'next'     },
        { key: '← / Backspace',     label: 'previous' },
      ]
    : [
        { key: '1 – 4', label: 'select option' },
      ];

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto' }} className="fade-in">

      {/* Progress bar */}
      <div className="progress-container">
        <div className="progress-row">
          <span className="progress-label">
            {isSpaced            ? 'Spaced review'
            : mode === 'quiz'    ? 'Examination in progress'
            : mode === 'flashcards' ? 'Reviewing flashcards'
            :                     'Practising MCQs'}
          </span>
          <span className="progress-fraction">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Top controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <Link to={`/subject/${subjectId}`}>
          <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
            ← Back
          </button>
        </Link>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {mode === 'quiz' && timeLeft !== null && (
            <span className={`timer${timeLeft < 60 ? ' urgent' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          )}
          {mode !== 'quiz' && !isSpaced && (
            <button
              className="btn-ghost"
              onClick={handleDelete}
              title="Delete this item"
              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Card */}
      {currentItem.type === 'mcq' ? (
        <MultipleChoice
          key={currentItem.id}
          question={currentItem.question}
          options={currentItem.options}
          correctAnswer={currentItem.correctAnswer}
          onNext={handleNext}
        />
      ) : (
        <>
          <Flashcard
            key={currentItem.id}
            front={currentItem.front}
            back={currentItem.back}
            spacedMode={isSpaced}
            onRate={isSpaced ? handleRate : undefined}
          />

          {!isSpaced && (
            <div className="flashcard-nav">
              {mode !== 'quiz' && (
                <button
                  className="btn-ghost"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  style={{ fontSize: '0.85rem' }}
                >
                  ← Previous
                </button>
              )}
              <button onClick={() => handleNext()} style={{ flex: 1 }}>
                {currentIndex === questions.length - 1
                  ? 'Finish Pass →'
                  : 'Next →'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Keyboard legend */}
      <KeyLegend items={legendItems} />

    </div>
  );
}