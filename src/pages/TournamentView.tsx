import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Copy, UserPlus, Users } from "lucide-react"; // <--- REMOVED 'Flag'

const TournamentView = () => {
  const { id } = useParams();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tournament, setTournament] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Manual Add State
  const [addName, setAddName] = useState("");
  const [guestRank, setGuestRank] = useState("1"); // Default rank 1
  const [addLoading, setAddLoading] = useState(false);

  // Helper to generate UUIDs
  const generateUUID = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  };

  const fetchData = async () => {
    if (!id) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);

    const { data: tData } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", id)
      .single();
    setTournament(tData);

    const { data: pData } = await supabase
      .from("participants")
      .select(
        "player_id, profiles(username, skill_level, rl_username, is_guest)"
      )
      .eq("tournament_id", id);

    if (pData) setParticipants(pData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleManualAdd = async () => {
    if (!addName) return;
    setAddLoading(true);

    try {
      // A. Try to find a REAL user first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: foundUser } = await supabase
        .from("profiles")
        .select("id, skill_level")
        .eq("username", addName)
        .single();

      let playerIdToAdd = foundUser?.id;

      // B. If no real user found, Create a GUEST Profile with selected Rank
      if (!playerIdToAdd) {
        const guestId = generateUUID();
        const { error: createGuestError } = await supabase
          .from("profiles")
          .insert({
            id: guestId,
            username: addName,
            rl_username: "Guest",
            is_guest: true,
            skill_level: parseInt(guestRank), // Use the selected rank
            sub_points: 50,
          });

        if (createGuestError) {
          if (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (createGuestError as any).message?.includes("unique constraint")
          ) {
            const uniqueGuestId = generateUUID();
            const uniqueName = `${addName}_${Math.floor(Math.random() * 1000)}`;
            await supabase.from("profiles").insert({
              id: uniqueGuestId,
              username: uniqueName,
              rl_username: "Guest",
              is_guest: true,
              skill_level: parseInt(guestRank), // Use the selected rank
            });
            playerIdToAdd = uniqueGuestId;
          } else {
            throw createGuestError;
          }
        } else {
          playerIdToAdd = guestId;
        }
      }

      // C. Add to participants
      const { error: insertError } = await supabase
        .from("participants")
        .insert({ tournament_id: id, player_id: playerIdToAdd });

      if (insertError) throw insertError;

      setAddName("");
      setGuestRank("1"); // Reset rank
      fetchData();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setAddLoading(false);
    }
  };

  if (loading)
    return (
      <div className="text-center mt-20 text-rl-primary font-bold">
        Loading Arena Data...
      </div>
    );
  if (!tournament)
    return (
      <div className="text-center mt-20 text-red-500">
        Tournament not found.
      </div>
    );

  const isAdmin = currentUser === tournament.host_id;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-rl-card border border-slate-700 p-6 rounded-xl mb-8 flex flex-col md:flex-row justify-between items-center shadow-[0_0_20px_rgba(14,165,233,0.1)]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                tournament.status === "open"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {tournament.status}
            </span>
            <span className="text-gray-400 text-sm">Hosted by Admin</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {tournament.name}
          </h1>
        </div>
        <div className="bg-slate-900 p-4 rounded-lg border border-rl-primary/30 text-center min-w-[200px]">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-widest">
            Join Code
          </p>
          <div className="flex justify-center items-center gap-2">
            <span className="text-3xl font-mono font-bold text-rl-primary tracking-wider">
              {tournament.join_code}
            </span>
            <Copy
              size={16}
              className="text-gray-500 cursor-pointer hover:text-white"
              onClick={() =>
                navigator.clipboard.writeText(tournament.join_code)
              }
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* LEFT COLUMN */}
        <div className="md:col-span-1 space-y-6">
          {/* MANUAL ADD TOOL */}
          {isAdmin && tournament.status === "open" && (
            <div className="bg-slate-800/50 p-4 rounded-xl border border-rl-accent/50">
              <h3 className="text-rl-accent font-bold mb-2 flex items-center gap-2">
                <UserPlus size={18} /> Manual Override
              </h3>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    className="bg-slate-900 flex-1 p-2 text-sm border border-slate-600 rounded text-white outline-none focus:border-rl-accent"
                    placeholder="Username / Guest"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                  {/* RANK SELECTOR */}
                  <select
                    className="bg-slate-900 w-16 p-2 text-sm border border-slate-600 rounded text-white outline-none focus:border-rl-accent"
                    value={guestRank}
                    onChange={(e) => setGuestRank(e.target.value)}
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleManualAdd}
                  disabled={addLoading}
                  className="bg-rl-accent hover:bg-orange-600 py-2 rounded font-bold text-white w-full transition"
                >
                  {addLoading ? "Adding..." : "Add Player"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Existing users ignore selected rank.
              </p>
            </div>
          )}

          {/* ROSTER */}
          <div className="bg-rl-card border border-slate-700 rounded-xl p-4">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Users size={18} className="text-rl-primary" />
              Player Roster ({participants.length})
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {participants.length === 0 ? (
                <p className="text-gray-500 text-sm italic">
                  Lobby is empty...
                </p>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                participants.map((p: any) => (
                  <div
                    key={p.player_id}
                    className="bg-slate-900 p-3 rounded flex justify-between items-center border border-slate-800"
                  >
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        {p.profiles?.username || "Unknown"}
                        {p.profiles?.is_guest && (
                          <span className="text-[10px] bg-slate-700 px-1 rounded text-gray-300">
                            GUEST
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-rl-primary">
                        {p.profiles?.rl_username}
                      </div>
                    </div>
                    <div className="bg-slate-800 text-xs px-2 py-1 rounded border border-slate-700 font-mono text-rl-accent">
                      Lvl {p.profiles?.skill_level}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="md:col-span-2">
          {/* ...Bracket Code (Same as before)... */}
          <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-12 text-center h-[500px] flex flex-col justify-center items-center">
            <p className="text-xl text-gray-400 mb-4">
              Bracket Generation Area
            </p>
            <p className="text-sm text-gray-500">Coming in next update</p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link to="/dashboard" className="text-rl-primary hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
export default TournamentView;
