import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { submitKYC } from '../../api/api';

const LivenessCheck = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [step, setStep] = useState<'instructions' | 'detection' | 'preview' | 'submitting'>('instructions');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
  };

  const handleStartDetection = () => {
    setStep('detection');
    toast.success('Please look at the camera and blink when prompted');
    setTimeout(() => {
      toast.success('Please blink now');
      setTimeout(captureImage, 2000);
    }, 3000);
  };

  const captureImage = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setStep('preview');
      toast.success('Image captured successfully!');
    }
  }, [webcamRef]);

  const handleRetake = () => {
    setCapturedImage(null);
    setStep('detection');
  };

  const handleSubmit = async () => {
    if (!capturedImage) return;

    setStep('submitting');
    try {
      await submitKYC(capturedImage);
      toast.success('KYC submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to submit KYC. Please try again.');
      setStep('preview');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            KYC Verification - Face Liveness Check
          </h2>

          {step === 'instructions' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Instructions:</h3>
                <ul className="list-disc list-inside text-blue-700 space-y-2">
                  <li>Ensure you are in a well-lit environment</li>
                  <li>Remove any face coverings (glasses, masks, etc.)</li>
                  <li>Look directly at the camera</li>
                  <li>Blink naturally when prompted</li>
                </ul>
              </div>
              <button
                onClick={handleStartDetection}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Start Verification
              </button>
            </div>
          )}

          {step === 'detection' && (
            <div className="space-y-4">
              <div className="relative">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full rounded-lg"
                />
                <div className="absolute inset-0 border-2 border-green-500 rounded-lg"></div>
              </div>
              <p className="text-center text-gray-600">
                Please follow the instructions and keep your face within the frame
              </p>
            </div>
          )}

          {step === 'preview' && capturedImage && (
            <div className="space-y-4">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full rounded-lg"
              />
              <div className="flex space-x-4">
                <button
                  onClick={handleRetake}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Retake Photo
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {step === 'submitting' && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LivenessCheck;