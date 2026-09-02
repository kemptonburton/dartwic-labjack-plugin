#include "labjack_t7_discovery.h"

#include <LabJackM.h>
#include <modules/BaseModule.h>

#include <algorithm>
#include <array>
#include <cctype>
#include <stdexcept>
#include <string>

namespace {
std::string safeName(std::string value) {
    for (char& character : value) {
        if (!std::isalnum(static_cast<unsigned char>(character))) character = '_';
        else character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
    }
    while (value.find("__") != std::string::npos) value.replace(value.find("__"), 2, "_");
    if (value.empty() || !std::isalpha(static_cast<unsigned char>(value.front()))) value = "device_" + value;
    return value;
}

std::string connectionName(int connection_type) {
    switch (connection_type) {
        case LJM_ctUSB: return "USB";
        case LJM_ctETHERNET: return "ETHERNET";
        case LJM_ctWIFI: return "WIFI";
        case LJM_ctTCP: return "TCP";
        default: return "ANY";
    }
}

std::string ipAddress(int numeric_ip) {
    if (numeric_ip == LJM_NO_IP_ADDRESS) return {};
    std::array<char, LJM_MAX_NAME_SIZE> buffer{};
    if (LJM_NumberToIP(static_cast<unsigned int>(numeric_ip), buffer.data()) != LJME_NOERROR) return {};
    return buffer.data();
}

nlohmann::json ranges(int start, int end) {
    if (start < 0 || end < start) return nlohmann::json::array();
    return nlohmann::json::array({{{"start", start}, {"end", end}}});
}

nlohmann::json taskOption(const char* task_id, const char* label, const char* segment,
    const char* direction, bool enabled) {
    return {
        {"task_id", task_id}, {"label", label}, {"channel_segment", segment},
        {"direction", direction}, {"default_enabled", enabled}
    };
}

nlohmann::json suggestionGroup(const char* id, const char* label, const char* register_type,
    const char* segment, int start, int end, nlohmann::json options) {
    return {
        {"id", id}, {"label", label}, {"register_type", register_type},
        {"channel_segment", segment}, {"supported", true},
        {"response_count", end >= start ? end - start + 1 : 0},
        {"response_ranges", ranges(start, end)}, {"default_ranges", ranges(start, end)},
        {"task_options", std::move(options)}
    };
}

nlohmann::json defaultAnalogChannels(const std::string& instance_name, int start, int end) {
    auto channels = nlohmann::json::array();
    for (int address = start; address <= end; ++address) {
        channels.push_back({
            {"name", instance_name + ".ain." + std::to_string(address)},
            {"direction", "input"}, {"register_type", "analog"}, {"address", address}
        });
    }
    return channels;
}

nlohmann::json defaultAnalogMappings(const std::string& instance_name, int start, int end) {
    auto mappings = nlohmann::json::array();
    for (int address = start; address <= end; ++address) {
        mappings.push_back({
            {"register", address}, {"channel_type", "analog"}, {"register_type", "analog"},
            {"negative_channel", LJM_GND}, {"range", 10.0},
            {"channel", instance_name + ".ain." + std::to_string(address)}
        });
    }
    return mappings;
}
}

LabJackT7DeviceFinder::LabJackT7DeviceFinder(
    DARTWIC::API::SDK_API* api,
    const nlohmann::json& plugin_config) : api_(api) {
    const auto discovery = plugin_config.value("device_discovery", nlohmann::json::object());
    enabled_ = discovery.value("enabled", true);
    suggest_analog_inputs_ = discovery.value("suggest_analog_inputs", true);
    analog_input_start_ = std::clamp(discovery.value("analog_input_start", 0), 0, 13);
    analog_input_end_ = std::clamp(discovery.value("analog_input_end", 13), analog_input_start_, 13);
    digital_io_start_ = std::clamp(discovery.value("digital_io_start", 0), 0, 22);
    digital_io_end_ = std::clamp(discovery.value("digital_io_end", 22), digital_io_start_, 22);
    scan_interval_ = std::chrono::seconds(std::clamp(discovery.value("scan_interval_seconds", 3), 1, 300));
}

void LabJackT7DeviceFinder::tick() {
    std::scoped_lock lock(mutex_);
    if (!enabled_ || api_ == nullptr) return;
    reconcileAnnouncements();
    if (std::chrono::steady_clock::now() < next_scan_) return;
    scanLocked();
}

