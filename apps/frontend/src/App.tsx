import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AGROSLayout from './components/AGROSLayout';
import RhythmEngine from './pages/RhythmEngine';
import ConceptForge from './pages/ConceptForge';
import MusicEngine from './pages/MusicEngine';
import OrganicVegasLobby from './pages/OrganicVegasLobby';
import OrganicVegas from './pages/OrganicVegas';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Existing AGROS routes — unchanged per route-mapping directive */}
        <Route element={<AGROSLayout />}>
          <Route path="/" element={<RhythmEngine />} />
          <Route path="/concept-forge" element={<ConceptForge />} />
          <Route path="/music-engine" element={<MusicEngine />} />
        </Route>

        {/* Organic Vegas — parallel route, does not replace "/" */}
        <Route path="/organic-vegas" element={<OrganicVegasLobby />} />
        <Route path="/organic-vegas/game" element={<OrganicVegas />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
