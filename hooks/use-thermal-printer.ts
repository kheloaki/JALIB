"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { buildClientReceiptEscPos } from "@/lib/print/build-client-receipt-escpos";
import type { ThermalReceiptSettings } from "@/lib/print/build-client-receipt-escpos";
import type { Invoice } from "@/lib/invoices/types";
import {
  disconnectThermalPrinter,
  getThermalPrinterServerSnapshot,
  getThermalPrinterStatus,
  isThermalPrinterActive,
  printRawEscPos,
  requestThermalPrinter,
  restoreThermalPrinter,
  subscribeThermalPrinter,
  type ThermalTransport,
} from "@/lib/print/thermal-printer";

function subscribe(listener: () => void) {
  return subscribeThermalPrinter(listener);
}

export function useThermalPrinter() {
  const status = useSyncExternalStore(
    subscribe,
    getThermalPrinterStatus,
    getThermalPrinterServerSnapshot,
  );
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void restoreThermalPrinter().finally(() => {
      if (!cancelled) setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async (preferred: ThermalTransport = "usb") => {
    return requestThermalPrinter(preferred);
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectThermalPrinter();
  }, []);

  const printClientReceipt = useCallback(
    async (invoice: Invoice, settings: ThermalReceiptSettings) => {
      if (!isThermalPrinterActive()) {
        throw new Error("Imprimante thermique inactive.");
      }
      const payload = await buildClientReceiptEscPos(invoice, settings);
      await printRawEscPos(payload);
    },
    [],
  );

  return {
    ...status,
    restoring,
    connect,
    disconnect,
    printClientReceipt,
    isActive: status.connected,
  };
}
