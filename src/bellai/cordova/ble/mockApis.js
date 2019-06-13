var Cmd = {
  Priority: {
    HIGH: 9999,
    LOW: 1,
  }
}
var BleApis = {
  init: function (success, fail) {
    if (success) success();
  },

  scan: function (start, end) {
    if (start) start();
    setTimeout(function () {
      if (end) end([
        { color: 'green', name: 'Mock1', address: 'A', rssi: -1 },
        { color: 'red', name: 'Mock2', address: 'B', rssi: -2 },
        { color: 'blue', name: 'Mock3', address: 'C', rssi: -3 }
      ]);
    }, 2000);
  },

  scanPlus: function (start, end) {
    this.scan(start, end);
  },

  isConnected: function () {
    return this.connected;
  },

  connected: false,
  connect: function (address, success, fail) {
    var that = this;
    setTimeout(function () {
      that.connected = true;
      if (success) success();
    }, 2000);
  },

  disconnect: function (cb) {
    this.connected = false;
    if (cb) cb();
  },

  setProfile: function (name, color, success, fail) {
    if (success) success();
  },

  getProfile: function (cb) {
    if (cb) cb('cyan', 'MockNew');
  },

  mabotInit: function (success, fail) {
    if (success) success();
  },

  driverMotion: function () { },
  sensorMotion: function () { },
  joinMotion: function () { },
  startPollBattery: function () { },
  stopPollBattery: function () { },
  emotion: function () { },
  masterControlLight: function () { },
  driverLight: function () { },
  lightTogether: function () { },
  stopLua: function () { },
  fileTransfer: function (arg0, arg1, arg2) {
    setTimeout(function () {
      if (arg2) arg2(-1);
    }, 2000); // 永远失败
  },
  getConnectedDeviceColor: function () { return cc.bell.lightColor.white; },
  registerConnectNotify: function () { },
  unregisterConnectNotify: function () { },
  registerDisconnectNotify: function () { },
  registerDisconnectNotifyWithConnectIcon: function () { },
  registerDisconnectWithoutNotify: function () { },
  unregisterDisconnectNotify: function () { },
  startPollBallsList: function () { },
  stopPollBallsList: function () { },
  startDebugMasterControl: function () { },
  startDebugBattery: function () { },
  startDebugDriver: function () { },
  startDebugInfrared: function () { },
  startDebugColor: function () { },
  stopDebugBall: function () { },
  testDriver: function () { },
  driverPolarity: function () { },
  sendDebugMakeABlinkForDriver: function () { },
  startDebugWaistJoin: function () { },
  startDebugArmJoin: function () { },
  startDebugTouchSensor: function () { },
  setWaistJoinAngle: function (sequence, angle) {
    console.log('setWaistJoinAngle: ' + sequence + ' ' + angle);
  },
  setArmJoinAngle: function (sequence, angle) {
    console.log('setArmJoinAngle: ' + sequence + ' ' + angle);
  },
  getDriverPolarity: function () { },
  driverReset: function () { },
  driverMotionPlus: function () { },
  joinMotionPlus: function (x, y) {
    x = cc.bell.jointMap ? (cc.bell.jointMap.w1 === 1 ? x : -x) : x;
    y = cc.bell.jointMap ? (cc.bell.jointMap.a1 === 1 ? y : -y) : y;
    console.log('x= ' + x + ' y= ' + y);
  },
  makeABlinkWhenMapping: function () {
    console.log('makeABlinkWhenMapping');
  },
  makeARotateWhenMappingWaist: function () {
    console.log('makeARotateWhenMappingWaist');
  },
  makeARotateWhenMappingArm: function () {
    console.log('makeARotateWhenMappingArm');
  },
  lightUpOrDownDriversWhenMapping: function () {
    console.log('lightUpOrDownDriversWhenMapping');
  },
  cockPeckHitWithMapping: function (sequence, reverse) {
    console.log('cockPeckHitWithMapping: ' + sequence, reverse);
    var reverseCoefficient = reverse ? -1 : 1;
    var that = this;
    var beltaAngle = 50; // 50度 ~= 0.5s
    var BELTA_MS = 500;
    if (sequence === 1) beltaAngle *= cc.bell.jointMap ? (cc.bell.jointMap.a1 === 1 ? 1 : -1) : 1;
    else if (sequence === 2) beltaAngle *= cc.bell.jointMap ? (cc.bell.jointMap.a2 === 1 ? 1 : -1) : 1
    this.setArmJoinAngle(sequence, 90 + reverseCoefficient * beltaAngle);
    setTimeout(function () {
      that.setArmJoinAngle(sequence, 90);
    }, BELTA_MS);
  },
  driverMotionOrangUtan: function (v1, v2) { console.log(v1, v2); },
  jointMotionOrangUtan: function () { },
  jointMotionM: function () { },
  driverMotionDropdownSwingBalance: function () { },
  onlineDriverCount: 2,
  getConnectedDeviceNameAndColor: function () {
    return {
      name: 'Mabot',
      color: cc.bell.lightColor.white
    };
  },
  stopScanPlus: function () { },
  registerDisconnectListener: function () { },
  unregisterDisconnectListener: function () { },
};
var BellAudioManager = {
  AUDIO_BLE_CONNECT: 'ble_connect',
  AUDIO_BLE_DISCONNECT: 'ble_disconnect',
  AUDIO_RUN: 'run',
  AUDIO_TAP: 'tap',

  playAudio: function (audio) {
    // var a = new Audio('../blockly/media/' + audio + '.mp3');
    // a.play();
    console.log('../../blockly/media/' + audio + '.mp3');
  },

  playAudioConnect: function () {
    this.playAudio(this.AUDIO_BLE_CONNECT);
  },

  playAudioDisconnect: function () {
    this.playAudio(this.AUDIO_BLE_DISCONNECT);
  },

  playAudioRun: function () {
    this.playAudio(this.AUDIO_RUN);
  },

  playAudioTap: function () {
    this.playAudio(this.AUDIO_TAP);
  },
};
