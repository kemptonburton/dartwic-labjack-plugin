import React from "@dartwic/interface-sdk/react";
import {Button} from "@dartwic/interface-sdk/ui/general";
import {LjmRuntimeStatus} from "./ljmRuntime";

function responseError(result: any, fallback: string) {
  return result?.error ? String(result?.payload?.error || result?.message || fallback).toUpperCase() : "";
}

export function LabJackPluginSettings({operation}: any) {
  const [settings, setSettings] = React.useState(null as any);
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await operation("labjack_t7.get_discovery_settings", {}, 15000);
      const resultError = responseError(result, "Could not load discovery status.");
      if (resultError) throw new Error(resultError);
      setSettings(result?.payload || {});
    } catch (caught: any) {
      setError(String(caught?.message || caught).toUpperCase());
    } finally {
      setLoading(false);
    }
  }, [operation]);

  React.useEffect(() => { void load(); }, [load]);

  async function scan() {
    setScanning(true);
    setError("");
    try {
      const result = await operation("labjack_t7.scan_devices", {}, 30000);
      const scanError = responseError(result, "LabJack discovery scan failed.");
      if (scanError) throw new Error(scanError);
      setSettings(result?.payload || {});
    } catch (caught: any) {
      setError(String(caught?.message || caught).toUpperCase());
    } finally {
      setScanning(false);
    }
  }

  const devices = Array.isArray(settings?.devices) ? settings.devices : [];
  return <div className="max-w-3xl space-y-10">
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">DEVICE DISCOVERY</div>
          <div className="mt-1 text-sm text-muted-foreground">LJM ENUMERATION AND MODULE / CHANNEL / TASK SUGGESTIONS</div>
        </div>
        <Button variant="outline" disabled={loading || scanning || settings?.enabled === false} onClick={scan}>
          {scanning ? "SCANNING…" : "SCAN NOW"}
        </Button>
      </div>
      <div className="grid border-y border-border/70 text-sm md:grid-cols-3">
        <div className="border-b px-3 py-3 md:border-b-0 md:border-r"><div className="text-[11px] text-muted-foreground">STATUS</div>
          <div>{settings?.enabled === false ? "DISABLED" : "ACTIVE"}</div></div>
        <div className="border-b px-3 py-3 md:border-b-0 md:border-r"><div className="text-[11px] text-muted-foreground">SCAN INTERVAL</div>
          <div>{settings?.scan_interval_seconds ?? 3} SECONDS</div></div>
        <div className="px-3 py-3"><div className="text-[11px] text-muted-foreground">FOUND</div><div>{devices.length} DEVICES</div></div>
      </div>
      {devices.length ? <div className="divide-y divide-border/70 border-b">
        {devices.map((device: any) => <div key={device.serial_number}
          className="grid grid-cols-[minmax(120px,.6fr)_minmax(100px,.5fr)_minmax(120px,1fr)] gap-3 px-3 py-3 text-sm">
          <div><div className="text-[11px] text-muted-foreground">SERIAL</div>{device.serial_number}</div>
          <div><div className="text-[11px] text-muted-foreground">LINK</div>{device.connection_type}</div>
          <div><div className="text-[11px] text-muted-foreground">ADDRESS</div>{device.ip_address || "LOCAL USB"}</div>
        </div>)}
      </div> : <div className="border-b px-3 py-4 text-sm text-muted-foreground">NO LABJACK T7 DEVICES FOUND</div>}
      <div className="pt-3 text-xs text-muted-foreground">
        Suggestions include AIN {settings?.analog_input_start ?? 0}–{settings?.analog_input_end ?? 13} and DIO {settings?.digital_io_start ?? 0}–{settings?.digital_io_end ?? 22}; review them before provisioning.
      </div>
      {settings?.last_error ? <div className="pt-3 text-xs text-destructive">{String(settings.last_error).toUpperCase()}</div> : null}
      {error ? <div className="pt-3 text-xs text-destructive">{error}</div> : null}
    </section>
    <LjmRuntimeStatus operation={operation} />
  </div>;
}
