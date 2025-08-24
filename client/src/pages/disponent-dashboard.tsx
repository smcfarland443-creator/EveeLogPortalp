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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Truck, MapPin, Calendar, Euro } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOrderSchema, type Order } from "@shared/schema";
import { z } from "zod";

type ViewType = 'dashboard' | 'orders' | 'create';

// Form schema for creating orders
const disponentOrderSchema = insertOrderSchema.extend({
  pickupDate: z.string(),
  deliveryDate: z.string().optional(),
});

type DisponentOrderFormData = z.infer<typeof disponentOrderSchema>;

export default function DisponentDashboard() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && (!user || (user as any)?.role !== 'disponent')) {
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

  // Fetch only disponent's own orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/orders"],
    enabled: !!user && (user as any)?.role === 'disponent',
  });

  const typedOrders = orders as Order[];

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: DisponentOrderFormData) => {
      return await apiRequest("POST", "/api/orders", {
        ...data,
        pickupDate: new Date(data.pickupDate),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsCreateOrderOpen(false);
      toast({ title: "Success", description: "Order created successfully" });
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
      toast({ title: "Error", description: "Failed to create order", variant: "destructive" });
    },
  });

  const form = useForm<DisponentOrderFormData>({
    resolver: zodResolver(disponentOrderSchema),
    defaultValues: {
      pickupLocation: "",
      deliveryLocation: "",
      vehicleBrand: "",
      vehicleModel: "",
      vehicleYear: new Date().getFullYear(),
      pickupDate: "",
      deliveryDate: "",
      pickupTimeFrom: "08:00",
      pickupTimeTo: "18:00",
      deliveryTimeFrom: "08:00",
      deliveryTimeTo: "18:00",
      price: "0",
      distance: 0,
      notes: "",
    },
  });

  const handleCreateOrder = (data: DisponentOrderFormData) => {
    createOrderMutation.mutate(data);
  };

  if (!user || (user as any)?.role !== 'disponent') {
    return null;
  }

  const myOrders = typedOrders.filter((order: Order) => order.createdById === user.id);
  const openOrders = myOrders.filter((order: Order) => order.status === 'open');
  const assignedOrders = myOrders.filter((order: Order) => order.status === 'assigned' || order.status === 'in_progress');
  const completedOrders = myOrders.filter((order: Order) => order.status === 'completed');

  const stats = {
    totalOrders: myOrders.length,
    openOrders: openOrders.length,
    assignedOrders: assignedOrders.length,
    completedOrders: completedOrders.length,
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      open: { label: "Offen", variant: "outline" as const },
      assigned: { label: "Zugewiesen", variant: "default" as const },
      in_progress: { label: "In Bearbeitung", variant: "secondary" as const },
      pickup_scheduled: { label: "Abholung geplant", variant: "default" as const },
      picked_up: { label: "Abgeholt", variant: "secondary" as const },
      delivered: { label: "Ausgeliefert", variant: "secondary" as const },
      completed: { label: "Abgeschlossen", variant: "secondary" as const },
      cancelled: { label: "Storniert", variant: "destructive" as const },
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
        <h1 className="text-3xl font-bold text-gray-900">Disponent Dashboard</h1>
        <p className="text-gray-600">Verwalten Sie Ihre eigenen Überführungsaufträge</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Truck className="text-blue-600" size={24} />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Gesamt Aufträge</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-total-orders">{stats.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <MapPin className="text-yellow-600" size={24} />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Offene Aufträge</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-open-orders">{stats.openOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="text-green-600" size={24} />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">In Bearbeitung</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-assigned-orders">{stats.assignedOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Euro className="text-primary-600" size={24} />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Abgeschlossen</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-completed-orders">{stats.completedOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Neueste Aufträge</CardTitle>
            <Button onClick={() => setIsCreateOrderOpen(true)} data-testid="button-create-order">
              <Plus className="mr-2" size={16} />
              Neuen Auftrag erstellen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {myOrders.slice(0, 5).length === 0 ? (
              <p className="text-center py-8 text-gray-500">Keine Aufträge vorhanden</p>
            ) : (
              myOrders.slice(0, 5).map((order: Order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Auftrag #{order.id.slice(-4)}</h4>
                      <p className="text-sm text-gray-600">{order.pickupLocation} → {order.deliveryLocation}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                </div>
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
        <p className="text-gray-600">Alle von Ihnen erstellten Überführungsaufträge</p>
      </div>

      <div className="space-y-4">
        {ordersLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : myOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Keine Aufträge vorhanden
          </div>
        ) : (
          myOrders.map((order: Order) => (
            <Card key={order.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">Auftrag #{order.id.slice(-4)}</h4>
                    <p className="text-sm text-gray-600">{order.pickupLocation} → {order.deliveryLocation}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                
                {order.assignedDriverId && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Zugewiesener Fahrer: </span>
                    <span className="text-sm text-gray-900 font-medium">{order.assignedDriverId}</span>
                  </div>
                )}
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
        userType="disponent"
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
            </div>
          </nav>
        </div>

        <div className="flex-1 p-8">
          {currentView === 'dashboard' && renderDashboardContent()}
          {currentView === 'orders' && renderOrdersContent()}
        </div>
      </div>

      {/* Create Order Dialog */}
      <Dialog open={isCreateOrderOpen} onOpenChange={setIsCreateOrderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neuen Auftrag erstellen</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateOrder)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pickupLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abholort</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. Berlin" {...field} data-testid="input-pickup-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="deliveryLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zielort</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. München" {...field} data-testid="input-delivery-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="vehicleBrand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fahrzeugmarke</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. BMW" {...field} data-testid="input-vehicle-brand" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="vehicleModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modell</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. 3er" {...field} data-testid="input-vehicle-model" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="vehicleYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Baujahr</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-vehicle-year" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pickupDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abholdatum</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-pickup-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="deliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lieferdatum (optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-delivery-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergütung (€)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="distance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distanz (km)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-distance" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notizen (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Zusätzliche Informationen..." {...field} data-testid="textarea-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setIsCreateOrderOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={createOrderMutation.isPending} data-testid="button-submit-order">
                  {createOrderMutation.isPending ? "Erstelle..." : "Auftrag erstellen"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}