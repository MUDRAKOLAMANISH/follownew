import { Rocket, LayoutDashboard, UserCheck, LogOut, ChevronDown, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setShowDropdown(false);
  };

  return (
    <nav className="fixed top-0 w-full z-50 glass-card bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:bg-indigo-700 transition-colors">
              <Rocket className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">FollowFlow AI</span>
          </Link>

          <div className="hidden md:flex space-x-8">
            <Link to="/#features" className="text-gray-600 hover:text-indigo-600 transition-colors text-sm font-medium">Features</Link>
            <Link to="/pricing" className="text-gray-600 hover:text-indigo-600 transition-colors text-sm font-medium">Pricing</Link>
            <Link to="/about" className="text-gray-600 hover:text-indigo-600 transition-colors text-sm font-medium">About</Link>
            <Link to="/contact" className="text-gray-600 hover:text-indigo-600 transition-colors text-sm font-medium">Contact</Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              /* Authenticated User Actions */
              <div className="flex items-center gap-2.5">
                <Link
                  to="/dashboard"
                  id="navbar-dashboard-btn"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    id="navbar-my-account-btn"
                    className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5"
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="hidden sm:inline">My Account</span>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3.5 py-2 border-b border-gray-100">
                        <p className="font-semibold text-gray-900 truncate">{user.displayName || 'User'}</p>
                        <p className="text-gray-500 text-2xs truncate">{user.email}</p>
                      </div>
                      <Link
                        to="/dashboard"
                        onClick={() => setShowDropdown(false)}
                        className="w-full text-left px-3.5 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5 text-indigo-600" /> Dashboard Overview
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setShowDropdown(false)}
                        className="w-full text-left px-3.5 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <User className="h-3.5 w-3.5 text-gray-500" /> Account Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-gray-100 mt-1"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Guest Actions */
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  id="navbar-login-btn"
                  className="text-gray-700 font-medium text-xs sm:text-sm hover:text-indigo-600 px-3 py-2 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/signup"
                  id="navbar-signup-btn"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
