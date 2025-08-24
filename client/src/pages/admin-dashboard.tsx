import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Navigation } from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderFormModal } from "@/components/admin/order-form-modal";
import { OrderEditModal } from "@/components/admin/order-edit-modal";
import { AuctionFormModal } from "@/components/admin/auction-form-modal";
import { UserFormModal } from "@/components/admin/user-form-modal";
import AdminBilling from "@/pages/admin-billing";
import type { User, Order, Auction } from "@shared/schema";

type ViewType = 'dashboard' | 'orders' | 'auctions' | 'users' | 'billing' | 'reports';

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showOrderEditModal, setShowOrderEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && (!user || (user as any).role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [user, authLoading, toast]);

  // Fetch data
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!user && (user as any).role === 'admin',
  });

  const { data: auctions = [], isLoading: auctionsLoading } = useQuery<Auction[]>({
    queryKey: ["/api/auctions"],
    enabled: !!user && (user as any).role === 'admin',
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user && (user as any).role === 'admin',
  });

  const { data: pendingUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users", { status: 'pending' }],
    enabled: !!user && (user as any).role === 'admin',
  });

  // Mutations
  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("PATCH", `/api/users/${userId}/status`, { status: 'active' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User approved successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to approve user", variant: "destructive" });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("DELETE", `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order deleted successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete order", variant: "destructive" });
    },
  });

  const deleteAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      await apiRequest("DELETE", `/api/auctions/${auctionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
      toast({ title: "Success", description: "Auction deleted successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete auction", variant: "destructive" });
    },
  });

  // Functions
  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setShowOrderEditModal(true);
  };

  const handleCloseEditOrder = () => {
    setEditingOrder(null);
    setShowOrderEditModal(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user || (user as any).role !== 'admin') {
    return null;
  }

  const stats = {
    activeOrders: orders.filter((order: Order) => order.status === 'pickup_scheduled' || order.status === 'picked_up').length,
    completedTrips: orders.filter((order: Order) => order.status === 'completed' || order.status === 'delivered').length,
    activeDrivers: users.filter((user: User) => user.role === 'driver' && user.status === 'active').length,
    openAuctions: auctions.filter((auction: Auction) => auction.status === 'active').length,
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      open: { label: "Offen", variant: "outline" as const },
      pickup_scheduled: { label: "Abholung geplant", variant: "default" as const },
      picked_up: { label: "Abgeholt", variant: "secondary" as const },
      delivered: { label: "Ausgeliefert", variant: "secondary" as const },
      completed: { label: "Abgeschlossen", variant: "secondary" as const },
      cancelled: { label: "Storniert", variant: "destructive" as const },
      active: { label: "Aktiv", variant: "default" as const },
      pending: { label: "Wartend", variant: "outline" as const },
    };
    
    const config = statusMap[status as keyof typeof statusMap];
    return config ? (
      <Badge variant={config.variant}>{config.label}</Badge>
    ) : (
      <Badge variant="outline">{status}</Badge>
    );
  };

  const renderDashboardContent = () => (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Überblick über Ihre Überführungsplattform</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <i className="fas fa-clipboard-list text-blue-600"></i>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Aktive Aufträge</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-active-orders">{stats.activeOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <i className="fas fa-check-circle text-green-600"></i>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Abgeschlossene Fahrten</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-completed-trips">{stats.completedTrips}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-lg">
                <i className="fas fa-users text-primary-600"></i>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Aktive Fahrer</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-active-drivers">{stats.activeDrivers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <i className="fas fa-gavel text-orange-600"></i>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Offene Auktionen</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-open-auctions">{stats.openAuctions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Neueste Aufträge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.slice(0, 3).map((order: Order) => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{order.pickupLocation} → {order.deliveryLocation}</p>
                    <p className="text-sm text-gray-600">{order.vehicleBrand} {order.vehicleModel} • Auftrag #{order.id.slice(-4)}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wartende Registrierungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingUsers.slice(0, 3).map((pendingUser: User) => (
                <div key={pendingUser.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{pendingUser.firstName} {pendingUser.lastName}</p>
                    <p className="text-sm text-gray-600">{pendingUser.email}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      className="bg-green-500 hover:bg-green-600 text-white"
                      onClick={() => approveUserMutation.mutate(pendingUser.id)}
                      disabled={approveUserMutation.isPending}
                      data-testid={`button-approve-user-${pendingUser.id}`}
                    >
                      <i className="fas fa-check mr-1"></i>Genehmigen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderOrdersContent = () => (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Aufträge verwalten</h1>
          <p className="text-gray-600">Erstellen, bearbeiten und verwalten Sie Überführungsaufträge</p>
        </div>
        <Button 
          className="bg-primary-500 hover:bg-primary-600 text-white"
          onClick={() => setShowOrderModal(true)}
          data-testid="button-create-order"
        >
          <i className="fas fa-plus mr-2"></i>Neuen Auftrag erstellen
        </Button>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Auftrag</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Fahrzeug</TableHead>
                <TableHead>Fahrer</TableHead>
                <TableHead>Preis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Keine Aufträge vorhanden
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order: Order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="text-sm font-medium text-gray-900">#{order.id.slice(-4)}</div>
                      <div className="text-sm text-gray-500">
                        Erstellt: {new Date(order.createdAt!).toLocaleDateString('de-DE')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{order.pickupLocation} → {order.deliveryLocation}</div>
                      <div className="text-sm text-gray-500">{order.distance} km</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{order.vehicleBrand} {order.vehicleModel}</div>
                      <div className="text-sm text-gray-500">{order.vehicleYear && `Bj. ${order.vehicleYear}`}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">
                        {order.assignedDriverId ? 'Zugewiesen' : 'Nicht zugewiesen'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-900">€{order.price}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => handleEditOrder(order)}
                          data-testid={`button-edit-order-${order.id}`}
                        >
                          Bearbeiten
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:text-red-900"
                          onClick={() => deleteOrderMutation.mutate(order.id)}
                          disabled={deleteOrderMutation.isPending}
                          data-testid={`button-delete-order-${order.id}`}
                        >
                          Löschen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderAuctionsContent = () => (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Auktionssystem</h1>
          <p className="text-gray-600">Verwalten Sie Sofortkauf-Aufträge für alle Fahrer</p>
        </div>
        <Button 
          className="bg-primary-500 hover:bg-primary-600 text-white"
          onClick={() => setShowAuctionModal(true)}
          data-testid="button-create-auction"
        >
          <i className="fas fa-gavel mr-2"></i>Neue Auktion erstellen
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {auctionsLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : auctions.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            Keine Auktionen vorhanden
          </div>
        ) : (
          auctions.map((auction: Auction) => (
            <Card key={auction.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <i className="fas fa-car text-orange-600"></i>
                    </div>
                    <div className="ml-3">
                      <h3 className="font-semibold text-gray-900">{auction.pickupLocation} → {auction.deliveryLocation}</h3>
                      <p className="text-sm text-gray-600">{auction.distance} km</p>
                    </div>
                  </div>
                  {getStatusBadge(auction.status)}
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fahrzeug:</span>
                    <span className="text-gray-900">{auction.vehicleBrand} {auction.vehicleModel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Abholung:</span>
                    <span className="text-gray-900">
                      {new Date(auction.pickupDate).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sofortpreis:</span>
                    <span className="text-lg font-bold text-primary-600">€{auction.instantPrice}</span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-900"
                    onClick={() => deleteAuctionMutation.mutate(auction.id)}
                    disabled={deleteAuctionMutation.isPending}
                    data-testid={`button-delete-auction-${auction.id}`}
                  >
                    <i className="fas fa-trash mr-1"></i>Löschen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  const renderUsersContent = () => (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Benutzer verwalten</h1>
          <p className="text-gray-600">Verwalten Sie Fahrer-Accounts und Berechtigungen</p>
        </div>
        <Button 
          onClick={() => setShowUserModal(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white"
          data-testid="button-add-user"
        >
          <i className="fas fa-plus mr-2"></i>
          Benutzer hinzufügen
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {usersLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            Keine Benutzer vorhanden
          </div>
        ) : (
          users.map((userItem: User) => (
            <Card key={userItem.id}>
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 bg-gray-300 rounded-full flex items-center justify-center">
                    {userItem.profileImageUrl ? (
                      <img 
                        src={userItem.profileImageUrl} 
                        alt={`${userItem.firstName} ${userItem.lastName}`}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <i className="fas fa-user text-gray-600"></i>
                    )}
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900">{userItem.firstName} {userItem.lastName}</h3>
                    <p className="text-sm text-gray-600">{userItem.email}</p>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rolle:</span>
                    <Badge variant="outline">{userItem.role === 'driver' ? 'Fahrer' : 'Admin'}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    {getStatusBadge(userItem.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-full">
      <Navigation 
        user={user as any}
        currentView={currentView}
        onViewChange={(view: string) => setCurrentView(view as ViewType)}
        userType="admin"
      />
      
      <div className="flex">
        <div className="w-64 bg-white shadow-sm min-h-screen">
          <nav className="mt-8">
            <div className="px-4 space-y-2">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`w-full text-left group flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                  currentView === 'dashboard'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                data-testid="nav-dashboard"
              >
                <i className={`fas fa-chart-bar mr-3 ${currentView === 'dashboard' ? 'text-primary-500' : ''}`}></i>
                Dashboard
              </button>
              
              <button
                onClick={() => setCurrentView('orders')}
                className={`w-full text-left group flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                  currentView === 'orders'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                data-testid="nav-orders"
              >
                <i className="fas fa-clipboard-list mr-3"></i>
                Aufträge verwalten
              </button>
              
              <button
                onClick={() => setCurrentView('auctions')}
                className={`w-full text-left group flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                  currentView === 'auctions'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                data-testid="nav-auctions"
              >
                <i className="fas fa-gavel mr-3"></i>
                Auktionen
              </button>
              
              <button
                onClick={() => setCurrentView('users')}
                className={`w-full text-left group flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                  currentView === 'users'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                data-testid="nav-users"
              >
                <i className="fas fa-users mr-3"></i>
                Benutzer verwalten
              </button>

              <button
                onClick={() => setCurrentView('billing')}
                className={`w-full text-left group flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                  currentView === 'billing'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                data-testid="nav-billing"
              >
                <i className="fas fa-euro-sign mr-3"></i>
                Abrechnungen
              </button>
            </div>
          </nav>
        </div>

        <div className="flex-1 p-8">
          {currentView === 'dashboard' && renderDashboardContent()}
          {currentView === 'orders' && renderOrdersContent()}
          {currentView === 'auctions' && renderAuctionsContent()}
          {currentView === 'users' && renderUsersContent()}
          {currentView === 'billing' && <AdminBilling />}
        </div>
      </div>

      <OrderFormModal 
        isOpen={showOrderModal} 
        onClose={() => setShowOrderModal(false)} 
      />
      
      <OrderEditModal 
        isOpen={showOrderEditModal} 
        onClose={handleCloseEditOrder}
        order={editingOrder}
      />
      
      <AuctionFormModal 
        isOpen={showAuctionModal} 
        onClose={() => setShowAuctionModal(false)} 
      />
      
      <UserFormModal 
        isOpen={showUserModal} 
        onClose={() => setShowUserModal(false)} 
      />
    </div>
  );
}
