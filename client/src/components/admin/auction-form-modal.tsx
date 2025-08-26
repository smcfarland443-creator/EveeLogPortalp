import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { insertAuctionSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

const auctionFormSchema = insertAuctionSchema.extend({
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().optional(),
  vehicleYear: z.number().optional(),
}).omit({ createdById: true });

type AuctionFormData = z.infer<typeof auctionFormSchema>;

interface AuctionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuctionFormModal({ isOpen, onClose }: AuctionFormModalProps) {
  const { toast } = useToast();
  
  const form = useForm<AuctionFormData>({
    resolver: zodResolver(auctionFormSchema),
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

  const createAuctionMutation = useMutation({
    mutationFn: async (data: AuctionFormData) => {
      const auctionData = {
        ...data,
        pickupDate: new Date(data.pickupDate),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        instantPrice: data.instantPrice.toString(),
      };
      
      await apiRequest("POST", "/api/auctions", auctionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
      toast({ title: "Success", description: "Auction created successfully" });
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
        description: "Failed to create auction", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: AuctionFormData) => {
    createAuctionMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Auktion erstellen</DialogTitle>
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
                        placeholder="Augsburg" 
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
                        placeholder="Mercedes" 
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
                        placeholder="A-Klasse" 
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
                        placeholder="2021" 
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
                name="instantPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sofortpreis (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="50" 
                        {...field} 
                        data-testid="input-instant-price"
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
                      placeholder="Zusätzliche Informationen zur Auktion..."
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
                disabled={createAuctionMutation.isPending}
                data-testid="button-submit"
              >
                {createAuctionMutation.isPending ? "Erstelle..." : "Auktion erstellen"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
