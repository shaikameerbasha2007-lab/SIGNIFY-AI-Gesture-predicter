import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { SAMPLE_ANIMAL_IMAGES } from '../data/sampleAnimals';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import type { AnimalRecognitionResult, SampleAnimalImage } from '../types';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export function AnimalDashboard() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [sourceLabel, setSourceLabel] = useState<string>('');

  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnimalRecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Webcam photo capture state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speech = useSpeechSynthesis();

  const closeCaptureCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => closeCaptureCamera();
  }, [closeCaptureCamera]);

  const analyzeImage = useCallback(async (base64Data: string, mime: string) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze-animal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: mime,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : `Analysis request failed (${response.status}).`,
        );
      }

      setResult(payload as AnimalRecognitionResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to analyze this image right now. Please try again.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
        setError('Unsupported file format. Please upload a JPG, JPEG, PNG, or WEBP image.');
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError('Image is larger than 12 MB. Please choose a smaller photograph.');
        return;
      }

      closeCaptureCamera();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        setPreviewUrl(dataUrl);
        setImageBase64(dataUrl);
        setMimeType(file.type.toLowerCase());
        setSourceLabel(file.name);
        analyzeImage(dataUrl, file.type.toLowerCase());
      };
      reader.onerror = () => {
        setError('Could not read the selected file. Please try another photograph.');
      };
      reader.readAsDataURL(file);
    },
    [analyzeImage, closeCaptureCamera],
  );

  const handleSampleClick = async (sample: SampleAnimalImage) => {
    setError(null);
    setCameraError(null);
    closeCaptureCamera();
    setPreviewUrl(sample.imageUrl);
    setSourceLabel(`Sample · ${sample.label}`);
    setIsAnalyzing(true);
    setResult(null);

    try {
      const resp = await fetch(sample.imageUrl);
      if (!resp.ok) throw new Error('Could not load the sample image file.');
      const blob = await resp.blob();
      const mime = blob.type || 'image/jpeg';

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to encode sample image.'));
        reader.readAsDataURL(blob);
      });

      setImageBase64(dataUrl);
      setMimeType(mime);
      await analyzeImage(dataUrl, mime);
    } catch (err) {
      setIsAnalyzing(false);
      setError(err instanceof Error ? err.message : 'Unable to analyze sample photograph.');
    }
  };

  const openCaptureCamera = async () => {
    setCameraError(null);
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera capture is not supported in this browser. Upload an image or pick a sample below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);

      // Attach stream after video element renders
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError') {
        setCameraError('Camera permission was denied. Allow access in your browser settings or upload an image file.');
      } else if (name === 'NotFoundError') {
        setCameraError('No camera detected on this device. Upload an image or test a sample wildlife photo.');
      } else {
        setCameraError('Unable to open the camera right now. Please upload an image instead.');
      }
    }
  };

  const captureFromWebcam = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    closeCaptureCamera();

    setPreviewUrl(dataUrl);
    setImageBase64(dataUrl);
    setMimeType('image/jpeg');
    setSourceLabel('Webcam Capture');
    analyzeImage(dataUrl, 'image/jpeg');
  };

  const speakAnimalSummary = () => {
    if (!result) return;
    if (!result.animalDetected) {
      speech.speak('No animal was detected in this photograph.');
      return;
    }
    const text = `${result.commonName}, scientific name ${result.scientificName}. Category: ${result.category}. ${result.summary}`;
    speech.speak(text);
  };

  const clearSelection = () => {
    setPreviewUrl(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
    setSourceLabel('');
    speech.stop();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-cyan-400">
            Module 2 · Multimodal Vision Intelligence
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            AI Animal Image Recognition
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Upload a photograph or capture one from your webcam to identify the species, scientific
            classification, habitat, diet, lifespan, and key ecological facts via Gemini Vision.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {cameraOpen ? (
            <button
              type="button"
              onClick={closeCaptureCamera}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-rose-500/35 bg-rose-500/15 px-4 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
            >
              <CameraOff className="h-4 w-4" aria-hidden="true" />
              <span>Close Camera</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openCaptureCamera}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/14 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.1] hover:text-white"
            >
              <Camera className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              <span>Capture with Webcam</span>
            </button>
          )}
        </div>
      </div>

      {cameraError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-950/35 px-4 py-3 text-xs text-amber-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 5 Columns: Upload / Webcam Capture / Preview + Sample Strip */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="glass-panel overflow-hidden rounded-2xl p-5">
            {cameraOpen ? (
              <div>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
                  <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={closeCaptureCamera}
                    className="rounded-lg border border-white/12 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={captureFromWebcam}
                    className="btn-primary-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold text-white"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    <span>Capture & Analyze</span>
                  </button>
                </div>
              </div>
            ) : previewUrl ? (
              <div>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10 bg-[#050a18]">
                  <img
                    src={previewUrl}
                    alt={sourceLabel || 'Uploaded animal photograph preview'}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearSelection}
                    aria-label="Remove current photograph"
                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[#040711]/80 text-slate-200 backdrop-blur-md hover:bg-[#040711] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="truncate text-xs text-slate-400">{sourceLabel}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.1]"
                    >
                      Replace Photo
                    </button>
                    {imageBase64 && (
                      <button
                        type="button"
                        onClick={() => analyzeImage(imageBase64, mimeType)}
                        disabled={isAnalyzing}
                        className="btn-primary-gradient inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        <span>{isAnalyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
                className={`flex aspect-[4/3] flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-white/15 bg-[#050a18]/70 hover:border-cyan-400/40'
                }`}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300">
                  <Upload className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-display text-base font-semibold text-white">
                  Drop an animal photograph here
                </h2>
                <p className="mt-1.5 text-xs text-slate-400">
                  Supports JPG, JPEG, PNG, and WEBP up to 12 MB
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary-gradient mt-5 whitespace-nowrap rounded-xl px-5 py-2.5 text-xs font-semibold text-white"
                >
                  Choose Image File
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Upload animal photograph"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </div>

          {/* Sample Wildlife Photographs */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white">
                Sample Wildlife Photographs
              </h2>
              <span className="text-xs text-slate-400">Click any photo to run Gemini Vision</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SAMPLE_ANIMAL_IMAGES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSampleClick(sample)}
                  disabled={isAnalyzing}
                  className="group overflow-hidden rounded-xl border border-white/[0.08] bg-[#060c1c] text-left transition-colors hover:border-cyan-400/45 disabled:opacity-60"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    <img
                      src={sample.imageUrl}
                      alt={sample.alt}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-white">{sample.label}</p>
                    <p className="truncate text-[11px] text-slate-400">{sample.regionHint}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Structured Recognition Results */}
        <div className="lg:col-span-7">
          <div className="glass-panel min-h-[520px] rounded-2xl p-6 sm:p-7" data-testid="animal-result-panel">
            {isAnalyzing ? (
              <div className="flex h-full min-h-[440px] flex-col items-center justify-center text-center">
                <Loader2 className="h-9 w-9 animate-spin text-cyan-400" aria-hidden="true" />
                <h2 className="mt-4 font-display text-lg font-semibold text-white">
                  Analyzing Photograph with Gemini Vision
                </h2>
                <p className="mt-1.5 max-w-md text-sm text-slate-400">
                  Identifying visual anatomy, taxonomic category, habitat range, diet, lifespan, and
                  species facts...
                </p>

                <div className="mt-8 w-full max-w-md space-y-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.05]" />
                </div>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="flex h-full min-h-[440px] flex-col items-center justify-center text-center"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                  <AlertCircle className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-display text-lg font-semibold text-white">
                  Analysis Could Not Complete
                </h2>
                <p className="mt-2 max-w-md text-sm text-rose-200/90">{error}</p>
                {imageBase64 && (
                  <button
                    type="button"
                    onClick={() => analyzeImage(imageBase64, mimeType)}
                    className="btn-primary-gradient mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Retry Analysis</span>
                  </button>
                )}
              </div>
            ) : !result ? (
              <div className="flex h-full min-h-[440px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-300">
                  <ImageIcon className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 className="font-display text-xl font-semibold text-white">
                  Awaiting Photograph
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                  Upload any JPG, PNG, or WEBP wildlife photo, take a picture with your webcam, or
                  click one of the four sample photographs on the left to inspect full species
                  identification results.
                </p>
              </div>
            ) : !result.animalDetected ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex h-full min-h-[440px] flex-col items-center justify-center text-center"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/12 text-amber-300">
                  <AlertCircle className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white">No Animal Detected</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
                  {result.uncertaintyNote ||
                    'No non-human animal was clearly visible in this image. Try uploading a sharper photograph with the animal centered.'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 rounded-xl border border-white/14 bg-white/[0.05] px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.1]"
                >
                  Upload Another Photograph
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-6"
              >
                {/* Identification Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-cyan-300">
                      <span>{result.category}</span>
                      {result.conservationStatus && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-slate-300">{result.conservationStatus}</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-white">
                      {result.commonName}
                    </h2>
                    {result.scientificName && (
                      <p className="mt-0.5 text-base italic text-slate-400">
                        {result.scientificName}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={speakAnimalSummary}
                    disabled={!speech.supported}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/14 bg-white/[0.05] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-400/40 hover:text-white disabled:opacity-40"
                  >
                    <Volume2 className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                    <span>Read Aloud</span>
                  </button>
                </div>

                {/* Confidence & Uncertainty Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${
                          result.confidence >= 80 ? 'text-cyan-400' : 'text-amber-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {result.confidence >= 80
                          ? 'High Visual Confidence'
                          : result.confidence >= 55
                            ? 'Moderate Confidence'
                            : 'Low Confidence / Uncertain'}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-white">
                      {result.confidence}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        result.confidence >= 80
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                  {result.uncertaintyNote && (
                    <p className="mt-2 text-xs text-slate-400">{result.uncertaintyNote}</p>
                  )}
                </div>

                {/* Summary */}
                {result.summary && (
                  <p className="text-sm leading-relaxed text-slate-200">{result.summary}</p>
                )}

                {/* Habitat / Diet / Lifespan Structured Row */}
                <div className="grid grid-cols-1 gap-4 border-y border-white/[0.08] py-5 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-cyan-300">Habitat</p>
                    <p className="mt-1.5 text-sm leading-snug text-slate-200">
                      {result.habitat || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-300">Diet</p>
                    <p className="mt-1.5 text-sm leading-snug text-slate-200">
                      {result.diet || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-violet-300">Lifespan</p>
                    <p className="mt-1.5 text-sm leading-snug text-slate-200">
                      {result.lifespan || 'Not specified'}
                    </p>
                  </div>
                </div>

                {/* Interesting Facts */}
                {result.interestingFacts.length > 0 && (
                  <div>
                    <h3 className="font-display text-sm font-semibold text-white">
                      Interesting Facts
                    </h3>
                    <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
                      {result.interestingFacts.map((fact, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="mt-0.5 font-mono text-xs text-cyan-400">
                            0{idx + 1}.
                          </span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
