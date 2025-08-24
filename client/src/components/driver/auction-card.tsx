import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Auction } from "@shared/schema";

interface AuctionCardProps {
  auction: Auction;
  onPurchase: () => void;
  isPurchasing: boolean;
}

export function AuctionCard({ auction, onPurchase, isPurchasing }: AuctionCardProps) {
  return (
    <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-medium text-gray-900">
            {auction.pickupLocation} → {auction.deliveryLocation}
          </h4>
          <p className="text-sm text-gray-600">
            {auction.vehicleBrand} {auction.vehicleModel} • {auction.distance} km
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary-600">€{auction.instantPrice}</p>
          <p className="text-xs text-gray-600">Sofortpreis</p>
        </div>
      </div>
      
      <div className="text-sm text-gray-600 mb-4">
        Abholung: {new Date(auction.pickupDate).toLocaleDateString('de-DE')}
        {auction.deliveryDate && (
          <> • Lieferung: {new Date(auction.deliveryDate).toLocaleDateString('de-DE')}</>
        )}
      </div>
      
      <Button 
        className="w-full bg-primary-500 hover:bg-primary-600 text-white"
        onClick={onPurchase}
        disabled={isPurchasing}
        data-testid={`button-buy-auction-${auction.id}`}
      >
        {isPurchasing ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Kaufe...
          </div>
        ) : (
          <>
            <i className="fas fa-bolt mr-2"></i>Sofort kaufen
          </>
        )}
      </Button>
    </div>
  );
}
