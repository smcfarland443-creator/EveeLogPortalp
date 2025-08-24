import { useQuery } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  password: string | null;
  isLocalUser: string | null;
  role: 'admin' | 'driver';
  status: 'pending' | 'active' | 'inactive';
  createdAt: Date | null;
  updatedAt: Date | null;
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
