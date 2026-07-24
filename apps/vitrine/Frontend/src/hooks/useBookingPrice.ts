"use client";

import type { BookingPriceRequest, BookingPriceResponse } from "@coworkprysme/shared";
import { useEffect, useRef, useState } from "react";

import { fetchBookingPrice } from "@/lib/booking-price-api";

import { shouldPreservePriceOnPromoError } from "./booking-price-state";

const DEBOUNCE_MS = 400;

export function useBookingPrice(request: BookingPriceRequest | null) {
  const [price, setPrice] = useState<BookingPriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef<string>("");
  const lastSuccessfulPriceRef = useRef<BookingPriceResponse | null>(null);

  useEffect(() => {
    if (!request) {
      setPrice(null);
      setError(null);
      setLoading(false);
      requestKeyRef.current = "";
      lastSuccessfulPriceRef.current = null;
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
          lastSuccessfulPriceRef.current = response;
          setPrice(response);
        })
        .catch((fetchError: unknown) => {
          if (requestKeyRef.current !== requestKey) {
            return;
          }

          const message = fetchError instanceof Error ? fetchError.message : "Calcul impossible";

          if (shouldPreservePriceOnPromoError(request, message) && lastSuccessfulPriceRef.current) {
            setPrice(lastSuccessfulPriceRef.current);
          } else {
            setPrice(null);
          }

          setError(message);
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
