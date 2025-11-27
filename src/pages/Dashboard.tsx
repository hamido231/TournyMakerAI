import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link, useNavigate } from "react-router-dom";

const Dashboard = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const getProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
    };
    getProfile();
  }, []);

  const handleJoin = async () => {
    if (!joinCode) return alert("Please enter a code");
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      // 1. Find the tournament ID from the code
      const { data: tournament, error: tError } = await supabase
        .from("tournaments")
        .select("id")
        .eq("join_code", joinCode.trim().toUpperCase())
        .single();

      if (tError || !tournament) throw new Error("Invalid Tournament Code");

      // 2. Add user to participants table
      const { error: pError } = await supabase.from("participants").insert({
        tournament_id: tournament.id,
        player_id: user.id,
      });

      // Ignore error if they are already joined (duplicate key)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (
        pError &&
        !(pError as any).message?.includes("unique constraint") &&
        pError.code !== "23505"
      ) {
        throw pError;
      }

      // 3. Go there
      navigate(`/tournament/${tournament.id}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      alert(error.message || "Error joining");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-rl-card to-slate-900 p-8 rounded-2xl mb-8 flex items-center gap-6 border border-slate-700">
        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-4xl border-4 border-rl-primary overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" />
          ) : (
            "🚗"
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{profile?.username || "Pilot"}</h1>
          <p className="text-rl-primary">
            {profile?.rl_username || "No ID Linked"}
          </p>
          <div className="flex gap-4 mt-2">
            <span className="bg-slate-800 text-white px-3 py-1 rounded text-sm font-bold border-l-4 border-rl-primary">
              Level {profile?.skill_level || 1}
            </span>
            <span className="bg-slate-800 text-white px-3 py-1 rounded text-sm font-bold border-l-4 border-rl-accent">
              {profile?.sub_points || 50} pts
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-rl-card p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Join Tournament</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Code (e.g. X9Y2Z)"
              className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-rl-primary outline-none"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button
              onClick={handleJoin}
              disabled={loading}
              className="bg-rl-primary hover:bg-cyan-600 px-6 py-2 rounded font-bold text-black transition"
            >
              {loading ? "..." : "JOIN"}
            </button>
          </div>
        </div>
        <div className="bg-rl-card p-6 rounded-xl border border-slate-700 flex flex-col justify-center items-center">
          <h2 className="text-xl font-bold mb-4">Host Tournament</h2>
          <Link
            to="/create"
            className="bg-rl-accent hover:bg-orange-600 w-full py-2 rounded font-bold text-center text-white transition"
          >
            Create Bracket
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
