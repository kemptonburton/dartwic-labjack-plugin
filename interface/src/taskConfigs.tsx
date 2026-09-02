import React from "@dartwic/interface-sdk/react";
import {defineTaskConfig, useTaskConfigBridge} from "@dartwic/interface-sdk/tasks";
import {
  Button, Input, Label, ScrollArea, ScrollBar, Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue,
} from "@dartwic/interface-sdk/ui/general";
import {
  ChannelComboBox, convertChannelReferenceToChannelName, ModuleInstanceSelect,
} from "@dartwic/interface-sdk/ui/dartwic";
import {
  analogRangeOptions, buildTaskPayload, normalizeAnalogRange, normalizeMappings, stableStringify,
} from "./shared";

function MappingRow({mapping, isStream, onChange, onRemove}: any) {
  const analog = isStream && mapping.channelType === "analog";
  return (
    <div className="grid items-center gap-2 rounded-md border p-3"
      style={{gridTemplateColumns: analog
        ? "110px 90px 90px 120px minmax(0, 1fr) auto"
        : isStream ? "110px 90px minmax(0, 1fr) auto" : "90px minmax(0, 1fr) auto"}}>
      {isStream ? <Select value={mapping.channelType}
        onValueChange={(value: string) => onChange({...mapping, channelType: value})}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="analog">ANALOG</SelectItem>
          <SelectItem value="digital">DIGITAL</SelectItem>
        </SelectContent>
      </Select> : null}
      <Input type="number" min="0" value={mapping.register} placeholder="REGISTER"
        onChange={(event: any) => onChange({...mapping, register: event.target.value})} />
      {analog ? <>
        <Input type="number" min="0" max="253" value={mapping.negativeChannel} placeholder="NEG CH"
          onChange={(event: any) => onChange({...mapping, negativeChannel: event.target.value})} />
        <Select value={normalizeAnalogRange(mapping.range)}
          onValueChange={(value: string) => onChange({...mapping, range: value})}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{analogRangeOptions.map((option) =>
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </> : null}
      <ChannelComboBox mode={isStream ? "write" : "read"} showFieldSelector={false}
        initialValue={mapping.channel} placeholder="SELECT FIXED CHANNEL"
        onSelect={(value: string) => onChange({...mapping, channel: convertChannelReferenceToChannelName(value)})}
        className="min-w-0 w-full" />
      <Button variant="ghost" onClick={onRemove}>REMOVE</Button>
    </div>
  );
}

function LabJackTaskConfig({task, operation, onSaved, onClose, taskEditor}: any) {
  const isStream = task.task_type === "labjack_t7.stream";
  const nextId = React.useRef(0);
  const [selectedInstance, setSelectedInstance] = React.useState(task.arguments?.module_instance_name || "");
  const [targetScanRate, setTargetScanRate] = React.useState(String(task.arguments?.target_scan_rate ?? 100));
  const [scansPerRead, setScansPerRead] = React.useState(String(task.arguments?.scans_per_read ?? 10));
  const [mappings, setMappings] = React.useState(() => normalizeMappings(task.arguments, convertChannelReferenceToChannelName));
  const [errorMessage, setErrorMessage] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const payload = React.useMemo(() => buildTaskPayload(
    selectedInstance, isStream, targetScanRate, scansPerRead, mappings,
  ), [isStream, mappings, scansPerRead, selectedInstance, targetScanRate]);
  const initialPayload = React.useMemo(() => buildTaskPayload(
    task.arguments?.module_instance_name || "", isStream,
    String(task.arguments?.target_scan_rate ?? 100), String(task.arguments?.scans_per_read ?? 10),
    normalizeMappings(task.arguments, convertChannelReferenceToChannelName),
  ), [isStream, task]);
  const isDirty = stableStringify(payload) !== stableStringify(initialPayload);

  async function saveTask() {
    if (!selectedInstance) return setErrorMessage("SELECT A LABJACK T7 MODULE INSTANCE.");
    if (payload.mappings.length === 0) return setErrorMessage("ADD AT LEAST ONE MAPPING.");
    setIsSaving(true);
    setErrorMessage("");
    try {
      const result = await operation("dartwic/create-task", {
        portal_name: task.portal, task_name: task.name, task_type: task.task_type, arguments: payload,
      }, 30000);
      if (result?.error) return setErrorMessage((result?.payload?.error || "FAILED TO SAVE TASK.").toUpperCase());
      await onSaved?.();
      await onClose?.();
    } finally {
      setIsSaving(false);
    }
  }

  useTaskConfigBridge(taskEditor, {
    isDirty, isSaving, canSave: true, errorMessage,
    saveLabel: "SAVE", cancelLabel: "CANCEL", onSave: saveTask, onCancel: onClose,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="space-y-2">
        <Label>MODULE CONNECTION</Label>
        <ModuleInstanceSelect pluginId="labjack_t7" moduleTypeIds={["labjack_t7"]}
          value={selectedInstance} onValueChange={setSelectedInstance}
          placeholder="SELECT ONE LABJACK T7" />
        <div className="text-xs text-muted-foreground">One hardware stream may run per LabJack device.</div>
      </div>
      {isStream ? <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>TARGET SCAN RATE (HZ)</Label>
          <Input type="number" min="1" value={targetScanRate}
            onChange={(event: any) => setTargetScanRate(event.target.value)} /></div>
        <div className="space-y-2"><Label>SCANS PER READ</Label>
          <Input type="number" min="1" value={scansPerRead}
            onChange={(event: any) => setScansPerRead(event.target.value)} /></div>
      </div> : null}
      <ScrollArea className="min-h-0 flex-1" type="always">
        <div className="space-y-2 pr-4">
          <div className="flex items-center justify-between gap-2">
            <Label>{isStream ? "STREAM MAPPINGS (DEVICE → RAPID)" : "DIGITAL WRITES (RAPID → DEVICE)"}</Label>
            <Button variant="outline" onClick={() => setMappings((current: any[]) => current.concat([{
              id: `mapping-new-${nextId.current++}`, channelType: "analog", register: "",
              negativeChannel: "199", range: "10", channel: "",
            }]))}>ADD</Button>
          </div>
          {mappings.length === 0
            ? <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">NONE CONFIGURED</div>
            : mappings.map((mapping: any, index: number) => <MappingRow key={mapping.id}
              mapping={mapping} isStream={isStream}
              onChange={(next: any) => setMappings((current: any[]) => current.map((item, itemIndex) => itemIndex === index ? next : item))}
              onRemove={() => setMappings((current: any[]) => current.filter((_, itemIndex) => itemIndex !== index))} />)}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}

export const taskConfigs = [
  defineTaskConfig({taskType: "labjack_t7.digital_write", component: LabJackTaskConfig}),
  defineTaskConfig({taskType: "labjack_t7.stream", component: LabJackTaskConfig}),
];
