import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';
import { submitKYC } from '../../api/api';
import { useNavigate } from 'react-router-dom';

type VerificationStep = 
  | 'instructions' 
  | 'initializing'
  | 'recording'
  | 'processing'
  | 'complete'
  | 'submission-success';

const KYCForm = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<VerificationStep>('instructions');
  const [recordingTime, setRecordingTime] = useState(0);
  const [submissionDetails, setSubmissionDetails] = useState<{
    verificationId?: string;
    timestamp?: string;
  }>({});

  // Video recording constraints
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };

  // Start video recording
  const startRecording = () => {
    chunksRef.current = []; // Reset chunks
    setStep('recording');
    setRecordingTime(0);

    // Ensure webcam is ready
    if (webcamRef.current && webcamRef.current.stream) {
      const stream = webcamRef.current.stream;
      
      // Create MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });

      // Event listeners for recording
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = handleStopRecording;

      // Start recording
      mediaRecorderRef.current.start();

      // Start countdown timer
      const timer = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 4) {
            clearInterval(timer);
            stopRecording();
            return 4;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      toast.error('Webcam not accessible');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && 
        mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Handle stop recording and submission
  const handleStopRecording = async () => {
    setStep('processing');
    
    // Create video blob
    const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
    
    // Validate blob size
    if (videoBlob.size === 0) {
      toast.error('No video recorded. Please try again.');
      resetVerification();
      return;
    }

    try {
      // Prepare form data
      const videoFile = new File([videoBlob], 'kyc_video.webm', { 
        type: 'video/webm' 
      });
      
      const formData = new FormData();
      formData.append('video', videoFile);

      // Set loading state
      setLoading(true);

      // Submit KYC
      const response = await submitKYC(formData);

      // Handle successful submission
      if (response && response.success) {
        setSubmissionDetails({
          verificationId: response.verificationId || generateVerificationId(),
          timestamp: new Date().toLocaleString()
        });
        
        setStep('submission-success');
        
        // Redirect after a delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 5000);
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      console.error('KYC Submission Error:', error);
      toast.error('Verification failed. Please try again.');
      resetVerification();
    } finally {
      setLoading(false);
    }
  };

  // Generate a random verification ID if not provided by backend
  const generateVerificationId = () => {
    return `KYC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  // Reset verification process
  const resetVerification = () => {
    setStep('instructions');
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setSubmissionDetails({});
  };

  // Request camera permissions on component mount
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        toast.error('Camera access denied. Please allow camera permissions.');
      }
    };

    requestCameraPermission();
  }, []);

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">
        KYC Video Verification
      </h2>

      {/* Instructions Step */}
      {step === 'instructions' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Verification Instructions:</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>Ensure good lighting</li>
              <li>Remove glasses or face coverings</li>
              <li>Look directly at the camera</li>
              <li>Recording will be 4 seconds long</li>
            </ul>
          </div>
          <button
            onClick={startRecording}
            className="w-full bg-green-500 text-white p-3 rounded-md 
            hover:bg-green-600 transition-colors"
          >
            Start Video Verification
          </button>
        </div>
      )}

      {/* Recording Step */}
      {step === 'recording' && (
        <div className="text-center">
          <Webcam
            ref={webcamRef}
            audio={false}
            videoConstraints={videoConstraints}
            className="w-full rounded-lg mb-4"
          />
          <div className="text-xl font-bold text-red-500">
            Recording: {4 - recordingTime} seconds left
          </div>
        </div>
      )}

      {/* Processing Step */}
      {(step === 'processing' || loading) && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 
          border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Processing your verification...</p>
        </div>
      )}

      {/* Submission Success Step */}
      {step === 'submission-success' && (
        <div className="text-center bg-green-50 p-6 rounded-lg">
          <div className="text-green-500 text-6xl mb-4">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-16 w-16 mx-auto" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold text-green-700 mb-4">
            KYC Submitted Successfully!
          </h3>
          
          <div className="bg-white p-4 rounded-md shadow-md text-left">
            <p className="mb-2">
              <strong>Verification ID:</strong> 
              <span className="ml-2 text-blue-600">
                {submissionDetails.verificationId}
              </span>
            </p>
            <p>
              <strong>Submitted At:</strong> 
              <span className="ml-2">
                {submissionDetails.timestamp}
              </span>
            </p>
          </div>
          
          <div className="mt-4 text-gray-600">
            <p>You will be redirected to the dashboard shortly...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KYCForm;
