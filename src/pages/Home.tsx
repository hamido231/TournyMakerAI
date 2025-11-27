import { Trophy, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-20">
        <h1 className="text-6xl font-bold mb-4">
          <span className="text-white">Tourny</span>
          <span className="text-rl-primary">Maker</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Competing on another level. Organize fairer Rocket League tournaments
          with friends.
        </p>
        <Link
          to="/auth"
          className="bg-rl-accent hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-full transition shadow-[0_0_20px_rgba(249,115,22,0.5)]"
        >
          Start Competing
        </Link>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 mb-20">
        <div className="bg-rl-card p-6 rounded-xl border border-slate-700">
          <Shield className="w-12 h-12 text-rl-primary mb-4" />
          <h3 className="text-xl font-bold mb-2">Fair Matchmaking</h3>
          <p className="text-gray-400">
            Our algorithm balances matches based on skill levels (1-10),
            ensuring every game is competitive.
          </p>
        </div>
        <div className="bg-rl-card p-6 rounded-xl border border-slate-700">
          <Trophy className="w-12 h-12 text-yellow-400 mb-4" />
          <h3 className="text-xl font-bold mb-2">Earn Titles & Rewards</h3>
          <p className="text-gray-400">
            Win tournaments to unlock exclusive profile titles, custom avatars,
            and special profile borders.
          </p>
        </div>
        <div className="bg-rl-card p-6 rounded-xl border border-slate-700">
          <Zap className="w-12 h-12 text-rl-accent mb-4" />
          <h3 className="text-xl font-bold mb-2">Instant Setup</h3>
          <p className="text-gray-400">
            Create a tournament in seconds. Share a unique code. You are the
            Admin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
