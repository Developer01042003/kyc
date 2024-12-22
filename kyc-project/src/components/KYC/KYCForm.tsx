import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';
import { submitKYC } from '../../api/api';
import { useNavigate } from 'react-router-dom';

type VerificationStep = 
  | 'instructions' 
  | 'recording'
  | 'processing'
  | 'complete';

const KYCForm = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [step, setStep] = useState<VerificationStep>('instructions');
  const [recordingTime, setRecordingTime] = useState(0);

  // Video recording constraints
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };

  // Start video recording
  const startRecording = async () => {
    try {
      // Ensure webcam is accessible
      if (!webcamRef.current) {
        toast.error('Webcam not initialized');
        return;
      }

      // Get the media stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false 
      });

      // Reset recording chunks
      chunksRef.current = [];
      setStep('recording');
      setRecordingTime(0);

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
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
      toast.error('Failed to start recording. Please check camera permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks to release camera
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(track => track.stop());
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

      // Prepare form data
      const videoFile = new File([videoBlob], 'kyc_video.webm', { 
        type: 'video/webm' 
      });
      
      const formData = new FormData();
      formData.append('video', videoFile);

      // Submit KYC
      const response = await submitKYC(formData);

      // Handle successful submission
      if (response && response.success) {
        toast.success('KYC Verification Successful!');
        setStep('complete');

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      console.error('KYC Submission Error:', error);
      toast.error('Verification failed. Please try again.');
      resetVerification();
    }
  };

  // Reset verification process
  const resetVerification = () => {
    setStep('instructions');
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setRecordingTime(0);
  };

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
          <div className="text-green-500 text-6xl mb-4">✓</div>
          <h3 className="text-2xl font-semibold">Verification Complete!</h3>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      )}
    </div>
  );
};

export default KYCForm;
