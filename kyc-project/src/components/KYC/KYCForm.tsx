import { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';
import { submitKYC } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';

type VerificationStep = 
  | 'instructions'
  | 'initial-blink'
  | 'look-straight'
  | 'final-blink'
  | 'processing'
  | 'complete';

const KYCForm = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<VerificationStep>('instructions');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [straightFace, setStraightFace] = useState(false);
  const intervalRef = useRef<number>();
  const [verificationStatus, setVerificationStatus] = useState({
    initialBlink: false,
    straightFace: false,
    finalBlink: false
  });

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        console.log('Face detection models loaded');
      } catch (error) {
        console.error('Error loading models:', error);
        toast.error('Failed to load face detection');
      }
    };
    loadModels();
  }, []);

  // Start face detection
  useEffect(() => {
    if (['initial-blink', 'look-straight', 'final-blink'].includes(step) && webcamRef.current?.video) {
      intervalRef.current = window.setInterval(async () => {
        await detectFace();
      }, 100);
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [step]);

  const detectFace = async () => {
    if (!webcamRef.current?.video) return;

    try {
      const detection = await faceapi
        .detectSingleFace(
          webcamRef.current.video,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks();

      if (detection) {
        setFaceDetected(true);
        
        if (step === 'initial-blink' || step === 'final-blink') {
          checkBlink(detection.landmarks);
        } else if (step === 'look-straight') {
          checkStraightFace(detection);
        }
      } else {
        setFaceDetected(false);
      }
    } catch (error) {
      console.error('Face detection error:', error);
    }
  };

  const checkBlink = (landmarks: faceapi.FaceLandmarks68) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    const leftEAR = getEyeAspectRatio(leftEye);
    const rightEAR = getEyeAspectRatio(rightEye);
    const averageEAR = (leftEAR + rightEAR) / 2;

    if (averageEAR < 0.2) {
      if (step === 'initial-blink') {
        setVerificationStatus(prev => ({ ...prev, initialBlink: true }));
        toast.success('Initial blink detected!');
        setStep('look-straight');
      } else if (step === 'final-blink') {
        setVerificationStatus(prev => ({ ...prev, finalBlink: true }));
        autoCapture();
      }
    }
  };

  const checkStraightFace = (detection: any) => {
    // Simple straight face detection - you might want to make this more sophisticated
    const landmarks = detection.landmarks;
    const nose = landmarks.getNose();
    const jawline = landmarks.getJawOutline();
    
    // Check if face is relatively centered and straight
    const isStraight = true; // Add your logic here
    
    if (isStraight) {
      setStraightFace(true);
      setVerificationStatus(prev => ({ ...prev, straightFace: true }));
      toast.success('Face is straight, please blink once more');
      setStep('final-blink');
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

  const autoCapture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setStep('processing');
      if (imageSrc && verificationStatus.initialBlink && 
          verificationStatus.straightFace && verificationStatus.finalBlink) {
        handleSubmit(imageSrc);
      } else {
        toast.error('Verification process incomplete');
        setStep('instructions');
      }
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
      toast.error('Failed to submit KYC');
      setStep('instructions');
    } finally {
      setLoading(false);
    }
  };

  const startLivenessCheck = () => {
    setStep('initial-blink');
    toast.success('Please blink naturally');
  };

  const getStepInstructions = () => {
    switch (step) {
      case 'initial-blink':
        return 'Please blink naturally to begin verification';
      case 'look-straight':
        return 'Please look straight at the camera';
      case 'final-blink':
        return 'Please blink once more to complete verification';
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
            <h3 className="font-semibold mb-2">Verification Steps:</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>Blink naturally to begin</li>
              <li>Look straight at the camera</li>
              <li>Blink once more to complete</li>
            </ol>
          </div>
          <button
            onClick={startLivenessCheck}
            className="w-full bg-green-500 text-white p-3 rounded-md hover:bg-green-600 transition-colors"
          >
            Start Verification
          </button>
        </div>
      )}

      {['initial-blink', 'look-straight', 'final-blink'].includes(step) && (
        <div className="space-y-4">
          <div className="relative">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full rounded-lg"
              videoConstraints={{
                width: 1280,
                height: 720,
                facingMode: "user"
              }}
            />
            <div className={`absolute inset-0 border-4 rounded-lg transition-colors ${
              faceDetected ? 'border-green-500' : 'border-red-500'
            }`} />
          </div>
          
          <div className="text-center">
            {faceDetected ? (
              <p className="text-green-600">
                {getStepInstructions()}
              </p>
            ) : (
              <p className="text-red-600">
                No face detected. Please position your face in the frame
              </p>
            )}
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-center">Processing your verification...</p>
          </div>
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