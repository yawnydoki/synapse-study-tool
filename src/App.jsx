import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './Home';
import DataEntry from './DataEntry';
import StudyDeck from './StudyDeck';
import BulkImport from './BulkImport';
import AddSubject from './AddSubject';
import SubjectDashboard from './SubjectDashboard';
import ManageSubject from './ManageSubject';

// AmbientSound import is removed

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
        
        {/* Updated Header Layout */}
        <header className="header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>
            <Link to="/" style={{ color: 'var(--text)', border: 'none', boxShadow: 'none' }}>Synapse</Link>
          </h1>
          
          <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link to="/" className="nav-link">Subjects</Link>
            <Link to="/add-subject" className="nav-link">+ Subject</Link>
            <Link to="/add" className="nav-link">Add Item</Link>
            <Link to="/bulk" className="nav-link">Bulk Import</Link>
          </nav>
        </header>
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subject/:subjectId" element={<SubjectDashboard />} />
          <Route path="/study/:subjectId/:mode" element={<StudyDeck />} />
          <Route path="/add-subject" element={<AddSubject />} />
          <Route path="/add" element={<DataEntry />} />
          <Route path="/bulk" element={<BulkImport />} />
          <Route path="/manage/:subjectId" element={<ManageSubject />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}