import React from 'react';
import CameraTest from '../components/CameraTest';

const CameraTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 pt-24">
      <div className="container mx-auto px-6 py-8">
        <CameraTest />
      </div>
    </div>
  );
};

export default CameraTestPage;