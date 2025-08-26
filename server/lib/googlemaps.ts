import { Client } from '@googlemaps/google-maps-services-js';

// Initialize Google Maps client
const googleMapsClient = new Client({});

export interface DistanceMatrixResult {
  distance: number; // in kilometers
  duration: number; // in minutes
  status: 'OK' | 'ZERO_RESULTS' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'INVALID_REQUEST' | 'UNKNOWN_ERROR';
}

/**
 * Calculate distance and duration between two addresses using Google Maps Distance Matrix API
 */
export async function calculateDistance(
  origin: string,
  destination: string
): Promise<DistanceMatrixResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  try {
    const response = await googleMapsClient.distancematrix({
      params: {
        origins: [origin],
        destinations: [destination],
        units: "metric" as const,
        key: apiKey,
      },
    });

    const element = response.data.rows[0]?.elements[0];
    
    if (!element || element.status !== 'OK') {
      return {
        distance: 0,
        duration: 0,
        status: element?.status as any || 'UNKNOWN_ERROR'
      };
    }

    // Convert meters to kilometers
    const distanceKm = Math.round(element.distance.value / 1000);
    // Convert seconds to minutes
    const durationMinutes = Math.round(element.duration.value / 60);

    return {
      distance: distanceKm,
      duration: durationMinutes,
      status: 'OK'
    };
  } catch (error) {
    console.error('Google Maps API error:', error);
    return {
      distance: 0,
      duration: 0,
      status: 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Get coordinates for an address using Google Maps Geocoding API
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  try {
    const response = await googleMapsClient.geocode({
      params: {
        address,
        key: apiKey,
      },
    });

    const result = response.data.results[0];
    if (!result) {
      return null;
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}