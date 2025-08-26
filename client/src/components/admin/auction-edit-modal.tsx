import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { insertAuctionSchema, type Auction } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

const auctionEditSchema = insertAuctionSchema.extend({
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().optional(),
  vehicleYear: z.number().optional(),
}).omit({ createdById: true });

type AuctionEditData = z.infer<typeof auctionEditSchema>;

interface AuctionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auction: Auction | null;
}

export function AuctionEditModal({ isOpen, onClose, auction }: AuctionEditModalProps) {
  const { toast } = useToast();
  
  const form = useForm<AuctionEditData>({
    resolver: zodResolver(auctionEditSchema),
    defaultValues: {
      pickupLocation: "",
      deliveryLocation: "",
      vehicleBrand: "",
      vehicleModel: "",
      vehicleYear: undefined,
      pickupDate: "",
      deliveryDate: "",
      pickupTimeFrom: "08:00",
      pickupTimeTo: "14:00",
      deliveryTimeFrom: "08:00",
      deliveryTimeTo: "18:00",
      instantPrice: "",
      distance: undefined,
      notes: "",
      status: "active",
    },
  });

  // Update form when auction changes
  useEffect(() => {
    if (auction) {
      const formatDate = (date: Date | string | null) => {
        if (!date) return "";
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toISOString().split('T')[0];
      };

      form.reset({
        pickupLocation: auction.pickupLocation || "",
        deliveryLocation: auction.deliveryLocation || "",
        vehicleBrand: auction.vehicleBrand || "",
        vehicleModel: auction.vehicleModel || "",
        vehicleYear: auction.vehicleYear || undefined,
        pickupDate: formatDate(auction.pickupDate),
        deliveryDate: auction.deliveryDate ? formatDate(auction.deliveryDate) : "",
        pickupTimeFrom: auction.pickupTimeFrom || "08:00",
        pickupTimeTo: auction.pickupTimeTo || "14:00",
        deliveryTimeFrom: auction.deliveryTimeFrom || "08:00",
        deliveryTimeTo: auction.deliveryTimeTo || "18:00",
        instantPrice: auction.instantPrice?.toString() || "",
        distance: auction.distance || undefined,
        notes: auction.notes || "",
        status: auction.status,
      });
    }
  }, [auction, form]);

  const updateAuctionMutation = useMutation({
    mutationFn: async (data: AuctionEditData) => {
      if (!auction) throw new Error("No auction to update");
      
      const auctionData = {
        ...data,
        pickupDate: new Date(data.pickupDate),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        instantPrice: data.instantPrice.toString(),
      };
      
      await apiRequest("PUT", `/api/auctions/${auction.id}`, auctionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
      toast({ title: "Erfolg", description: "Auktion wurde erfolgreich aktualisiert" });
      onClose();
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
      toast({ 
        title: "Fehler", 
        description: "Fehler beim Aktualisieren der Auktion", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: AuctionEditData) => {
    updateAuctionMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auktion bearbeiten</DialogTitle>
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
                        data-testid="input-edit-pickup-location"
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
                        placeholder="Augsburg" 
                        {...field} 
                        data-testid="input-edit-delivery-location"
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
                        placeholder="Mercedes" 
                        {...field} 
                        data-testid="input-edit-vehicle-brand"
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
                        placeholder="A-Klasse" 
                        {...field} 
                        data-testid="input-edit-vehicle-model"
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
                name="vehicleYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Baujahr</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="2024" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-edit-vehicle-year"
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
                        placeholder="150" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-edit-distance"
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
                        data-testid="input-edit-pickup-date"
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
                        data-testid="input-edit-delivery-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Abholzeit</h4>
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="pickupTimeFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Von</FormLabel>
                        <FormControl>
                          <Input 
                            type="time" 
                            {...field} 
                            data-testid="input-edit-pickup-time-from"
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
                        <FormLabel className="text-xs">Bis</FormLabel>
                        <FormControl>
                          <Input 
                            type="time" 
                            {...field} 
                            data-testid="input-edit-pickup-time-to"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Lieferzeit</h4>
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="deliveryTimeFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Von</FormLabel>
                        <FormControl>
                          <Input 
                            type="time" 
                            {...field} 
                            data-testid="input-edit-delivery-time-from"
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
                        <FormLabel className="text-xs">Bis</FormLabel>
                        <FormControl>
                          <Input 
                            type="time" 
                            {...field} 
                            data-testid="input-edit-delivery-time-to"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="instantPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sofortkaufpreis (€)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="250.00" 
                      {...field} 
                      data-testid="input-edit-instant-price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Zusätzliche Informationen..." 
                      {...field}
                      value={field.value || ""}
                      data-testid="textarea-edit-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                data-testid="button-cancel-edit"
              >
                Abbrechen
              </Button>
              <Button 
                type="submit" 
                disabled={updateAuctionMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateAuctionMutation.isPending ? "Speichern..." : "Speichern"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}