import React from "@dartwic/interface-sdk/react";
import {LjmRuntimeStatus} from "./ljmRuntime";

export function LabJackPluginSettings({operation}: any) {
  return <div className="w-full">
    <LjmRuntimeStatus operation={operation} />
  </div>;
}
