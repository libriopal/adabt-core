import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AGROSLayout from './components/AGROSLayout';
import SlotGen from './pages/SlotGen';
import ConceptForge from './pages/ConceptForge';
import MusicEngine from './pages/MusicEngine';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AGROSLayout />}>
          <Route path="/" element={<SlotGen />} />
          <Route path="/concept-forge" element={<ConceptForge />} />
          <Route path="/music-engine" element={<MusicEngine />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
