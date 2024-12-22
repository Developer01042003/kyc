import { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';
import { submitKYC } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import type { VerificationStep } from '../../types/kyc';

const KYCForm = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [step, setStep] = useState<VerificationStep>('instructions');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const lastBlinkTime = useRef(Date.now());

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
  };

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoading(true);
        console.log('Loading face detection models...');
        
        // Test if models are accessible
        const testResponse = await fetch('/models/tiny_face_detector_model-weights_manifest.json');
        if (!testResponse.ok) {
          throw new Error('Models not accessible');
        }

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);

        console.log('Face detection models loaded successfully');
        setModelsLoaded(true);
        toast.success('Face detection initialized');
      } catch (error) {
        console.error('Error loading face detection models:', error);
        toast.error('Failed to initialize face detection. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    if (step === 'initializing') {
      loadModels();
    }
  }, [step]);

  // Face detection loop
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const detectFace = async () => {
      if (!webcamRef.current?.video || !modelsLoaded) return;

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

    if (modelsLoaded && ['initial-blink', 'look-straight', 'final-blink'].includes(step)) {
      interval = setInterval(detectFace, 100);
    }

    return () => clearInterval(interval);
  }, [step, modelsLoaded]);

  const checkBlink = (landmarks: faceapi.FaceLandmarks68) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    const leftEAR = getEyeAspectRatio(leftEye);
    const rightEAR = getEyeAspectRatio(rightEye);
    const averageEAR = (leftEAR + rightEAR) / 2;

    const now = Date.now();
    if (averageEAR < 0.2 && now - lastBlinkTime.current > 500) {
      lastBlinkTime.current = now;
      setBlinkCount(prev => {
        const newCount = prev + 1;
        if (step === 'initial-blink' && newCount >= 1) {
          toast.success('Initial blink detected!');
          setStep('look-straight');
        } else if (step === 'final-blink' && newCount >= 2) {
          toast.success('Final blink detected!');
          autoCapture();
        }
        return newCount;
      });
    }
  };

  // Your existing helper functions (getEyeAspectRatio, getDistance, checkStraightFace)...

  const startVerification = () => {
    setStep('initializing');
    setBlinkCount(0);
    setCapturedImage(null);
  };

  const autoCapture = () => {
    if (webcamRef.current && blinkCount >= 2) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        setStep('processing');
        handleSubmit(imageSrc);
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
      console.error('KYC submission error:', error);
      toast.error('Failed to submit KYC. Please try again.');
      resetVerification();
    } finally {
      setLoading(false);
    }
  };

  const resetVerification = () => {
    setStep('instructions');
    setBlinkCount(0);
    setCapturedImage(null);
    setFaceDetected(false);
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
              <li>Follow the on-screen instructions</li>
            </ol>
          </div>
          <button
            onClick={startVerification}
            className="w-full bg-green-500 text-white p-3 rounded-md hover:bg-green-600 transition-colors"
          >
            Start Verification
          </button>
        </div>
      )}

      {step === 'initializing' && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4">Initializing face detection...</p>
        </div>
      )}

      {['initial-blink', 'look-straight', 'final-blink'].includes(step) && (
        <div className="space-y-4">
          <div className="relative">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full rounded-lg"
            />
            <div className={`absolute inset-0 border-4 rounded-lg transition-colors ${
              faceDetected ? 'border-green-500' : 'border-red-500'
            }`} />
          </div>
          
          <div className="text-center">
            {faceDetected ? (
              <p className="text-green-600">
                {step === 'initial-blink' && 'Please blink once'}
                {step === 'look-straight' && 'Please look straight at the camera'}
                {step === 'final-blink' && `Please blink twice (${blinkCount}/2)`}
              </p>
            ) : (
              <p className="text-red-600">
                No face detected. Please position your face in the frame
              </p>
            )}
          </div>
        </div>
      )}

      {(step === 'processing' || loading) && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4">Processing your verification...</p>
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
