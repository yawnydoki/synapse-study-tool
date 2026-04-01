import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';

// ── Schema ────────────────────────────────────────────────────────
// Valid item shapes:
//   { type: 'flashcard', front: string, back: string }
//   { type: 'mcq', question: string, options: string[2-4], correctAnswer: string }

function validateItem(item, index) {
  const errors = [];

  if (!item || typeof item !== 'object') {
    return { valid: false, errors: ['Not an object'] };
  }

  if (!['flashcard', 'mcq'].includes(item.type)) {
    errors.push(`type must be "flashcard" or "mcq", got: ${JSON.stringify(item.type)}`);
  }

  if (item.type === 'flashcard') {
    if (!item.front || typeof item.front !== 'string' || !item.front.trim())
      errors.push('"front" is missing or empty');
    if (!item.back || typeof item.back !== 'string' || !item.back.trim())
      errors.push('"back" is missing or empty');
  }

  if (item.type === 'mcq') {
    if (!item.question || typeof item.question !== 'string' || !item.question.trim())
      errors.push('"question" is missing or empty');
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 4)
      errors.push('"options" must be an array of 2 to 4 strings');
    else if (item.options.some((o) => typeof o !== 'string' || !o.trim()))
      errors.push('all options must be non-empty strings');
    if (!item.correctAnswer || typeof item.correctAnswer !== 'string' || !item.correctAnswer.trim())
      errors.push('"correctAnswer" is missing or empty');
    else if (Array.isArray(item.options) && !item.options.includes(item.correctAnswer))
      errors.push('"correctAnswer" does not match any option exactly');
  }

  return { valid: errors.length === 0, errors };
}

// ── Prompt template ───────────────────────────────────────────────
const PROMPT_TEMPLATE = `Generate a JSON array of study items from the provided source material.

RULES:
- Output ONLY the raw JSON array. No explanation, no markdown, no code fences.
- Every item must be either a flashcard or an MCQ.
- Do not mix up the schemas. Follow them exactly.

FLASHCARD SCHEMA:
{
  "type": "flashcard",
  "front": "The question or term",
  "back": "The answer or definition",
  "tag": "Module 1"  (optional)
}

MCQ SCHEMA:
{
  "type": "mcq",
  "question": "The full question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],  (2 to 4 options)
  "correctAnswer": "Option A",
  "tag": "Module 1"  (optional)
}

REQUIREMENTS:
- "correctAnswer" must be an exact copy of one of the strings in "options"
- options array must have between 2 and 4 items
- For True/False questions use exactly 2 options: ["True", "False"]
- All fields are required — never omit any

EXAMPLE OUTPUT (2 items):
[
  {
    "type": "flashcard",
    "front": "What is photosynthesis?",
    "back": "The process by which plants convert sunlight into glucose using CO2 and water."
  },
  {
    "type": "mcq",
    "question": "Which organelle is responsible for photosynthesis?",
    "options": ["Mitochondria", "Chloroplast", "Ribosome", "Nucleus"],
    "correctAnswer": "Chloroplast"
  }
]

Now generate [NUMBER] items from the following material:`;

