import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

const NAV = [
  { to: '/leads', label: 'Leads', roles: ['OWNER', 'STAFF'] as const },
  { to: '/staff/today', label: 'Today', roles: ['OWNER', 'STAFF'] as const },
  { to: '/owner/dashboard', label: 'Dashboard', roles: ['OWNER'] as const },
];

export function Navbar(): React.JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = (): void => {
    logout();
    void navigate('/login', { replace: true });
  };

  const visible = NAV.filter((n) => user && (n.roles as readonly string[]).includes(user.role));

  return (
    <nav className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-brand-700">LeadOps</span>
          <div className="flex gap-4">
            {visible.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition-colors ${
                  pathname === to ? 'text-brand-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {user?.role}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
