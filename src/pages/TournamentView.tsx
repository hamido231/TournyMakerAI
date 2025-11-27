import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Copy, UserPlus, Users, PlayCircle } from "lucide-react";
import { RANK_MAP } from "./AuthPage";

const TournamentView = () => {
  const { id } = useParams();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tournament, setTournament] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [participants, setParticipants] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [matches, setMatches] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Manual Add State
  const [addName, setAddName] = useState("");
  const [guestRank, setGuestRank] = useState("1");
  const [addLoading, setAddLoading] = useState(false);

  // Helper: Get Rank Name from number
  const getRankName = (lvl: number) => {
    const r = RANK_MAP.find((x) => x.value === lvl);
    return r ? r.name : "Unranked";
  };

  // Helper: UUID Generator
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

  // --- DATA FETCHING ---
  const fetchData = async () => {
    if (!id) return;

    // 1. User
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);

    // 2. Tournament
    const { data: tData } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", id)
      .single();
    if (tData) setTournament(tData);

    // 3. Participants
    const { data: pData } = await supabase
      .from("participants")
      .select(
        "player_id, profiles(id, username, skill_level, rl_username, is_guest)"
      )
      .eq("tournament_id", id);
    if (pData) setParticipants(pData);

    // 4. Matches
    const { data: mData } = await supabase
      .from("matches")
      .select("*, p1:player1_id(username), p2:player2_id(username)")
      .eq("tournament_id", id)
      .order("id");
    if (mData) setMatches(mData);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // --- REALTIME SUBSCRIPTION ---
    const channel = supabase
      .channel("room1")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `tournament_id=eq.${id}`,
        },
        () => {
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${id}`,
        },
        () => {
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // --- ACTIONS ---

  const handleManualAdd = async () => {
    if (!addName) return;
    setAddLoading(true);
    try {
      // 1. Find User or Create Guest
      const { data: foundUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", addName)
        .single();
      let playerId = foundUser?.id;

      if (!playerId) {
        playerId = generateUUID();
        await supabase.from("profiles").insert({
          id: playerId,
          username: addName,
          rl_username: "Guest",
          is_guest: true,
          skill_level: parseInt(guestRank),
          sub_points: 50,
        });
      }

      // 2. Add to Tournament
      await supabase
        .from("participants")
        .insert({ tournament_id: id, player_id: playerId });
      setAddName("");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (!error.message?.includes("duplicate"))
        alert("Error: " + error.message);
    } finally {
      setAddLoading(false);
    }
  };

  const startTournament = async () => {
    if (participants.length < 2) return alert("Need at least 2 players!");
    const confirmStart = window.confirm(
      "Start tournament? No more players can join."
    );
    if (!confirmStart) return;

    // 1. Update Status
    await supabase
      .from("tournaments")
      .update({ status: "active" })
      .eq("id", id);

    // 2. Generate Pairs (Shuffle -> Pair)
    const shuffled = [...participants].sort(() => 0.5 - Math.random());
    const newMatches = [];

    while (shuffled.length >= 2) {
      const p1 = shuffled.pop();
      const p2 = shuffled.pop();
      newMatches.push({
        tournament_id: id,
        player1_id: p1.profiles.id,
        player2_id: p2.profiles.id,
        round: 1,
        status: "pending",
      });
    }

    // Handle odd player
    if (shuffled.length === 1) {
      alert(
        `Odd number of players! ${shuffled[0].profiles.username} sits out this round.`
      );
    }

    // 3. Insert Matches
    if (newMatches.length > 0) {
      const { error } = await supabase.from("matches").insert(newMatches);
      if (error) alert("Error creating bracket: " + error.message);
    }
  };

  // --- RENDER ---

  if (loading)
    return (
      <div className="text-center mt-20 font-bold text-rl-primary animate-pulse">
        Loading Arena...
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
                  : "bg-rl-accent/20 text-rl-accent"
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

        {tournament.status === "open" && (
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
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* LEFT: ROSTER & TOOLS */}
        <div className="md:col-span-1 space-y-6">
          {isAdmin && tournament.status === "open" && (
            <div className="bg-slate-800/50 p-4 rounded-xl border border-rl-accent/50">
              <h3 className="text-rl-accent font-bold mb-2 flex items-center gap-2">
                <UserPlus size={18} /> Manual Add
              </h3>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    className="bg-slate-900 flex-1 p-2 text-sm border border-slate-600 rounded text-white outline-none"
                    placeholder="Username / Guest"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                  <select
                    className="bg-slate-900 w-24 p-2 text-sm border border-slate-600 rounded text-white outline-none"
                    value={guestRank}
                    onChange={(e) => setGuestRank(e.target.value)}
                  >
                    {RANK_MAP.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleManualAdd}
                  disabled={addLoading}
                  className="bg-rl-accent hover:bg-orange-600 py-2 rounded font-bold text-white w-full transition"
                >
                  {addLoading ? "Adding..." : "+ Add Player"}
                </button>
              </div>
            </div>
          )}

          <div className="bg-rl-card border border-slate-700 rounded-xl p-4">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Users size={18} className="text-rl-primary" /> Roster (
              {participants.length})
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {participants.length === 0 ? (
                <p className="text-gray-500 italic">Empty lobby...</p>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                participants.map((p: any) => (
                  <div
                    key={p.player_id}
                    className="bg-slate-900 p-3 rounded flex justify-between items-center border border-slate-800"
                  >
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        {p.profiles?.username}
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
                    <div className="text-xs font-bold text-gray-400">
                      {getRankName(p.profiles?.skill_level)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: BRACKET / START */}
        <div className="md:col-span-2">
          <h2 className="text-2xl font-bold border-l-4 border-rl-accent pl-4 mb-4">
            Arena Status
          </h2>

          {tournament.status === "open" ? (
            <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-12 text-center h-[400px] flex flex-col justify-center items-center">
              <p className="text-xl text-gray-400 mb-4">
                {participants.length < 2
                  ? "Waiting for players..."
                  : "Players Ready"}
              </p>
              {isAdmin && (
                <button
                  onClick={startTournament}
                  disabled={participants.length < 2}
                  className={`px-8 py-3 rounded font-bold flex items-center gap-2 transition ${
                    participants.length < 2
                      ? "bg-slate-700 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                  }`}
                >
                  <PlayCircle /> START TOURNAMENT
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {matches.length === 0 ? (
                <div className="text-center p-10">Generating Bracket...</div>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                matches.map((match: any) => (
                  <div
                    key={match.id}
                    className="bg-rl-card border border-slate-700 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center"
                  >
                    <div className="text-lg font-bold w-1/3 text-center md:text-left text-rl-primary">
                      {match.p1?.username || "Bye"}
                    </div>
                    <div className="bg-slate-900 px-4 py-2 rounded text-sm font-bold text-gray-400">
                      VS
                    </div>
                    <div className="text-lg font-bold w-1/3 text-center md:text-right text-rl-accent">
                      {match.p2?.username || "Bye"}
                    </div>
                  </div>
                ))
              )}
              <div className="mt-8 text-center text-gray-500 italic">
                Score reporting coming in Phase 2
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-8 text-center">
        <Link to="/dashboard" className="text-rl-primary hover:underline">
          ← Dashboard
        </Link>
      </div>
    </div>
  );
};
export default TournamentView;
