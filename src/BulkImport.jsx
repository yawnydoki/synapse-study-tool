import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';

export default function BulkImport() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchSubjects = async () => {
      const snap = await getDocs(collection(db, "subjects"));
      const subs = snap.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
      setSubjects(subs);
      if (subs.length > 0) setSubjectId(subs[0].id);
    };
    fetchSubjects();
  }, []);

  const handleImport = async () => {
    if (!subjectId) {
      setStatus("Error: Please select a valid Subject.");
      return;
    }

    try {
      setStatus('Parsing...');
      const data = JSON.parse(jsonInput);
      
      if (!Array.isArray(data)) throw new Error("Input must be a JSON array.");

      setStatus('Uploading...');
      const batch = writeBatch(db);
      const colRef = collection(db, "subjects", subjectId, "questions");

      data.forEach((item) => {
        const newDocRef = doc(colRef); 
        batch.set(newDocRef, item);
      });

      await batch.commit();
      
      setJsonInput('');
      setStatus(`Success! Added ${data.length} items.`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px', margin: '20px auto' }}>
      <h3>Bulk Import via JSON</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Subject</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
          {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.title}</option>)}
        </select>
      </div>

      <textarea 
        value={jsonInput} 
        onChange={(e) => setJsonInput(e.target.value)} 
        placeholder='Paste JSON array here...' 
        style={{ padding: '10px', minHeight: '300px', fontFamily: 'monospace', whiteSpace: 'pre', borderRadius: '5px', border: '1px solid #ccc', marginTop: '10px' }}
      />
      
      <button onClick={handleImport} disabled={!subjectId} style={{ padding: '15px', cursor: subjectId ? 'pointer' : 'not-allowed', backgroundColor: subjectId ? '#007bff' : '#999', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
        Process & Upload Batch
      </button>

      {status && <p style={{ textAlign: 'center', fontWeight: 'bold', color: status.includes('Error') ? 'red' : 'green' }}>{status}</p>}
    </div>
  );
}