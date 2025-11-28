/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import { PlayCircle, Shield } from "lucide-react";

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  // History State
  const [hosted, setHosted] = useState<any[]>([]);
  const [joined, setJoined] = useState<any[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    const getData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // 1. Get Profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(profileData);

        // 2. Get Hosted Tournaments
        const { data: hostedData } = await supabase
          .from("tournaments")
          .select("*")
          .eq("host_id", user.id)
          .order("created_at", { ascending: false });
        if (hostedData) setHosted(hostedData);

        // 3. Get Joined Tournaments
        const { data: joinedData } = await supabase
          .from("participants")
          .select("tournaments(*)")
          .eq("player_id", user.id);

        if (joinedData) {
          // Map the nested data structure
          const flatList = joinedData
            .map((item: any) => item.tournaments)
            .filter(Boolean);

          // Sort by date (Newest first)
          flatList.sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );

          setJoined(flatList);
        }
      }
    };
    getData();
  }, []);

  const handleJoin = async () => {
    if (!joinCode) return alert("Please enter a code");
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      // 1. Find Tournament
      const { data: tournament, error: tError } = await supabase
        .from("tournaments")
        .select("id")
        .eq("join_code", joinCode.trim().toUpperCase())
        .single();

      if (tError || !tournament) throw new Error("Invalid Tournament Code");

      // 2. Join
      const { error: pError } = await supabase
        .from("participants")
        .insert({ tournament_id: tournament.id, player_id: user.id });

      if (pError && !(pError as any).message?.includes("unique constraint"))
        throw pError;

      navigate(`/tournament/${tournament.id}`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-rl-card to-slate-900 p-8 rounded-2xl mb-8 flex items-center gap-6 border border-slate-700 shadow-xl">
        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-4xl border-4 border-rl-primary overflow-hidden">
          <img
            src={
              profile?.avatar_url ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username}`
            }
            alt="avatar"
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold">
            {profile?.username || "Loading..."}
          </h1>
          <p className="text-rl-primary font-mono">
            {profile?.rl_username || "No ID"}
          </p>
          <div className="flex gap-4 mt-2">
            <span className="bg-slate-800 text-white px-3 py-1 rounded text-sm font-bold border-l-4 border-rl-primary">
              Rank:{" "}
              {profile?.skill_level <= 8
                ? [
                    "Bronze",
                    "Silver",
                    "Gold",
                    "Plat",
                    "Diamond",
                    "Champ",
                    "GC",
                    "SSL",
                  ][profile?.skill_level - 1]
                : profile?.skill_level}
            </span>
            <span className="bg-slate-800 text-white px-3 py-1 rounded text-sm font-bold border-l-4 border-rl-accent">
              {profile?.sub_points || 50} pts
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="bg-rl-card p-6 rounded-xl border border-slate-700 shadow-lg">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <PlayCircle /> Join Arena
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Code (e.g. X9Y2Z)"
              className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-rl-primary"
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
        <div className="bg-rl-card p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-center items-center">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield /> Host Arena
          </h2>
          <Link
            to="/create"
            className="bg-rl-accent hover:bg-orange-600 w-full py-2 rounded font-bold text-center text-white transition"
          >
            Create Bracket
          </Link>
        </div>
      </div>

      {/* HISTORY SECTION */}
      <h2 className="text-2xl font-bold mb-6 border-l-4 border-white pl-4">
        Tournament History
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        {/* HOSTED */}
        <div>
          <h3 className="text-rl-accent font-bold mb-4 uppercase tracking-wider text-sm">
            Hosted by You
          </h3>
          <div className="space-y-3">
            {hosted.length === 0 ? (
              <p className="text-gray-500 italic">No tournaments hosted.</p>
            ) : (
              hosted.map((t) => (
                <Link
                  key={t.id}
                  to={`/tournament/${t.id}`}
                  className="block bg-slate-800 p-4 rounded border border-slate-700 hover:border-rl-accent transition"
                >
                  <div className="flex justify-between">
                    <span className="font-bold text-white">{t.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                        t.status === "open"
                          ? "bg-green-900 text-green-400"
                          : "bg-blue-900 text-blue-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    Code: {t.join_code}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* JOINED */}
        <div>
          <h3 className="text-rl-primary font-bold mb-4 uppercase tracking-wider text-sm">
            Joined Arenas
          </h3>
          <div className="space-y-3">
            {joined.length === 0 ? (
              <p className="text-gray-500 italic">No tournaments joined.</p>
            ) : (
              joined.map((t) => (
                <Link
                  key={t.id}
                  to={`/tournament/${t.id}`}
                  className="block bg-slate-800 p-4 rounded border border-slate-700 hover:border-rl-primary transition"
                >
                  <div className="flex justify-between">
                    <span className="font-bold text-white">{t.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                        t.status === "open"
                          ? "bg-green-900 text-green-400"
                          : "bg-blue-900 text-blue-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    View Bracket →
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
