#include "labjack_t7_plugin.h"

#include "labjack_t7_controller.h"
#include "labjack_t7_discovery.h"

#include <LabJackM.h>

#include <algorithm>
#include <cmath>
#include <string>
#include <utility>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#endif

namespace {
constexpr const char* labjack_icon =
    "https://labjack.com/cdn/shop/files/LabJack_Logo_fa79278b-4a0c-4e5e-8ed7-dff9ad5b8dbb.png?v=1656709585&width=180";

std::string normalizeChannel(std::string channel) {
    if (channel.size() >= 2 && channel.front() == '|' && channel.back() == '|') {
        channel = channel.substr(1, channel.size() - 2);
    }
    std::replace(channel.begin(), channel.end(), '/', '.');
    return channel;
}

std::string stateChannel(const std::string& channel) {
    return channel + "_state";
}

std::shared_ptr<LabJackT7Module> requireModule(
    DARTWIC::API::SDK_API* api,
    const nlohmann::json& arguments) {
    const std::string instance = arguments.value("module_instance_name", std::string{});
    if (instance.empty()) throw std::runtime_error("A LabJack T7 module instance is required.");
    auto module = std::dynamic_pointer_cast<LabJackT7Module>(api->getModuleInstance(instance));
    if (!module) throw std::runtime_error("Configured LabJack T7 module `" + instance + "` is not available.");
    return module;
}

std::vector<std::string> mappingChannels(const nlohmann::json& arguments) {
    std::vector<std::string> channels;
    const auto mappings = arguments.value("mappings", nlohmann::json::array());
    if (!mappings.is_array()) throw std::runtime_error("LabJack task mappings must be an array.");
    for (const auto& mapping : mappings) {
        if (!mapping.is_object() || !mapping.contains("register") || !mapping["register"].is_number_integer() ||
            !mapping.contains("channel") || !mapping["channel"].is_string()) {
            throw std::runtime_error("Every LabJack mapping requires an integer register and channel string.");
        }
        auto channel = normalizeChannel(mapping["channel"].get<std::string>());
        if (channel.empty()) throw std::runtime_error("LabJack mapping channels cannot be empty.");
        channels.push_back(std::move(channel));
    }
    if (channels.empty()) throw std::runtime_error("Configure at least one LabJack mapping.");
    return channels;
}

void configureDigitalWriteAuthority(
    DARTWIC::API::SDK_API* api,
    DARTWIC::API::TaskRuntime& runtime,
    const std::vector<std::string>& channels
) {
    const std::string controller = "task:" + runtime.getTaskName();
    for (const auto& channel : channels) {
        const auto state_channel = stateChannel(channel);
        api->upsertChannelField(state_channel, DARTWIC::API::ChannelField::CONTROL_OWNER,
            controller, DARTWIC::API::ChannelStorage::Fixed);
        api->upsertChannelField(state_channel, DARTWIC::API::ChannelField::ACTIVE_CONTROLLER,
            controller, DARTWIC::API::ChannelStorage::Fixed);
        api->upsertChannelField(state_channel, DARTWIC::API::ChannelField::CONTROL_POLICY,
            DARTWIC::API::ControlPolicy::ObserveOnly, DARTWIC::API::ChannelStorage::Fixed);
        api->upsertChannelField(state_channel, DARTWIC::API::ChannelField::STALE_TIMEOUT,
            1.0, DARTWIC::API::ChannelStorage::Fixed);
    }
}

void configureDigitalWrite(DARTWIC::API::SDK_API* api, DARTWIC::API::TaskRuntime& runtime) {
    const auto& arguments = runtime.getArguments();
    requireModule(api, arguments);
    auto channels = mappingChannels(arguments);
    for (const auto& channel : channels) {
        api->createFixedChannel(channel);
        api->createFixedChannel(stateChannel(channel));
    }
    configureDigitalWriteAuthority(api, runtime, channels);
    runtime.setFixedInputChannels(std::move(channels));
}

void configureStream(DARTWIC::API::SDK_API* api, DARTWIC::API::TaskRuntime& runtime) {
    const auto& arguments = runtime.getArguments();
    requireModule(api, arguments);
    api->removeChannel(runtime.getTaskName() + "_stream_worker_read_rate");
    const std::string controller = "task:" + runtime.getTaskName();
    for (const auto& channel : mappingChannels(arguments)) {
        api->createFixedChannel(channel);
        api->upsertChannelField(channel, DARTWIC::API::ChannelField::CONTROL_OWNER,
            controller, DARTWIC::API::ChannelStorage::Fixed);
        api->upsertChannelField(channel, DARTWIC::API::ChannelField::ACTIVE_CONTROLLER,
            controller, DARTWIC::API::ChannelStorage::Fixed);
        api->upsertChannelField(channel, DARTWIC::API::ChannelField::CONTROL_POLICY,
            DARTWIC::API::ControlPolicy::ObserveOnly, DARTWIC::API::ChannelStorage::Fixed);
        api->upsertChannelField(channel, DARTWIC::API::ChannelField::RECORD_MODE,
            DARTWIC::API::RecordMode::EveryValue, DARTWIC::API::ChannelStorage::Fixed);
    }
    for (const char* suffix : {
        "_stream_target_scan_rate", "_stream_scans_per_read", "_stream_actual_scan_rate",
        "_stream_expected_read_rate", "_stream_last_read_ms",
        "_stream_device_scan_backlog", "_stream_ljm_scan_backlog"
    }) api->createFixedChannel(runtime.getTaskName() + suffix);
}

std::string getLoadedLjmLibraryPath() {
#ifdef _WIN32
    std::vector<HMODULE> modules(256);
    DWORD bytes_needed = 0;
    if (K32EnumProcessModules(GetCurrentProcess(), modules.data(),
        static_cast<DWORD>(modules.size() * sizeof(HMODULE)), &bytes_needed)) {
        modules.resize(bytes_needed / sizeof(HMODULE));
        for (const auto module_handle : modules) {
            if (GetProcAddress(module_handle, "LJM_ReadLibraryConfigS") == nullptr) continue;
            std::vector<char> module_path(MAX_PATH);
            while (true) {
                const DWORD length = K32GetModuleFileNameExA(GetCurrentProcess(), module_handle,
                    module_path.data(), static_cast<DWORD>(module_path.size()));
                if (length == 0) break;
                if (length < module_path.size() - 1) return std::string(module_path.data(), length);
                module_path.resize(module_path.size() * 2);
            }
        }
    }
#endif
    return {};
}

std::string ljmErrorText(int error_number) {
    char error_string[LJM_MAX_NAME_SIZE] = "LJM error not found.";
    LJM_ErrorToString(error_number, error_string);
    return error_string;
}

nlohmann::json buildLjmInfoPayload(const nlohmann::json& request_payload) {
    nlohmann::json payload = {
        {"plugin_sdk_version", LJM_VERSION}, {"required_ljm_version", LJM_VERSION},
        {"system_runtime_version", nullptr}, {"version_match", false},
        {"constants_ok", false}, {"library_ready", false},
        {"loaded_library_path", getLoadedLjmLibraryPath()}
    };
    if (request_payload.contains("module_instance_name") && request_payload["module_instance_name"].is_string()) {
        payload["module_instance_name"] = request_payload["module_instance_name"];
    }
    double runtime_version = 0.0;
    int error = LJM_ReadLibraryConfigS(LJM_LIBRARY_VERSION, &runtime_version);
    if (error != LJME_NOERROR) {
        payload["ljm_error_number"] = error;
        payload["ljm_error"] = ljmErrorText(error);
        payload["error"] = "The LabJack LJM system install could not be read.";
        return payload;
    }
    payload["system_runtime_version"] = runtime_version;
    payload["version_match"] = std::abs(runtime_version - LJM_VERSION) <= 0.00001;
    int address = 0;
    int type = 0;
    error = LJM_NameToAddress("AIN0", &address, &type);
    if (error != LJME_NOERROR) {
        payload["ljm_error_number"] = error;
        payload["ljm_error"] = ljmErrorText(error);
        payload["error"] = "The LabJack LJM constants/configuration files could not resolve AIN0.";
        return payload;
    }
    payload["constants_ok"] = true;
    payload["library_ready"] = payload["version_match"];
    if (!payload["version_match"].get<bool>()) {
        payload["error"] = "The installed LabJack LJM runtime version does not match the plugin SDK version.";
    }
    return payload;
}
}

