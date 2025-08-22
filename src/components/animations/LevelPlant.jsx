import React, { useEffect, useState } from 'react';
import PalmGrowthSVG from './PalmGrowthSVG.jsx';
import PlantStage01 from './stages/PlantStage01.jsx';
import './LevelPlant.css';

// Selects which plant stage to render based on the user's level.
// For now only Stage01 exists (levels 1-4). Other ranges fall back to PalmGrowthSVG
// until you provide their SVGs (e.g., Stage05, Stage10, Stage15).
export default function LevelPlant({
  level = 1,
  growth = 0,
  miniProgress = 0,
  timerColor = '#10b981',
  className = 'plant-svg'
}) {
  const [anim, setAnim] = useState(null); // 'level' | 'rank' | null
  useEffect(() => {
    const onLevelUp = () => {
      setAnim('level');
      setTimeout(() => setAnim(null), 1200);
    };
    const onRankUp = () => {
      setAnim('rank');
      setTimeout(() => setAnim(null), 1400);
    };
    window.addEventListener('level_up', onLevelUp);
    window.addEventListener('rank_up', onRankUp);
    return () => {
      window.removeEventListener('level_up', onLevelUp);
      window.removeEventListener('rank_up', onRankUp);
    };
  }, []);
  // Determine stage by level range
  let StageComponent = null;
  let extraProps = {};

  if (level < 5) {
    StageComponent = PlantStage01; // seedling / fidan
    extraProps = { stageScale: 0.9 };
  } else if (level < 10) {
    // TODO: replace with PlantStage05 when provided
    StageComponent = PalmGrowthSVG;
    extraProps = { palmScale: 0.8 };
  } else if (level < 15) {
    // TODO: replace with PlantStage10 when provided
    StageComponent = PalmGrowthSVG;
    extraProps = { palmScale: 0.85 };
  } else {
    // TODO: replace with PlantStage15 when provided
    StageComponent = PalmGrowthSVG;
    extraProps = { palmScale: 0.9 };
  }

  return (
    <div className={`level-plant-wrap ${anim ? `glow-${anim}` : ''}`}>
      <StageComponent
        growth={growth}
        miniProgress={miniProgress}
        timerColor={timerColor}
        className={className}
        {...extraProps}
      />
      {anim && <div className={`sparkle-layer ${anim}`} aria-hidden="true" />}
    </div>
  );
}
