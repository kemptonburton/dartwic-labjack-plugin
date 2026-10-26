import {definePlugin} from "@dartwic/interface-sdk";
import {moduleMap, streamMap, digitalWriteMap} from './configMaps';
import {LabJackPluginSettings} from "./pluginSettings";
import {taskCards} from "./taskCards";

export default definePlugin({
  id: "labjack_t7",
  name: "LabJack T7",
  register(registry) {
    registry.addTaskUi({
      id: "digital_write", name: "LabJack Digital Write",
      card: taskCards[0].component, configMap: digitalWriteMap,
    });
    registry.addTaskUi({
      id: "stream", name: "LabJack Stream",
      card: taskCards[1].component, configMap: streamMap,
    });
    registry.addModuleUi({
      id: "labjack_t7", name: "LabJack T7", configMap: moduleMap,
      connection: ({instanceConfig}) => ({
        channel: `${instanceConfig.name}.info.connected`, label: "LabJack LJM",
        endpoint: `${instanceConfig.parameters?.connection_type || "ANY"} · ${instanceConfig.parameters?.identifier || "ANY"}`,
        connectedValue: 1,
      }),
    });
    registry.addSettingsPanel({id: "discovery", name: "Discovery & LJM", component: LabJackPluginSettings});
  },
});