void LabJackT7Plugin::onPluginLoaded() {
    dartwic->registerOperation("get_ljm_info", "Get LJM Runtime Information", buildLjmInfoPayload);

    auto device_finder = createLabJackT7DeviceFinder(dartwic, config);
    dartwic->registerOperation("get_discovery_settings", "Get LabJack Discovery Settings",
        [device_finder](const nlohmann::json&) { return device_finder->settings(); });
    dartwic->registerOperation("scan_devices", "Scan for LabJack T7 Devices",
        [device_finder](const nlohmann::json&) { return device_finder->scanNow(); });
    dartwic->registerLoop("device_discovery", "LabJack T7 Device Discovery", {
        .on_loop = [device_finder]() { device_finder->tick(); },
        .target_frequency_hz = 1.0,
    });

    dartwic->registerModuleType({.id = "labjack_t7", .name = "LabJack T7"});

    DARTWIC::API::TaskTypeDefinition digital_write_task;
    digital_write_task.metadata.structure = DARTWIC::API::TaskStructure::Periodic;
    digital_write_task.metadata.icon_url = labjack_icon;
    digital_write_task.metadata.default_arguments = {
        {"module_instance_name", ""}, {"mappings", nlohmann::json::array()}
    };
    digital_write_task.on_configure = [this](const auto&, DARTWIC::API::TaskRuntime& runtime) {
        configureDigitalWrite(dartwic, runtime);
    };
    digital_write_task.on_start = [this](const auto&, DARTWIC::API::TaskRuntime& runtime) {
        configureDigitalWriteAuthority(dartwic, runtime, mappingChannels(runtime.getArguments()));
    };
    digital_write_task.on_task = [this](const auto&, DARTWIC::API::TaskRuntime& runtime, double) {
        auto module = requireModule(dartwic, runtime.getArguments());
        module->controller().applyDigitalWrite(runtime.getArguments(), runtime);
    };
    digital_write_task.cleanup = [](DARTWIC::API::TaskRuntime&) {};
    dartwic->registerTaskType("digital_write", "LabJack Digital Write", std::move(digital_write_task));

    DARTWIC::API::TaskTypeDefinition stream_task;
    stream_task.metadata.structure = DARTWIC::API::TaskStructure::Worker;
    stream_task.metadata.icon_url = labjack_icon;
    stream_task.metadata.default_arguments = {
        {"module_instance_name", ""}, {"target_scan_rate", 100.0},
        {"scans_per_read", 10}, {"mappings", nlohmann::json::array()}
    };
    stream_task.on_configure = [this](const auto&, DARTWIC::API::TaskRuntime& runtime) {
        configureStream(dartwic, runtime);
    };
    stream_task.on_task = [this](const auto&, DARTWIC::API::TaskRuntime& runtime, double) {
        auto module = requireModule(dartwic, runtime.getArguments());
        module->controller().runStreamWorker(runtime);
    };
    stream_task.on_end = [this](const auto&, DARTWIC::API::TaskRuntime& runtime) {
        const std::string instance = runtime.getArguments().value("module_instance_name", std::string{});
        auto module = std::dynamic_pointer_cast<LabJackT7Module>(dartwic->getModuleInstance(instance));
        if (module) module->controller().stopStream(runtime);
    };
    stream_task.cleanup = [](DARTWIC::API::TaskRuntime&) {};
    dartwic->registerTaskType("stream", "LabJack Stream", std::move(stream_task));
}

DARTWIC::Modules::BaseModule* LabJackT7Plugin::createModule(
    const std::string& module_type_id,
    nlohmann::json cfg,
    DARTWIC::API::SDK_API* drtw) {
    if (module_type_id != "labjack_t7.labjack_t7" && module_type_id != "labjack_t7") return nullptr;
    return new LabJackT7Module(std::move(cfg), drtw);
}

DARTWIC_PLUGIN_EXPORT DARTWIC::Plugins::BasePlugin* createPlugin(
    nlohmann::json cfg,
    DARTWIC::API::SDK_API* drtw) {
    return new LabJackT7Plugin(std::move(cfg), drtw);
}
