import React from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import Home from './Home';
import DataEntry from './DataEntry';
import StudyDeck from './StudyDeck';
import BulkImport from './BulkImport';
import AddSubject from './AddSubject';
import SubjectDashboard from './SubjectDashboard';
import ManageSubject from './ManageSubject';
import { ToastProvider } from './ToastContext';

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <div className="app-wrapper">

        <header className="site-header">
          <div className="header-title-group">
            <Link to="/" className="header-wordmark">Synapse</Link>
            <span className="header-tagline">A Commonplace Book</span>
          </div>

          <nav className="site-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'nav-link nav-primary' : 'nav-link'
              }
            >
              Subjects
            </NavLink>
            <NavLink
              to="/add-subject"
              className={({ isActive }) =>
                isActive ? 'nav-link nav-primary' : 'nav-link'
              }
            >
              + Subject
            </NavLink>
            <NavLink
              to="/add"
              className={({ isActive }) =>
                isActive ? 'nav-link nav-primary' : 'nav-link'
              }
            >
              Add Item
            </NavLink>
            <NavLink
              to="/bulk"
              className={({ isActive }) =>
                isActive ? 'nav-link nav-primary' : 'nav-link'
              }
            >
              Bulk Import
            </NavLink>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/"                          element={<Home />} />
            <Route path="/subject/:subjectId"        element={<SubjectDashboard />} />
            <Route path="/study/:subjectId/:mode"    element={<StudyDeck />} />
            <Route path="/add-subject"               element={<AddSubject />} />
            <Route path="/add"                       element={<DataEntry />} />
            <Route path="/bulk"                      element={<BulkImport />} />
            <Route path="/manage/:subjectId"         element={<ManageSubject />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
    </ToastProvider>
  );
}