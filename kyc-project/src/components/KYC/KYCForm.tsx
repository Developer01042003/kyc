import { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';
import { submitKYC } from '../../api/api';
import { useNavigate } from 'react-router-dom';

type VerificationStep = 
  | 'instructions' 
  | 'initializing'
  | 'recording'
  | 'processing'
  | 'complete';

const KYCForm = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<VerificationStep>('instructions');
  const [capturedVideo, setCapturedVideo] = useState<Blob | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };

  // Start video recording and initialize necessary data
  const startVerification = () => {
    setStep('recording');
    setBlinkCount(0);
    setCapturedVideo(null);
    setVideoStream(null);

    if (webcamRef.current) {
      // Start recording the video stream
      const stream = webcamRef.current.stream;
      if (stream) {
        setVideoStream(stream);
      }
    }
    toast.success('Please blink twice during the video recording.');
    setTimeout(() => {
      stopRecording();
    }, 4000);  // Stop recording after 4 seconds
  };

  const stopRecording = () => {
    if (videoStream) {
      const recorder = new MediaRecorder(videoStream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        setCapturedVideo(videoBlob);
        setStep('processing');
        handleSubmit(videoBlob);
      };

      recorder.start();
    }
  };

  const handleSubmit = async (video: Blob) => {
    setLoading(true);
    try {
      const videoFile = new File([video], 'user_video.webm', { type: 'video/webm' });
      const formData = new FormData();
      formData.append('video', videoFile);

      // Send the video to the backend via submitKYC
      await submitKYC(formData);
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
    setCapturedVideo(null);
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

      {step === 'recording' && (
        <div className="text-center py-8">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full rounded-lg"
          />
          <div className="text-center mt-4">
            <p>Please blink twice during the video recording.</p>
            <p>Recording for 4 seconds...</p>
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
