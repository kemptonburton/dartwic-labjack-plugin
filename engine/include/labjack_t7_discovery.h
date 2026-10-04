#pragma once

#include <sdk/sdk_api.h>

#include <chrono>
#include <future>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <string>
#include <unordered_map>
#include <unordered_set>

class LabJackT7DeviceFinder {
public:
    LabJackT7DeviceFinder(DARTWIC::API::SDK_API* api, const nlohmann::json& plugin_config);

    void tick();
    nlohmann::json settings() const;
    nlohmann::json scanNow();

private:
    void startScanLocked();
    void collectScanLocked();
    void announce(int device_type, int connection_type, int serial_number, const std::string& ip_address);
    void reconcileAnnouncements();
    bool hasConfiguredModule(int serial_number) const;
    bool isDiscoveryMuted(const std::string& discovery_id) const;

    DARTWIC::API::SDK_API* api_{};
    bool enabled_{true};
    bool suggest_analog_inputs_{true};
    int analog_input_start_{0};
    int analog_input_end_{13};
    int digital_io_start_{0};
    int digital_io_end_{22};
    std::chrono::seconds scan_interval_{3};
    std::chrono::steady_clock::time_point next_scan_{};
    std::future<nlohmann::json> scan_future_;
    bool scan_in_progress_{false};
    nlohmann::json last_devices_ = nlohmann::json::array();
    std::string last_error_;
    std::unordered_set<std::string> announced_ids_;
    std::unordered_map<std::string, std::string> request_ids_;
    std::unordered_map<std::string, bool> last_mute_states_;
    mutable std::mutex mutex_;
};

std::shared_ptr<LabJackT7DeviceFinder> createLabJackT7DeviceFinder(
    DARTWIC::API::SDK_API* api,
    const nlohmann::json& plugin_config);
