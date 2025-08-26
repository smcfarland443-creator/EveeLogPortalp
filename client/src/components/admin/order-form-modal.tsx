import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { insertOrderSchema, type User } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";

const orderFormSchema = insertOrderSchema.extend({
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().optional(),
  vehicleYear: z.number().optional(),
  pickupTimeFrom: z.string().optional(),
  pickupTimeTo: z.string().optional(),
  deliveryTimeFrom: z.string().optional(),
  deliveryTimeTo: z.string().optional(),
  vehicleCount: z.number().min(1, "Mindestens 1 Fahrzeug erforderlich").max(50, "Maximal 50 Fahrzeuge pro Auftrag").optional(),
}).omit({ createdById: true });

type OrderFormData = z.infer<typeof orderFormSchema>;

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrderFormModal({ isOpen, onClose }: OrderFormModalProps) {
  const { toast } = useToast();
  
  // Fetch active drivers for assignment
  const { data: activeDrivers = [] } = useQuery<User[]>({
    queryKey: ["/api/drivers/active"],
    enabled: isOpen,
    retry: false,
  });
  
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      pickupLocation: "",
      deliveryLocation: "",
      vehicleBrand: "",
      vehicleModel: "",
      vehicleYear: undefined,
      pickupDate: "",
      deliveryDate: "",
      pickupTimeFrom: "",
      pickupTimeTo: "",
      deliveryTimeFrom: "",
      deliveryTimeTo: "",
      vehicleCount: 1,
      price: "",
      distance: undefined,
      notes: "",
      status: "open",
      assignedDriverId: undefined,
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const orderData = {
        ...data,
        pickupDate: new Date(data.pickupDate),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        price: data.price.toString(),
      };
      
      const vehicleCount = data.vehicleCount || 1;
      
      // Erstelle mehrere Aufträge wenn Anzahl > 1
      const promises = [];
      for (let i = 0; i < vehicleCount; i++) {
        promises.push(apiRequest("POST", "/api/orders", orderData));
      }
      
      await Promise.all(promises);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      const count = variables.vehicleCount || 1;
      const message = count === 1 
        ? "Auftrag erfolgreich erstellt" 
        : `${count} Aufträge erfolgreich erstellt`;
      toast({ title: "Erfolg", description: message });
      onClose();
      form.reset();
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
        description: "Failed to create order", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: OrderFormData) => {
    createOrderMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuen Auftrag erstellen</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="pickupLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abholort</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Stuttgart" 
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
                        placeholder="München" 
                        {...field} 
                        data-testid="input-delivery-location"
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
                    <FormLabel>Modell</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="320d" 
                        {...field} 
                        data-testid="input-vehicle-model"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <FormField
                control={form.control}
                name="vehicleYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Baujahr</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="2020" 
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
              
              <FormField
                control={form.control}
                name="vehicleCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anzahl Fahrzeuge</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        max="50"
                        placeholder="1" 
                        {...field}
                        value={field.value || 1}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 1)}
                        data-testid="input-vehicle-count"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pickupDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abholtermin</FormLabel>
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
                    <FormLabel>Liefertermin</FormLabel>
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

            {/* Zeit-Felder für Abholung */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="pickupTimeFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abholzeit von</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field}
                        value={field.value || ""}
                        data-testid="input-pickup-time-from"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pickupTimeTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abholzeit bis</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field}
                        value={field.value || ""}
                        data-testid="input-pickup-time-to"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Zeit-Felder für Lieferung */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="deliveryTimeFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lieferzeit von</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field}
                        value={field.value || ""}
                        data-testid="input-delivery-time-from"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="deliveryTimeTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lieferzeit bis</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field}
                        value={field.value || ""}
                        data-testid="input-delivery-time-to"
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
                  <FormLabel>Fahrer zuweisen (optional)</FormLabel>
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
                disabled={createOrderMutation.isPending}
                data-testid="button-submit"
              >
                {createOrderMutation.isPending ? "Erstelle..." : "Auftrag erstellen"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
