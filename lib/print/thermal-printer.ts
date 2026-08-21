import { THERMAL_PRINTER_PROFILE } from "@/lib/print/thermal-printer-profile";

/**
 * Direct thermal printing via WebUSB or Web Serial (ESC/POS).
 * Default profile: WDLink WD8260 (80mm / 576 dots).
 */

const STORAGE_KEY = "matjar:thermal-printer:v1";
const USB_CHUNK = THERMAL_PRINTER_PROFILE.usbChunkBytes;
const SERIAL_BAUD = THERMAL_PRINTER_PROFILE.serialBaudRate;

export type ThermalTransport = "usb" | "serial";

export type ThermalPrinterStatus = {
  supported: boolean;
  connected: boolean;
  transport: ThermalTransport | null;
  label: string | null;
  lastError: string | null;
};

type StoredPreference = {
  transport: ThermalTransport;
};

type UsbEndpoint = {
  endpointNumber: number;
  direction: "in" | "out";
};

type UsbAlternate = {
  alternateSetting: number;
  endpoints: UsbEndpoint[];
};

type UsbInterface = {
  interfaceNumber: number;
  claimed: boolean;
  alternates: UsbAlternate[];
};

type UsbDeviceLike = {
  opened: boolean;
  configuration: { interfaces: UsbInterface[] } | null;
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (value: number) => Promise<void>;
  claimInterface: (interfaceNumber: number) => Promise<void>;
  selectAlternateInterface: (
    interfaceNumber: number,
    alternateSetting: number,
  ) => Promise<void>;
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<unknown>;
};

type SerialPortLike = {
  writable: WritableStream<Uint8Array> | null;
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
};

type UsbApi = {
  getDevices: () => Promise<UsbDeviceLike[]>;
  requestDevice: (options?: {
    filters: Array<Record<string, unknown>>;
  }) => Promise<UsbDeviceLike>;
};

type SerialApi = {
  getPorts: () => Promise<SerialPortLike[]>;
  requestPort: () => Promise<SerialPortLike>;
};

function getUsbApi(): UsbApi | null {
  if (typeof navigator === "undefined") return null;
  const usb = (navigator as Navigator & { usb?: UsbApi }).usb;
  return usb ?? null;
}

function getSerialApi(): SerialApi | null {
  if (typeof navigator === "undefined") return null;
  const serial = (navigator as Navigator & { serial?: SerialApi }).serial;
  return serial ?? null;
}

let usbDevice: UsbDeviceLike | null = null;
let usbEndpointNumber: number | null = null;
let serialPort: SerialPortLike | null = null;
let serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
let activeTransport: ThermalTransport | null = null;
let deviceLabel: string | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();

const SERVER_SNAPSHOT: ThermalPrinterStatus = {
  supported: false,
  connected: false,
  transport: null,
  label: null,
  lastError: null,
};

let cachedSnapshot: ThermalPrinterStatus = SERVER_SNAPSHOT;

function statusEquals(a: ThermalPrinterStatus, b: ThermalPrinterStatus): boolean {
  return (
    a.supported === b.supported &&
    a.connected === b.connected &&
    a.transport === b.transport &&
    a.label === b.label &&
    a.lastError === b.lastError
  );
}

function buildStatus(): ThermalPrinterStatus {
  const support = getThermalPrinterSupport();
  return {
    supported: support.usb || support.serial,
    connected: activeTransport !== null,
    transport: activeTransport,
    label: deviceLabel,
    lastError,
  };
}

function refreshCachedSnapshot(): ThermalPrinterStatus {
  const next = buildStatus();
  if (statusEquals(cachedSnapshot, next)) return cachedSnapshot;
  cachedSnapshot = next;
  return cachedSnapshot;
}

function notify() {
  refreshCachedSnapshot();
  for (const listener of listeners) listener();
}

