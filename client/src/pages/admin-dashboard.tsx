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
import { AuctionEditModal } from "@/components/admin/auction-edit-modal";
import { UserFormModal } from "@/components/admin/user-form-modal";
import { HandoverDetailsModal } from "@/components/admin/handover-details-modal";
import AdminBilling from "@/pages/admin-billing";
import type { User, Order, Auction } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type ViewType = 'dashboard' | 'orders' | 'auctions' | 'users' | 'billing' | 'reports';

// Schema for editing users
const editUserSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  email: z.string().email("Gültige E-Mail-Adresse erforderlich"),
  password: z.string().optional(),
  role: z.enum(['admin', 'driver', 'disponent']),
  status: z.enum(['pending', 'active', 'inactive']),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showOrderEditModal, setShowOrderEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showAuctionEditModal, setShowAuctionEditModal] = useState(false);
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [selectedOrderForHandover, setSelectedOrderForHandover] = useState<Order | null>(null);
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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserToDelete(null);
      toast({ title: "Erfolg", description: "Benutzer erfolgreich gelöscht" });
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
      toast({ title: "Fehler", description: "Benutzer konnte nicht gelöscht werden", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: EditUserFormData }) => {
      const updateData = { ...data };
      if (!data.password || data.password.trim() === '') {
        delete updateData.password;
      }
      await apiRequest("PATCH", `/api/users/${userId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowEditModal(false);
      setEditingUser(null);
      toast({ title: "Erfolg", description: "Benutzer erfolgreich aktualisiert" });
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
      toast({ title: "Fehler", description: "Benutzer konnte nicht aktualisiert werden", variant: "destructive" });
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

  // Edit User Form
  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "driver",
      status: "active",
    },
  });

  // Update form when editing user changes
  useEffect(() => {
    if (editingUser) {
      editForm.reset({
        firstName: editingUser.firstName || "",
        lastName: editingUser.lastName || "",
        email: editingUser.email || "",
        password: "",
        role: editingUser.role as 'admin' | 'driver' | 'disponent',
        status: editingUser.status as 'pending' | 'active' | 'inactive',
      });
    }
  }, [editingUser, editForm]);

  // Functions
  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setShowOrderEditModal(true);
  };

  const handleEditUser = (data: EditUserFormData) => {
    if (editingUser) {
      updateUserMutation.mutate({ userId: editingUser.id, data });
    }
  };

  const handleDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete);
    }
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

      {/* Mobile-responsive Cards instead of Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ordersLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            Keine Aufträge vorhanden
          </div>
        ) : (
          orders.map((order: Order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <i className="fas fa-truck text-blue-600"></i>
                    </div>
                    <div className="ml-3">
                      <h3 className="font-semibold text-gray-900">Auftrag #{order.id.slice(-4)}</h3>
                      <p className="text-sm text-gray-600">
                        Erstellt: {new Date(order.createdAt!).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Route:</span>
                    <span className="text-gray-900 text-right font-medium">
                      {order.pickupLocation} → {order.deliveryLocation}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Entfernung:</span>
                    <span className="text-gray-900">{order.distance} km</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fahrzeug:</span>
                    <span className="text-gray-900">
                      {order.vehicleBrand} {order.vehicleModel}
                      {order.vehicleYear && ` (${order.vehicleYear})`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fahrer:</span>
                    <span className="text-gray-900">
                      {order.assignedDriverId ? 'Zugewiesen' : 'Nicht zugewiesen'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Preis:</span>
                    <span className="text-lg font-bold text-primary-600">€{order.price}</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="text-blue-600 hover:text-blue-900"
                    onClick={() => handleEditOrder(order)}
                    data-testid={`button-edit-order-${order.id}`}
                  >
                    <i className="fas fa-edit mr-1"></i>Bearbeiten
                  </Button>
                  {(order.status === 'in_progress' || order.status === 'completed') && (
                    <Button 
                      variant="outline"
                      size="sm"
                      className="text-green-600 hover:text-green-900"
                      onClick={() => {
                        setSelectedOrderForHandover(order);
                        setShowHandoverModal(true);
                      }}
                      data-testid={`button-view-handover-${order.id}`}
                    >
                      <i className="fas fa-clipboard-check mr-1"></i>Übergabe
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-900"
                    onClick={() => deleteOrderMutation.mutate(order.id)}
                    disabled={deleteOrderMutation.isPending}
                    data-testid={`button-delete-order-${order.id}`}
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
                    className="text-blue-600 hover:text-blue-900"
                    onClick={() => {
                      setEditingAuction(auction);
                      setShowAuctionEditModal(true);
                    }}
                    data-testid={`button-edit-auction-${auction.id}`}
                  >
                    <i className="fas fa-edit mr-1"></i>Bearbeiten
                  </Button>
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
                    <Badge variant="outline">
                      {userItem.role === 'driver' ? 'Fahrer' : 
                       userItem.role === 'admin' ? 'Admin' : 
                       userItem.role === 'disponent' ? 'Disponent' : userItem.role}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    {getStatusBadge(userItem.status)}
                  </div>
                </div>
                
                <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-200">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingUser(userItem);
                      setShowEditModal(true);
                    }}
                    data-testid={`button-edit-user-${userItem.id}`}
                  >
                    <i className="fas fa-edit mr-1"></i>Bearbeiten
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setUserToDelete(userItem.id)}
                    disabled={userItem.id === user?.id}
                    data-testid={`button-delete-user-${userItem.id}`}
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
      
      <AuctionEditModal 
        isOpen={showAuctionEditModal} 
        onClose={() => {
          setShowAuctionEditModal(false);
          setEditingAuction(null);
        }}
        auction={editingAuction}
      />
      
      <UserFormModal 
        isOpen={showUserModal} 
        onClose={() => setShowUserModal(false)} 
      />
      
      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditUser)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vorname</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="edit-input-first-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nachname</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="edit-input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-Mail</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="edit-input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neues Passwort (optional)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Leer lassen für keine Änderung" {...field} data-testid="edit-input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rolle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="edit-select-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="driver">Fahrer</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="disponent">Disponent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="edit-select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Aktiv</SelectItem>
                        <SelectItem value="pending">Wartend</SelectItem>
                        <SelectItem value="inactive">Inaktiv</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  data-testid="edit-button-cancel"
                >
                  Abbrechen
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateUserMutation.isPending}
                  data-testid="edit-button-submit"
                >
                  {updateUserMutation.isPending ? "Speichere..." : "Speichern"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete User Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diesen Benutzer löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              data-testid="delete-confirm"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <HandoverDetailsModal 
        isOpen={showHandoverModal}
        onClose={() => {
          setShowHandoverModal(false);
          setSelectedOrderForHandover(null);
        }}
        order={selectedOrderForHandover}
      />
    </div>
  );
}
