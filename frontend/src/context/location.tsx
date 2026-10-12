import React, { createContext, useContext, useEffect, useState } from "react";
import * as Location from "expo-location";

import { storage } from "@/src/utils/storage";

export type DeliveryLocation = {
  label: string;
  sublabel: string;
  lat: number | null;
  lng: number | null;
  source: "gps" | "saved" | "none";
};

const DEFAULT_LOC: DeliveryLocation = {
  label: "Set location",
  sublabel: "Choose your delivery address",
  lat: null,
  lng: null,
  source: "none",
};

const LOC_KEY = "dashbite_location";

export type DetectResult = "granted" | "denied" | "blocked" | "error";

type LocationContextType = {
  location: DeliveryLocation;
  detecting: boolean;
  detect: () => Promise<DetectResult>;
  setLocation: (loc: DeliveryLocation) => void;
};

const LocationContext = createContext<LocationContextType>(null!);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<DeliveryLocation>(DEFAULT_LOC);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<DeliveryLocation | null>(LOC_KEY, null);
      if (saved && saved.label) setLocationState(saved);
    })();
  }, []);

  const setLocation = (loc: DeliveryLocation) => {
    setLocationState(loc);
    storage.setItem(LOC_KEY, loc);
  };

  const detect = async (): Promise<DetectResult> => {
    setDetecting(true);
    try {
      // Check before requesting (permission contract).
      const existing = await Location.getForegroundPermissionsAsync();
      let granted = existing.granted;
      if (!granted && existing.canAskAgain) {
        const req = await Location.requestForegroundPermissionsAsync();
        granted = req.granted;
        if (!granted) {
          setDetecting(false);
          return req.canAskAgain ? "denied" : "blocked";
        }
      } else if (!granted) {
        setDetecting(false);
        return "blocked";
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      let sublabel = "Current location";
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        const p = places[0];
        if (p) {
          sublabel = [p.name, p.street, p.city].filter(Boolean).join(", ") || sublabel;
        }
      } catch {
        // reverse geocode is best-effort
      }
      setLocation({ label: "Current Location", sublabel, lat: latitude, lng: longitude, source: "gps" });
      setDetecting(false);
      return "granted";
    } catch {
      setDetecting(false);
      return "error";
    }
  };

  return (
    <LocationContext.Provider value={{ location, detecting, detect, setLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocationContext = () => useContext(LocationContext);
