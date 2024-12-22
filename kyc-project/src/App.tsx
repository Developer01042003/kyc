import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginForm from './components/Auth/LoginForm';
import SignupForm from './components/Auth/SignupForm';
import KYCForm from './components/KYC/KYCForm';
import Dashboard from './components/Dashboard/Dashboard';

function App() {
  return (
    <HashRouter>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<LoginForm />} />
            <Route path="/signup" element={<SignupForm />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/kyc" element={<KYCForm />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
