import type { ImageSourcePropType } from 'react-native';

import exploreHero from './liftmark-hero-deadlift.png';
import historyHero from './liftmark-recovery.png';
import partnerHero from './liftmark-partner-bench.png';
import planHero from './liftmark-plan-review.png';
import trainingStudioHero from './liftmark-training-bench.png';
import trainingHero from './liftmark-workout-hero-bench.jpg';

export const liftmarkImages = {
  exploreHero: exploreHero as ImageSourcePropType,
  historyHero: historyHero as ImageSourcePropType,
  partnerHero: partnerHero as ImageSourcePropType,
  planHero: planHero as ImageSourcePropType,
  recoveryHero: historyHero as ImageSourcePropType,
  trainingStudioHero: trainingStudioHero as ImageSourcePropType,
  trainingHero: trainingHero as ImageSourcePropType,
};