nlohmann::json LabJackT7DeviceFinder::settings() const {
    std::scoped_lock lock(mutex_);
    return {
        {"enabled", enabled_}, {"scan_interval_seconds", scan_interval_.count()},
        {"suggest_analog_inputs", suggest_analog_inputs_},
        {"analog_input_start", analog_input_start_}, {"analog_input_end", analog_input_end_},
        {"digital_io_start", digital_io_start_}, {"digital_io_end", digital_io_end_},
        {"devices", last_devices_}, {"device_count", last_devices_.size()}, {"last_error", last_error_}
    };
}

nlohmann::json LabJackT7DeviceFinder::scanNow() {
    {
        std::scoped_lock lock(mutex_);
        next_scan_ = {};
        if (enabled_ && api_ != nullptr) {
            reconcileAnnouncements();
            scanLocked();
        }
    }
    return settings();
}

void LabJackT7DeviceFinder::reconcileAnnouncements() {
    for (auto announced = announced_ids_.begin(); announced != announced_ids_.end();) {
        const auto request_id = request_ids_.find(*announced);
        if (request_id == request_ids_.end()) {
            announced = announced_ids_.erase(announced);
            continue;
        }
        try {
            const auto request = api_->getInterfaceUiRequest(request_id->second);
            const std::string status = request.value("status", "pending");
            if (status == "pending") {
                ++announced;
                continue;
            }
            // A terminal discovery request can be announced again only when its
            // matching live module no longer exists.
            request_ids_.erase(request_id);
            announced = announced_ids_.erase(announced);
        } catch (const std::exception&) {
            // Retain pending state through transient broker failures so a scan
            // does not create duplicate discovery prompts.
            ++announced;
        }
    }
}

bool LabJackT7DeviceFinder::hasConfiguredModule(const int serial_number) const {
    const std::string identifier = std::to_string(serial_number);
    for (const auto& summary : api_->getModuleInstances("labjack_t7")) {
        const auto module = api_->getModuleInstance(summary.name);
        if (!module) continue;
        if (module->getParameter<std::string>("device_type", "T7") != "T7") continue;
        if (module->getParameter<std::string>("identifier") == identifier) return true;
    }
    return false;
}

void LabJackT7DeviceFinder::scanLocked() {
    next_scan_ = std::chrono::steady_clock::now() + scan_interval_;
    last_error_.clear();
    last_devices_ = nlohmann::json::array();
    std::unordered_set<int> seen_serials;
    auto scan_connection = [&](const char* connection_filter) {
        std::array<int, LJM_LIST_ALL_SIZE> device_types{};
        std::array<int, LJM_LIST_ALL_SIZE> connection_types{};
        std::array<int, LJM_LIST_ALL_SIZE> serial_numbers{};
        std::array<int, LJM_LIST_ALL_SIZE> ip_addresses{};
        int found = 0;
        const int error = LJM_ListAllS("T7", connection_filter, &found, device_types.data(),
            connection_types.data(), serial_numbers.data(), ip_addresses.data());
        if (error != LJME_NOERROR) {
            // An Auto-IP file is optional. A missing or invalid file must not hide
            // USB devices, so network enumeration failures are isolated here.
            if (error != LJME_AUTO_IPS_FILE_NOT_FOUND && error != LJME_AUTO_IPS_FILE_INVALID) {
                std::array<char, LJM_MAX_NAME_SIZE> error_text{};
                LJM_ErrorToString(error, error_text.data());
                if (!last_error_.empty()) last_error_ += "; ";
                last_error_ += std::string(connection_filter) + ": " + error_text.data();
            }
            return;
        }
        found = std::clamp(found, 0, static_cast<int>(LJM_LIST_ALL_SIZE));
        for (int index = 0; index < found; ++index) {
            if (!seen_serials.insert(serial_numbers[index]).second) continue;
            last_devices_.push_back({
                {"serial_number", serial_numbers[index]},
                {"connection_type", connectionName(connection_types[index])},
                {"ip_address", ipAddress(ip_addresses[index])}
            });
            announce(device_types[index], connection_types[index], serial_numbers[index], ip_addresses[index]);
        }
    };

    // Prefer USB when a device is reachable over more than one transport.
    scan_connection("USB");
    scan_connection("ETHERNET");
    scan_connection("WIFI");
}

