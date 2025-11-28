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
  Edit,
  X,
  BarChart2,
  History,
} from "lucide-react";
import { RANK_MAP } from "./AuthPage";

const TournamentView = () => {
  const { id } = useParams();

  const [tournament, setTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Admin State
  const [addName, setAddName] = useState("");
  const [guestRank, setGuestRank] = useState("1");
  const [addLoading, setAddLoading] = useState(false);

  // Stats Modal State
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  // Holds the temporary stats while editing: { p1_g: 0, p1_a: 0, p1_s: 0, ... }
  const [statsInput, setStatsInput] = useState<any>({});
  const [savingScore, setSavingScore] = useState(false);

  // Helpers
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

  // --- STATS & SCORING ---

  const openStatsModal = (match: any) => {
    setEditingMatch(match);
    setStatsInput({
      p1_g: match.score_p1 || 0,
      p1_a: match.p1_assists || 0,
      p1_s: match.p1_saves || 0,
      p2_g: match.score_p2 || 0,
      p2_a: match.p2_assists || 0,
      p2_s: match.p2_saves || 0,
    });
  };

  const saveMatchStats = async () => {
    if (!editingMatch) return;
    setSavingScore(true);

    const { p1_g, p1_a, p1_s, p2_g, p2_a, p2_s } = statsInput;

    // Logic: Goals determine winner
    if (p1_g === p2_g) {
      setSavingScore(false);
      return alert("Draws not allowed! Goals cannot be equal.");
    }

    const winnerId =
      p1_g > p2_g ? editingMatch.player1_id : editingMatch.player2_id;

    // Update DB
    const { error } = await supabase
      .from("matches")
      .update({
        score_p1: p1_g,
        p1_assists: p1_a,
        p1_saves: p1_s,
        score_p2: p2_g,
        p2_assists: p2_a,
        p2_saves: p2_s,
        winner_id: winnerId,
        status: "completed",
      })
      .eq("id", editingMatch.id);

    if (error) {
      alert("Error: " + error.message);
      setSavingScore(false);
      return;
    }

    // Check Next Round
    await checkForNextRound(editingMatch.round);

    setSavingScore(false);
    setEditingMatch(null);
    fetchData();
  };

  const checkForNextRound = async (currentRound: number) => {
    const { data: roundMatches } = await supabase
      .from("matches")
      .select("status")
      .eq("tournament_id", id)
      .eq("round", currentRound);

    const allComplete = roundMatches?.every((m) => m.status === "completed");

    if (allComplete && roundMatches && roundMatches.length > 0) {
      if (roundMatches.length === 1) {
        await supabase
          .from("tournaments")
          .update({ status: "completed" })
          .eq("id", id);
      } else {
        await generateNextRound(currentRound);
      }
    }
  };

  const generateNextRound = async (prevRound: number) => {
    const { data: winners } = await supabase
      .from("matches")
      .select("winner_id")
      .eq("tournament_id", id)
      .eq("round", prevRound)
      .order("id");

    if (!winners) return;
    const winnerIds = winners.map((w) => w.winner_id);
    const newMatches = [];

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
    if (newMatches.length > 0)
      await supabase.from("matches").insert(newMatches);
  };

  // --- LEADERBOARD CALCULATION ---
  const getLeaderboard = () => {
    const stats: Record<
      string,
      { name: string; g: number; a: number; s: number }
    > = {};

    // Initialize with participants
    participants.forEach((p) => {
      stats[p.profiles.id] = { name: p.profiles.username, g: 0, a: 0, s: 0 };
    });

    // Aggregate matches
    matches.forEach((m) => {
      if (m.status === "completed") {
        if (stats[m.player1_id]) {
          stats[m.player1_id].g += m.score_p1 || 0;
          stats[m.player1_id].a += m.p1_assists || 0;
          stats[m.player1_id].s += m.p1_saves || 0;
        }
        if (stats[m.player2_id]) {
          stats[m.player2_id].g += m.score_p2 || 0;
          stats[m.player2_id].a += m.p2_assists || 0;
          stats[m.player2_id].s += m.p2_saves || 0;
        }
      }
    });

    const list = Object.values(stats);
    return {
      topScorers: [...list]
        .sort((a, b) => b.g - a.g)
        .slice(0, 5)
        .filter((p) => p.g > 0),
      topAssisters: [...list]
        .sort((a, b) => b.a - a.a)
        .slice(0, 5)
        .filter((p) => p.a > 0),
      topSavers: [...list]
        .sort((a, b) => b.s - a.s)
        .slice(0, 5)
        .filter((p) => p.s > 0),
    };
  };

  const { topScorers, topAssisters, topSavers } = getLeaderboard();

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

  const rounds = matches.reduce((acc: any, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  // History List (Completed Matches sorted by most recent)
  const historyMatches = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => b.id - a.id);

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* --- STATS MODAL --- */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-rl-card border border-rl-primary p-6 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Match Stats</h3>
              <button onClick={() => setEditingMatch(null)}>
                <X className="text-gray-400 hover:text-white" />
              </button>
            </div>

            {/* Player 1 Stats */}
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <h4 className="text-blue-400 font-bold mb-3 text-lg">
                {editingMatch.p1?.username || "P1"}
              </h4>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs uppercase text-gray-400 font-bold">
                    Goals
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white font-bold"
                    value={statsInput.p1_g}
                    onChange={(e) =>
                      setStatsInput({
                        ...statsInput,
                        p1_g: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs uppercase text-gray-400 font-bold">
                    Assists
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                    value={statsInput.p1_a}
                    onChange={(e) =>
                      setStatsInput({
                        ...statsInput,
                        p1_a: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs uppercase text-gray-400 font-bold">
                    Saves
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                    value={statsInput.p1_s}
                    onChange={(e) =>
                      setStatsInput({
                        ...statsInput,
                        p1_s: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Player 2 Stats */}
            <div className="mb-6 p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
              <h4 className="text-orange-400 font-bold mb-3 text-lg">
                {editingMatch.p2?.username || "P2"}
              </h4>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs uppercase text-gray-400 font-bold">
                    Goals
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white font-bold"
                    value={statsInput.p2_g}
                    onChange={(e) =>
                      setStatsInput({
                        ...statsInput,
                        p2_g: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs uppercase text-gray-400 font-bold">
                    Assists
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                    value={statsInput.p2_a}
                    onChange={(e) =>
                      setStatsInput({
                        ...statsInput,
                        p2_a: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs uppercase text-gray-400 font-bold">
                    Saves
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                    value={statsInput.p2_s}
                    onChange={(e) =>
                      setStatsInput({
                        ...statsInput,
                        p2_s: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <button
              onClick={saveMatchStats}
              disabled={savingScore}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded text-lg transition shadow-lg"
            >
              {savingScore
                ? "Updating Bracket..."
                : "Confirm Stats & End Match"}
            </button>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="bg-rl-card border border-slate-700 p-6 rounded-xl mb-8 flex flex-col md:flex-row justify-between items-center shadow-[0_0_20px_rgba(14,165,233,0.1)]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                tournament.status === "open"
                  ? "bg-green-500/20 text-green-400"
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

      {/* --- MAIN GRID --- */}
      <div className="grid md:grid-cols-4 gap-8">
        {/* LEFT: ROSTER / LEADERBOARD */}
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
                    className="bg-slate-900 w-16 p-2 text-sm border border-slate-600 rounded text-white outline-none"
                    value={guestRank}
                    onChange={(e) => setGuestRank(e.target.value)}
                  >
                    {RANK_MAP.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.value}
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

          {tournament.status === "open" ? (
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
                      {isAdmin && (
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
          ) : (
            // LEADERBOARD (Only shows when active)
            <div className="bg-rl-card border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <BarChart2 size={18} className="text-yellow-400" /> Top 5
                Leaders
              </h3>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs uppercase text-rl-primary font-bold mb-2">
                    Top Scorers (Goals)
                  </h4>
                  {topScorers.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No goals yet</p>
                  ) : (
                    topScorers.map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm border-b border-slate-800 py-1"
                      >
                        <span>
                          {i + 1}. {p.name}
                        </span>
                        <span className="font-bold text-white">{p.g}</span>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <h4 className="text-xs uppercase text-rl-accent font-bold mb-2">
                    Playmakers (Assists)
                  </h4>
                  {topAssisters.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">
                      No assists yet
                    </p>
                  ) : (
                    topAssisters.map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm border-b border-slate-800 py-1"
                      >
                        <span>
                          {i + 1}. {p.name}
                        </span>
                        <span className="font-bold text-white">{p.a}</span>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <h4 className="text-xs uppercase text-blue-400 font-bold mb-2">
                    Saviors (Saves)
                  </h4>
                  {topSavers.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No saves yet</p>
                  ) : (
                    topSavers.map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm border-b border-slate-800 py-1"
                      >
                        <span>
                          {i + 1}. {p.name}
                        </span>
                        <span className="font-bold text-white">{p.s}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: BRACKET */}
        <div className="md:col-span-3">
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
            <>
              <div className="flex gap-8 overflow-x-auto pb-4 mb-8">
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

                          {/* P1 */}
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
                            <span className="font-bold text-white text-lg">
                              {match.score_p1 ?? "-"}
                            </span>
                          </div>

                          {/* P2 */}
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
                            <span className="font-bold text-white text-lg">
                              {match.score_p2 ?? "-"}
                            </span>
                          </div>

                          {/* Edit Button */}
                          {isAdmin && match.status !== "completed" && (
                            <div className="bg-slate-950 p-2 flex justify-center">
                              <button
                                onClick={() => openStatsModal(match)}
                                className="flex items-center gap-1 text-[10px] uppercase font-bold text-rl-primary hover:text-white transition"
                              >
                                <Edit size={12} /> Input Stats
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* HISTORY SECTION */}
              <div className="mt-12">
                <h2 className="text-xl font-bold border-l-4 border-slate-500 pl-4 mb-4 flex items-center gap-2">
                  <History size={20} /> Match History
                </h2>
                <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-950 text-gray-400 uppercase font-bold">
                      <tr>
                        <th className="p-3">Round</th>
                        <th className="p-3">Matchup</th>
                        <th className="p-3 text-center">Score</th>
                        <th className="p-3 text-center hidden md:table-cell">
                          Stats (G/A/S)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {historyMatches.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-6 text-center text-gray-500 italic"
                          >
                            No matches completed yet.
                          </td>
                        </tr>
                      ) : (
                        historyMatches.map((m: any) => (
                          <tr key={m.id} className="hover:bg-slate-800/50">
                            <td className="p-3 font-mono text-gray-500">
                              R{m.round}
                            </td>
                            <td className="p-3">
                              <span
                                className={
                                  m.winner_id === m.player1_id
                                    ? "text-green-400 font-bold"
                                    : "text-gray-300"
                                }
                              >
                                {m.p1?.username}
                              </span>
                              <span className="mx-2 text-gray-600">vs</span>
                              <span
                                className={
                                  m.winner_id === m.player2_id
                                    ? "text-green-400 font-bold"
                                    : "text-gray-300"
                                }
                              >
                                {m.p2?.username}
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-white bg-slate-800">
                              {m.score_p1} - {m.score_p2}
                            </td>
                            <td className="p-3 text-center hidden md:table-cell text-xs text-gray-400">
                              <div>
                                P1: {m.score_p1}/{m.p1_assists}/{m.p1_saves}
                              </div>
                              <div>
                                P2: {m.score_p2}/{m.p2_assists}/{m.p2_saves}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
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
