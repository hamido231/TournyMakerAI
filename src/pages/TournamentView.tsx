/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  Copy,
  UserPlus,
  Users,
  PlayCircle,
  Trophy,
  Trash2,
  Save,
} from "lucide-react";
import { RANK_MAP } from "./AuthPage";

const TournamentView = () => {
  const { id } = useParams();

  const [tournament, setTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [guestRank, setGuestRank] = useState("1");
  const [addLoading, setAddLoading] = useState(false);
  const [savingScoreId, setSavingScoreId] = useState<string | null>(null);

  // Local state for score inputs: { match_id: { p1: "2", p2: "1" } }
  const [scoreInputs, setScoreInputs] = useState<
    Record<string, { p1: string; p2: string }>
  >({});

  const getRankName = (lvl: number) =>
    RANK_MAP.find((x) => x.value === lvl)?.name || "Unranked";
  const getRankColor = (lvl: number) =>
    RANK_MAP.find((x) => x.value === lvl)?.color || "text-gray-500";

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
    if (tData) setTournament(tData);

    const { data: pData } = await supabase
      .from("participants")
      .select(
        "player_id, profiles(id, username, skill_level, rl_username, is_guest)"
      )
      .eq("tournament_id", id);
    if (pData) setParticipants(pData);

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
    const channel = supabase
      .channel("room1")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", filter: `tournament_id=eq.${id}` },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${id}`,
        },
        () => fetchData()
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
      await supabase
        .from("participants")
        .insert({ tournament_id: id, player_id: playerId });
      setAddName("");
    } catch (error: any) {
      if (!error.message?.includes("duplicate"))
        alert("Error: " + error.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!window.confirm("Remove this player?")) return;
    await supabase
      .from("participants")
      .delete()
      .eq("player_id", playerId)
      .eq("tournament_id", id);
    fetchData();
  };

  const startTournament = async () => {
    if (participants.length < 2) return alert("Need at least 2 players!");
    if (!window.confirm("Start tournament? This will lock the bracket."))
      return;

    await supabase
      .from("tournaments")
      .update({ status: "active" })
      .eq("id", id);

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

    if (newMatches.length > 0) {
      await supabase.from("matches").insert(newMatches);
    }
    fetchData();
  };

  // --- SCORE LOGIC ---

  const handleScoreChange = (
    matchId: string,
    player: "p1" | "p2",
    value: string
  ) => {
    // Prevent negative numbers
    if (parseInt(value) < 0) return;

    setScoreInputs((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [player]: value,
      },
    }));
  };

  const saveScore = async (match: any) => {
    const inputs = scoreInputs[match.id];

    // 1. Validation
    if (
      !inputs ||
      inputs.p1 === undefined ||
      inputs.p2 === undefined ||
      inputs.p1 === "" ||
      inputs.p2 === ""
    ) {
      return alert("Please enter a score for BOTH players.");
    }

    const s1 = parseInt(inputs.p1);
    const s2 = parseInt(inputs.p2);

    if (isNaN(s1) || isNaN(s2)) return alert("Scores must be numbers.");
    if (s1 === s2) return alert("Draws are not allowed! Play Overtime.");

    setSavingScoreId(match.id); // Show loading state on button

    // 2. Determine Winner
    const winnerId = s1 > s2 ? match.player1_id : match.player2_id;

    console.log("Saving Score:", { matchId: match.id, s1, s2, winnerId });

    // 3. Update Database
    const { error } = await supabase
      .from("matches")
      .update({
        score_p1: s1,
        score_p2: s2,
        winner_id: winnerId,
        status: "completed",
      })
      .eq("id", match.id);

    if (error) {
      console.error("DB Error:", error);
      alert("Failed to save: " + error.message);
      setSavingScoreId(null);
      return;
    }

    // 4. Check for Next Round
    await checkForNextRound(match.round);

    setSavingScoreId(null);
    // Data will refresh automatically via Realtime, but we fetch just in case
    fetchData();
  };

  const checkForNextRound = async (currentRound: number) => {
    // Check if ALL matches in this round are done
    const { data: roundMatches } = await supabase
      .from("matches")
      .select("status")
      .eq("tournament_id", id)
      .eq("round", currentRound);

    const allComplete = roundMatches?.every((m) => m.status === "completed");

    if (allComplete && roundMatches && roundMatches.length > 0) {
      if (roundMatches.length === 1) {
        // Final match finished!
        await supabase
          .from("tournaments")
          .update({ status: "completed" })
          .eq("id", id);
        alert("🏆 TOURNAMENT COMPLETE! 🏆");
      } else {
        // Generate next round
        await generateNextRound(currentRound);
      }
    }
  };

  const generateNextRound = async (prevRound: number) => {
    // Get winners
    const { data: winners } = await supabase
      .from("matches")
      .select("winner_id")
      .eq("tournament_id", id)
      .eq("round", prevRound)
      .order("id"); // Important: Keep order consistent for bracket flow

    if (!winners) return;

    const winnerIds = winners.map((w) => w.winner_id);
    const newMatches = [];

    // Create new pairs
    while (winnerIds.length >= 2) {
      const p1 = winnerIds.shift();
      const p2 = winnerIds.shift();
      newMatches.push({
        tournament_id: id,
        player1_id: p1,
        player2_id: p2,
        round: prevRound + 1,
        status: "pending",
      });
    }

    if (newMatches.length > 0) {
      await supabase.from("matches").insert(newMatches);
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

  // Group matches by round
  const rounds = matches.reduce((acc: any, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

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
                  : tournament.status === "active"
                  ? "bg-rl-accent/20 text-rl-accent"
                  : "bg-purple-500/20 text-purple-400"
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

      <div className="grid md:grid-cols-4 gap-8">
        {/* LEFT COLUMN: ROSTER (Hidden if active to give bracket space, or keep small) */}
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
                    placeholder="Name"
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
                  {addLoading ? "..." : "+ Add"}
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
                participants.map((p: any) => (
                  <div
                    key={p.player_id}
                    className="bg-slate-900 p-2 rounded flex justify-between items-center border border-slate-800 group"
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
                      <div
                        className={`text-[10px] font-bold ${getRankColor(
                          p.profiles?.skill_level
                        )}`}
                      >
                        {getRankName(p.profiles?.skill_level)}
                      </div>
                    </div>
                    {isAdmin && tournament.status === "open" && (
                      <button
                        onClick={() => handleRemovePlayer(p.player_id)}
                        className="text-slate-600 hover:text-red-500 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMNS: BRACKET AREA */}
        <div className="md:col-span-3 overflow-x-auto">
          <h2 className="text-2xl font-bold border-l-4 border-rl-accent pl-4 mb-6">
            Tournament Bracket
          </h2>

          {tournament.status === "open" ? (
            <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-12 text-center h-[400px] flex flex-col justify-center items-center">
              <Trophy size={48} className="text-slate-700 mb-4" />
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
            <div className="flex gap-8 pb-4">
              {Object.keys(rounds).map((roundNum) => (
                <div key={roundNum} className="min-w-[320px]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-rl-primary h-2 w-2 rounded-full"></div>
                    <h3 className="text-white font-bold uppercase tracking-wider text-sm">
                      Round {roundNum}
                    </h3>
                  </div>
                  <div className="space-y-6">
                    {rounds[roundNum].map((match: any) => (
                      <div
                        key={match.id}
                        className={`bg-slate-800 border ${
                          match.status === "completed"
                            ? "border-green-600/50"
                            : "border-slate-600"
                        } rounded-lg overflow-hidden relative shadow-lg`}
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${
                            match.status === "completed"
                              ? "bg-green-500"
                              : "bg-gradient-to-b from-rl-primary to-rl-accent"
                          }`}
                        ></div>

                        {/* Player 1 */}
                        <div
                          className={`flex justify-between items-center p-3 border-b border-slate-700 ${
                            match.winner_id === match.player1_id
                              ? "bg-green-900/20"
                              : "bg-slate-900/40"
                          }`}
                        >
                          <span
                            className={`font-bold ${
                              match.winner_id === match.player1_id
                                ? "text-green-400"
                                : "text-gray-200"
                            }`}
                          >
                            {match.p1?.username || "Bye"}
                          </span>
                          {match.status === "completed" ? (
                            <span className="font-bold text-white">
                              {match.score_p1}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              disabled={!isAdmin}
                              className="bg-black/50 w-12 text-center rounded text-sm text-white p-1 outline-none focus:bg-black"
                              placeholder="0"
                              value={scoreInputs[match.id]?.p1 ?? ""}
                              onChange={(e) =>
                                handleScoreChange(
                                  match.id,
                                  "p1",
                                  e.target.value
                                )
                              }
                            />
                          )}
                        </div>

                        {/* Player 2 */}
                        <div
                          className={`flex justify-between items-center p-3 ${
                            match.winner_id === match.player2_id
                              ? "bg-green-900/20"
                              : "bg-slate-900/40"
                          }`}
                        >
                          <span
                            className={`font-bold ${
                              match.winner_id === match.player2_id
                                ? "text-green-400"
                                : "text-gray-200"
                            }`}
                          >
                            {match.p2?.username || "Bye"}
                          </span>
                          {match.status === "completed" ? (
                            <span className="font-bold text-white">
                              {match.score_p2}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              disabled={!isAdmin}
                              className="bg-black/50 w-12 text-center rounded text-sm text-white p-1 outline-none focus:bg-black"
                              placeholder="0"
                              value={scoreInputs[match.id]?.p2 ?? ""}
                              onChange={(e) =>
                                handleScoreChange(
                                  match.id,
                                  "p2",
                                  e.target.value
                                )
                              }
                            />
                          )}
                        </div>

                        {/* Actions */}
                        {isAdmin && match.status !== "completed" && (
                          <div className="bg-slate-950 p-2 flex justify-center">
                            <button
                              onClick={() => saveScore(match)}
                              disabled={savingScoreId === match.id}
                              className="flex items-center gap-1 text-[10px] uppercase font-bold text-green-500 hover:text-green-400 transition"
                            >
                              {savingScoreId === match.id ? (
                                "Saving..."
                              ) : (
                                <>
                                  <Save size={12} /> Save Score
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
