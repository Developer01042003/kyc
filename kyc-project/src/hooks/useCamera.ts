import { useState, useEffect } from 'react';

interface CameraHook {
  hasPermission: boolean | null;
  error: string | null;
  stream: MediaStream | null;
  requestPermission: () => Promise<void>;
}

export const useCamera = (): CameraHook => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const requestPermission = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(mediaStream);
      setHasPermission(true);
      setError(null);
    } catch (err) {
      setHasPermission(false);
      setError('Camera permission denied');
      console.error('Camera permission error:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return { hasPermission, error, stream, requestPermission };
};