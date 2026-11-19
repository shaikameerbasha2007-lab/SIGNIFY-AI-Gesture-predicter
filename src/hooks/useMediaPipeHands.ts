import { useCallback, useEffect, useRef, useState } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandDetection } from '../types';

export interface MediaPipeHandsController {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  initLandmarker: () => Promise<HandLandmarker | null>;
  detectVideoFrame: (video: HTMLVideoElement, timestampMs: number) => HandDetection[];
}

const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export function useMediaPipeHands(): MediaPipeHandsController {
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const initPromiseRef = useRef<Promise<HandLandmarker | null> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initLandmarker = useCallback(async (): Promise<HandLandmarker | null> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    if (initPromiseRef.current) return initPromiseRef.current;

    const task = (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const visionModule = await import('@mediapipe/tasks-vision');
        const { FilesetResolver, HandLandmarker: MPHandLandmarker } = visionModule;

        // Prefer local Express-hosted WASM assets first, with CDN fallback
        let fileset;
        try {
          fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        } catch {
          fileset = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
          );
        }

        let created: HandLandmarker;
        try {
          created = await MPHandLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: MODEL_ASSET_PATH,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          });
        } catch {
          // Graceful CPU delegate fallback when WebGL GPU acceleration is unavailable
          created = await MPHandLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: MODEL_ASSET_PATH,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          });
        }

        landmarkerRef.current = created;
        setIsReady(true);
        return created;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to initialize MediaPipe HandLandmarker model.';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
        initPromiseRef.current = null;
      }
    })();

    initPromiseRef.current = task;
    return task;
  }, []);

  const detectVideoFrame = useCallback(
    (video: HTMLVideoElement, timestampMs: number): HandDetection[] => {
      const landmarker = landmarkerRef.current;
      if (!landmarker || video.readyState < 2 || video.videoWidth === 0) {
        return [];
      }

      try {
        const result = landmarker.detectForVideo(video, timestampMs);
        if (!result.landmarks || result.landmarks.length === 0) {
          return [];
        }

        return result.landmarks.map((lmList, i) => {
          const rawCategory = result.handednesses?.[i]?.[0]?.categoryName;
          const handedness = rawCategory === 'Left' ? 'Left' : 'Right';
          return {
            landmarks: lmList.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z })),
            handedness,
          };
        });
      } catch {
        return [];
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  return {
    isReady,
    isLoading,
    error,
    initLandmarker,
    detectVideoFrame,
  };
}
