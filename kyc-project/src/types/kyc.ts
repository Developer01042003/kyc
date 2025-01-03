export interface KYCState {
    isVerified: boolean;
    status: 'pending' | 'approved' | 'rejected' | 'not_submitted';
    message?: string;
  }
  
  export interface LivenessState {
    isBlinking: boolean;
    faceDetected: boolean;
    capturedImage: string | null;
    status: 'idle' | 'checking' | 'success' | 'error';
  }


export type VerificationStep = 
  | 'instructions' 
  | 'initializing'
  | 'initial-blink' 
  | 'look-straight' 
  | 'final-blink' 
  | 'processing' 
  | 'complete';
