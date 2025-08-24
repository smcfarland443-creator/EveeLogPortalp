import type { User } from "@shared/schema";

interface NavigationProps {
  user: User;
  currentView: string;
  onViewChange: (view: string) => void;
  userType: 'admin' | 'driver';
}

export function Navigation({ user, currentView, onViewChange, userType }: NavigationProps) {
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-car text-white"></i>
            </div>
            <span className="ml-3 text-xl font-bold text-gray-900">AutoTransfer Pro</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {userType === 'admin' ? 'Administrator:' : 'Fahrer:'}
              </span>
              <span className="text-sm font-medium text-gray-900" data-testid="text-username">
                {user.firstName} {user.lastName}
              </span>
            </div>
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
