import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import TournamentView from "./pages/TournamentView";
import CreateTournament from "./pages/CreateTournament";

function App() {
  return (
    <div className="min-h-screen bg-rl-dark text-white font-sans">
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<CreateTournament />} />
          <Route path="/tournament/:id" element={<TournamentView />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
