import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

const CreateTournament = () => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const create = async () => {
    if (!name) return alert("Please enter a name");
    setLoading(true);

    try {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in!");
        return;
      }

      // 2. Generate random code
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 3. Insert AND fetch the new row
      const { data, error } = await supabase
        .from("tournaments")
        .insert({
          name: name,
          host_id: user.id,
          join_code: joinCode,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      // 4. Redirect
      if (data) {
        navigate(`/tournament/${data.id}`);
      }
    } catch (error) {
      // Safe error handling for TypeScript
      const message = (error as Error).message || "Unknown error occurred";
      console.error(error);
      alert("Error: " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-10 flex flex-col items-center">
      <div className="bg-rl-card p-8 rounded-xl border border-slate-700 w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Create Tournament
        </h1>

        <label className="block text-gray-400 mb-2">Tournament Name</label>
        <input
          className="bg-slate-900 p-3 text-white border border-slate-600 rounded mb-6 block w-full focus:border-rl-primary outline-none"
          placeholder="e.g. Midnight Rumble 1v1"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />

        <button
          onClick={create}
          disabled={loading}
          className="w-full bg-rl-accent hover:bg-orange-600 px-6 py-3 rounded font-bold text-white transition"
        >
          {loading ? "Creating Arena..." : "Create & Start"}
        </button>
      </div>
    </div>
  );
};
export default CreateTournament;