function readPreference(): StoredPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPreference;
    if (parsed.transport === "usb" || parsed.transport === "serial") {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writePreference(preference: StoredPreference | null) {
  if (typeof window === "undefined") return;
  if (!preference) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
}

function isSecureContextOk(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function getThermalPrinterSupport(): {
  usb: boolean;
  serial: boolean;
} {
  if (!isSecureContextOk()) return { usb: false, serial: false };
  return {
    usb: getUsbApi() !== null,
    serial: getSerialApi() !== null,
  };
}

export function getThermalPrinterStatus(): ThermalPrinterStatus {
  return refreshCachedSnapshot();
}

/** Stable empty snapshot for SSR / useSyncExternalStore getServerSnapshot. */
export function getThermalPrinterServerSnapshot(): ThermalPrinterStatus {
  return SERVER_SNAPSHOT;
}

export function subscribeThermalPrinter(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function claimUsbInterface(device: UsbDeviceLike): Promise<number> {
  if (!device.opened) {
    await device.open();
  }
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  const configuration = device.configuration;
  if (!configuration) {
    throw new Error("USB configuration unavailable.");
  }

  for (const iface of configuration.interfaces) {
    for (const alternate of iface.alternates) {
      const outEndpoint = alternate.endpoints.find(
        (endpoint: UsbEndpoint) => endpoint.direction === "out",
      );
      if (!outEndpoint) continue;
      try {
        if (!iface.claimed) {
          await device.claimInterface(iface.interfaceNumber);
        }
        if (alternate.alternateSetting !== 0) {
          await device.selectAlternateInterface(
            iface.interfaceNumber,
            alternate.alternateSetting,
          );
        }
        return outEndpoint.endpointNumber;
      } catch {
        // try next interface
      }
    }
  }

  throw new Error(
    "Impossible de revendiquer l’interface USB. Sous Windows, installez WinUSB (Zadig) pour l’imprimante thermique.",
  );
}

async function writeUsb(data: Uint8Array): Promise<void> {
  if (!usbDevice || usbEndpointNumber == null) {
    throw new Error("Imprimante USB non connectée.");
  }
  const CHUNK = USB_CHUNK;
  for (let offset = 0; offset < data.length; offset += CHUNK) {
    const slice = Uint8Array.from(data.subarray(offset, offset + CHUNK));
    await usbDevice.transferOut(usbEndpointNumber, slice);
  }
}

async function writeSerial(data: Uint8Array): Promise<void> {
  if (!serialWriter) {
    throw new Error("Imprimante série non connectée.");
  }
  await serialWriter.write(data);
}

export async function disconnectThermalPrinter(): Promise<void> {
  try {
    if (serialWriter) {
      await serialWriter.close().catch(() => undefined);
      serialWriter = null;
    }
    if (serialPort) {
      await serialPort.close().catch(() => undefined);
      serialPort = null;
    }
    if (usbDevice?.opened) {
      await usbDevice.close().catch(() => undefined);
    }
  } finally {
    usbDevice = null;
    usbEndpointNumber = null;
    activeTransport = null;
    deviceLabel = null;
    writePreference(null);
    notify();
  }
}

async function connectUsbDevice(device: UsbDeviceLike): Promise<void> {
  await disconnectThermalPrinter();
  const endpoint = await claimUsbInterface(device);
  usbDevice = device;
  usbEndpointNumber = endpoint;
  activeTransport = "usb";
  deviceLabel =
    [device.productName, device.manufacturerName].filter(Boolean).join(" · ") ||
    `WD8260 USB ${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
  lastError = null;
  writePreference({ transport: "usb" });
  notify();
}

async function connectSerialPort(port: SerialPortLike): Promise<void> {
  await disconnectThermalPrinter();
  await port.open({ baudRate: SERIAL_BAUD });
  const writer = port.writable?.getWriter();
  if (!writer) {
    await port.close().catch(() => undefined);
    throw new Error("Port série non accessible.");
  }
  serialPort = port;
  serialWriter = writer;
  activeTransport = "serial";
  deviceLabel = `WD8260 · série / USB-COM (${SERIAL_BAUD} baud)`;
  lastError = null;
  writePreference({ transport: "serial" });
  notify();
}

/** User-gesture required: opens browser device picker. */
export async function requestThermalPrinter(
  preferred: ThermalTransport = "usb",
): Promise<ThermalPrinterStatus> {
  lastError = null;
  const usb = getUsbApi();
  const serial = getSerialApi();
  try {
    if (preferred === "usb" && usb) {
      const device = await usb.requestDevice({ filters: [] });
      await connectUsbDevice(device);
      return getThermalPrinterStatus();
    }
    if (serial) {
      const port = await serial.requestPort();
      await connectSerialPort(port);
      return getThermalPrinterStatus();
    }
    if (usb) {
      const device = await usb.requestDevice({ filters: [] });
      await connectUsbDevice(device);
      return getThermalPrinterStatus();
    }
    throw new Error(
      "WebUSB / Web Serial indisponible. Utilisez Chrome/Edge en HTTPS.",
    );
  } catch (error) {
    lastError =
      error instanceof Error ? error.message : "Connexion imprimante échouée.";
    notify();
    throw error;
  }
}

/** Reconnect previously authorized devices (no picker if permission persists). */
export async function restoreThermalPrinter(): Promise<ThermalPrinterStatus> {
  if (!isSecureContextOk()) return getThermalPrinterStatus();
  const preference = readPreference();
  if (!preference) return getThermalPrinterStatus();

  try {
    if (preference.transport === "usb") {
      const usb = getUsbApi();
      const devices = usb ? await usb.getDevices() : [];
      if (devices[0]) {
        await connectUsbDevice(devices[0]);
        return getThermalPrinterStatus();
      }
    }
    if (preference.transport === "serial") {
      const serial = getSerialApi();
      const ports = serial ? await serial.getPorts() : [];
      if (ports[0]) {
        await connectSerialPort(ports[0]);
        return getThermalPrinterStatus();
      }
    }
  } catch (error) {
    lastError =
      error instanceof Error
        ? error.message
        : "Reconnect imprimante échouée.";
    writePreference(null);
    notify();
  }
  return getThermalPrinterStatus();
}

export async function printRawEscPos(data: Uint8Array): Promise<void> {
  if (!activeTransport) {
    throw new Error("Aucune imprimante thermique connectée.");
  }
  try {
    if (activeTransport === "usb") {
      await writeUsb(data);
    } else {
      await writeSerial(data);
    }
    lastError = null;
    notify();
  } catch (error) {
    lastError =
      error instanceof Error ? error.message : "Impression thermique échouée.";
    notify();
    throw error;
  }
}

export function isThermalPrinterActive(): boolean {
  return activeTransport !== null;
}
