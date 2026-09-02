import React from "@dartwic/interface-sdk/react";
import {useDartwic} from "@dartwic/interface-sdk/hooks";
import {defineModuleConfig, useModuleConfigBridge} from "@dartwic/interface-sdk/module-configs";
import {Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@dartwic/interface-sdk/ui/general";
import {ModuleRuntimeOverview} from "@dartwic/interface-sdk/ui/dartwic";
import {LjmRuntimeStatus} from "./ljmRuntime";
import {resolveLabJackTaskChannels} from "./shared";

function Field({label, htmlFor, children}: {label: string; htmlFor: string; children?: any}) {
  return <div className="min-w-0 space-y-1.5">
    <Label htmlFor={htmlFor} className="block text-[11px] text-muted-foreground">{label}</Label>{children}
  </div>;
}

function Row({label, children}: {label: string; children?: any}) {
  return <div className="grid min-h-12 items-end gap-5 border-t border-border/70 px-3 py-3 last:border-b"
    style={{gridTemplateColumns: "minmax(140px, 0.45fr) minmax(0, 1.55fr)"}}>
    <div className="pb-2 text-xs text-muted-foreground">{label}</div>{children}
  </div>;
}

function LabJackModuleConfig({instanceConfig, setInstanceConfig, save, moduleEditor}: any) {
  const {operation} = useDartwic() as any;
  const [savedParameters, setSavedParameters] = React.useState(instanceConfig?.parameters || {});
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const parameters = instanceConfig?.parameters || {};
  const isDirty = JSON.stringify(parameters) !== JSON.stringify(savedParameters);
  const saveRef = React.useRef(save);
  const parametersRef = React.useRef(parameters);
  saveRef.current = save;
  parametersRef.current = parameters;

  React.useEffect(() => {
    setSavedParameters(instanceConfig?.parameters || {});
    setErrorMessage("");
  }, [instanceConfig?.name]);

  function update(key: string, value: unknown) {
    setInstanceConfig((current: any) => ({...current, parameters: {...(current?.parameters || {}), [key]: value}}));
  }

  const handleSave = React.useCallback(async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      await saveRef.current();
      setSavedParameters(parametersRef.current);
    } catch (caught: any) {
      setErrorMessage(String(caught?.message || caught).toUpperCase());
    } finally {
      setIsSaving(false);
    }
  }, []);

  useModuleConfigBridge(moduleEditor, {
    isDirty, isSaving, canSave: true, errorMessage, saveLabel: "SAVE CONFIG", onSave: handleSave,
  });

  return <div className="space-y-8">
    <div className="pb-2">
      <div className="mb-3 text-xs font-medium text-muted-foreground">CONNECTION DETAILS</div>
      <div>
        <Row label="Device selector">
          <div className="grid min-w-0 gap-3" style={{gridTemplateColumns: "minmax(110px, .35fr) minmax(130px, .45fr) minmax(180px, 1fr)"}}>
            <Field label="Device type" htmlFor="labjack-device-type">
              <Select value={parameters.device_type || "T7"} onValueChange={(value: string) => update("device_type", value)}>
                <SelectTrigger id="labjack-device-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="T7">T7</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Connection" htmlFor="labjack-connection-type">
              <Select value={parameters.connection_type || "ANY"} onValueChange={(value: string) => update("connection_type", value)}>
                <SelectTrigger id="labjack-connection-type"><SelectValue /></SelectTrigger>
                <SelectContent>{["ANY", "USB", "ETHERNET", "WIFI", "TCP"].map((value) =>
                  <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Identifier / serial / IP" htmlFor="labjack-identifier">
              <Input id="labjack-identifier" value={parameters.identifier || ""} placeholder="ANY"
                onChange={(event: any) => update("identifier", event.target.value)} />
            </Field>
          </div>
        </Row>
      </div>
    </div>
    <ModuleRuntimeOverview instanceName={instanceConfig?.name || ""}
      resolveTaskChannels={resolveLabJackTaskChannels}
      emptyMessage="NO TASKS LINKED TO THIS MODULE" className="pt-2" />
    <LjmRuntimeStatus operation={operation} />
  </div>;
}

export const moduleConfigs = [defineModuleConfig({component: LabJackModuleConfig})];
