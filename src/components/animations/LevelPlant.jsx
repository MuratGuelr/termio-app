import React from 'react';
import PalmGrowthSVG from './PalmGrowthSVG.jsx';
import PlantStage01 from './stages/PlantStage01.jsx';

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
    <StageComponent
      growth={growth}
      miniProgress={miniProgress}
      timerColor={timerColor}
      className={className}
      {...extraProps}
    />
  );
}
