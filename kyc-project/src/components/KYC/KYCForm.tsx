import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';
import { submitKYC } from '../../api/api';
import { useNavigate } from 'react-router-dom';

type VerificationStep = 
  | 'permissions'
  | 'instructions' 
  | 'recording'
  | 'processing'
  | 'complete';

const KYCForm = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [step, setStep] = useState<VerificationStep>('permissions');
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Video recording constraints
  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    aspectRatio: 16 / 9,
    facingMode: "user"
  };

  // Request Camera Permissions
  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      });

      setCameraStream(stream);
      setStep('instructions');
      toast.success('Camera access granted');
    } catch (error) {
      console.error('Camera permission error:', error);
      toast.error('Camera access denied. Please check permissions.');
    }
  };

  // Start video recording
  const startRecording = async () => {
    try {
      if (!cameraStream) {
        toast.error('Camera stream not available');
        return;
      }

      // Reset recording chunks
      chunksRef.current = [];
      setStep('recording');
      setRecordingTime(0);

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(cameraStream, {
        mimeType: 'video/webm'
      });

      // Setup event listeners
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleStopRecording;

      // Start recording
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      // Countdown timer
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

    } catch (error) {
      console.error('Recording start error:', error);
      toast.error('Failed to start recording');
      resetVerification();
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  // Handle video submission
  const handleStopRecording = async () => {
    setStep('processing');

    try {
      // Create video blob
      const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });

      // Validate blob
      if (videoBlob.size === 0) {
        toast.error('No video recorded. Please try again.');
        resetVerification();
        return;
      }

      // Validate blob size (optional: limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (videoBlob.size > maxSize) {
        toast.error('Video file is too large. Maximum 10MB allowed.');
        resetVerification();
        return;
      }

      // Prepare form data
      const videoFile = new File([videoBlob], 'kyc_video.webm', { 
        type: 'video/webm' 
      });
      
      const formData = new FormData();
      formData.append('video', videoFile);

      // Submit KYC
      const response = await submitKYC(formData);

      // Handle response
      if (response.success) {
        // Success scenario
        toast.success(response.message || 'KYC Verification Successful!');
        setStep('complete');

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        // Error scenario
        toast.error(response.message || 'Verification failed');
        resetVerification();
      }

    } catch (error) {
      console.error('KYC Submission Error:', error);
      toast.error('An unexpected error occurred during verification');
      resetVerification();
    }
  };

  // Reset verification process
  const resetVerification = () => {
    // Stop existing stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }

    setStep('permissions');
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setCameraStream(null);
    setRecordingTime(0);
  };

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">
        KYC Video Verification
      </h2>

      {/* Permissions Step */}
      {step === 'permissions' && (
        <div className="space-y-4 text-center">
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Camera Access Required</h3>
            <p className="mb-4">
              We need access to your camera to complete the verification process.
            </p>
          </div>
          <button
            onClick={requestCameraPermission}
            className="w-full bg-blue-500 text-white p-3 rounded-md 
            hover:bg-blue-600 transition-colors"
          >
            Grant Camera Access
          </button>
        </div>
      )}

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
      {step === 'recording' && cameraStream && (
        <div className="text-center">
          <Webcam
            ref={webcamRef}
            audio={false}
            videoConstraints={videoConstraints}
            className="w-full rounded-lg mb-4"
            mirrored={true}
            style={{ 
              width: '100%', 
              height: 'auto', 
              objectFit: 'cover' 
            }}
          />
          <div className="text-xl font-bold text-red-500">
            Recording: {4 - recordingTime} seconds left
          </div>
        </div>
      )}

      {/* Processing Step */}
      {step === 'processing' && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 
          border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Processing your verification...</p>
        </div>
      )}

      {/* Completion Step */}
      {step === 'complete' && (
        <div className="text-center">
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
          <h3 className="text-2xl font-semibold text-green-700">
            Verification Complete!
          </h3>
          <p className="text-gray-600 mt-2">
            You will be redirected to the dashboard shortly...
          </p>
        </div>
      )}
    </div>
  );
};

export default KYCForm;
