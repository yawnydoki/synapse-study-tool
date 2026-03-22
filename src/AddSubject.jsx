import React, { useState } from 'react';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function AddSubject() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Convert "Image Processing" to "image-processing" for the ID
    const subjectId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    if (!subjectId) return alert("Please enter a valid title.");

    // setDoc creates the document and the collection if it doesn't exist
    await setDoc(doc(db, "subjects", subjectId), {
      title: title,
      description: description
    });

    alert(`Subject "${title}" created successfully!`);
    navigate('/'); // Redirect to home to see it
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', margin: '20px auto' }}>
      <h3>Create New Subject</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Subject Title</label>
        <input 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          placeholder="e.g., Advanced Mathematics" 
          required 
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Short Description</label>
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          placeholder="e.g., Calculus, Linear Algebra, etc." 
          required 
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', minHeight: '80px' }} 
        />
      </div>

      <button type="submit" style={{ padding: '12px', cursor: 'pointer', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
        Create Subject
      </button>
    </form>
  );
}