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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuctionCard } from "@/components/driver/auction-card";
import { AuctionPurchaseDialog } from "@/components/driver/auction-purchase-dialog";
import { VehicleHandoverDialog } from "@/components/driver/vehicle-handover-dialog";
import { Car, CheckCircle, Filter, Search } from "lucide-react";
import type { Order, Auction } from "@shared/schema";

type ViewType = 'dashboard' | 'orders' | 'auctions' | 'billing' | 'history';

export default function DriverDashboard() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isHandoverDialogOpen, setIsHandoverDialogOpen] = useState(false);
  const [handoverMode, setHandoverMode] = useState<'pickup' | 'delivery'>('pickup');
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  
  // Filter states
  const [priceFilter, setPriceFilter] = useState({ min: '', max: '' });
  const [locationFilter, setLocationFilter] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [transportTypeFilter, setTransportTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('price');
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
  
  // Filter and sort auctions
  const filteredAndSortedAuctions = typedAuctions
    .filter(auction => {
      // Price filter
      if (priceFilter.min && parseFloat(auction.instantPrice) < parseFloat(priceFilter.min)) return false;
      if (priceFilter.max && parseFloat(auction.instantPrice) > parseFloat(priceFilter.max)) return false;
      
      // Location filter
      if (locationFilter) {
        const locationMatch = 
          auction.pickupLocation.toLowerCase().includes(locationFilter.toLowerCase()) ||
          auction.deliveryLocation.toLowerCase().includes(locationFilter.toLowerCase());
        if (!locationMatch) return false;
      }
      
      // Vehicle type filter
      if (vehicleTypeFilter && !auction.vehicleBrand.toLowerCase().includes(vehicleTypeFilter.toLowerCase()) &&
          !auction.vehicleModel.toLowerCase().includes(vehicleTypeFilter.toLowerCase())) {
        return false;
      }
      
      // Transport type filter (using status as proxy for transport type)
      if (transportTypeFilter && auction.status !== transportTypeFilter) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return parseFloat(a.instantPrice) - parseFloat(b.instantPrice);
        case 'price-desc':
          return parseFloat(b.instantPrice) - parseFloat(a.instantPrice);
        case 'distance':
          return parseInt(a.distance) - parseInt(b.distance);
        case 'pickup':
          return a.pickupLocation.localeCompare(b.pickupLocation);
        case 'delivery':
          return a.deliveryLocation.localeCompare(b.deliveryLocation);
        default:
          return parseFloat(a.instantPrice) - parseFloat(b.instantPrice);
      }
    });
    
  const clearFilters = () => {
    setPriceFilter({ min: '', max: '' });
    setLocationFilter('');
    setVehicleTypeFilter('');
    setTransportTypeFilter('');
    setSortBy('price');
  };

  // Mutations
  const markCompletedMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order marked as completed" });
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
      toast({ title: "Error", description: "Failed to update order", variant: "destructive" });
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
    order.status === 'in_progress'
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
      in_progress: { label: "In Bearbeitung", variant: "secondary" as const },
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
                        onClick={() => markCompletedMutation.mutate(order.id)}
                        disabled={markCompletedMutation.isPending}
                        data-testid={`button-mark-completed-${order.id}`}
                      >
                        Als erledigt markieren
                      </Button>
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
                      onClick={() => {
                        setSelectedOrder(order);
                        setHandoverMode('delivery');
                        setIsHandoverDialogOpen(true);
                      }}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
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

      {/* Filter Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Sortierung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Price Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Preis (€)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={priceFilter.min}
                  onChange={(e) => setPriceFilter(prev => ({ ...prev, min: e.target.value }))}
                  className="w-20"
                  data-testid="filter-price-min"
                />
                <span className="self-center">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={priceFilter.max}
                  onChange={(e) => setPriceFilter(prev => ({ ...prev, max: e.target.value }))}
                  className="w-20"
                  data-testid="filter-price-max"
                />
              </div>
            </div>

            {/* Location Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Ort</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Stadt oder PLZ"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="pl-10"
                  data-testid="filter-location"
                />
              </div>
            </div>

            {/* Vehicle Type Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Fahrzeugtyp</label>
              <Input
                placeholder="z.B. BMW, Transporter"
                value={vehicleTypeFilter}
                onChange={(e) => setVehicleTypeFilter(e.target.value)}
                data-testid="filter-vehicle-type"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium mb-2">Sortieren nach</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger data-testid="sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price-asc">Preis aufsteigend</SelectItem>
                  <SelectItem value="price-desc">Preis absteigend</SelectItem>
                  <SelectItem value="distance">Entfernung</SelectItem>
                  <SelectItem value="pickup">Abholort</SelectItem>
                  <SelectItem value="delivery">Zielort</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {filteredAndSortedAuctions.length} von {typedAuctions.length} Auktionen
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters} data-testid="clear-filters">
              Filter zurücksetzen
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {auctionsLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : filteredAndSortedAuctions.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            {typedAuctions.length === 0 ? 'Keine Auktionen verfügbar' : 'Keine Auktionen entsprechen den Filterkriterien'}
          </div>
        ) : (
          filteredAndSortedAuctions.map((auction: Auction) => (
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
        ) : billings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Keine Abrechnungen vorhanden
          </div>
        ) : (
          billings.map((billing: any) => (
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