void LabJackT7DeviceFinder::announce(
    int device_type,
    int connection_type,
    int serial_number,
    int numeric_ip) {
    const std::string discovery_id = "t7:" + std::to_string(serial_number);
    if (hasConfiguredModule(serial_number) || announced_ids_.contains(discovery_id)) return;
    const std::string connection = connectionName(connection_type);
    const std::string ip = ipAddress(numeric_ip);
    const std::string identifier = std::to_string(serial_number);
    const std::string instance_name = safeName("labjack_t7_" + identifier);
    const auto channels = suggest_analog_inputs_
        ? defaultAnalogChannels(instance_name, analog_input_start_, analog_input_end_)
        : nlohmann::json::array();
    auto tasks = nlohmann::json::array();
    if (suggest_analog_inputs_) {
        tasks.push_back({
            {"name_suffix", "_stream"}, {"task_type", "stream"},
            {"arguments", {
                {"target_scan_rate", 100.0}, {"scans_per_read", 10},
                {"mappings", defaultAnalogMappings(instance_name, analog_input_start_, analog_input_end_)}
            }}
        });
    }

    const auto analog_group = suggestionGroup(
        "analog_inputs", "Analog inputs", "analog", "ain", analog_input_start_, analog_input_end_,
        nlohmann::json::array({taskOption("stream", "Stream", "ain", "input", suggest_analog_inputs_)}));
    const auto digital_input_group = suggestionGroup(
        "digital_inputs", "Digital inputs", "digital", "dio", digital_io_start_, digital_io_end_,
        nlohmann::json::array({taskOption("stream", "Stream", "dio", "input", false)}));
    const auto digital_output_group = suggestionGroup(
        "digital_outputs", "Digital outputs", "digital", "dio_command", digital_io_start_, digital_io_end_,
        nlohmann::json::array({taskOption("digital_write", "Digital write", "dio_command", "output", false)}));

    const std::string endpoint_host = ip.empty() ? connection : ip;
    nlohmann::json discovery_request;
    try {
        discovery_request = api_->requestInterfaceUi("dartwic.module-discovery", {
        {"discovery_id", discovery_id}, {"device_type", "labjack_t7"},
        {"display_name", "LabJack T7 · " + identifier},
        {"endpoint", {{"host", endpoint_host}, {"port", ip.empty() ? 1 : LJM_TCP_PORT}, {"unit_id", serial_number}}},
        {"metadata", {
            {"protocol", "LabJack LJM"}, {"serial_number", serial_number},
            {"connection_type", connection}, {"ip_address", ip}, {"device_type_code", device_type}
        }},
        {"channels", channels},
        {"provisioning", {
            {"module_type", "labjack_t7"}, {"suggested_instance_name", instance_name},
            {"parameters", {{"device_type", "T7"}, {"connection_type", connection}, {"identifier", identifier}}},
            {"module_identity", {{"parameter_keys", nlohmann::json::array({"device_type", "identifier"})}}},
            {"channel_suggestion_editor", {
                {"kind", "address_ranges"}, {"maximum_channels", 128},
                {"groups", nlohmann::json::array({analog_group, digital_input_group, digital_output_group})},
                {"tasks", nlohmann::json::array({
                    {{"id", "stream"}, {"label", "Stream"}, {"name_suffix", "_stream"},
                        {"task_type", "stream"}, {"argument_key", "mappings"}},
                    {{"id", "digital_write"}, {"label", "Digital write"}, {"name_suffix", "_write"},
                        {"task_type", "digital_write"}, {"argument_key", "mappings"}}
                })}
            }},
            {"tasks", std::move(tasks)}
        }}
    }, {
        {"request_key", discovery_id},
        {"merge_key", "module-discovery"},
        {"reopen_completed", true}
        });
    } catch (const std::exception& error) {
        throw std::runtime_error(std::string("Unable to open the discovery interface request: ") + error.what());
    }
    if (!discovery_request.is_object()) {
        throw std::runtime_error("The interface request broker returned an invalid discovery response.");
    }
    const std::string request_id = discovery_request.value("request_id", "");
    if (request_id.empty()) {
        throw std::runtime_error("The interface request broker did not return a request ID.");
    }
    request_ids_[discovery_id] = request_id;
    announced_ids_.insert(discovery_id);
}

std::shared_ptr<LabJackT7DeviceFinder> createLabJackT7DeviceFinder(
    DARTWIC::API::SDK_API* api,
    const nlohmann::json& plugin_config) {
    return std::make_shared<LabJackT7DeviceFinder>(api, plugin_config);
}
