import './DaySelector.css';

// Helpers - Turkish week starts from Monday
const dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const trDayShort = {
  monday: 'Pzt',
  tuesday: 'Sal',
  wednesday: 'Çar',
  thursday: 'Per',
  friday: 'Cum',
  saturday: 'Cmt',
  sunday: 'Pzr',
};
const trDayFull = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

const getTodayDayKey = () => {
  const jsDay = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const turkishDayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert to Turkish week (0=Monday, 6=Sunday)
  return dayKeys[turkishDayIndex];
};

export default function DaySelector({ selectedDay, onDayChange }) {
  return (
    <div className="day-selector-global">
      <div className="day-selector-container">
        <div className="day-selector-header">
          <i className="fas fa-calendar-alt"></i>
          <span>Gün Seçimi</span>
        </div>
        
        <div className="day-buttons">
          {dayKeys.map((dayKey) => {
            const isToday = dayKey === getTodayDayKey();
            const isSelected = selectedDay === dayKey;
            
            return (
              <button
                key={dayKey}
                className={`day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => onDayChange(dayKey)}
                title={trDayFull[dayKey]}
              >
                <span className="day-short">{trDayShort[dayKey]}</span>
                {isToday && <div className="today-indicator"></div>}
              </button>
            );
          })}
        </div>
        
        <div className="selected-day-display">
          <span className="selected-day-text">{trDayFull[selectedDay]}</span>
          {selectedDay === getTodayDayKey() && (
            <span className="today-badge">Bugün</span>
          )}
        </div>
      </div>
    </div>
  );
}
