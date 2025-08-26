import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Car } from "lucide-react";
import type { Auction } from "@shared/schema";

interface AuctionCardProps {
  auction: Auction;
  onPurchase: () => void;
  isPurchasing: boolean;
}

export function AuctionCard({ auction, onPurchase, isPurchasing }: AuctionCardProps) {
  return (
    <div className="border border-primary-200 rounded-lg p-6 bg-primary-50 hover:shadow-md transition-shadow">
      {/* Header with Order Number and Price */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              Auftrag #{auction.id.slice(-8)}
            </Badge>
          </div>
          <h4 className="font-semibold text-gray-900 flex items-center gap-1">
            <MapPin className="w-4 h-4 text-gray-500" />
            {auction.pickupLocation} → {auction.deliveryLocation}
          </h4>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-primary-600">€{auction.instantPrice}</p>
          <p className="text-xs text-gray-600">Sofortpreis</p>
        </div>
      </div>

      {/* Vehicle Details */}
      <div className="flex items-center gap-1 mb-3">
        <Car className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900">
          {auction.vehicleBrand} {auction.vehicleModel}
        </span>
        {auction.vehicleYear && (
          <span className="text-sm text-gray-600">({auction.vehicleYear})</span>
        )}
        <span className="text-sm text-gray-600 ml-2">• {auction.distance} km</span>
      </div>

      {/* Pickup Details with Times */}
      <div className="bg-white rounded-lg p-3 mb-4">
        <div className="flex items-center gap-1 mb-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900">Abholzeiten</span>
        </div>
        <div className="text-sm text-gray-700">
          <p><strong>Datum:</strong> {new Date(auction.pickupDate).toLocaleDateString('de-DE')}</p>
          <p><strong>Zeitfenster:</strong> {auction.pickupTimeFrom} - {auction.pickupTimeTo} Uhr</p>
        </div>
      </div>

      {/* Delivery Details with Times (if provided) */}
      {auction.deliveryDate && (
        <div className="bg-white rounded-lg p-3 mb-4">
          <div className="flex items-center gap-1 mb-2">
            <Clock className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-gray-900">Lieferzeiten</span>
          </div>
          <div className="text-sm text-gray-700">
            <p><strong>Datum:</strong> {new Date(auction.deliveryDate).toLocaleDateString('de-DE')}</p>
            {auction.deliveryTimeFrom && auction.deliveryTimeTo && (
              <p><strong>Zeitfenster:</strong> {auction.deliveryTimeFrom} - {auction.deliveryTimeTo} Uhr</p>
            )}
          </div>
        </div>
      )}

      {/* Notes (if provided) */}
      {auction.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-700"><strong>Hinweise:</strong></p>
          <p className="text-sm text-gray-700">{auction.notes}</p>
        </div>
      )}
      
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
