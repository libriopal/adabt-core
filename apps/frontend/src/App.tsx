import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AGROSLayout from './components/AGROSLayout';
import RhythmEngine from './pages/RhythmEngine';
import ConceptForge from './pages/ConceptForge';
import MusicEngine from './pages/MusicEngine';
import OrganicVegasLobby from './pages/OrganicVegasLobby';
import OrganicVegas from './pages/OrganicVegas';
import AgeGate, { isAgeVerified } from './components/AgeGate';

function OrganicVegasEntry() {
  const [verified, setVerified] = useState(isAgeVerified);
  if (!verified) return <AgeGate onVerified={() => setVerified(true)} />;
  return <OrganicVegasLobby />;
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default: land on Organic Vegas age gate */}
        <Route path="/" element={<Navigate to="/organic-vegas" replace />} />

        {/* Organic Vegas */}
        <Route path="/organic-vegas" element={<OrganicVegasEntry />} />
        <Route path="/organic-vegas/game" element={<OrganicVegas />} />

        {/* AGROS engine — still reachable at /agros/* */}
        <Route path="/agros" element={<AGROSLayout />}>
          <Route index element={<RhythmEngine />} />
          <Route path="concept-forge" element={<ConceptForge />} />
          <Route path="music-engine" element={<MusicEngine />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
