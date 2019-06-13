/*
 BLE protocol for mabot

 // 1.get profile for a mabot ( specified name, color for the master control, etc.)
 // 2.set profile for a mabot ( name, color)
 // 3.get the firmware version for a mabot
 // 4.prepare for firmware upgrading
 // 5.init--- @deprecated  no use
 // 6.motion
 // 7.emotions (happy, surprise, glad)
 // 8.light (module[ master control, drivers], mode[ off, on, blink, breath], color[ red, green, yellow, blue, purple, cyan, orange, white])
 // 9.online balls retrieve
 // 10.debugging battery
 // 11.debugging driver
 // 12.debugging infrared
 // 13.debugging color sensor
 // 14.debugging master controller
 // 15.testing driver
 // 16.lua context / ble context
 // 17.single driver light cmd
 // 18.polarity for a single driver

 // 19.file transfer start
 // 20.file transfer data frame
 // 21.file transfer end

 // 22.debug waist joins
 // 23.debug arm joins
 // 24.debug touch sensor
 // 25.set waist join angle
 // 26.set arm join angle
 // 27.get the single driver polarity
 // 28.reset single driver data

 // 29.batch motor
 // 30.batch waist
 // 31.batch arm

 // 32.beep
 // 33.is lua running?
 // 34.batch color fetch with specific mode
 // 35.batch infrared distance
 // 36.batch touch states

 // 37.batch waist fetch
 // 38.batch arm fetch
 // 39.batch battery fetch
 // 40.batch driver fetch

 // 41.lua runtime cmd
 */
var Cmd = {
    Priority: {
      HIGH: 9999,
      LOW: 1,
    },
    CMD_RAW: 0x00,
    CMD_GET_PROFILE: 0x01,
    CMD_SET_PROFILE: 0x02,
    CMD_GET_FIRMWARE_VERSION: 0x03,
    CMD_FIRMWARE_UPGRADE_PREPARE: 0x04,
    CMD_INIT: 0x05,
    CMD_MOTION: 0x06,
    CMD_EMOTIONS: 0x07,
    CMD_LIGHT: 0x08,
    CMD_ONLINE_BALLS: 0x09,
    CMD_DEBUG_BATTERY: 0x0a,
    CMD_DEBUG_DRIVER: 0x0b,
    CMD_DEBUG_INFRARED: 0x0c,
    CMD_DEBUG_COLOR: 0x0d,
    CMD_DEBUG_MASTER_CONTROL: 0x0e,
    CMD_DEBUG_TEST_DRIVER: 0x0f,
    CMD_ENV_SWITCH_TO_LUA: 0x10,
    CMD_ENV_SWITCH_TO_BLE: 0x11,
    CMD_SINGLE_DRIVER_LIGHT: 0x12,
    CMD_SINGLE_DRIVER_POLARITY: 0x13,
    CMD_FILE_TRANSFER_START: 0x14,
    CMD_FILE_TRANSFER_DATA: 0x15,
    CMD_FILE_TRANSFER_END: 0x16,

    CMD_DEBUG_WAIST_JOIN: 0x17,
    CMD_DEBUG_ARM_JOIN: 0x18,
    CMD_DEBUG_TOUCH_SENSOR: 0x19,
    CMD_SET_WAIST_JOIN_ANGLE: 0x1a,
    CMD_SET_ARM_JOIN_ANGLE: 0x1b,
    CMD_SINGLE_DRIVER_POLARITY_FETCH: 0x1c,
    CMD_SINGLE_DRIVER_RESET: 0x1d,

    CMD_BATCH_DRIVER_MOTION: 0x1e,
    CMD_BATCH_WAIST_MOTION: 0x1f,
    CMD_BATCH_ARM_MOTION: 0x20,

    CMD_BEEP: 0x21,
    CMD_IS_LUA_RUNNING: 0x22,

    CMD_BATCH_COLOR_FETCH: 0x23,
    CMD_BATCH_INFRARED_FETCH: 0x24,
    CMD_BATCH_TOUCH_FETCH: 0x25,

    CMD_BATCH_WAIST_FETCH: 0x26,
    CMD_BATCH_ARM_FETCH: 0x27,
    CMD_BATCH_BATTERY_FETCH: 0x28,
    CMD_BATCH_DRIVER_FETCH: 0x29,

    CMD_LUA_RUNTIME_PIPE: 0x2a,
};
