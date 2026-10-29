import React from "@dartwic/interface-sdk/react";
import {ConfigMap} from "@dartwic/interface-sdk/config-maps";
import {LjmRuntimeStatus} from "./ljmRuntime";

export function LabJackPluginSettings({operation}: any) {
  return <div className="w-full">
    <ConfigMap/>
    <LjmRuntimeStatus operation={operation} />
  </div>;
}
