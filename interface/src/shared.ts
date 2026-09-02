export interface LabJackMappingValue {
  id: string;
  channelType: "analog" | "digital";
  register: string;
  negativeChannel: string;
  range: string;
  channel: string;
}

export const analogRangeOptions = [
  {value: "10", label: "±10 V"},
  {value: "1", label: "±1 V"},
  {value: "0.1", label: "±0.1 V"},
  {value: "0.01", label: "±0.01 V"},
];

export function normalizeAnalogRange(value: unknown) {
  const numeric = Number(value);
  return [10, 1, 0.1, 0.01].includes(numeric) ? String(numeric) : "10";
}

export function normalizeMappings(argumentsPayload: any,
  convertChannelReferenceToChannelName: (value: string) => string): LabJackMappingValue[] {
  if (!Array.isArray(argumentsPayload?.mappings)) return [];
  return argumentsPayload.mappings.filter((mapping: any) => mapping && typeof mapping === "object")
    .map((mapping: any, index: number) => ({
      id: `mapping-${index}-${mapping.register ?? ""}-${mapping.channel ?? ""}`,
      channelType: (mapping.channel_type || mapping.register_type) === "digital" ? "digital" : "analog",
      register: Number.isFinite(Number(mapping.register)) ? String(mapping.register) : "",
      negativeChannel: Number.isFinite(Number(mapping.negative_channel)) ? String(mapping.negative_channel) : "199",
      range: normalizeAnalogRange(mapping.range),
      channel: typeof mapping.channel === "string" ? convertChannelReferenceToChannelName(mapping.channel) : "",
    }));
}

export function buildTaskPayload(selectedInstance: string, isStream: boolean, targetScanRate: string,
  scansPerRead: string, mappings: LabJackMappingValue[]) {
  const cleaned = mappings.map((mapping) => ({
    ...(isStream ? {channel_type: mapping.channelType, register_type: mapping.channelType} : {}),
    register: Number(mapping.register),
    ...(isStream && mapping.channelType === "analog" ? {
      negative_channel: Number(mapping.negativeChannel || 199),
      range: Number(normalizeAnalogRange(mapping.range)),
    } : {}),
    channel: String(mapping.channel || "").trim(),
  })).filter((mapping) => Number.isInteger(mapping.register) && mapping.register >= 0 && mapping.channel);
  return {
    module_instance_name: selectedInstance,
    ...(isStream ? {
      target_scan_rate: Math.max(1, Number(targetScanRate) || 100),
      scans_per_read: Math.max(1, Math.trunc(Number(scansPerRead) || 10)),
    } : {}),
    mappings: cleaned,
  };
}

export function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

export function resolveLabJackTaskChannels(task: any) {
  const isStream = task?.task_type === "labjack_t7.stream";
  return (Array.isArray(task?.arguments?.mappings) ? task.arguments.mappings : [])
    .map((mapping: any) => ({
      name: String(mapping?.channel || "").trim(),
      direction: isStream ? "input" as const : "output" as const,
      detail: `${isStream && (mapping?.channel_type || mapping?.register_type) !== "digital" ? "AIN" : "DIO"}${Number(mapping?.register)}`,
    })).filter((channel: any) => channel.name);
}
