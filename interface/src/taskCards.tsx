import React from "@dartwic/interface-sdk/react";
import {useDartwic, useDartwicChannelValues} from "@dartwic/interface-sdk/hooks";
import {defineTaskCard} from "@dartwic/interface-sdk/tasks";
import {Separator} from "@dartwic/interface-sdk/ui/general";

function readBacklog(channels: any, channelName: string) {
  const value = Number(channels?.[channelName]?.channel_data?.value);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
}

function BacklogMetric({label, value, channelName}: {label: string; value: number | null; channelName: string}) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2" title={channelName}>
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${value !== null && value > 0 ? "text-yellow" : ""}`}>
        {value === null ? "—" : `${value} SCANS`}
      </div>
    </div>
  );
}

function LabJackTaskCard({task}: {task: any}) {
  const isStream = task.task_type === "labjack_t7.stream";
  const mappings = Array.isArray(task.arguments?.mappings) ? task.arguments.mappings : [];
  const {addChannelToTelemetry, removeChannelFromTelemetry} = useDartwic() as any;
  const backlogChannels = React.useMemo(() => {
    const taskName = String(task?.name || "").trim();
    if (!isStream || !taskName) return [];
    return [
      `${taskName}_stream_device_scan_backlog`,
      `${taskName}_stream_ljm_scan_backlog`,
    ];
  }, [isStream, task?.name]);
  const channelValues = useDartwicChannelValues(backlogChannels) as any;

  React.useEffect(() => {
    backlogChannels.forEach((channelName) => addChannelToTelemetry(channelName));
    return () => backlogChannels.forEach((channelName) => removeChannelFromTelemetry(channelName));
  }, [addChannelToTelemetry, backlogChannels, removeChannelFromTelemetry]);

  const deviceBacklogChannel = backlogChannels[0] || "";
  const ljmBacklogChannel = backlogChannels[1] || "";
  return <>
    <Separator />
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-md border bg-muted/40 px-3 py-2">
        <div className="text-muted-foreground">DEVICE</div>
        <div className="truncate">{task.arguments?.module_instance_name || "UNBOUND"}</div>
      </div>
      <div className="rounded-md border bg-muted/40 px-3 py-2">
        <div className="text-muted-foreground">{isStream ? "STREAM INPUTS" : "DIGITAL OUTPUTS"}</div>
        <div>{mappings.length}</div>
      </div>
      {isStream ? <>
        <BacklogMetric
          label="DEVICE BACKLOG"
          value={readBacklog(channelValues, deviceBacklogChannel)}
          channelName={deviceBacklogChannel}
        />
        <BacklogMetric
          label="LJM BACKLOG"
          value={readBacklog(channelValues, ljmBacklogChannel)}
          channelName={ljmBacklogChannel}
        />
      </> : null}
    </div>
  </>;
}

export const taskCards = [
  defineTaskCard({taskType: "labjack_t7.digital_write", component: LabJackTaskCard}),
  defineTaskCard({taskType: "labjack_t7.stream", component: LabJackTaskCard}),
];
