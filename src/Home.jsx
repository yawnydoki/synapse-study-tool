import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { Link } from "react-router-dom";

export default function Home() {
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    const fetchSubjects = async () => {
      const snapshot = await getDocs(collection(db, "subjects"));
      setSubjects(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchSubjects();
  }, []);

  return (
    <div>
      <h2>Your Subjects</h2>
      <div style={{ display: "grid", gap: "15px", marginTop: "20px" }}>
        {subjects.map((sub) => (
          <div key={sub.id} className="card">
            <h3 style={{ margin: "0 0 10px 0" }}>{sub.title}</h3>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-muted)" }}>
              {sub.description}
            </p>
            <Link to={`/subject/${sub.id}`}>
              <button>Open Subject</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
