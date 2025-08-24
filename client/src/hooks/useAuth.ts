import { useQuery } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'driver';
  status: 'pending' | 'active' | 'inactive';
  firstName?: string;
  lastName?: string;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user: user as AuthUser | undefined,
    isLoading,
    isAuthenticated: !!user,
  };
}
