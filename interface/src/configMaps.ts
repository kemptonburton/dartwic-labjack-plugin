import {defineConfigMap, createModuleConfigAdapter, createTaskConfigAdapter, type ConfigMapField} from '@dartwic/interface-sdk/config-maps';
import React from '@dartwic/interface-sdk/react';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@dartwic/interface-sdk/ui/general';
import {createDiscoverySettingsAdapter} from './discoverySettings.js';

export const pluginMap = defineConfigMap({
  ...createDiscoverySettingsAdapter('labjack_t7'), title: 'LabJack discovery settings',
  groups: [{id: 'discovery', label: 'Device discovery · Engine restart required', fields: [
    {path: 'device_discovery.enabled', label: 'Device discovery', type: 'toggle', defaultValue: true},
    {path: 'device_discovery.scan_interval_seconds', label: 'Scan interval (seconds)', type: 'number', required: true, integer: true, min: 1, max: 300, defaultValue: 3},
    {path: 'device_discovery.suggest_analog_inputs', label: 'Suggest analog inputs', type: 'toggle', defaultValue: true},
    ...(['analog_input', 'digital_io'] as const).flatMap(kind => (['start', 'end'] as const).map(edge => ({
      path: `device_discovery.${kind}_${edge}`, label: `${kind === 'analog_input' ? 'Analog input' : 'Digital I/O'} ${edge}`,
      type: 'number' as const, required: true, integer: true, min: 0, max: kind === 'analog_input' ? 13 : 22,
      defaultValue: edge === 'start' ? 0 : kind === 'analog_input' ? 13 : 22,
    }))),
  ]}],
  validate({device_discovery: value}) {
    return value.analog_input_start > value.analog_input_end || value.digital_io_start > value.digital_io_end
      ? 'Range starts must not exceed their ends.' : '';
  },
});

export const moduleMap = defineConfigMap({
  ...createModuleConfigAdapter(), title: 'LabJack connection',
  groups: [{id: 'connection', label: 'Connection', fields: [
    {path: 'parameters.device_type', label: 'Device type', type: 'select', defaultValue: 'T7', options: [{value: 'T7', label: 'T7'}]},
    {path: 'parameters.connection_type', label: 'Connection', type: 'select', defaultValue: 'ANY',
      options: ['ANY', 'USB', 'ETHERNET', 'WIFI', 'TCP'].map(value => ({value, label: value}))},
    {path: 'parameters.identifier', label: 'Identifier / serial / IP', type: 'text', defaultValue: 'ANY', required: true},
  ]}],
});

function taskMap(stream: boolean) {
  const adapter = createTaskConfigAdapter();
  const columns: ConfigMapField[] = [
    ...(stream ? [{path: 'channel_type', label: 'Type', type: 'select' as const, defaultValue: 'analog',
      options: [{value: 'analog', label: 'Analog'}, {value: 'digital', label: 'Digital'}],
      render: ({row, onCommit, disabled}: any) => React.createElement(Select, {value: row?.channel_type || row?.register_type || 'analog', onValueChange: onCommit, disabled},
        React.createElement(SelectTrigger, {className: 'h-6 rounded-none border-0 bg-transparent px-0 text-xs'}, React.createElement(SelectValue)),
        React.createElement(SelectContent, null, ...['analog', 'digital'].map(value => React.createElement(SelectItem, {key: value, value}, value))))}] : []),
    {path: 'register', label: stream ? 'AIN / DIO number' : 'DIO number', type: 'number', required: true, min: 0, max: stream ? 127 : 22, integer: true},
    ...(stream ? [{path: 'negative_channel', label: 'Negative channel', type: 'number' as const, min: 0, max: 199, integer: true, defaultValue: 199},
      {path: 'range', label: 'Range (±V)', type: 'number' as const, defaultValue: 10,
        validate: (value: any) => [10, 1, .1, .01].includes(value) ? '' : 'Choose 10, 1, 0.1 or 0.01 V.'}] : []),
    {path: 'channel', label: stream ? 'Publish channel' : 'Command channel', type: 'channel', channelMode: stream ? 'write' : 'read', required: true},
  ];
  return defineConfigMap({...adapter, title: stream ? 'LabJack stream' : 'LabJack digital write',
    groups: [{id: 'configuration', label: 'Task configuration', fields: [
      {path: 'arguments.module_instance_name', label: 'Module connection', type: 'module', pluginId: 'labjack_t7', moduleTypeIds: ['labjack_t7'], required: true},
      ...(stream ? [{path: 'arguments.target_scan_rate', label: 'Target scan rate (Hz)', type: 'number' as const, min: 1, defaultValue: 100},
        {path: 'arguments.scans_per_read', label: 'Scans per read', type: 'number' as const, min: 1, integer: true, defaultValue: 10}] : []),
    ]}, {id: 'bindings', label: 'Channel bindings', tables: [{path: 'arguments.mappings', label: stream ? 'Stream inputs' : 'Digital outputs', columns,
      createRow: () => stream ? {channel_type: 'analog', negative_channel: 199, range: 10} : {}}]}],
    validate: value => value.arguments?.mappings?.length ? '' : 'Add at least one channel binding.',
  });
}
export const streamMap = taskMap(true);
export const digitalWriteMap = taskMap(false);
