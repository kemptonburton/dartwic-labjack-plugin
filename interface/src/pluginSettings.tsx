import React from "@dartwic/interface-sdk/react";
import {LjmRuntimeStatus} from "./ljmRuntime";

export function LabJackPluginSettings({operation}: any) {
  return <div className="max-w-3xl">
    <LjmRuntimeStatus operation={operation} />
  </div>;
}
