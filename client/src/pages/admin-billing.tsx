import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Euro, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order, Billing } from "@shared/schema";

export default function AdminBilling() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedBilling, setSelectedBilling] = useState<Billing | null>(null);
  const [billingAmount, setBillingAmount] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch pending orders
  const { data: pendingOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/admin/billing/pending"],
  });

  // Fetch pending billing approvals
  const { data: pendingBillings = [], isLoading: billingsLoading } = useQuery({
    queryKey: ["/api/admin/billing/approvals"],
  });

  // Create billing mutation
  const createBillingMutation = useMutation({
    mutationFn: async (data: { orderId: string; driverId: string; amount: string }) => {
      return await apiRequest("POST", "/api/admin/billing/create", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing/approvals"] });
      setIsCreateDialogOpen(false);
      setSelectedOrder(null);
      setBillingAmount("");
      toast({ title: "Success", description: "Billing created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to create billing", variant: "destructive" });
    },
  });

  // Approve/reject billing mutation
  const updateBillingMutation = useMutation({
    mutationFn: async (data: { billingId: string; status: string; adminNotes?: string; newAmount?: string }) => {
      return await apiRequest("PATCH", `/api/admin/billing/${data.billingId}/status`, {
        status: data.status,
        adminNotes: data.adminNotes,
        newAmount: data.newAmount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      setIsApprovalDialogOpen(false);
      setSelectedBilling(null);
      setAdminNotes("");
      setNewAmount("");
      toast({ title: "Success", description: "Billing updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update billing", variant: "destructive" });
    },
  });

  const handleCreateBilling = (order: Order) => {
    setSelectedOrder(order);
    setBillingAmount(order.price);
    setIsCreateDialogOpen(true);
  };

  const handleApproveBilling = (billing: Billing, action: 'approved' | 'rejected') => {
    setSelectedBilling(billing);
    setNewAmount(billing.amount);
    setIsApprovalDialogOpen(true);
  };

  const handleSubmitBilling = () => {
    if (!selectedOrder || !billingAmount) return;
    
    createBillingMutation.mutate({
      orderId: selectedOrder.id,
      driverId: selectedOrder.assignedDriverId!,
      amount: billingAmount,
    });
  };

  const handleSubmitApproval = (status: 'approved' | 'rejected') => {
    if (!selectedBilling) return;
    
    updateBillingMutation.mutate({
      billingId: selectedBilling.id,
      status,
      adminNotes: adminNotes,
      newAmount: status === 'approved' ? newAmount : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Ausstehend", variant: "secondary" as const, icon: Clock },
      approved: { label: "Genehmigt", variant: "default" as const, icon: CheckCircle },
      rejected: { label: "Abgelehnt", variant: "destructive" as const, icon: XCircle },
    };
    
    const config = statusMap[status as keyof typeof statusMap];
    if (!config) return <Badge variant="outline">{status}</Badge>;
    
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Abrechnungsmanagement</h1>
        <p className="text-gray-600">Verwalten Sie Fahrerabrechnungen und Vergütungen</p>
      </div>

      <Tabs defaultValue="pending-orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending-orders" data-testid="tab-pending-orders">
            Abgeschlossene Aufträge ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">
            Genehmigungen ({pendingBillings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending-orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Abgeschlossene Aufträge zur Abrechnung
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Keine abgeschlossenen Aufträge zur Abrechnung vorhanden
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingOrders.map((order: Order) => (
                    <div
                      key={order.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            Auftrag #{order.id.slice(-4)}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {order.pickupLocation} → {order.deliveryLocation}
                          </p>
                        </div>
                        <Badge variant="default">Abgeschlossen</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-gray-600 block">Fahrzeug:</span>
                          <span className="text-gray-900">
                            {order.vehicleBrand} {order.vehicleModel}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Preis:</span>
                          <span className="text-gray-900 font-medium">€{order.price}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Distanz:</span>
                          <span className="text-gray-900">{order.distance} km</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Abgeschlossen:</span>
                          <span className="text-gray-900">
                            {new Date(order.updatedAt || '').toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleCreateBilling(order)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`button-create-billing-${order.id}`}
                        >
                          Abrechnung erstellen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Abrechnungen zur Genehmigung
              </CardTitle>
            </CardHeader>
            <CardContent>
              {billingsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : pendingBillings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Keine Abrechnungen zur Genehmigung vorhanden
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingBillings.map((billing: Billing) => (
                    <div
                      key={billing.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {billing.description}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Erstellt am {new Date(billing.createdAt || '').toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        {getStatusBadge(billing.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-gray-600 block">Betrag:</span>
                          <span className="text-gray-900 font-medium">€{billing.amount}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Typ:</span>
                          <span className="text-gray-900">{billing.type}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Fahrer-ID:</span>
                          <span className="text-gray-900">{billing.userId}</span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleApproveBilling(billing, 'rejected')}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-reject-billing-${billing.id}`}
                        >
                          Ablehnen
                        </Button>
                        <Button
                          onClick={() => handleApproveBilling(billing, 'approved')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`button-approve-billing-${billing.id}`}
                        >
                          Genehmigen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Billing Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-billing">
          <DialogHeader>
            <DialogTitle>Abrechnung erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedOrder && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Auftrag</p>
                  <p className="font-medium">
                    {selectedOrder.vehicleBrand} {selectedOrder.vehicleModel}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedOrder.pickupLocation} → {selectedOrder.deliveryLocation}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abrechnungsbetrag (€)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={billingAmount}
                    onChange={(e) => setBillingAmount(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-billing-amount"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-billing"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleSubmitBilling}
                    disabled={!billingAmount || createBillingMutation.isPending}
                    data-testid="button-submit-billing"
                  >
                    {createBillingMutation.isPending ? "Erstelle..." : "Erstellen"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent data-testid="dialog-approve-billing">
          <DialogHeader>
            <DialogTitle>Abrechnung genehmigen/ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBilling && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Beschreibung</p>
                  <p className="font-medium">{selectedBilling.description}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Finaler Betrag (€)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-new-amount"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin-Notizen
                  </label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Grund für Änderung oder Ablehnung..."
                    data-testid="textarea-admin-notes"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsApprovalDialogOpen(false)}
                    data-testid="button-cancel-approval"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSubmitApproval('rejected')}
                    disabled={updateBillingMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                    data-testid="button-reject-approval"
                  >
                    Ablehnen
                  </Button>
                  <Button
                    onClick={() => handleSubmitApproval('approved')}
                    disabled={updateBillingMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-approve-approval"
                  >
                    Genehmigen
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}