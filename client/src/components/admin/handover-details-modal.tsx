import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, MapPin, Camera, FileText, User, Car } from "lucide-react";
import type { Order, VehicleHandover } from "@shared/schema";

interface HandoverDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export function HandoverDetailsModal({ isOpen, onClose, order }: HandoverDetailsModalProps) {
  const { data: handovers = [], isLoading } = useQuery<VehicleHandover[]>({
    queryKey: ["/api/admin/orders", order?.id, "handovers"],
    enabled: !!order?.id && isOpen,
  });

  if (!order) return null;

  const pickupHandover = handovers.find(h => h.handoverType === 'pickup');
  const deliveryHandover = handovers.find(h => h.handoverType === 'delivery');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Übergabeprotokolle - Auftrag #{order.id.slice(-8)}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {order.pickupLocation} → {order.deliveryLocation}
            </span>
            <span>{order.vehicleBrand} {order.vehicleModel}</span>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : handovers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Keine Übergabeprotokolle vorhanden</p>
          </div>
        ) : (
          <Tabs defaultValue="pickup" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pickup" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Abholung {pickupHandover ? "✓" : ""}
              </TabsTrigger>
              <TabsTrigger value="delivery" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Lieferung {deliveryHandover ? "✓" : ""}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="pickup">
              {pickupHandover ? (
                <HandoverCard handover={pickupHandover} type="Abholung" />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p>Abholung noch nicht erfolgt</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="delivery">
              {deliveryHandover ? (
                <HandoverCard handover={deliveryHandover} type="Lieferung" />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8 text-gray-500">
                      <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p>Lieferung noch nicht erfolgt</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HandoverCard({ handover, type }: { handover: VehicleHandover; type: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="outline">{type}</Badge>
          <span className="text-lg">{new Date(handover.handoverDateTime).toLocaleDateString('de-DE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fahrzeugdaten */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Car className="w-4 h-4" />
              Fahrzeugdaten
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">KM-Stand:</span>
                <span className="font-medium">{handover.kmReading?.toLocaleString() || 'Nicht erfasst'} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tankstand:</span>
                <span className="font-medium">{handover.fuelLevel || 'Nicht erfasst'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Standort:</span>
                <span className="font-medium">{handover.location || 'Nicht erfasst'}</span>
              </div>
            </div>
          </div>

          {/* Fahrerdaten */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Fahrer
            </h4>
            <div className="text-sm">
              <p className="font-medium">ID: {handover.driverId}</p>
            </div>
          </div>
        </div>

        {/* Zustand & Schäden */}
        {(handover.vehicleCondition || handover.damageNotes) && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Fahrzeugzustand
            </h4>
            {handover.vehicleCondition && (
              <div className="mb-3">
                <span className="text-gray-600 text-sm">Allgemeiner Zustand:</span>
                <p className="text-sm mt-1 p-3 bg-gray-50 rounded-lg">{handover.vehicleCondition}</p>
              </div>
            )}
            {handover.damageNotes && (
              <div>
                <span className="text-gray-600 text-sm">Schäden/Besonderheiten:</span>
                <p className="text-sm mt-1 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">{handover.damageNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Fotos */}
        {handover.photos && handover.photos.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Dokumentation ({handover.photos.length} Foto{handover.photos.length !== 1 ? 's' : ''})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {handover.photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img
                    src={photo}
                    alt={`${type} Foto ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unterschrift */}
        {handover.signature && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Unterschrift</h4>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <img 
                src={handover.signature} 
                alt="Unterschrift" 
                className="max-h-24 mx-auto"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}