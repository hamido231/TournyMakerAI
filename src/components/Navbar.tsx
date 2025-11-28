import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { User } from "@supabase/supabase-js";

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const getData = async () => {
      // 1. Get Auth User
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      // 2. Get Profile Data (Username)
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
    };

    getData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) getData(); // Refetch profile on login
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className="border-b border-slate-700 bg-rl-card p-4 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold flex items-center gap-2">
          <span className="bg-rl-primary text-black px-2 skew-x-[-10deg] block">
            TM
          </span>
          <span>
            Tourny<span className="text-rl-primary">Maker</span>
          </span>
        </Link>
        <div className="flex gap-4 items-center">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-3 hover:bg-slate-800 px-3 py-1 rounded transition"
              >
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-white">
                    {profile?.username || "Pilot"}
                  </div>
                  <div className="text-[10px] text-rl-primary uppercase tracking-wider">
                    Online
                  </div>
                </div>
                <div className="w-8 h-8 bg-slate-700 rounded-full overflow-hidden border border-rl-primary">
                  <img
                    src={
                      profile?.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username}`
                    }
                    alt="avatar"
                  />
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="text-red-400 hover:text-red-300 text-sm font-bold border border-red-500/30 px-3 py-1 rounded"
              >
                LOGOUT
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="bg-rl-primary hover:bg-cyan-600 text-black px-6 py-2 rounded font-bold skew-x-[-10deg] transition"
            >
              <span className="block skew-x-[10deg]">LOGIN</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
