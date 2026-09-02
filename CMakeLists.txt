cmake_minimum_required(VERSION 3.30)
project(labjack_t7)

include(CTest)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

if(MSVC)
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /Zi")
    set(CMAKE_SHARED_LINKER_FLAGS_RELEASE "${CMAKE_SHARED_LINKER_FLAGS_RELEASE} /DEBUG")
endif()

set(ENGINE_DIR "${PROJECT_SOURCE_DIR}/engine")
set(PLUGIN_MANIFEST_FILE "${PROJECT_SOURCE_DIR}/plugin.json")
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${PLUGIN_MANIFEST_FILE}")

file(READ "${PLUGIN_MANIFEST_FILE}" PLUGIN_MANIFEST_JSON)
string(JSON ENGINE_PLUGIN_ID GET "${PLUGIN_MANIFEST_JSON}" id)
string(JSON MIN_ENGINE_VERSION GET "${PLUGIN_MANIFEST_JSON}" minEngineVersion)
string(JSON CONTAINS_ENGINE_PLUGIN GET "${PLUGIN_MANIFEST_JSON}" contains_engine_plugin)
if("${MIN_ENGINE_VERSION}" STREQUAL "")
    message(FATAL_ERROR "plugin.json must set minEngineVersion.")
endif()
if(NOT CONTAINS_ENGINE_PLUGIN)
    message(FATAL_ERROR "plugin.json must set contains_engine_plugin to true.")
endif()

string(TOLOWER "${CMAKE_BUILD_TYPE}" NORMALIZED_BUILD_TYPE)
set(ENGINE_PLUGIN_VARIANT "engine")
if(NORMALIZED_BUILD_TYPE STREQUAL "debug")
    set(ENGINE_PLUGIN_VARIANT "engine-debug")
endif()
set(ENGINE_PLUGIN_DIR "${PROJECT_SOURCE_DIR}/plugin/${ENGINE_PLUGIN_VARIANT}/${ENGINE_PLUGIN_ID}")

file(GLOB_RECURSE LABJACK_ENGINE_SOURCES "${ENGINE_DIR}/src/*.cpp")
add_library(labjack_t7_engine SHARED ${LABJACK_ENGINE_SOURCES})

file(GLOB ENGINE_INCLUDE_DIRS CONFIGURE_DEPENDS LIST_DIRECTORIES true "${ENGINE_DIR}/include/*")
target_include_directories(labjack_t7_engine PRIVATE
    "${ENGINE_DIR}/include"
    "${ENGINE_DIR}/libs/concurrent_queue"
    "${ENGINE_DIR}/libs/LabJack/Drivers"
    ${ENGINE_INCLUDE_DIRS})

find_package(nlohmann_json CONFIG REQUIRED)
target_link_libraries(labjack_t7_engine PRIVATE
    nlohmann_json::nlohmann_json
    "${ENGINE_DIR}/libs/LabJack/Drivers/64bit/LabJackM.lib")

set_target_properties(labjack_t7_engine PROPERTIES
    OUTPUT_NAME "${ENGINE_PLUGIN_ID}"
    RUNTIME_OUTPUT_DIRECTORY "${ENGINE_PLUGIN_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${ENGINE_PLUGIN_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${ENGINE_PLUGIN_DIR}/bin"
    LIBRARY_OUTPUT_DIRECTORY "${ENGINE_PLUGIN_DIR}/bin"
    LIBRARY_OUTPUT_DIRECTORY_DEBUG "${ENGINE_PLUGIN_DIR}/bin"
    LIBRARY_OUTPUT_DIRECTORY_RELEASE "${ENGINE_PLUGIN_DIR}/bin"
    PDB_OUTPUT_DIRECTORY "${ENGINE_PLUGIN_DIR}/bin"
    PDB_OUTPUT_DIRECTORY_DEBUG "${ENGINE_PLUGIN_DIR}/bin"
    PDB_OUTPUT_DIRECTORY_RELEASE "${ENGINE_PLUGIN_DIR}/bin")

set(ENGINE_PLUGIN_COPY_COMMANDS
    COMMAND ${CMAKE_COMMAND} -E make_directory "${ENGINE_PLUGIN_DIR}"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${PLUGIN_MANIFEST_FILE}" "${ENGINE_PLUGIN_DIR}/plugin.json"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${ENGINE_DIR}/src/module_config.json" "${ENGINE_PLUGIN_DIR}/module_config.json"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${ENGINE_DIR}/src/default_parameters.json" "${ENGINE_PLUGIN_DIR}/default_parameters.json")

add_custom_target(labjack_t7 ALL
    ${ENGINE_PLUGIN_COPY_COMMANDS}
    DEPENDS labjack_t7_engine
    COMMENT "Copying LabJack T7 engine plugin files")
add_custom_target(copy_engine_plugin DEPENDS labjack_t7)

message(STATUS "LabJack engine plugin dir: ${ENGINE_PLUGIN_DIR}")
message(STATUS "LabJack engine plugin variant: ${ENGINE_PLUGIN_VARIANT}")
message(STATUS "Using the bundled Engine SDK snapshot from engine/include/sdk.")