// ── Duplicate detection helpers ───────────────────────────────────
function normalise(str) {
  return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getQuestion(item) {
  return item.type === 'flashcard' ? item.front : item.question;
}

function getAnswer(item) {
  return item.type === 'flashcard' ? item.back : item.correctAnswer;
}

// Returns 'exact' | 'conflict' | null
function checkDuplicate(incoming, existing) {
  const inQ = normalise(getQuestion(incoming));
  const exQ = normalise(getQuestion(existing));
  if (inQ !== exQ || incoming.type !== existing.type) return null;
  const inA = normalise(getAnswer(incoming));
  const exA = normalise(getAnswer(existing));
  return inA === exA ? 'exact' : 'conflict';
}

// ── Component ─────────────────────────────────────────────────────
export default function BulkImport() {
  const [subjects, setSubjects]     = useState([]);
  const [subjectId, setSubjectId]   = useState('');
  const [jsonInput, setJsonInput]   = useState('');
  const [parsed, setParsed]         = useState(null);   // null | { items, results }
  const [status, setStatus]         = useState(null);   // null | { type, message }
  const [uploading, setUploading]   = useState(false);
  const [resolutions, setResolutions] = useState({});  // index -> 'incoming' | 'existing' | 'both'
  const [copied, setCopied]         = useState(false);
  const [tag, setTag]                 = useState('');
  const [existingTags, setExistingTags] = useState([]);
  const [promptUnlocked, setPromptUnlocked] = useState(
    () => localStorage.getItem('synapse_prompt_unlocked') === 'true'
  );
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseError, setPassphraseError] = useState(false);
  const [showPassphraseInput, setShowPassphraseInput] = useState(false);

  useEffect(() => {
    const fetchSubjects = async () => {
      const snap = await getDocs(collection(db, 'subjects'));
      const subs = snap.docs.map((d) => ({ id: d.id, title: d.data().title }));
      setSubjects(subs);
      if (subs.length > 0) setSubjectId(subs[0].id);
    };
    fetchSubjects();
  }, []);

  // Fetch existing tags for the selected subject
  useEffect(() => {
    if (!subjectId) return;
    const fetchTags = async () => {
      const snap = await getDocs(collection(db, 'subjects', subjectId, 'questions'));
      const tagSet = new Set();
      snap.docs.forEach((d) => {
        const t = d.data().tag;
        if (t) tagSet.add(t);
      });
      setExistingTags(
        [...tagSet].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        )
      );
      setTag(''); // reset tag when subject changes
    };
    fetchTags();
  }, [subjectId]);

  // ── Copy prompt ───────────────────────────────────────────────────
  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(PROMPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passphraseInput === 'prompt') {
      localStorage.setItem('synapse_prompt_unlocked', 'true');
      setPromptUnlocked(true);
      setPassphraseError(false);
      setPassphraseInput('');
    } else {
      setPassphraseError(true);
      setPassphraseInput('');
    }
  };

  // ── Parse & validate ──────────────────────────────────────────────
  const handleParse = async () => {
    setStatus(null);
    setParsed(null);

    if (!jsonInput.trim()) {
      setStatus({ type: 'error', message: 'Paste your JSON first.' });
      return;
    }

    let items;
    try {
      // Strip accidental markdown code fences if AI added them
      const cleaned = jsonInput
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      items = JSON.parse(cleaned);
    } catch (e) {
      setStatus({ type: 'error', message: `JSON parse error: ${e.message}` });
      return;
    }

    if (!Array.isArray(items)) {
      setStatus({ type: 'error', message: 'Input must be a JSON array.' });
      return;
    }

    // Fetch existing questions for duplicate detection
    let existing = [];
    try {
      const snap = await getDocs(collection(db, 'subjects', subjectId, 'questions'));
      existing = snap.docs.map((d) => d.data());
    } catch (_) {}

    const results = items.map((item, i) => {
      const validation = validateItem(item, i);

      // Only check duplicates for valid items
      let dupStatus = null;    // null | 'exact' | 'conflict'
      let existingMatch = null;

      if (validation.valid) {
        for (const ex of existing) {
          const result = checkDuplicate(item, ex);
          if (result) {
            dupStatus     = result;
            existingMatch = ex;
            break;
          }
        }
      }

      return { item, index: i, dupStatus, existingMatch, ...validation };
    });

    // Collect tags that were already present in the JSON
    const detectedTags = [...new Set(
      items.map((item) => item?.tag?.trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    setResolutions({});
    setParsed({ items, results, detectedTags });
  };

  // ── Upload valid items ────────────────────────────────────────────
  const handleUpload = async () => {
    if (!subjectId || !parsed) return;

    // Gather items to upload:
    //  - valid + no duplicate  → always upload
    //  - exact duplicate       → skip
    //  - conflict + 'incoming' → upload incoming
    //  - conflict + 'both'     → upload incoming (existing stays)
    //  - conflict + unresolved → skip (user must decide)
    const toUpload = parsed.results.filter(({ valid, dupStatus, index }) => {
      if (!valid) return false;
      if (!dupStatus) return true;
      if (dupStatus === 'exact') return false;
      if (dupStatus === 'conflict') {
        const res = resolutions[index];
        return res === 'incoming' || res === 'both';
      }
      return false;
    });

    if (toUpload.length === 0) {
      setStatus({ type: 'error', message: 'Nothing to upload. Resolve any conflicts first.' });
      return;
    }

    // Warn if unresolved conflicts remain
    const unresolvedCount = parsed.results.filter(
      ({ valid, dupStatus, index }) => valid && dupStatus === 'conflict' && !resolutions[index]
    ).length;

    setUploading(true);
    setStatus(null);

    try {
      const batch  = writeBatch(db);
      const colRef = collection(db, 'subjects', subjectId, 'questions');
      toUpload.forEach(({ item }) => {
        const resolvedTag = item.tag?.trim() || tag.trim() || null;
        const itemWithTag = resolvedTag ? { ...item, tag: resolvedTag } : item;
        batch.set(doc(colRef), itemWithTag);
      });
      await batch.commit();

      const skippedMsg = unresolvedCount > 0
        ? ` · ${unresolvedCount} unresolved conflict${unresolvedCount > 1 ? 's' : ''} skipped.`
        : '';
      setStatus({ type: 'success', message: `Uploaded ${toUpload.length} items successfully.${skippedMsg}` });
      setJsonInput('');
      setParsed(null);
      setResolutions({});
    } catch (e) {
      setStatus({ type: 'error', message: `Upload failed: ${e.message}` });
    } finally {
      setUploading(false);
    }
  };

  // ── Derived counts ────────────────────────────────────────────────
  const newCount        = parsed?.results.filter((r) => r.valid && !r.dupStatus).length          ?? 0;
  const exactDupCount   = parsed?.results.filter((r) => r.valid && r.dupStatus === 'exact').length    ?? 0;
  const conflictCount   = parsed?.results.filter((r) => r.valid && r.dupStatus === 'conflict').length ?? 0;
  const invalidCount    = parsed?.results.filter((r) => !r.valid).length                             ?? 0;
  const validCount      = newCount; // kept for upload button (only new + resolved conflicts)
  const resolvedCount   = Object.keys(resolutions).length;
  const uploadableCount = newCount + parsed?.results.filter(
    ({ valid, dupStatus, index }) => valid && dupStatus === 'conflict' && (resolutions[index] === 'incoming' || resolutions[index] === 'both')
  ).length ?? 0;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }} className="fade-in">

      <h2 style={{ marginBottom: '6px' }}>Bulk Import</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '32px' }}>
        Paste a JSON array of flashcards and MCQs. Items are validated before upload.
      </p>

      {/* ── Prompt template (passphrase-gated) ── */}
      {promptUnlocked ? (
        <div className="card" style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                Generation Prompt
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                Copy this prompt, paste it into NotebookLM or any AI, append your source
                material, and it will return valid JSON ready to import.
              </p>
            </div>
            <button
              onClick={handleCopyPrompt}
              className={copied ? 'btn-accent' : 'btn-ghost'}
              style={{ padding: '8px 16px', fontSize: '0.82rem', flexShrink: 0, minWidth: '110px' }}
            >
              {copied ? '✓ Copied' : 'Copy Prompt'}
            </button>
          </div>

          {/* Schema quick-reference */}
          <div style={{
            marginTop: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
          }}>
            {[
              {
                label: 'Flashcard',
                fields: ['type: "flashcard"', 'front: string', 'back: string'],
              },
              {
                label: 'MCQ',
                fields: ['type: "mcq"', 'question: string', 'options: string[4]', 'correctAnswer: string'],
              },
            ].map(({ label, fields }) => (
              <div key={label} style={{
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: 'var(--accent-dim)',
                  marginBottom: '8px',
                }}>
                  {label}
                </div>
                {fields.map((f) => (
                  <div key={f} style={{
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.7,
                  }}>
                    {f}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Subject selector ── */}
      <div style={{ marginBottom: '20px' }}>
        <label>Subject</label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      {/* ── Tag input ── */}
      <div style={{ marginBottom: '20px' }}>
        <label>
          Fallback Tag{' '}
          <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            (optional — applied to items that have no tag of their own)
          </span>
        </label>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. Module 1 — leave blank if your JSON already has tags…"
          list="bulk-existing-tags"
          style={{ marginTop: '6px' }}
        />
        <datalist id="bulk-existing-tags">
          {existingTags.map((t) => <option key={t} value={t} />)}
        </datalist>
        {existingTags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {existingTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag((prev) => prev === t ? '' : t)}
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

      {/* ── JSON input ── */}
      <div style={{ marginBottom: '16px' }}>
        <label>JSON Input</label>
        <textarea
          value={jsonInput}
          onChange={(e) => { setJsonInput(e.target.value); setParsed(null); setStatus(null); }}
          placeholder='Paste your JSON array here…'
          style={{
            minHeight: '200px',
            fontFamily: 'monospace',
            fontSize: '0.82rem',
            whiteSpace: 'pre',
            marginTop: '6px',
          }}
        />
      </div>

      {/* ── Parse button ── */}
      {!parsed && (
        <button
          onClick={handleParse}
          disabled={!subjectId || !jsonInput.trim()}
          style={{ width: '100%', marginBottom: '16px' }}
        >
          Validate →
        </button>
      )}

      {/* ── Status message ── */}
      {status && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius)',
          border: `1px solid ${status.type === 'error' ? '#6e2a2a' : '#3f5235'}`,
          background: status.type === 'error' ? '#2a1515' : '#1a2a1a',
          color: status.type === 'error' ? '#c08080' : '#9fc090',
          fontSize: '0.88rem',
          marginBottom: '16px',
        }}>
          {status.message}
        </div>
      )}

      {/* ── Preview ── */}
      {parsed && (
        <div className="fade-in">

          {/* Summary bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.88rem' }}>
                  <span style={{ fontWeight: 700, color: '#9fc090' }}>{newCount}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '5px' }}>new</span>
                </span>
                {exactDupCount > 0 && (
                  <span style={{ fontSize: '0.88rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-faint)' }}>{exactDupCount}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '5px' }}>exact duplicate{exactDupCount > 1 ? 's' : ''}</span>
                  </span>
                )}
                {conflictCount > 0 && (
                  <span style={{ fontSize: '0.88rem' }}>
                    <span style={{ fontWeight: 700, color: '#c8a060' }}>{conflictCount}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '5px' }}>conflict{conflictCount > 1 ? 's' : ''}</span>
                    {resolvedCount > 0 && (
                      <span style={{ color: 'var(--text-faint)', marginLeft: '5px' }}>({resolvedCount} resolved)</span>
                    )}
                  </span>
                )}
                {invalidCount > 0 && (
                  <span style={{ fontSize: '0.88rem' }}>
                    <span style={{ fontWeight: 700, color: '#c08080' }}>{invalidCount}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '5px' }}>invalid</span>
                  </span>
                )}
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  {parsed.results.length} total
                </span>
              </div>
              {parsed.detectedTags?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                    tags detected:
                  </span>
                  {parsed.detectedTags.map((t) => (
                    <span key={t} style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      color: 'var(--accent-dim)',
                      background: 'var(--bg-deep)',
                      border: '1px solid var(--border)',
                      padding: '2px 8px',
                      borderRadius: '2px',
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setParsed(null); setStatus(null); }}
                className="btn-ghost"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                Edit
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || uploadableCount === 0}
                style={{ padding: '6px 16px', fontSize: '0.82rem' }}
              >
                {uploading ? 'Uploading…' : `Upload ${uploadableCount} item${uploadableCount !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </div>

          {/* Item list */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '480px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}>
            {parsed.results.map(({ item, index, valid, errors }) => (
              <div
                key={index}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${valid ? 'var(--border)' : '#6e2a2a'}`,
                  borderLeft: `3px solid ${valid ? 'var(--border-light)' : '#9f5a5a'}`,
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: valid ? '8px' : '6px',
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                      color: 'var(--text-faint)',
                    }}>
                      #{index + 1} · {item?.type ?? 'unknown'}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: valid ? '#6a9f5a' : '#c08080',
                  }}>
                    {valid ? '✓ Valid' : '✕ Invalid'}
                  </span>
                </div>

                {/* Content preview */}
                {valid && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                    {item.type === 'flashcard' ? (
                      <>
                        <div style={{ fontWeight: 600, marginBottom: '3px' }}>
                          {item.front}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {item.back}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                          {item.question}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {item.options.map((opt, i) => (
                            <div key={i} style={{
                              fontSize: '0.78rem',
                              color: opt === item.correctAnswer
                                ? '#6a9f5a'
                                : 'var(--text-muted)',
                              fontWeight: opt === item.correctAnswer ? 600 : 400,
                              display: 'flex',
                              gap: '6px',
                            }}>
                              <span style={{
                                fontFamily: 'var(--font-display)',
                                fontStyle: 'italic',
                                color: opt === item.correctAnswer
                                  ? '#6a9f5a'
                                  : 'var(--text-faint)',
                                flexShrink: 0,
                              }}>
                                {i + 1}.
                              </span>
                              {opt}
                              {opt === item.correctAnswer && (
                                <span style={{ opacity: 0.7 }}>✓</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Validation errors */}
                {!valid && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {errors.map((err, i) => (
                      <div key={i} style={{
                        fontSize: '0.78rem',
                        color: '#c08080',
                        fontStyle: 'italic',
                      }}>
                        · {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Discreet unlock trigger ── */}
      {!promptUnlocked && (
        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          {!showPassphraseInput ? (
            <span
              onClick={() => setShowPassphraseInput(true)}
              style={{
                color: 'var(--text-faint)',
                fontSize: '0.7rem',
                cursor: 'default',
                userSelect: 'none',
                letterSpacing: '2px',
              }}
            >
              ·
            </span>
          ) : (
            <form
              onSubmit={handleUnlock}
              style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}
            >
              <input
                type="password"
                value={passphraseInput}
                onChange={(e) => { setPassphraseInput(e.target.value); setPassphraseError(false); }}
                autoFocus
                autoComplete="off"
                style={{
                  width: '160px',
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  borderColor: passphraseError ? '#6e2a2a' : 'var(--border)',
                  textAlign: 'center',
                }}
                onBlur={() => {
                  if (!passphraseInput) {
                    setShowPassphraseInput(false);
                    setPassphraseError(false);
                  }
                }}
              />
            </form>
          )}
        </div>
      )}

    </div>
  );
}