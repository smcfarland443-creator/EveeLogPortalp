import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Camera, Car, Clock, MapPin, AlertTriangle, CheckCircle, X, Upload } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";

const handoverSchema = z.object({
  pickupKm: z.string().min(1, "KM-Stand bei Abholung ist erforderlich"),
  deliveryKm: z.string().optional(),
  damageNotes: z.string().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor'], {
    required_error: "Fahrzeugzustand ist erforderlich",
  }),
  pickupNotes: z.string().optional(),
  deliveryNotes: z.string().optional(),
  photos: z.array(z.instanceof(File)).optional(),
});

type HandoverFormData = z.infer<typeof handoverSchema>;

interface VehicleHandoverDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  mode: 'pickup' | 'delivery';
}

export function VehicleHandoverDialog({ isOpen, onClose, order, mode }: VehicleHandoverDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<HandoverFormData>({
    resolver: zodResolver(handoverSchema),
    defaultValues: {
      pickupKm: "",
      deliveryKm: "",
      damageNotes: "",
      condition: "good",
      pickupNotes: "",
      deliveryNotes: "",
    },
  });

  const handoverMutation = useMutation({
    mutationFn: async (data: HandoverFormData & { photos?: File[] }) => {
      // For now, we'll submit without photos until we implement file upload endpoint
      const { photos: _, ...submitData } = data;
      return await apiRequest("POST", `/api/orders/${order?.id}/handover`, {
        ...submitData,
        type: mode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${order?.id}`] });
      onClose();
      form.reset();
      toast({
        title: "Erfolgreich",
        description: `${mode === 'pickup' ? 'Abholung' : 'Auslieferung'} dokumentiert`,
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Speichern der ${mode === 'pickup' ? 'Abholung' : 'Auslieferung'}`,
        variant: "destructive",
      });
    },
  });

  // Photo handling functions
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Limit to max 6 photos
    const currentPhotoCount = photos.length;
    const maxNewPhotos = Math.max(0, 6 - currentPhotoCount);
    const newFiles = files.slice(0, maxNewPhotos);

    if (files.length > maxNewPhotos) {
      toast({
        title: "Maximale Anzahl erreicht",
        description: "Sie können maximal 6 Fotos hochladen.",
        variant: "destructive",
      });
    }

    // Create preview URLs
    const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
    
    setPhotos(prev => [...prev, ...newFiles]);
    setPhotoPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    
    // Reset input value
    if (event.target) {
      event.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    // Revoke the URL to prevent memory leaks
    URL.revokeObjectURL(photoPreviewUrls[index]);
    
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: HandoverFormData) => {
    handoverMutation.mutate({ ...data, photos });
  };

  // Cleanup URLs when component unmounts
  React.useEffect(() => {
    return () => {
      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const conditionLabels = {
    excellent: { label: "Ausgezeichnet", color: "bg-green-100 text-green-800" },
    good: { label: "Gut", color: "bg-blue-100 text-blue-800" },
    fair: { label: "Zufriedenstellend", color: "bg-yellow-100 text-yellow-800" },
    poor: { label: "Schlecht", color: "bg-red-100 text-red-800" },
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-vehicle-handover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            {mode === 'pickup' ? 'Fahrzeugabholung' : 'Fahrzeugauslieferung'} dokumentieren
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Auftragsinformationen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 block">Fahrzeug:</span>
                  <span className="font-medium">{order.vehicleBrand} {order.vehicleModel}</span>
                </div>
                <div>
                  <span className="text-gray-600 block">Fahrzeugtyp:</span>
                  <span className="font-medium">{order.vehicleYear || 'Nicht angegeben'}</span>
                </div>
                <div>
                  <span className="text-gray-600 block">
                    {mode === 'pickup' ? 'Abholort:' : 'Lieferort:'}
                  </span>
                  <span className="font-medium">
                    {mode === 'pickup' ? order.pickupLocation : order.deliveryLocation}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 block">Datum/Zeit:</span>
                  <span className="font-medium">
                    {new Date().toLocaleString('de-DE')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Vehicle Condition and Mileage */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Fahrzeugzustand und KM-Stand</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={mode === 'pickup' ? 'pickupKm' : 'deliveryKm'}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            KM-Stand bei {mode === 'pickup' ? 'Abholung' : 'Auslieferung'}
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              placeholder="z.B. 85420"
                              data-testid={`input-${mode}-km`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fahrzeugzustand</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              data-testid="select-condition"
                            >
                              <option value="">Fahrzeugzustand auswählen</option>
                              {Object.entries(conditionLabels).map(([value, config]) => (
                                <option key={value} value={value}>
                                  {config.label}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="damageNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schäden und Besonderheiten</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Beschreiben Sie sichtbare Schäden, Kratzer, oder andere Besonderheiten am Fahrzeug..."
                            rows={3}
                            data-testid="textarea-damage-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Additional Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Zusätzliche Informationen</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name={mode === 'pickup' ? 'pickupNotes' : 'deliveryNotes'}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Notizen zur {mode === 'pickup' ? 'Abholung' : 'Auslieferung'}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={`Besondere Umstände bei der ${mode === 'pickup' ? 'Abholung' : 'Auslieferung'}, Anweisungen des Kunden, etc.`}
                            rows={2}
                            data-testid={`textarea-${mode}-notes`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Photo Documentation */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Fotodokumentation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Upload Button */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                        data-testid="input-photo-upload"
                      />
                      <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">
                        Fotografieren Sie das Fahrzeug von mehreren Seiten
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2"
                        data-testid="button-upload-photos"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Fotos hinzufügen
                      </Button>
                    </div>
                    
                    {/* Photo Previews */}
                    {photoPreviewUrls.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {photoPreviewUrls.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Foto ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-remove-photo-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Warning for Important Documentation */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Wichtiger Hinweis</h4>
                    <p className="text-sm text-amber-700">
                      Bitte dokumentieren Sie den Fahrzeugzustand sorgfältig. Diese Informationen sind 
                      wichtig für die Abrechnung und eventuelle Schadensmeldungen.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="button-cancel-handover"
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={handoverMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-submit-handover"
                >
                  {handoverMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Speichere...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {mode === 'pickup' ? 'Abholung' : 'Auslieferung'} bestätigen
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}