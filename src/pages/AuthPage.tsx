import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

const AuthPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login and Signup

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [rlUsername, setRlUsername] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // --- SIGN UP LOGIC ---
        // 1. Create User in Supabase Auth
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (data.user) {
          // 2. Create User Profile in the Database
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              username: username,
              rl_username: rlUsername,
              skill_level: 1, // Default starting level
              sub_points: 50,
            });

          if (profileError) {
            console.error("Profile Error:", profileError);
            // Optional: Delete the auth user if profile creation fails
          } else {
            alert("Account created! You are now logged in.");
            navigate("/dashboard");
          }
        }
      } else {
        // --- LOGIN LOGIC ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (error) {
      // FIX: We remove ': any' and cast it safely inside
      const message = (error as Error).message || "An unknown error occurred";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-[80vh]">
      <div className="bg-rl-card p-8 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
        <h2 className="text-3xl font-bold mb-6 text-center text-white">
          {isSignUp ? "Join the Arena" : "Pilot Login"}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          {/* Email & Password are always needed */}
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

          {/* Only show these if Signing Up */}
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
                  Rocket League ID (Gamertag)
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-rl-primary"
                  placeholder="e.g. Kronovi"
                  value={rlUsername}
                  onChange={(e) => setRlUsername(e.target.value)}
                />
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
