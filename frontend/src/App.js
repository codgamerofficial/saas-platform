import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';

// Context and Hooks
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Components
import Navbar from './components/Navbar/Navbar';
import Hero from './components/Hero/Hero';
import Features from './components/Features/Features';
import Dashboard from './pages/Dashboard/Dashboard';
import ImageTools from './pages/ImageTools/ImageTools';
import DocumentTools from './pages/DocumentTools/DocumentTools';
import AITools from './pages/AITools/AITools';
import VideoTools from './pages/VideoTools/VideoTools';
import SignatureMaker from './pages/SignatureMaker/SignatureMaker';
import PassportMaker from './pages/PassportMaker/PassportMaker';
import Profile from './pages/Profile/Profile';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';

// 3D Background Component
const Scene3D = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#667eea" />

      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />

      <Float speed={1.4} rotationIntensity={1} floatIntensity={0.5}>
        <Center>
          <Text3D
            font="/fonts/helvetiker_regular.typeface.json"
            size={2}
            height={0.2}
            curveSegments={12}
            bevelEnabled
            bevelThickness={0.02}
            bevelSize={0.02}
            bevelOffset={0}
            bevelSegments={5}
          >
            SaaS Platform
            <meshStandardMaterial
              color="#667eea"
              emissive="#667eea"
              emissiveIntensity={0.2}
              metalness={0.8}
              roughness={0.2}
            />
          </Text3D>
        </Center>
      </Float>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={Math.PI / 2}
        minPolarAngle={Math.PI / 2}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

// Main App Component
const AppContent = () => {
  const { user } = useAuth();
  const [show3D, setShow3D] = useState(true);

  useEffect(() => {
    // Disable 3D on mobile for performance
    const checkMobile = () => {
      setShow3D(window.innerWidth > 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="App">
      {/* 3D Background */}
      {show3D && (
        <div className="fixed inset-0 -z-10">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 75 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance"
            }}
          >
            <Suspense fallback={null}>
              <Scene3D />
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10">
        <Navbar />

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={
            <>
              <Hero />
              <Features />
            </>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/image-tools" element={
            <ProtectedRoute>
              <ImageTools />
            </ProtectedRoute>
          } />

          <Route path="/document-tools" element={
            <ProtectedRoute>
              <DocumentTools />
            </ProtectedRoute>
          } />

          <Route path="/ai-tools" element={
            <ProtectedRoute>
              <AITools />
            </ProtectedRoute>
          } />

          <Route path="/video-tools" element={
            <ProtectedRoute>
              <VideoTools />
            </ProtectedRoute>
          } />

          <Route path="/signature-maker" element={
            <ProtectedRoute>
              <SignatureMaker />
            </ProtectedRoute>
          } />

          <Route path="/passport-maker" element={
            <ProtectedRoute>
              <PassportMaker />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="/admin/*" element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
};

// Main App with Providers
const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;