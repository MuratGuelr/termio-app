import { useState } from 'react';
import './DailyNotes.css';

export default function DailyNotes({ notes, onUpdateNotes }) {
  const [currentNotes, setCurrentNotes] = useState(notes);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveStatus, setShowSaveStatus] = useState(false);

  const handleNotesChange = (e) => {
    setCurrentNotes(e.target.value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateNotes(currentNotes);
      setShowSaveStatus(true);
      setTimeout(() => setShowSaveStatus(false), 3000);
    } catch (error) {
      alert('Notlar kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card">
      <h3>
        <i className="fas fa-sticky-note"></i>
        Günlük Notlar
      </h3>
      <textarea 
        className="notes-textarea" 
        id="dailyNotes" 
        placeholder="Bugün nasıl geçti? Neler öğrendin?"
        value={currentNotes}
        onChange={handleNotesChange}
      />
      <button className="save-btn" onClick={handleSave} disabled={isSaving}>
        {isSaving ? <div className="loading"></div> : 'Kaydet'}
      </button>
      <div className={`save-status ${showSaveStatus ? 'show' : ''}`} id="saveStatus">
        ✓ Notlar kaydedildi!
      </div>
    </div>
  );
}
