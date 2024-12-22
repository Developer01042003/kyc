import { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';
import { submitKYC } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';

type VerificationStep = 
  | 'instructions' 
  | 'initializing' 
  | 'detecting' 
  | 'blinking' 
  | 'holding' 
  | 'processing' 
  | 'complete';

const KYCForm = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [step, setStep] = useState<VerificationStep>('instructions');
  const [faceDetected, setFaceDetected] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [holdTimer, setHoldTimer] = useState(2); // 2 seconds hold time
  const [retryAttempt, setRetryAttempt] = useState(0);
  const lastBlinkTime = useRef(Date.now());

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
        console.log('Face detection models loaded successfully');
      } catch (error) {
        console.error('Error loading models:', error);
        if (retryAttempt === 0) {
          toast.error('Failed to initialize face detection. Retrying...');
        }
        setRetryAttempt(prev => prev + 1);
        setTimeout(loadModels, 2000);
      }
    };

    if (cameraReady && !modelsLoaded) {
      loadModels();
    }
  }, [cameraReady, retryAttempt]);

  const checkBlink = (landmarks: faceapi.FaceLandmarks68) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    const leftEAR = getEyeAspectRatio(leftEye);
    const rightEAR = getEyeAspectRatio(rightEye);
    const averageEAR = (leftEAR + rightEAR) / 2;

    const now = Date.now();
    if (averageEAR < 0.2 && now - lastBlinkTime.current > 500) { // 500ms cooldown between blinks
      lastBlinkTime.current = now;
      setBlinkCount(prev => {
        const newCount = prev + 1;
        if (newCount === 2) {
          toast.success('Blinks detected! Now hold still...');
          setStep('holding');
        }
        return newCount;
      });
    }
  };

  const getEyeAspectRatio = (eye: faceapi.Point[]) => {
    const verticalDist1 = getDistance(eye[1], eye[5]);
    const verticalDist2 = getDistance(eye[2], eye[4]);
    const horizontalDist = getDistance(eye[0], eye[3]);
    return (verticalDist1 + verticalDist2) / (2 * horizontalDist);
  };

  const getDistance = (point1: faceapi.Point, point2: faceapi.Point) => {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  };

  // Face detection loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let holdInterval: NodeJS.Timeout;

    const detectFace = async () => {
      if (webcamRef.current?.video && modelsLoaded) {
        try {
          const detection = await faceapi
            .detectSingleFace(
              webcamRef.current.video,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: 0.3
              })
            )
            .withFaceLandmarks();

          if (detection) {
            setFaceDetected(true);
            if (step === 'detecting') {
              setStep('blinking');
              toast.success('Face detected! Please blink twice...');
            }
            if (step === 'blinking') {
              checkBlink(detection.landmarks);
            }
          } else {
            setFaceDetected(false);
            if (step === 'holding') {
              setStep('detecting');
              setHoldTimer(2);
              setBlinkCount(0);
              toast.error('Face lost! Please try again.');
            }
          }
        } catch (error) {
          console.error('Face detection error:', error);
        }
      }
    };

    if (['detecting', 'blinking', 'holding'].includes(step)) {
      interval = setInterval(detectFace, 100);

      if (step === 'holding' && faceDetected) {
        holdInterval = setInterval(() => {
          setHoldTimer(prev => {
            if (prev <= 1) {
              clearInterval(holdInterval);
              autoCapture();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }

    return () => {
      clearInterval(interval);
      clearInterval(holdInterval);
    };
  }, [step, modelsLoaded, faceDetected]);

  const handleCameraStart = () => {
    setCameraReady(true);
    setStep('initializing');
    console.log('Camera started successfully');
  };

  const handleCameraError = (error: string | DOMException) => {
    console.error('Camera error:', error);
    toast.error('Failed to access camera. Please check permissions.');
  };

  const autoCapture = () => {
    if (webcamRef.current && blinkCount >= 2) {
      const imageSrc = webcamRef.current.getScreenshot();
      setStep('processing');
      if (imageSrc) {
        handleSubmit(imageSrc);
      }
    } else {
      toast.error('Verification incomplete. Please blink twice and hold still.');
      setStep('detecting');
      setBlinkCount(0);
      setHoldTimer(2);
    }
  };

  const handleSubmit = async (image: string) => {
    setLoading(true);
    try {
      await submitKYC(image);
      toast.success('KYC submitted successfully!');
      setStep('complete');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (error) {
      console.error('KYC submission error:', error);
      toast.error('Failed to submit KYC. Please try again.');
      resetVerification();
    } finally {
      setLoading(false);
    }
  };

  const resetVerification = () => {
    setStep('detecting');
    setBlinkCount(0);
    setHoldTimer(2);
    setFaceDetected(false);
  };

  const getStepMessage = () => {
    switch (step) {
      case 'initializing':
        return 'Initializing face detection...';
      case 'detecting':
        return 'Position your face in the frame';
      case 'blinking':
        return `Please blink twice (${blinkCount}/2 blinks detected)`;
      case 'holding':
        return `Hold still! Capturing in ${holdTimer} seconds...`;
      default:
        return '';
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">KYC Verification</h2>

      {step === 'instructions' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>Ensure you're in a well-lit environment</li>
              <li>Remove glasses or face coverings</li>
              <li>Look directly at the camera</li>
              <li>Blink twice when prompted</li>
              <li>Hold still for final capture</li>
            </ol>
          </div>
          <button
            onClick={() => setStep('detecting')}
            className="w-full bg-green-500 text-white p-3 rounded-md hover:bg-green-600 transition-colors"
          >
            Start Verification
          </button>
        </div>
      )}

      {['initializing', 'detecting', 'blinking', 'holding'].includes(step) && (
        <div className="space-y-4">
          <div className="relative">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full rounded-lg"
              onUserMedia={handleCameraStart}
              onUserMediaError={handleCameraError}
            />
            <div className={`absolute inset-0 border-4 rounded-lg transition-colors ${
              faceDetected ? 'border-green-500' : 'border-red-500'
            }`} />
          </div>
          
          <div className="text-center">
            <p className={`text-lg ${faceDetected ? 'text-green-600' : 'text-red-600'}`}>
              {getStepMessage()}
            </p>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-2">Processing your verification...</p>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h3 className="text-xl font-semibold mb-2">Verification Complete!</h3>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      )}
    </div>
  );
};

export default KYCForm;
