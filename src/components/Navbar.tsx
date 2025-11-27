import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const Navbar = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
              <Link to="/dashboard" className="text-gray-300 hover:text-white">
                Dashboard
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
