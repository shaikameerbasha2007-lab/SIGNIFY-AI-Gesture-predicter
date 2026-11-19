export type PageId = 'home' | 'gesture' | 'animal' | 'learn' | 'about';

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right';

export interface HandDetection {
  landmarks: Landmark3D[];
  handedness: Handedness;
}

export interface LetterScore {
  letter: string;
  confidence: number;
}

export type RecognitionStatus =
  | 'recognized'
  | 'uncertain'
  | 'unsupported'
  | 'no-hand'
  | 'two-hand-space';

export interface GesturePrediction {
  label: string | null;
  confidence: number;
  status: RecognitionStatus;
  reason: string;
  topCandidates: LetterScore[];
  isDynamic: boolean;
  handCount: number;
}

export interface SmoothedResult {
  stableLabel: string | null;
  displayLabel: string | null;
  confidence: number;
  status: RecognitionStatus;
  reason: string;
  stabilityProgress: number; // 0..1 towards committing letter
  committedLetter: string | null;
  committedAction: 'letter' | 'space' | null;
  topCandidates: LetterScore[];
  isDynamic: boolean;
  handCount: number;
}

export type SignMotionType = 'Static' | 'Dynamic';

export interface ASLLetterInfo {
  letter: string;
  motionType: SignMotionType;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  handShapeSummary: string;
  steps: string[];
  commonMistake: string;
  fingerStates: {
    thumb: 'extended' | 'tucked' | 'crossed' | 'pinched' | 'side';
    index: 'up' | 'curled' | 'curved' | 'side' | 'down' | 'crossed';
    middle: 'up' | 'curled' | 'curved' | 'side' | 'down' | 'crossed';
    ring: 'up' | 'curled' | 'curved';
    pinky: 'up' | 'curled' | 'curved';
  };
}

export type AnimalCategory =
  | 'Mammal'
  | 'Bird'
  | 'Reptile'
  | 'Amphibian'
  | 'Fish'
  | 'Invertebrate'
  | 'Unknown';

export interface AnimalRecognitionResult {
  animalDetected: boolean;
  commonName: string;
  scientificName: string;
  category: AnimalCategory;
  confidence: number;
  uncertaintyNote: string;
  habitat: string;
  diet: string;
  lifespan: string;
  conservationStatus: string;
  summary: string;
  interestingFacts: string[];
}

export interface SampleAnimalImage {
  id: string;
  label: string;
  regionHint: string;
  imageUrl: string;
  alt: string;
}
