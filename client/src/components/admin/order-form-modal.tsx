import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { MapPin, Calculator, Clock } from "lucide-react";
import { z } from "zod";

const orderFormSchema = insertOrderSchema.extend({
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().optional(),
  vehicleYear: z.number().optional(),
}).omit({ createdById: true });

type OrderFormData = z.infer<typeof orderFormSchema>;

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrderFormModal({ isOpen, onClose }: OrderFormModalProps) {
  const { toast } = useToast();
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [autoCalculatedDistance, setAutoCalculatedDistance] = useState<number | null>(null);
  
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
      price: "",
      distance: undefined,
      notes: "",
      status: "open",
      assignedDriverId: undefined,
    },
  });
  
  // Auto-calculate distance when locations change
  const calculateDistanceMutation = useMutation({
    mutationFn: async ({ origin, destination }: { origin: string; destination: string }) => {
      return await apiRequest("POST", "/api/calculate-distance", { origin, destination });
    },
    onSuccess: (result: any) => {
      if (result.status === 'OK' && result.distance > 0) {
        setAutoCalculatedDistance(result.distance);
        form.setValue('distance', result.distance);
        toast({
          title: "Entfernung berechnet",
          description: `Automatisch berechnete Entfernung: ${result.distance} km`,
        });
      } else {
        toast({
          title: "Warnung",
          description: "Entfernung konnte nicht automatisch berechnet werden",
          variant: "destructive",
        });
      }
      setIsCalculatingDistance(false);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Entfernung konnte nicht berechnet werden",
        variant: "destructive",
      });
      setIsCalculatingDistance(false);
    },
  });
  
  // Auto-calculate distance when both locations are filled
  useEffect(() => {
    const pickup = form.watch('pickupLocation');
    const delivery = form.watch('deliveryLocation');
    
    if (pickup && delivery && pickup.trim() && delivery.trim() && pickup !== delivery) {
      const timer = setTimeout(() => {
        setIsCalculatingDistance(true);
        calculateDistanceMutation.mutate({ origin: pickup, destination: delivery });
      }, 1000); // Debounce for 1 second
      
      return () => clearTimeout(timer);
    }
  }, [form.watch('pickupLocation'), form.watch('deliveryLocation')]);
  
  const manuallyCalculateDistance = () => {
    const pickup = form.getValues('pickupLocation');
    const delivery = form.getValues('deliveryLocation');
    
    if (!pickup || !delivery) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie zuerst Abhol- und Lieferort ein",
        variant: "destructive",
      });
      return;
    }
    
    setIsCalculatingDistance(true);
    calculateDistanceMutation.mutate({ origin: pickup, destination: delivery });
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const orderData = {
        ...data,
        pickupDate: new Date(data.pickupDate),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        price: data.price.toString(),
      };
      
      await apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order created successfully" });
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Entfernung (km)
                      {autoCalculatedDistance && (
                        <Badge variant="secondary" className="text-xs">
                          Auto-berechnet
                        </Badge>
                      )}
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="280" 
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            field.onChange(value);
                            if (value) setAutoCalculatedDistance(null); // Mark as manually entered
                          }}
                          data-testid="input-distance"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={manuallyCalculateDistance}
                        disabled={isCalculatingDistance}
                        className="flex-shrink-0"
                        data-testid="button-calculate-distance"
                      >
                        {isCalculatingDistance ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        ) : (
                          <Calculator className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Entfernung wird automatisch berechnet oder kann manuell eingegeben werden
                    </div>
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
