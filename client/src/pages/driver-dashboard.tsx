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
import { AuctionCard } from "@/components/driver/auction-card";
import { AuctionPurchaseDialog } from "@/components/driver/auction-purchase-dialog";
import { VehicleHandoverDialog } from "@/components/driver/vehicle-handover-dialog";
import { Car, CheckCircle } from "lucide-react";
import type { Order, Auction } from "@shared/schema";

type ViewType = 'dashboard' | 'orders' | 'auctions' | 'billing' | 'history';

export default function DriverDashboard() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isHandoverDialogOpen, setIsHandoverDialogOpen] = useState(false);
  const [handoverMode, setHandoverMode] = useState<'pickup' | 'delivery'>('pickup');
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && (!user || (user as any)?.role !== 'driver')) {
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
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/orders"],
    enabled: !!user && (user as any)?.role === 'driver',
  });

  const { data: auctions = [], isLoading: auctionsLoading } = useQuery({
    queryKey: ["/api/auctions"],
    enabled: !!user && (user as any)?.role === 'driver',
  });

  const { data: billings = [], isLoading: billingsLoading } = useQuery({
    queryKey: ["/api/billing"],
    enabled: !!user && (user as any)?.role === 'driver',
  });

  // Type assertions for data
  const typedOrders = orders as Order[];
  const typedAuctions = auctions as Auction[];
  const typedBillings = billings as any[];

  // Mutations
  const markDeliveredMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status: 'delivered' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Erfolg", description: "Auto wurde erfolgreich abgegeben" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Nicht autorisiert",
          description: "Sie sind nicht angemeldet. Weiterleitung zur Anmeldung...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({ title: "Fehler", description: "Fehler beim Aktualisieren des Auftrags", variant: "destructive" });
    },
  });

  const handlePurchaseClick = (auction: Auction) => {
    setSelectedAuction(auction);
    setIsPurchaseDialogOpen(true);
  };

  const handleClosePurchaseDialog = () => {
    setSelectedAuction(null);
    setIsPurchaseDialogOpen(false);
  };

  const handleHandoverClick = (order: Order, mode: 'pickup' | 'delivery') => {
    setSelectedOrder(order);
    setHandoverMode(mode);
    setIsHandoverDialogOpen(true);
  };

  const handleCloseHandoverDialog = () => {
    setSelectedOrder(null);
    setIsHandoverDialogOpen(false);
  };

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order accepted successfully!" });
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
      toast({ title: "Error", description: "Failed to accept order", variant: "destructive" });
    },
  });

  const rejectOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order rejected successfully" });
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
      toast({ title: "Error", description: "Failed to reject order", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user || user.role !== 'driver') {
    return null;
  }

  const assignedOrders = typedOrders.filter((order: Order) => 
    (order.status === 'assigned' && order.fromAuction !== 'true') || // Manual assignments that need acceptance
    order.status === 'in_progress' || order.status === 'delivered'
  );
  const completedOrders = typedOrders.filter((order: Order) => order.status === 'completed');
  const monthlyEarnings = completedOrders.reduce((sum: number, order: Order) => sum + Number(order.price), 0);

  const stats = {
    assignedOrders: assignedOrders.length,
    completedTrips: completedOrders.length,
    monthlyEarnings: monthlyEarnings,
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      assigned: { label: "Zugewiesen", variant: "default" as const },
      in_progress: { label: "Auto abgeholt", variant: "secondary" as const },
      delivered: { label: "Auto abgegeben", variant: "outline" as const },
      completed: { label: "Abgeschlossen", variant: "secondary" as const },
      cancelled: { label: "Storniert", variant: "destructive" as const },
      open: { label: "Offen", variant: "outline" as const },
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
        <h1 className="text-3xl font-bold text-gray-900">
          Willkommen zurück, {user.firstName}!
        </h1>
        <p className="text-gray-600">Hier ist Ihr Überblick für heute</p>
      </div>

      {/* Driver Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <i className="fas fa-clipboard-list text-blue-600"></i>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Zugewiesene Aufträge</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-assigned-orders">{stats.assignedOrders}</p>
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
                <i className="fas fa-euro-sign text-primary-600"></i>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Verdienst (Gesamt)</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-monthly-earnings">€{stats.monthlyEarnings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Orders */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Meine aktuellen Aufträge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assignedOrders.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Keine zugewiesenen Aufträge</p>
            ) : (
              assignedOrders.map((order: Order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Auftrag #{order.id.slice(-4)}</h4>
                      <p className="text-sm text-gray-600">{order.pickupLocation} → {order.deliveryLocation}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600 block">Fahrzeug:</span>
                      <span className="text-gray-900">{order.vehicleBrand} {order.vehicleModel}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">Abholung:</span>
                      <span className="text-gray-900">
                        {new Date(order.pickupDate).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">Vergütung:</span>
                      <span className="text-gray-900 font-medium">€{order.price}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">Distanz:</span>
                      <span className="text-gray-900">{order.distance} km</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    {order.status === 'assigned' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => handleHandoverClick(order, 'pickup')}
                          data-testid={`button-start-pickup-${order.id}`}
                        >
                          Auftrag starten
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => rejectOrderMutation.mutate(order.id)}
                          disabled={rejectOrderMutation.isPending}
                          data-testid={`button-reject-order-${order.id}`}
                        >
                          Ablehnen
                        </Button>
                      </>
                    )}
                    {order.status === 'in_progress' && (
                      <Button
                        size="sm"
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={() => markDeliveredMutation.mutate(order.id)}
                        disabled={markDeliveredMutation.isPending}
                        data-testid={`button-mark-delivered-${order.id}`}
                      >
                        Auto abgegeben
                      </Button>
                    )}
                    {order.status === 'delivered' && (
                      <div className="text-green-600 text-sm font-medium">
                        ✓ Auto wurde abgegeben - Wartet auf admin. Bestätigung
                      </div>
                    )}
                    {order.status === 'in_progress' && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleHandoverClick(order, 'delivery')}
                        data-testid={`button-delivery-handover-${order.id}`}
                      >
                        Auslieferung dokumentieren
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Auctions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Verfügbare Auktionen</CardTitle>
            <span className="text-sm text-gray-600">Sofortkauf möglich</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {auctionsLoading ? (
              <div className="col-span-full flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : typedAuctions.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                Keine Auktionen verfügbar
              </div>
            ) : (
              typedAuctions.map((auction: Auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  onPurchase={() => handlePurchaseClick(auction)}
                  isPurchasing={false}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderOrdersContent = () => (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Meine Aufträge</h1>
        <p className="text-gray-600">Alle Ihnen zugewiesenen Überführungsaufträge</p>
      </div>

      <div className="space-y-4">
        {ordersLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : typedOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Keine Aufträge vorhanden
          </div>
        ) : (
          typedOrders.map((order: Order) => (
            <Card key={order.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">Auftrag #{order.id.slice(-4)}</h4>
                    <p className="text-sm text-gray-600">{order.pickupLocation} → {order.deliveryLocation}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-600 block">Fahrzeug:</span>
                    <span className="text-gray-900">{order.vehicleBrand} {order.vehicleModel}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block">Abholung:</span>
                    <span className="text-gray-900">
                      {new Date(order.pickupDate).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 block">Vergütung:</span>
                    <span className="text-gray-900 font-medium">€{order.price}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block">Distanz:</span>
                    <span className="text-gray-900">{order.distance} km</span>
                  </div>
                </div>
                
                {/* Action buttons based on order status */}
                <div className="flex flex-wrap gap-2">
                  {order.status === 'assigned' && order.fromAuction !== 'true' && (
                    <>
                      <Button 
                        onClick={() => acceptOrderMutation.mutate(order.id)}
                        size="sm"
                        disabled={acceptOrderMutation.isPending}
                        data-testid={`button-accept-${order.id}`}
                      >
                        {acceptOrderMutation.isPending ? "Wird angenommen..." : "Annehmen"}
                      </Button>
                      <Button 
                        onClick={() => rejectOrderMutation.mutate(order.id)}
                        variant="outline"
                        size="sm"
                        disabled={rejectOrderMutation.isPending}
                        data-testid={`button-reject-${order.id}`}
                      >
                        {rejectOrderMutation.isPending ? "Wird abgelehnt..." : "Ablehnen"}
                      </Button>
                    </>
                  )}
                  
                  {order.status === 'assigned' && order.fromAuction === 'true' && (
                    <Button 
                      onClick={() => {
                        setSelectedOrder(order);
                        setHandoverMode('pickup');
                        setIsHandoverDialogOpen(true);
                      }}
                      size="sm"
                      data-testid={`button-pickup-${order.id}`}
                    >
                      <Car className="w-4 h-4 mr-2" />
                      Fahrzeug übernehmen
                    </Button>
                  )}
                  
                  {order.status === 'in_progress' && (
                    <Button 
                      onClick={() => updateOrderStatus.mutate({ orderId: order.id, status: 'delivered' })}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={updateOrderStatus.isPending}
                      data-testid={`button-delivery-${order.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Fahrzeug übergeben
                    </Button>
                  )}
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Auktionen</h1>
        <p className="text-gray-600">Verfügbare Sofortkauf-Aufträge</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {auctionsLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : typedAuctions.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            Keine Auktionen verfügbar
          </div>
        ) : (
          typedAuctions.map((auction: Auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              onPurchase={() => handlePurchaseClick(auction)}
              isPurchasing={false}
            />
          ))
        )}
      </div>
    </div>
  );

  const renderBillingContent = () => (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Meine Abrechnung</h1>
        <p className="text-gray-600">Übersicht Ihrer Abrechnungen und Verdienste</p>
      </div>

      <div className="space-y-6">
        {billingsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : typedBillings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Keine Abrechnungen vorhanden
          </div>
        ) : (
          typedBillings.map((billing: any) => (
            <Card key={billing.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Abrechnung #{billing.id.slice(-4)}</h4>
                    <p className="text-sm text-gray-600">
                      Auftrag #{billing.orderId?.slice(-4)} • {new Date(billing.createdAt).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      billing.status === 'approved' ? 'default' : 
                      billing.status === 'rejected' ? 'destructive' : 
                      'secondary'
                    }
                  >
                    {billing.status === 'pending' && 'Ausstehend'}
                    {billing.status === 'approved' && 'Genehmigt'}
                    {billing.status === 'rejected' && 'Abgelehnt'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-600 block">Betrag:</span>
                    <span className="text-gray-900 font-medium">€{billing.amount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block">Status:</span>
                    <span className="text-gray-900">
                      {billing.status === 'pending' && 'Wird geprüft'}
                      {billing.status === 'approved' && 'Ausgezahlt'}
                      {billing.status === 'rejected' && 'Zurückgewiesen'}
                    </span>
                  </div>
                  {billing.adminNotes && (
                    <div>
                      <span className="text-gray-600 block">Notizen:</span>
                      <span className="text-gray-900">{billing.adminNotes}</span>
                    </div>
                  )}
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
        user={user}
        currentView={currentView}
        onViewChange={(view: string) => setCurrentView(view as ViewType)}
        userType="driver"
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
                <i className={`fas fa-tachometer-alt mr-3 ${currentView === 'dashboard' ? 'text-primary-500' : ''}`}></i>
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
                Meine Aufträge
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
                onClick={() => setCurrentView('billing')}
                className={`w-full text-left group flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                  currentView === 'billing'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                data-testid="nav-billing"
              >
                <i className="fas fa-receipt mr-3"></i>
                Meine Abrechnung
              </button>
            </div>
          </nav>
        </div>

        <div className="flex-1 p-8">
          {currentView === 'dashboard' && renderDashboardContent()}
          {currentView === 'orders' && renderOrdersContent()}
          {currentView === 'auctions' && renderAuctionsContent()}
          {currentView === 'billing' && renderBillingContent()}
        </div>
      </div>

      {/* Purchase Dialog */}
      <AuctionPurchaseDialog
        auction={selectedAuction}
        isOpen={isPurchaseDialogOpen}
        onClose={handleClosePurchaseDialog}
      />
      
      {/* Vehicle Handover Dialog */}
      <VehicleHandoverDialog
        isOpen={isHandoverDialogOpen}
        onClose={handleCloseHandoverDialog}
        order={selectedOrder}
        mode={handoverMode}
      />
    </div>
  );
}
