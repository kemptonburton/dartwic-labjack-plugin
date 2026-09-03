import React from "@dartwic/interface-sdk/react";
import {Button} from "@dartwic/interface-sdk/ui/general";

function version(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(4) : "UNKNOWN";
}

export function LjmRuntimeStatus({operation, compact = false}: {operation: any; compact?: boolean}) {
  const [info, setInfo] = React.useState(null as any);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await operation("labjack_t7.get_ljm_info", {}, 15000);
      if (result?.error) throw new Error(result?.payload?.error || "Could not read the LJM runtime.");
      setInfo(result?.payload || {});
      if (result?.payload?.error) setError(String(result.payload.error).toUpperCase());
    } catch (caught: any) {
      setError(String(caught?.message || caught).toUpperCase());
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [operation]);

  React.useEffect(() => { void refresh(); }, [refresh]);
  const ready = Boolean(info?.library_ready && info?.version_match && info?.constants_ok);

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">DRIVER AND PLUGIN COMPATIBILITY</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={ready ? "text-xs text-emerald-300" : "text-xs text-destructive"}>
            {loading ? "CHECKING…" : ready ? "READY" : "CHECK INSTALL"}
          </span>
          <Button variant="outline" disabled={loading} onClick={refresh}>REFRESH</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border/70 border-y border-border/70 text-sm">
        <div className="px-3 py-3">
          <div className="text-[11px] text-muted-foreground">PLUGIN SDK</div>
          <div>{version(info?.plugin_sdk_version)}</div>
        </div>
        <div className="px-3 py-3">
          <div className="text-[11px] text-muted-foreground">SYSTEM INSTALL</div>
          <div>{version(info?.system_runtime_version)}</div>
        </div>
      </div>
      {!compact ? <div className="border-b border-border/70 px-3 py-3 text-sm">
        <div className="text-[11px] text-muted-foreground">LOADED LIBRARY</div>
        <div className="break-all font-mono text-xs">{info?.loaded_library_path || "UNKNOWN"}</div>
      </div> : null}
      {error ? <div className="border-b border-border/70 px-3 py-3 text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
