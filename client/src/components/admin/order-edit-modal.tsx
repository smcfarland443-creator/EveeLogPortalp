import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { insertOrderSchema, type User, type Order } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";

const orderEditSchema = insertOrderSchema.extend({
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().optional(),
  vehicleYear: z.number().optional(),
}).omit({ createdById: true });

type OrderEditData = z.infer<typeof orderEditSchema>;

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export function OrderEditModal({ isOpen, onClose, order }: OrderEditModalProps) {
  const { toast } = useToast();
  
  // Fetch active drivers for assignment
  const { data: activeDrivers = [] } = useQuery<User[]>({
    queryKey: ["/api/drivers/active"],
    enabled: isOpen,
    retry: false,
  });
  
  const form = useForm<OrderEditData>({
    resolver: zodResolver(orderEditSchema),
    defaultValues: {
      pickupLocation: order?.pickupLocation || "",
      deliveryLocation: order?.deliveryLocation || "",
      vehicleBrand: order?.vehicleBrand || "",
      vehicleModel: order?.vehicleModel || "",
      vehicleYear: order?.vehicleYear || undefined,
      pickupDate: order?.pickupDate ? new Date(order.pickupDate).toISOString().split('T')[0] : "",
      deliveryDate: order?.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : "",
      price: order?.price || "",
      distance: order?.distance || undefined,
      notes: order?.notes || "",
      status: order?.status || "open",
      assignedDriverId: order?.assignedDriverId || undefined,
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (data: OrderEditData) => {
      if (!order) return;
      
      const orderData = {
        ...data,
        pickupDate: data.pickupDate,
        deliveryDate: data.deliveryDate || null,
        price: data.price.toString(),
      };
      
      await apiRequest("PATCH", `/api/orders/${order.id}`, orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order updated successfully" });
      onClose();
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
      toast({
        title: "Error",
        description: "Failed to update order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: OrderEditData) => {
    updateOrderMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  // Update form values when order changes
  React.useEffect(() => {
    if (order && isOpen) {
      form.reset({
        pickupLocation: order.pickupLocation,
        deliveryLocation: order.deliveryLocation,
        vehicleBrand: order.vehicleBrand,
        vehicleModel: order.vehicleModel,
        vehicleYear: order.vehicleYear || undefined,
        pickupDate: new Date(order.pickupDate).toISOString().split('T')[0],
        deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : "",
        price: order.price,
        distance: order.distance || undefined,
        notes: order.notes || "",
        status: order.status,
        assignedDriverId: order.assignedDriverId || undefined,
      });
    }
  }, [order, isOpen, form]);

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Auftrag bearbeiten
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="pickupLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abholort</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Berlin, Deutschland" 
                        {...field} 
                        data-testid="input-pickup-location"
                      />
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
                      <Input 
                        placeholder="München, Deutschland" 
                        {...field} 
                        data-testid="input-delivery-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="vehicleBrand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fahrzeugmarke</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="BMW" 
                        {...field} 
                        data-testid="input-vehicle-brand"
                      />
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
                    <FormLabel>Fahrzeugmodell</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="X3" 
                        {...field} 
                        data-testid="input-vehicle-model"
                      />
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
                    <FormLabel>Baujahr (optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="2023" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-vehicle-year"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="pickupDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abholdatum</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        data-testid="input-pickup-date"
                      />
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
                      <Input 
                        type="date" 
                        {...field}
                        value={field.value || ""}
                        data-testid="input-delivery-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vergütung (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="120" 
                        {...field} 
                        data-testid="input-price"
                      />
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
                    <FormLabel>Entfernung (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="280" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-distance"
                      />
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
                  <FormLabel>Besondere Hinweise</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Zusätzliche Informationen zum Auftrag..."
                      className="h-24"
                      {...field}
                      value={field.value || ""}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedDriverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fahrer zuweisen</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-driver">
                        <SelectValue placeholder="Kein Fahrer zugewiesen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none" data-testid="option-no-driver">
                        Kein Fahrer zugewiesen
                      </SelectItem>
                      {(activeDrivers || []).map((driver: User) => (
                        <SelectItem 
                          key={driver.id} 
                          value={driver.id}
                          data-testid={`option-driver-${driver.id}`}
                        >
                          {driver.firstName && driver.lastName 
                            ? `${driver.firstName} ${driver.lastName}` 
                            : driver.email || `Driver ${driver.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Status auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open" data-testid="option-status-open">
                        Offen
                      </SelectItem>
                      <SelectItem value="assigned" data-testid="option-status-assigned">
                        Zugewiesen
                      </SelectItem>
                      <SelectItem value="in_progress" data-testid="option-status-in-progress">
                        In Bearbeitung
                      </SelectItem>
                      <SelectItem value="completed" data-testid="option-status-completed">
                        Abgeschlossen
                      </SelectItem>
                      <SelectItem value="cancelled" data-testid="option-status-cancelled">
                        Storniert
                      </SelectItem>
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
                onClick={handleClose}
                data-testid="button-cancel"
              >
                Abbrechen
              </Button>
              <Button 
                type="submit" 
                className="bg-primary-500 hover:bg-primary-600 text-white"
                disabled={updateOrderMutation.isPending}
                data-testid="button-update"
              >
                {updateOrderMutation.isPending ? "Wird aktualisiert..." : "Auftrag aktualisieren"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}