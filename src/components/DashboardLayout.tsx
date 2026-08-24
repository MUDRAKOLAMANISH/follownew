import { useState, ReactNode } from 'react';
import { Rocket, LogOut, LayoutDashboard, Users, MessageCircle, Bot, Settings, Bell, Briefcase, UserCheck, Mail, ShieldCheck, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { isSuperAdmin } from '../lib/adminAuth';

export default function DashboardLayout({ children, title }: { children: ReactNode, title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const superAdmin = isSuperAdmin(user);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Standard business owner navigation items (Knowledge Base is removed for regular users/owners)
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { name: 'Leads', path: '/leads', icon: <Users className="h-4 w-4" /> },
    { name: 'Follow-Ups', path: '/followups', icon: <MessageCircle className="h-4 w-4" /> },
    { name: 'Gmail Outreach', path: '/gmail', icon: <Mail className="h-4 w-4 text-red-500" /> },
    { name: 'Customers', path: '/customers', icon: <UserCheck className="h-4 w-4" /> },
    { name: 'AI Assistant', path: '/ai-assistant', icon: <Bot className="h-4 w-4" /> },
    { name: 'Business Profile', path: '/business-profile', icon: <Briefcase className="h-4 w-4" /> },
    { name: 'Firebase Status', path: '/firebase-diagnostics', icon: <Database className="h-4 w-4 text-emerald-600" /> },
    { name: 'Settings', path: '/settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Rocket className="text-indigo-600 h-6 w-6" />
            <span className="text-lg font-bold text-gray-900 tracking-tight">FollowFlow</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg ${
                location.pathname === item.path
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon} {item.name}
              </div>
            </Link>
          ))}

          {/* Super Admin ONLY section - strictly invisible to regular users and business owners */}
          {superAdmin && (
            <div className="pt-4 mt-4 border-t border-gray-100 space-y-1">
              <div className="px-3 pb-1 text-2xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                <span>Super Admin</span>
              </div>
              <Link
                to="/admin/knowledge-base"
                className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg ${
                  location.pathname.includes('/knowledge-base')
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'text-gray-700 hover:bg-amber-50/60 hover:text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span>Central Knowledge Base</span>
                </div>
                <span className="text-2xs px-1.5 py-0.5 rounded font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                  Owner
                </span>
              </Link>
            </div>
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
          
          <div className="flex items-center gap-4">
            {superAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                <ShieldCheck className="h-3 w-3 text-amber-600" />
                Super Admin
              </span>
            )}

            <button className="text-gray-500 hover:text-gray-700 focus:outline-none">
              <Bell className="h-5 w-5" />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 focus:outline-none"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm overflow-hidden border border-indigo-200">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'
                  )}
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-100 ring-1 ring-black ring-opacity-5 py-1 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    <span className="mt-1 inline-block text-2xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {superAdmin ? 'Super Admin / Owner' : 'Business Owner'}
                    </span>
                  </div>

                  {superAdmin && (
                    <Link
                      to="/admin/knowledge-base"
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 flex items-center gap-2 border-b border-gray-100 transition-colors"
                    >
                      <ShieldCheck className="h-4 w-4 text-amber-600" /> Central Knowledge Base
                    </Link>
                  )}

                  <Link
                    to="/firebase-diagnostics"
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-100 transition-colors"
                  >
                    <Database className="h-4 w-4 text-indigo-600" /> Firebase Status (Locked)
                  </Link>

                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
