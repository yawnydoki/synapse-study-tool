import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const SUBJECT_PALETTE = [
  { color: '#b5986d' },
  { color: '#8a7aaa' },
  { color: '#5a8c7f' },
  { color: '#a06040' },
  { color: '#6a82a0' },
  { color: '#9a6070' },
];

const GLYPHS = ['✦', '❧', '☽', '§', '⚘', '⊕', '⁂', '⌘'];

export default function Home() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetchSubjects = async () => {
      const snapshot = await getDocs(collection(db, 'subjects'));
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Sort: subjects with lastStudied first (most recent at top),
      // never-studied subjects fall to the bottom sorted alphabetically
      data.sort((a, b) => {
        const aTime = a.lastStudied?.toMillis?.() ?? a.lastStudied ?? null;
        const bTime = b.lastStudied?.toMillis?.() ?? b.lastStudied ?? null;
        if (aTime && bTime) return bTime - aTime;          // both studied — most recent first
        if (aTime)          return -1;                     // a studied, b not — a goes up
        if (bTime)          return  1;                     // b studied, a not — b goes up
        return a.title.localeCompare(b.title);             // neither studied — alphabetical
      });

      setSubjects(data);
      setLoading(false);
    };
    fetchSubjects();
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <span className="empty-state-glyph">⧗</span>
        <p className="empty-state-quote">Consulting the archives…</p>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="empty-state fade-in">
        <span className="empty-state-glyph">❧</span>
        <p className="empty-state-quote">
          "The mind is not a vessel to be filled, but a fire to be kindled."
        </p>
        <p className="empty-state-attr">— Plutarch</p>
        <div style={{ marginTop: '28px' }}>
          <Link to="/add-subject">
            <button>Begin Your First Subject</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '28px',
      }}>
        <h2 style={{ margin: 0 }}>Your Subjects</h2>
        <span className="label-ornate">
          {subjects.length} {subjects.length === 1 ? 'volume' : 'volumes'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {subjects.map((sub, i) => {
          const palette = SUBJECT_PALETTE[i % SUBJECT_PALETTE.length];
          const glyph   = GLYPHS[i % GLYPHS.length];

          return (
            <Link
              key={sub.id}
              to={`/subject/${sub.id}`}
              className="subject-card"
              style={{ '--card-accent': palette.color }}
            >
              <div className="subject-card-glyph" style={{ color: palette.color }}>
                {glyph}
              </div>

              <div className="subject-card-body">
                <div className="subject-card-title" style={{ color: palette.color }}>
                  {sub.title}
                </div>
                {sub.description && (
                  <div className="subject-card-desc">{sub.description}</div>
                )}
              </div>

              <div className="subject-card-arrow">›</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}