"use client";

import type { BookingPriceRequest, BookingPriceResponse } from "@coworkprysme/shared";
import { useEffect, useRef, useState } from "react";

import { fetchBookingPrice } from "@/lib/booking-price-api";

const DEBOUNCE_MS = 400;

export function useBookingPrice(request: BookingPriceRequest | null) {
  const [price, setPrice] = useState<BookingPriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef<string>("");

  useEffect(() => {
    if (!request) {
      setPrice(null);
      setError(null);
      setLoading(false);
      requestKeyRef.current = "";
      return;
    }

    const requestKey = JSON.stringify(request);
    requestKeyRef.current = requestKey;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void fetchBookingPrice(request)
        .then((response) => {
          if (requestKeyRef.current !== requestKey) {
            return;
          }
          setPrice(response);
        })
        .catch((fetchError: unknown) => {
          if (requestKeyRef.current !== requestKey) {
            return;
          }
          setPrice(null);
          setError(fetchError instanceof Error ? fetchError.message : "Calcul impossible");
        })
        .finally(() => {
          if (requestKeyRef.current === requestKey) {
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [request]);

  return { price, loading, error };
}
