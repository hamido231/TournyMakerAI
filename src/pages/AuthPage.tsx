import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export const RANK_MAP = [
  { name: "Bronze", value: 1, color: "text-orange-700" },
  { name: "Silver", value: 2, color: "text-gray-400" },
  { name: "Gold", value: 3, color: "text-yellow-400" },
  { name: "Platinum", value: 4, color: "text-cyan-200" },
  { name: "Diamond", value: 5, color: "text-cyan-500" },
  { name: "Champion", value: 6, color: "text-purple-500" },
  { name: "Grand Champion", value: 7, color: "text-red-500" },
  { name: "SSL", value: 8, color: "text-white" },
];

const AuthPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [rlUsername, setRlUsername] = useState("");
  const [rank, setRank] = useState("1"); // Default Bronze

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // 1. Sign Up
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;

        if (data.user) {
          // 2. Create Profile with Selected Rank
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              username: username,
              rl_username: rlUsername,
              skill_level: parseInt(rank), // Store as number 1-8
              sub_points: 50,
            });

          if (profileError) console.error(profileError);
          else {
            alert("Account created! Logging you in...");
            navigate("/dashboard");
          }
        }
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (error: any) {
      alert(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[80vh] py-10">
      <div className="bg-rl-card p-8 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
        <h2 className="text-3xl font-bold mb-6 text-center text-white">
          {isSignUp ? "Join the Arena" : "Pilot Login"}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-rl-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-rl-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {isSignUp && (
            <>
              <div>
                <label className="block text-sm text-rl-primary mb-1 font-bold">
                  Create Username
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-rl-primary"
                  placeholder="TournyMaster99"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Rocket League ID
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-rl-primary"
                  placeholder="e.g. Kronovi"
                  value={rlUsername}
                  onChange={(e) => setRlUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-rl-accent mb-1 font-bold">
                  Current Rank
                </label>
                <select
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-rl-accent"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                >
                  {RANK_MAP.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rl-accent hover:bg-orange-600 text-white font-bold py-3 rounded mt-4 transition"
          >
            {loading ? "Processing..." : isSignUp ? "Sign Up" : "Log In"}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-400">
          {isSignUp ? "Already have an account?" : "New to TournyMaker?"}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-rl-primary font-bold ml-2 hover:underline"
          >
            {isSignUp ? "Log In" : "Create Account"}
          </button>
        </p>
      </div>
    </div>
  );
};
export default AuthPage;
