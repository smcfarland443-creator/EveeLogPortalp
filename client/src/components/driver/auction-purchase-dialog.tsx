import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Auction } from "@shared/schema";

interface AuctionPurchaseDialogProps {
  auction: Auction | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuctionPurchaseDialog({ auction, isOpen, onClose }: AuctionPurchaseDialogProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { toast } = useToast();

  const purchaseAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      await apiRequest("POST", `/api/auctions/${auctionId}/purchase`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ 
        title: "Erfolgreich gekauft!", 
        description: "Der Auftrag wurde direkt zugewiesen. Sie finden ihn in Ihren Aufträgen." 
      });
      handleClose();
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
        title: "Fehler", 
        description: "Auktion konnte nicht gekauft werden", 
        variant: "destructive" 
      });
    },
  });

  const handlePurchase = () => {
    if (auction && agreedToTerms) {
      purchaseAuctionMutation.mutate(auction.id);
    }
  };

  const handleClose = () => {
    setAgreedToTerms(false);
    onClose();
  };

  if (!auction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Auktion sofort kaufen
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Auction Details */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-gray-900">
                  {auction.vehicleBrand} {auction.vehicleModel}
                </h4>
                <p className="text-sm text-gray-600">
                  {auction.vehicleYear && `Baujahr: ${auction.vehicleYear}`}
                </p>
              </div>
              <Badge variant="outline" className="bg-white">
                {auction.distance} km
              </Badge>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Von:</span>
                <span className="font-medium">{auction.pickupLocation}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Nach:</span>
                <span className="font-medium">{auction.deliveryLocation}</span>
              </div>
            </div>
            
            <Separator />
            
            {/* Time slots */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Abholung:</span>
                <span className="font-medium">
                  {new Date(auction.pickupDate).toLocaleDateString()} 
                  {auction.pickupTimeFrom && auction.pickupTimeTo && 
                    ` (${auction.pickupTimeFrom} - ${auction.pickupTimeTo})`
                  }
                </span>
              </div>
              {auction.deliveryDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Zustellung:</span>
                  <span className="font-medium">
                    {new Date(auction.deliveryDate).toLocaleDateString()}
                    {auction.deliveryTimeFrom && auction.deliveryTimeTo && 
                      ` (${auction.deliveryTimeFrom} - ${auction.deliveryTimeTo})`
                    }
                  </span>
                </div>
              )}
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">Sofortpreis:</span>
              <span className="text-2xl font-bold text-primary-600">€{auction.instantPrice}</span>
            </div>
          </div>

          {/* Warning Box */}
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-red-800 font-semibold mb-2">
                  Wichtiger Hinweis - Storno-Gebühr
                </h4>
                <p className="text-red-700 text-sm">
                  Wenn Sie diesen Auftrag nach dem Kauf stornieren, fällt eine 
                  <strong> Storno-Gebühr von 10% (€{(parseFloat(auction.instantPrice) * 0.1).toFixed(2)}) </strong>
                  des Auftragswertes an. Diese wird automatisch von Ihren Gutschriften abgezogen.
                </p>
              </div>
            </div>
          </div>

          {/* Agreement Checkbox */}
          <div className="flex items-start space-x-3">
            <Checkbox 
              id="agree-terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(!!checked)}
              data-testid="checkbox-agree-terms"
            />
            <label 
              htmlFor="agree-terms" 
              className="text-sm text-gray-700 cursor-pointer leading-relaxed"
              data-testid="label-agree-terms"
            >
              Ich habe die Storno-Bedingungen verstanden und stimme dem Sofortkauf zu. 
              Der Auftrag wird mir direkt zugewiesen und bei Stornierung wird eine 
              <strong> 10% Storno-Gebühr (€{(parseFloat(auction?.instantPrice || '0') * 0.1).toFixed(2)}) </strong>
              berechnet.
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="flex-1"
              data-testid="button-cancel-purchase"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handlePurchase}
              disabled={!agreedToTerms || purchaseAuctionMutation.isPending}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-confirm-purchase"
            >
              {purchaseAuctionMutation.isPending ? "Kaufe..." : "Sofort kaufen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}