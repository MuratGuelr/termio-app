import './MobileEditButton.css';

export default function MobileEditButton({ isEditing, onToggleEdit }) {
  return (
    <button
      className={`mobile-edit-btn ${isEditing ? 'active' : ''}`}
      onClick={onToggleEdit}
      aria-label={isEditing ? 'Düzenlemeyi Bitir' : 'Düzenle'}
      title={isEditing ? 'Düzenlemeyi Bitir' : 'Düzenle'}
    >
      <i className="fas fa-edit"></i>
      <span className="label">{isEditing ? 'Bitti' : 'Düzenle'}</span>
    </button>
  );
}
