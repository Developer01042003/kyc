import * as faceapi from 'face-api.js';

export const loadModels = async () => {
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models')
    ]);
    return true;
  } catch (error) {
    console.error('Error loading face detection models:', error);
    return false;
  }
};

export const detectFace = async (videoElement: HTMLVideoElement) => {
  try {
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();
    
    return detection || null;
  } catch (error) {
    console.error('Error detecting face:', error);
    return null;
  }
};

export const detectBlink = (landmarks: faceapi.FaceLandmarks68) => {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  
  const leftEAR = getEyeAspectRatio(leftEye);
  const rightEAR = getEyeAspectRatio(rightEye);
  
  const averageEAR = (leftEAR + rightEAR) / 2;
  return averageEAR < 0.2; // Threshold for blink detection
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