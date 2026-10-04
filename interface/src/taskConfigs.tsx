import React from "@dartwic/interface-sdk/react";
import {defineTaskConfig, useTaskConfigBridge} from "@dartwic/interface-sdk/tasks";
import {
  Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@dartwic/interface-sdk/ui/general";
import {
  ChannelComboBox, convertChannelReferenceToChannelName, TaskBindingTable,
} from "@dartwic/interface-sdk/ui/dartwic";
import {
  analogRangeOptions, buildTaskPayload, normalizeAnalogRange, normalizeMappings, stableStringify,
} from "./shared";

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
  const moduleConnection = React.useMemo(() => ({
    pluginId: "labjack_t7",
    moduleTypeIds: ["labjack_t7"],
    value: selectedInstance,
    onValueChange: setSelectedInstance,
    placeholder: "SELECT ONE LABJACK T7",
    description: "One hardware stream may run per LabJack device.",
    showConnectionStatus: true,
  }), [selectedInstance]);
  const tableInputClass = "h-8 min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-xs normal-case shadow-none ring-offset-transparent focus-visible:ring-0 focus-visible:ring-offset-0";
  const tableSelectClass = "h-8 min-h-0 w-full rounded-none border-0 bg-transparent px-0 py-0 text-xs uppercase shadow-none focus:ring-0";
  const columns = [
    ...(isStream ? [{
      key: "channelType", label: "TYPE", width: "8rem",
      render: (mapping: any, _index: number, update: (mapping: any) => void) => (
        <Select value={mapping.channelType} onValueChange={(value: string) => update({...mapping, channelType: value})}>
          <SelectTrigger className={tableSelectClass}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="analog">ANALOG</SelectItem>
            <SelectItem value="digital">DIGITAL</SelectItem>
          </SelectContent>
        </Select>
      ),
    }] : []),
    {
      key: "register", label: "ADDRESS", width: "7rem",
      render: (mapping: any, _index: number, update: (mapping: any) => void) => (
        <Input type="number" min="0" value={mapping.register} placeholder="ADDRESS" className={tableInputClass}
          onChange={(event: any) => update({...mapping, register: event.target.value})} />
      ),
    },
    ...(isStream ? [
      {
        key: "negativeChannel", label: "NEGATIVE", width: "7rem",
        render: (mapping: any, _index: number, update: (mapping: any) => void) => mapping.channelType === "analog" ? (
          <Input type="number" min="0" max="253" value={mapping.negativeChannel} placeholder="NEG CH" className={tableInputClass}
            onChange={(event: any) => update({...mapping, negativeChannel: event.target.value})} />
        ) : <span className="text-xs text-muted-foreground">—</span>,
      },
      {
        key: "range", label: "RANGE", width: "9rem",
        render: (mapping: any, _index: number, update: (mapping: any) => void) => mapping.channelType === "analog" ? (
          <Select value={normalizeAnalogRange(mapping.range)} onValueChange={(value: string) => update({...mapping, range: value})}>
            <SelectTrigger className={tableSelectClass}><SelectValue /></SelectTrigger>
            <SelectContent>{analogRangeOptions.map((option) =>
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : <span className="text-xs text-muted-foreground">—</span>,
      },
    ] : []),
    {
      key: "channel", label: "CHANNEL", width: "minmax(14rem,1.5fr)",
      render: (mapping: any, _index: number, update: (mapping: any) => void) => (
        <ChannelComboBox key={mapping.channel || mapping.id} mode={isStream ? "write" : "read"} showFieldSelector={false}
          initialValue={mapping.channel} placeholder="SELECT FIXED CHANNEL"
          onSelect={(value: string) => update({...mapping, channel: convertChannelReferenceToChannelName(value)})}
          className="min-w-0 w-full" channelComboboxClassName={tableInputClass} />
      ),
    },
  ];

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
    moduleConnection,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {isStream ? <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>TARGET SCAN RATE (HZ)</Label>
          <Input type="number" min="1" value={targetScanRate}
            onChange={(event: any) => setTargetScanRate(event.target.value)} /></div>
        <div className="space-y-2"><Label>SCANS PER READ</Label>
          <Input type="number" min="1" value={scansPerRead}
            onChange={(event: any) => setScansPerRead(event.target.value)} /></div>
      </div> : null}
      <TaskBindingTable
        title={isStream ? "STREAM MAPPINGS (DEVICE → RAPID)" : "DIGITAL WRITES (RAPID → DEVICE)"}
        bindings={mappings}
        onBindingsChange={setMappings}
        bindingTypes={[]}
        columns={columns}
        addLabel="ADD MAPPING"
        minTableWidth={isStream ? "54rem" : "32rem"}
        createBinding={() => ({
          id: `mapping-new-${nextId.current++}`, channelType: "analog", register: "",
          negativeChannel: "199", range: "10", channel: "",
        })}
      />
    </div>
  );
}

export const taskConfigs = [
  defineTaskConfig({taskType: "labjack_t7.digital_write", component: LabJackTaskConfig}),
  defineTaskConfig({taskType: "labjack_t7.stream", component: LabJackTaskConfig}),
];
