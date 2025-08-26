import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Car, Clock } from "lucide-react";
import { z } from "zod";
import type { Order } from "@shared/schema";

const handoverFormSchema = z.object({
  kmReading: z.number().min(0, "KM-Stand muss positiv sein"),
  fuelLevel: z.string().min(1, "Tankstand ist erforderlich"),
  location: z.string(), // Removed .min(1) since it's auto-filled
  vehicleCondition: z.string().optional(),
  damageNotes: z.string().optional(),
});

type HandoverFormData = z.infer<typeof handoverFormSchema>;

interface HandoverFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  mode: 'pickup' | 'delivery';
}

export function HandoverFormModal({ isOpen, onClose, order, mode }: HandoverFormModalProps) {
  const { toast } = useToast();
  
  const form = useForm<HandoverFormData>({
    resolver: zodResolver(handoverFormSchema),
    defaultValues: {
      kmReading: 0,
      fuelLevel: "",
      location: "",
      vehicleCondition: "",
      damageNotes: "",
    },
  });

  // Auto-fill location when component opens or mode/order changes
  React.useEffect(() => {
    if (order && isOpen) {
      const autoLocation = mode === 'pickup' ? order.pickupLocation : order.deliveryLocation;
      form.setValue('location', autoLocation);
    }
  }, [order, mode, isOpen, form]);

  const submitHandoverMutation = useMutation({
    mutationFn: async (data: HandoverFormData) => {
      if (!order) throw new Error("Kein Auftrag ausgewählt");
      
      const handoverData = {
        ...data,
        handoverType: mode,
        handoverDateTime: new Date().toISOString(),
      };
      
      // Erstelle Handover-Protokoll
      await apiRequest("POST", `/api/orders/${order.id}/handovers`, handoverData);
      
      // Update Order Status
      if (mode === 'pickup') {
        await apiRequest("PATCH", `/api/orders/${order.id}/status`, { status: 'in_progress' });
      } else if (mode === 'delivery') {
        await apiRequest("PATCH", `/api/orders/${order.id}/status`, { status: 'delivered' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      const message = mode === 'pickup' 
        ? "Abholung erfolgreich protokolliert" 
        : "Abgabe erfolgreich protokolliert";
      toast({ title: "Erfolg", description: message });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({ 
        title: "Fehler", 
        description: "Fehler beim Speichern des Protokolls", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: HandoverFormData) => {
    submitHandoverMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  if (!order) return null;

  const isPickup = mode === 'pickup';
  const title = isPickup ? "Fahrzeug übernehmen" : "Fahrzeug abgeben";
  const locationLabel = isPickup ? "Übernahmeort (aktueller Standort)" : "Abgabeort";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            {title}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {order.pickupLocation} → {order.deliveryLocation}
            </span>
            <span>{order.vehicleBrand} {order.vehicleModel}</span>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Fahrzeugdaten */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="kmReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KM-Stand</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="145000" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                        data-testid="input-km-reading"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="fuelLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tankstand</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-fuel-level">
                          <SelectValue placeholder="Tankstand wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Leer (0-10%)">Leer (0-10%)</SelectItem>
                        <SelectItem value="1/4 Tank (10-25%)">1/4 Tank (10-25%)</SelectItem>
                        <SelectItem value="1/2 Tank (25-50%)">1/2 Tank (25-50%)</SelectItem>
                        <SelectItem value="3/4 Tank (50-75%)">3/4 Tank (50-75%)</SelectItem>
                        <SelectItem value="Voll (75-100%)">Voll (75-100%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{locationLabel}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Wird automatisch ausgefüllt" 
                      {...field}
                      readOnly
                      className="bg-gray-50" 
                      data-testid="input-location"
                    />
                  </FormControl>
                  <p className="text-sm text-gray-600">Der Ort wird automatisch aus dem Auftrag übernommen</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehicleCondition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fahrzeugzustand (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Allgemeiner Zustand des Fahrzeugs..." 
                      {...field} 
                      data-testid="textarea-vehicle-condition"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="damageNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schäden/Besonderheiten (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Beschreibung von Schäden oder besonderen Merkmalen..." 
                      {...field} 
                      data-testid="textarea-damage-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
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
                disabled={submitHandoverMutation.isPending}
                data-testid="button-submit-handover"
              >
                {submitHandoverMutation.isPending ? "Speichert..." : "Protokoll speichern"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}