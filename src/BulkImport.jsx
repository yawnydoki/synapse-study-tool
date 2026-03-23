import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';

// ── Schema ────────────────────────────────────────────────────────
// Valid item shapes:
//   { type: 'flashcard', front: string, back: string }
//   { type: 'mcq', question: string, options: string[4], correctAnswer: string }

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
    if (!Array.isArray(item.options) || item.options.length !== 4)
      errors.push('"options" must be an array of exactly 4 strings');
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
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Option A",
  "tag": "Module 1"  (optional)
}

REQUIREMENTS:
- "correctAnswer" must be an exact copy of one of the four strings in "options"
- options array must have exactly 4 items
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

// ── Component ─────────────────────────────────────────────────────
export default function BulkImport() {
  const [subjects, setSubjects]     = useState([]);
  const [subjectId, setSubjectId]   = useState('');
  const [jsonInput, setJsonInput]   = useState('');
  const [parsed, setParsed]         = useState(null);   // null | { items, results }
  const [status, setStatus]         = useState(null);   // null | { type, message }
  const [uploading, setUploading]   = useState(false);
  const [copied, setCopied]         = useState(false);
  const [tag, setTag]                 = useState('');
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
  const handleParse = () => {
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

    const results = items.map((item, i) => ({
      item,
      index: i,
      ...validateItem(item, i),
    }));

    setParsed({ items, results });
  };

  // ── Upload valid items ────────────────────────────────────────────
  const handleUpload = async () => {
    if (!subjectId || !parsed) return;
    const valid = parsed.results.filter((r) => r.valid);
    if (valid.length === 0) return;

    setUploading(true);
    setStatus(null);

    try {
      const batch  = writeBatch(db);
      const colRef = collection(db, 'subjects', subjectId, 'questions');
      valid.forEach(({ item }) => {
        const itemWithTag = tag.trim()
          ? { ...item, tag: tag.trim() }
          : item;
        batch.set(doc(colRef), itemWithTag);
      });
      await batch.commit();
      setStatus({ type: 'success', message: `Uploaded ${valid.length} items successfully.` });
      setJsonInput('');
      setParsed(null);
    } catch (e) {
      setStatus({ type: 'error', message: `Upload failed: ${e.message}` });
    } finally {
      setUploading(false);
    }
  };

  // ── Derived counts ────────────────────────────────────────────────
  const validCount   = parsed?.results.filter((r) => r.valid).length  ?? 0;
  const invalidCount = parsed?.results.filter((r) => !r.valid).length ?? 0;

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
        <label>Tag <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — e.g. Module 1, Chapter 3)</span></label>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Leave blank to import without a tag…"
          style={{ marginTop: '6px' }}
        />
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
            <div style={{ display: 'flex', gap: '20px' }}>
              <span style={{ fontSize: '0.88rem' }}>
                <span style={{ fontWeight: 700, color: '#9fc090' }}>{validCount}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: '5px' }}>valid</span>
              </span>
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
                disabled={uploading || validCount === 0}
                style={{ padding: '6px 16px', fontSize: '0.82rem' }}
              >
                {uploading ? 'Uploading…' : `Upload ${validCount} item${validCount !== 1 ? 's' : ''} →`}
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