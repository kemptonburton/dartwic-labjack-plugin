import {definePlugin} from "@dartwic/interface-sdk";
import {moduleConfigs} from "./moduleConfigs";
import {LabJackPluginSettings} from "./pluginSettings";
import {taskCards} from "./taskCards";
import {taskConfigs} from "./taskConfigs";

export default definePlugin({
  id: "labjack_t7",
  name: "LabJack T7",
  register(registry) {
    registry.addTaskUi({
      id: "digital_write", name: "LabJack Digital Write",
      card: taskCards[0].component, editor: taskConfigs[0].component,
    });
    registry.addTaskUi({
      id: "stream", name: "LabJack Stream",
      card: taskCards[1].component, editor: taskConfigs[1].component,
    });
    registry.addModuleUi({
      id: "labjack_t7", name: "LabJack T7", panel: moduleConfigs[0].component,
      connection: ({instanceConfig}) => ({
        channel: `${instanceConfig.name}.info.connected`, label: "LabJack LJM",
        endpoint: `${instanceConfig.parameters?.connection_type || "ANY"} · ${instanceConfig.parameters?.identifier || "ANY"}`,
        connectedValue: 1,
      }),
    });
    registry.addSettingsPanel({id: "discovery", name: "Discovery & LJM", component: LabJackPluginSettings});
  },
});
