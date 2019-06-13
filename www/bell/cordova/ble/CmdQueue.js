// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.slice
if (!Uint8Array.prototype.slice) {
  Object.defineProperty(Uint8Array.prototype, 'slice', {
    value: Array.prototype.slice
  });
}
var GbkWrapper = {
    encode (gbkString) {
        var arr = [];
        for (var i = 0; i < gbkString.length; i++) {
            var result = gbk.encode(gbkString[i]);
            var length = result.length;
            switch (length) {
                case 1:
                    var c = result.charCodeAt(0).toString(16);
                    arr.push(Number("0x" + c));
                    break;
                case 3:
                    arr.push(Number("0x" + result.replace(/%/, '')));
                    break;
                case 6:
                    var tmp = result.replace(/%/, '').split('%');
                    var newArr = tmp.map(function (item) {
                        return Number("0x" + item);
                    });
                    arr.push(...newArr);
                    break;
            }
        }
        return arr;
    },

    decode (bytesArray) {
        if (bytesArray && bytesArray.length > 0) {
            var hexString = '';
            var resultString = '';
            for (var i=0; i<bytesArray.length; i++) {
                if (this.isAscii(bytesArray[i])) {
                    if (hexString.length > 0) {
                        resultString += gbk.decode(hexString); // 结算之前汉字
                    }
                    hexString = '';
                    resultString += String.fromCharCode(bytesArray[i]);
                } else {
                    hexString += '%' + bytesArray[i].toString(16).toUpperCase();
                    if (bytesArray.length - 1 == i) {
                        resultString += gbk.decode(hexString); // 汉字在最后，直接结算
                        hexString = '';
                    }
                }
            }
            return resultString;
        }
    },

    // copy from gbk.js
    isAscii (unicode) {
        return ((unicode == 0x20AC) || (unicode <= 0x007F && unicode >= 0x0000));
    }
}

var INTERVAL_MS = 50; // 50ms
var _cmdQueue = [];
var _lowerCmdQueue = [];
var LOWER_QUEUE_SIZE_LIMIT = 1;
var _debug = Constants.DEBUG; // for debugging
var _looper = null;
var _device = null; // should be initialized when device connected
var gbkWrapper = GbkWrapper;
var _receiveCallback = null; // should be initialized when you can receive all the data from ble of device
var RESPONSE = 'noResponse';
var NO_RESPONSE = 'noResponse';
var startIndicator = false;
var _transferCallback = null; // for lua/firmware download
var _isWritting = false;
var _isDownloading = false; // indicator for file transferring

var CmdQueue = {
    // NOTE: only for testing
    testSomething () {
        //1.测试gbk.js
        console.log(gbk.encode('a中b国c人d!！'));
        console.log(gbk.decode(gbk.encode('a中b国c人d!！')));

        //2.测试gbk wrapper
        this.gbk = GbkWrapper;
        var afterEncoded = this.gbk.encode('a中b国c人d!！');
        console.log(afterEncoded);
        var afterDecoded = this.gbk.decode(afterEncoded);
        console.log(afterDecoded);
    },

    loop () {
        this.quit();
        _looper = setInterval(this.popCmd, INTERVAL_MS);
    },

    quit () {
        if (_looper) clearInterval(_looper);
        this.clear();
    },

    clear () {
      _cmdQueue = [];
      _lowerCmdQueue = [];

      startIndicator = false;
      _isWritting = false;
      _isDownloading = false;
    },

    popCmd () {
        if (_debug) console.log('popCmd() ');
        if (!_device) return; // no device connected
        if (_isWritting) return;

        // 次级队列将在高级队列有元素时清空
        if (_cmdQueue.length > 0 && _lowerCmdQueue.length !== 0) _lowerCmdQueue = [];
        // 指令优先考虑高级队列，当高级队列中没有待发指令，将从次级队列中拿
        var command = _cmdQueue.shift() || _lowerCmdQueue.shift();
        if (command) {
            var cmd = command.cmd;
            if (typeof cmd === 'undefined') return; // invalid cmd
            var timestamp = command.timestamp;
            var now = new Date().getTime();
            var delay = now - timestamp;
            if (_debug) console.log('cmd delayed: ' + delay + ' ms.');

            var frame = [];
            var data = command.data;

            var response = RESPONSE; // response by default
            switch (cmd) {
                case Cmd.CMD_RAW: {
                    frame = frame.concat(data); // data should be a bytes array
                }
                    break;
                case Cmd.CMD_GET_PROFILE: {
                    frame.push(0xfb); // start
                    frame.push(0x02); // command
                    concatCrc(frame); // crc
                }
                    break;
                case Cmd.CMD_SET_PROFILE: {
                    frame.push(0xfb); // start
                    frame.push(0x03); // command
                    data.color = Math.min(0x08, Math.max(0x01, data.color));
                    frame.push(data.color); // color
                    var nameArray = gbkWrapper.encode(data.name);
                    frame.push(nameArray.length); // name bytes length
                    frame = frame.concat(nameArray); // name
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_GET_FIRMWARE_VERSION: {
                    frame.push(0xff);
                    frame.push(0xee);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_FIRMWARE_UPGRADE_PREPARE: {
                    frame.push(0xff);
                    frame.push(0x0e);
                    frame = frame.concat(intTo2Bytes(data.version)); // version
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_INIT: {
                    frame.push(0xfb);
                    frame.push(0x01);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_MOTION: {
                    response = NO_RESPONSE;
                    frame.push(0xb0);
                    frame.push(0xc0);
                    // speed [0-100]
                    data.speed = Math.min(100, Math.max(0, data.speed));
                    frame.push(data.speed);
                    // x [-100, 100]
                    data.x = Math.min(100, Math.max(-100, data.x));
                    frame.push(data.x);
                    // y [-100, 100]
                    data.y = Math.min(100, Math.max(-100, data.y));
                    frame.push(data.y);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_EMOTIONS: {
                    response = NO_RESPONSE;
                    frame.push(0xb0);
                    frame.push(0xac);
                    // action [happy, surprise, glad]
                    data.emotion = Math.min(0x03, Math.max(0x01, data.emotion));
                    frame.push(data.emotion);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_LIGHT: {
                    response = NO_RESPONSE;
                    frame.push(0xb0);
                    frame.push(0xed);
                    // module: [master controller, driver, master controller && driver]~ [1, 2, 3]
                    data.module = Math.min(0x03, Math.max(0x01, data.module));
                    frame.push(data.module);
                    // mode: [off, on, blink, breath]~ [1, 2, 3, 4]
                    data.mode = Math.min(0x04, Math.max(0x01, data.mode));
                    frame.push(data.mode);
                    // color [red, green, yellow, blue, purple, cyan, orange, white]~ [1, 2, 3, 4, 5, 6, 7, 8]
                    data.color = Math.min(0x08, Math.max(0x01, data.color));
                    frame.push(data.color);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_ONLINE_BALLS: {
                    frame.push(0xb0);
                    frame.push(0x00);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_BATTERY: {
                    frame.push(0xb0);
                    frame.push(0x01);
                    // battery sequence number: [1-15]
                    data.sequence = Math.min(0xff, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_DRIVER: {
                    frame.push(0xb0);
                    frame.push(0x02);
                    // driver sequence number: [1-15]
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_INFRARED: {
                    frame.push(0xb0);
                    frame.push(0x04);
                    // infrared sequence number: [1-15]
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_COLOR: {
                    frame.push(0xb0);
                    frame.push(0x03);
                    // color sequence number: [1-15]
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    // mode [1-3]
                    data.mode = Math.min(0x0f, Math.max(0x01, data.mode));
                    frame.push(data.mode);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_MASTER_CONTROL: {
                    frame.push(0xb0);
                    frame.push(0x10);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_TEST_DRIVER: {
                    frame.push(0xb1);
                    frame.push(0x02);
                    // driver sequence number: [1-15]
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    // power [-100-100]
                    data.power = Math.min(100, Math.max(-100, data.power));
                    frame.push(data.power);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_ENV_SWITCH_TO_LUA: {
                    frame.push(0xc0);
                    frame.push(0x04);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_ENV_SWITCH_TO_BLE: {
                    frame.push(0xc0);
                    frame.push(0x05);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_SINGLE_DRIVER_LIGHT: {
                    response = NO_RESPONSE; // no response
                    frame.push(0xb1);
                    frame.push(0xed);
                    // driver sequence number: [1-15]
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    // mode
                    data.mode = Math.min(0x04, Math.max(0x01, data.mode));
                    frame.push(data.mode);
                    // color
                    data.color = Math.min(0x08, Math.max(0x01, data.color));
                    frame.push(data.color);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_SINGLE_DRIVER_POLARITY: {
                    frame.push(0xb2);
                    frame.push(0x02);
                    // driver sequence number: [1-15]
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    // polarity 0-clockwise, 1-anticlockwise
                    data.polarity = Math.min(0x01, Math.max(0x00, data.polarity));
                    frame.push(data.polarity);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_FILE_TRANSFER_START: {
                    frame.push(0x30);
                    frame.push(0x61);
                    frame = frame.concat(intTo2Bytes(data.chunkCount));
                    frame = frame.concat(intTo4Bytes(data.dataLength));
                    concatCrc(frame);
                    startIndicator = true; //NOTE: indicator that file transfer started
                    _isDownloading = true;
                }
                    break;
                case Cmd.CMD_FILE_TRANSFER_DATA: {
                    frame.push(0x42);
                    frame.push(0x4c);
                    frame = frame.concat(intTo4Bytes(data.chunkSize + 2)); // chunk size + 2(sequence number)
                    frame = frame.concat(intTo2Bytes(data.seqNumber));
                    frame = frame.concat(data.rawData);
                    concatCrc(frame);
                    if (_debug) console.error('rawData length: ' + data.rawData.length + ' chunkSize: ' + data.chunkSize + ' seqNumber: ' + data.seqNumber);
                }
                    break;
                case Cmd.CMD_FILE_TRANSFER_END: {
                    frame.push(0x4e);
                    frame.push(0x52);
                    frame = frame.concat(intTo2Bytes(data.totalChunk));
                    frame = frame.concat(intTo4Bytes(data.totalLength));
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_WAIST_JOIN: {
                    frame.push(0xb4);
                    frame.push(0x02);
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_ARM_JOIN: {
                    frame.push(0xb5);
                    frame.push(0x02);
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_DEBUG_TOUCH_SENSOR: {
                    frame.push(0xb8);
                    frame.push(0x02);
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_SET_WAIST_JOIN_ANGLE: {
                    frame.push(0xb6);
                    frame.push(0x02);
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    frame.push(Math.min(180, Math.max(0, data.angle)));
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_SET_ARM_JOIN_ANGLE: {
                    frame.push(0xb7);
                    frame.push(0x02);
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    frame.push(Math.min(180, Math.max(0, data.angle)));
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_SINGLE_DRIVER_POLARITY_FETCH: {
                    frame.push(0xb3);
                    frame.push(0x02);
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_SINGLE_DRIVER_RESET: {
                    frame.push(0xb9);
                    frame.push(0x02);
                    data.sequence = Math.min(0x0f, Math.max(0x01, data.sequence));
                    frame.push(data.sequence);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_DRIVER_MOTION: {
                    frame.push(0x01);
                    frame.push(0x06);
                    frame = frame.concat(data.powers);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_ARM_MOTION: {
                    frame.push(0x02);
                    frame.push(0x06);
                    frame = frame.concat(data.angles);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_WAIST_MOTION: {
                    frame.push(0x03);
                    frame.push(0x06);
                    frame = frame.concat(data.angles);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BEEP: {
                    frame.push(0x04);
                    frame.push(0x06);
                    frame = frame.concat(data.beep);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_IS_LUA_RUNNING: {
                    frame.push(0x05);
                    frame.push(0x06);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_COLOR_FETCH: {
                    frame.push(0x06);
                    frame.push(0x06);
                    data.mode = Math.min(0x03, Math.max(0x01, data.mode));
                    frame = frame.concat(data.mode); // 0x01 for environment 0x02 for reflection 0x03 for recognization
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_INFRARED_FETCH: {
                    frame.push(0x07);
                    frame.push(0x06);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_TOUCH_FETCH: {
                    frame.push(0x08);
                    frame.push(0x06);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_WAIST_FETCH: {
                    frame.push(0x09);
                    frame.push(0x06);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_ARM_FETCH: {
                    frame.push(0x0a);
                    frame.push(0x06);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_BATTERY_FETCH: {
                    frame.push(0x0b);
                    frame.push(0x06);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_BATCH_DRIVER_FETCH: {
                    frame.push(0x0c);
                    frame.push(0x06);
                    concatCrc(frame);
                }
                    break;
                case Cmd.CMD_LUA_RUNTIME_PIPE: {
                    frame.push(0x0d)
                    frame.push(0x06)
                    if (data.length !== 4) throw new Error('data error: ' + data)
                    frame = frame.concat(data) // data is 4 byte array
                    concatCrc(frame)
                }
                    break;
                //....
                default:
                    console.error('Unknown cmd(ignored): ' + cmd);
                    return;
            }
            if (frame.length > 0) {
                if (_debug) console.log('cmd prepare cost: ' + (new Date().getTime() - now) + ' ms.');
                now = new Date().getTime();
                _isWritting = true;
                var TOTAL_SIZE = frame.length;
                var PACKET_SIZE = 20;
                var packetCount = parseInt(TOTAL_SIZE / PACKET_SIZE) +
                    ((Math.round(TOTAL_SIZE % PACKET_SIZE) === 0 ? 0 : 1));
                var currentPacket = 0;
                if (_debug) console.log('cmd slice into ' + packetCount + ' packet(s).');

                var frameData = new Uint8Array(frame);
                var params = {
                    'address': _device.address,
                    'service': Constants.SERVICE_UUID,
                    'characteristic': Constants.CHARACTERISTIC_UUID,
                    //'value': bluetoothle.bytesToEncodedString(frameData),// Base64 encoded string
                    'type': response // 'noResponse/response'
                };
                var failed = function (err) {
                    if (_debug) console.log('write failed : ' + JSON.stringify(err));
                    _isWritting = false;
                };
                var success = function (res) {
                    currentPacket++;
                    if (currentPacket < packetCount) {
                        // 最后包
                        if (currentPacket == packetCount - 1) {
                            var d = frameData.slice(PACKET_SIZE * currentPacket, TOTAL_SIZE);
                            params.value = bluetoothle.bytesToEncodedString(d);
                            if (_debug) console.log('第' + (currentPacket + 1) + '个包: 长度=' + d.length + ' ' + d);
                            params.type = response;
                        // 中间包
                        } else {
                            var d = frameData.slice(PACKET_SIZE * currentPacket, PACKET_SIZE * (currentPacket + 1));
                            params.value = bluetoothle.bytesToEncodedString(d);
                            if (_debug) console.log('第' + (currentPacket + 1) + '个包: 长度=' + d.length + ' ' + d);
                            params.type = NO_RESPONSE;
                        }
                        bluetoothle.write(success, failed, params);
                    } else {
                        if (_debug) console.log('write success: ' + JSON.stringify(res));
                        _isWritting = false;
                        if (_debug) console.log('cmd writting cost: ' + (new Date().getTime() - now) + ' ms.');
                    }
                };
                // 不足20字节的包直接发送就完事
                if (TOTAL_SIZE <= PACKET_SIZE) {
                    var d = frameData.slice(0, TOTAL_SIZE);
                    params.value = bluetoothle.bytesToEncodedString(d);
                    if (_debug) console.log('第1个包: 长度=' + d.length + ' ' + d);
                // 大于20字节,先发前20字节
                } else {
                    var d = frameData.slice(0, PACKET_SIZE);
                    params.value = bluetoothle.bytesToEncodedString(d);
                    if (_debug) console.log('第1个包: 长度=' + d.length + ' ' + d);
                    params.type = NO_RESPONSE;
                }
                bluetoothle.write(success, failed, params);
            }
        }
    },

    bindDevice (device) {
        _device = device;
    },

    unbindDevice () {
        _device = null;
    },

    bindCallback (cb) {
        _receiveCallback = cb;
    },

    unbindCallback () {
        _receiveCallback = null;
    },

    bindTransferCallback (cb) {
        _transferCallback = cb;
    },

    unbindTransferCallback () {
        _transferCallback = null;
    },

    release (callback) {
      this.quit();
      if (!_device) return;
      var params = {
          'address': _device.address,
          'service': Constants.SERVICE_UUID,
          'characteristic': Constants.CHARACTERISTIC_UUID
      };
      bluetoothle.unsubscribe(function (res) {
          if (_debug) console.log('unsubscribe success: ' + JSON.stringify(res));
          if (res && res.status === 'unsubscribed') {
            var params = {
              'address': _device.address
            };
            bluetoothle.disconnect(function (res) {
                if (_debug) console.log('disconnect success: ' + JSON.stringify(res));
                if (res && res.status === 'disconnected') {
                  bluetoothle.close(function (res) {
                    if (_debug) console.log('close success: ' + JSON.stringify(res));
                    if (res && res.status === 'closed') {
                      if (callback) callback();
                    }
                  }, function (err) {
                    if (_debug) console.log('close fail: ' + JSON.stringify(err));
                  }, params);
                }
            }, function (err) {
                if (_debug) console.log('disconnect fail   : ' + JSON.stringify(err));
            }, params);
          }
      }, function (err) {
          if (_debug) console.log('unsubscribe fail   : ' + JSON.stringify(err));
      }, params);
    },

    subscribe (callback) {
        if (!_device) return;
        var params = {
            'address': _device.address,
            'service': Constants.SERVICE_UUID,
            'characteristic': Constants.CHARACTERISTIC_UUID
        };
        bluetoothle.subscribe(function (res) {
            if (_debug) console.log('subscribe success: ' +  JSON.stringify(res));
            if (res && res.status === 'subscribedResult' && res.value) {
                var frame = Array.from(bluetoothle.encodedStringToBytes(res.value));
                if (!frame || frame.length < 2) {
                    console.error('Error data received: ' + frame);
                    return;
                }
                console.warn('Origin Received: ' + frame);
                if (CmdBuffer.D) {
                  var one = frame.slice(0, 2);
                  var two = frame.slice(2, frame.length);
                  CmdBuffer.check(one);
                  frame = CmdBuffer.check(two);
                } else {
                  frame = CmdBuffer.check(frame);
                }
                if (!frame) {
                  return;
                }
                var start = frame[0];
                var command = frame[1];
                var dataArray = Array.prototype.slice.call(frame, 0);
                if (!crcCheck(dataArray)) {
                    console.error('Error data crc: ' + frame);
                    return;
                }
                console.log('Received: ' + dataArray);
                // init
                // @deprecated
                if (start === 0xfb && command === 0x01) {
                    parseInit(dataArray);
                // get profile
                } else if (start === 0xfb && command === 0x02) {
                    parseGetProfile(dataArray);
                // set profile
                } else if (start === 0xfb && command === 0x03) {
                    parseSetProfile(dataArray);
                // get firmware version
                } else if (start === 0xff && command === 0xee) {
                    parseGetFirmwareVersion(dataArray);
                // firmware upgrade prepare
                } else if (start === 0xff && command === 0x0e) {
                    parseFirmwareUpgradePrepare(dataArray);
                // motion
                } else if (start === 0xb0 && command === 0xc0) {
                    // no response
                // emotions
                } else if (start === 0xb0 && command === 0xac) {
                    // no response
                // light
                } else if (start === 0xb0 && command === 0xed) {
                    // no response
                // online balls
                } else if (start === 0xb0 && command === 0x00) {
                    parseOnlineBalls(dataArray);
                // debug battery
                } else if (start === 0xb0 && command === 0x01) {
                    parseDebugBattery(dataArray);
                // debug driver
                } else if (start === 0xb0 && command === 0x02) {
                    parseDebugDriver(dataArray);
                // debug color
                } else if (start === 0xb0 && command === 0x03) {
                    parseDebugColor(dataArray);
                // debug infrared
                } else if (start === 0xb0 && command === 0x04) {
                    parseDebugInfrared(dataArray);
                // debug master controller
                } else if (start === 0xb0 && command === 0x10) {
                    parseDebugMasterControl(dataArray);
                // test driver
                } else if (start === 0xb1 && command === 0x02) {
                    parseDebugTestDriver(dataArray);
                // switch to run LUA
                } else if (start === 0xc0 && command === 0x04) {
                    parseSwitchToLua(dataArray);
                // switch to run BLE
                } else if (start === 0xc0 && command === 0x05) {
                    parseSwitchToBle(dataArray);
                // single driver light
                } else if (start === 0xb2 && command === 0x02) {
                    // no response
                // single driver polarity
                } else if (start === 0xb1 && command === 0xed) {
                    parseSingleDriverPolarity(dataArray);
                // file transfer
                // 1. lua upload
                // 2. firmware update
                } else if (start === 0x48 && command === 0x4a) {
                    // start/end response
                    if (dataArray[4] == 0x00 && dataArray[5] === 0x00) {
                        if (startIndicator) {
                            startIndicator = false;

                            parseFileTransferStart(dataArray);
                        } else {
                            parseFileTransferEnd(dataArray);
                        }
                    } else {
                        parseFileTransferData(dataArray);
                    }
                } else if (start === 0xb4 && command === 0x02) {
                    parseDebugWaistJoin(dataArray);
                } else if (start === 0xb5 && command === 0x02) {
                    parseDebugArmJoin(dataArray);
                } else if (start === 0xb8 && command === 0x02) {
                    parseDebugTouchSensor(dataArray);
                } else if (start === 0xb6 && command === 0x02) {
                    parseSetWaistJoinAngle(dataArray);
                } else if (start === 0xb7 && command === 0x02) {
                    parseSetArmJoinAngle(dataArray);
                } else if (start === 0xb3 && command === 0x02) {
                    parseSingleDriverPolarityFetched(dataArray);
                } else if (start === 0xb9 && command === 0x02) {
                    parseSingleDriverReset(dataArray);
                } else if (start === 0x01 && command === 0x06) {
                    // no response
                } else if (start === 0x02 && command === 0x06) {
                    // no reponse
                } else if (start === 0x03 && command === 0x06) {
                    // no reponse
                } else if (start === 0x05 && command === 0x06) {
                    parseIsRunningLua(dataArray);
                } else if (start === 0x06 && command === 0x06) {
                  // color batch
                    parseBatchColor(dataArray);
                } else if (start === 0x07 && command === 0x06) {
                  // infrared batch
                    parseBatchInfrared(dataArray);
                } else if (start === 0x08 && command === 0x06) {
                  // touch batch
                    parseBatchTouch(dataArray);
                } else if (start === 0x09 && command === 0x06) {
                    parseBatchWaist(dataArray);
                } else if (start === 0x0a && command === 0x06) {
                    parseBatchArm(dataArray);
                } else if (start === 0x0b && command === 0x06) {
                  // battery batch fetch
                    parseBatchBattery(dataArray);
                } else if (start === 0x0c && command === 0x06) {
                  // driver batch fetch
                    parseBatchDriver(dataArray)
                } else if (start === 0x0d && command === 0x06) {
                  // do not parse it
                  // Cmd.CMD_LUA_RUNTIME_PIPE
                } else {
                    console.error('unknown data received: ' + dataArray);
                }
            } else if (res && res.status === 'subscribed') {
              if (callback) callback();
            }
        }, function (err) {
            if (_debug) console.log('subscribe failed : ' + JSON.stringify(err));
        }, params);
    },

    pushCmd (command) {
        if (_debug) console.log('pushCmd() ');
        if (_isDownloading) {
          switch (command.cmd) {
            case Cmd.CMD_FILE_TRANSFER_START:
            case Cmd.CMD_FILE_TRANSFER_DATA:
            case Cmd.CMD_FILE_TRANSFER_END:
              break;
            default:
              return;
          }
        }
        if (command.priority == Cmd.Priority.LOW) {
          // 连续的此列队列指令发送时，次级队列根据设置的size，保存待发指令集合
          _lowerCmdQueue.push(command);
          while (_lowerCmdQueue.length > LOWER_QUEUE_SIZE_LIMIT) {
            _lowerCmdQueue.shift();
          }
        } else if (command.priority == Cmd.Priority.HIGH) {
          _cmdQueue.push(command);
        } else {
          // 兼容之前的指令，没有priority的cmd将全部进入优先队列
          // FIXME: all the cmds without priority will push to _cmdQueue
          _cmdQueue.push(command);
        }
    },
}
/*
   utility functions
 */
// append the crc bytes to the data
function concatCrc(data) {
    var crcInt = crc(data);
    var low = crcInt & 0xff;
    var high = (crcInt >> 8) & 0xff;
    data.push(high);
    data.push(low);
}

// check if crc in the data is right
function crcCheck (data) {
    var high = data[data.length - 2];
    var low = data[data.length - 1];
    data.pop();
    data.pop();
    concatCrc(data);
    return data[data.length - 2] === high &&
        data[data.length - 1] === low;
}

function intTo2Bytes(i) {
    var bytes = [];
    // low
    bytes.push((i & 0xff));
    // high
    bytes.push((i >> 8) & 0xff);
    return bytes;
}

function intTo4Bytes(l) {
    var bytes = [];
    bytes.push(l & 0xff);
    bytes.push((l >> 8) & 0xff);
    bytes.push((l >> 16) & 0xff);
    bytes.push((l >> 24) & 0xff);
    return bytes;
}

function bytes2ToInt(bytes) {
    // var result = bytes[0] & 0xff;
    // result |= (bytes[1] << 8) & 0xff00;
    var int8Array = new Int8Array(bytes);
    var bytes = int8Array.buffer.slice(-2);
    return new Int16Array(bytes)[0];
}

function bytes4ToInt(bytes) {
    // var result = bytes[0] & 0xff;
    // result |= (bytes[1] << 8) & 0xff00;
    // result |= (bytes[2] << 16) & 0xff0000;
    // result |= (bytes[3] << 24) & 0xff000000;
    var int8Array = new Int8Array(bytes);
    var bytes = int8Array.buffer.slice(-4);
    return new Int32Array(bytes)[0];
}

/*
    _receiveCallback: {
        onInitSuccess: function () {},
        onInitFailed: function () {},

        onGetProfileSuccess: function (color, name) {},
        onGetProfileFailed: function () {},
        onNoProfile: function () {},

        onSetProfileSuccess: function () {},
        onSetProfileFailed: function () {},

        onGetFirmwareVersion: function (version) {},
        onFirmwareUpgradePrepareSuccess: function () {},
        onFirmwareUpgradePrepareFailed: function () {},

        onOnlineBalls: function (moduleCount, battery, driver, infrared, color) {},
        onDebugBattery: function (module, battery) {},
        onDebugDriver: function (module, revolution, position) {},
        onDebugColor: function (module, mode, number) {},
        onDebugInfrared: function (module, distance) {},
        onDebugMasterControl: function (bias, rotation, pitch) {},
        onDebugTestDriverSuccess: function (module) {},
        onDebugTestDriverFailed: function (module) {},

        onSwitchToLuaSuccess: function () {},
        onSwitchToLuaFailed: function () {},
        onSwitchToBleSuccess: function () {},
        onSwitchToBleFailed: function () {},

        onSingleDriverPolarity: function (module, polarity) {},

        onFileTransferStartSuccess: function () {},
        onFileTransferStartFailed: function () {},
        onFileTransferEndSuccess: function () {},
        onFileTransferEndFailed: function () {},
        onFileTransferDataSuccess: function () {},
        onFileTransferDataFailed: function () {},

        onDebugWaistJoin: function (angle) {},
        onDebugArmJoin: function (angle) {},
        onDebugTouchSensor: function (pressed) {}, // 0, 未按下  1，按下
        onSetWaistJoinAngleSuccess: function () {},
        onSetWaistJoinAngleFailed: function () {},
        onSetArmJoinAngleSuccess: function () {},
        onSetArmJoinAngleFailed: function () {},
        onSingleDriverPolarityFetched: function (polarity) {}, // 0x0a 顺时针, 0x0b 逆时针

        onSingleDriverReset: function (module) {},

        isLuaRunning: function (running) {}, // 0, 未运行 1，运行中

        onBatchColor: function (arr) {}, // arr -> 15 data array
        onBatchInfrared: function (arr) {}, // arr -> 15 distances array
        onBatchTouch: function (arr) {}, // arr -> 15 states array
    }
 */
function parseInit (data) {
    if (!_receiveCallback) return;
    var status = data[2]; // 1- inited 0-not inited
    if (status === 0x01) {
        // inited
        _receiveCallback.onInitSuccess();
    } else if (status === 0x00) {
        // not inited
        _receiveCallback.onInitFailed();
    } else {
        console.error('parseInit error status: ' + status);
        _receiveCallback.onInitFailed();
    }
}

function parseGetProfile(data) {
    if (!_receiveCallback) return;
    var color = data[2];
    var nameLength = data[3];
    var name = gbkWrapper.decode(data.slice(4, 4 + nameLength));
    var colorName = '';
    switch (color) {
        case 0x00: // not inited
            colorName = 'none';
            break;
        case 0x01: // red
            colorName = 'red';
            break;
        case 0x02: // green
            colorName = 'green';
            break;
        case 0x03: // yellow
            colorName = 'yellow';
            break;
        case 0x04: // blue
            colorName = 'blue';
            break;
        case 0x05: // purple
            colorName = 'purple';
            break;
        case 0x06: // cyan
            colorName = 'cyan';
            break;
        case 0x07: // orange
            colorName = 'orange';
            break;
        case 0x08: // white
            colorName = 'white';
            break;
        default: // unknown
            console.error('unknown color: ' + color);
            break;
    }
    if (colorName && colorName.length > 0 && name) {
        if (colorName === 'none') {
            _receiveCallback.onNoProfile();
        } else {
            _receiveCallback.onGetProfileSuccess(colorName, name);
        }
    } else {
        _receiveCallback.onGetProfileFailed();
    }
}

function parseSetProfile (data) {
    if (!_receiveCallback) return;
    var status = data[2];
    if (status === 0x01) {
        _receiveCallback.onSetProfileSuccess();
    } else if (status === 0x00) {
        _receiveCallback.onSetProfileFailed();
    } else {
        _receiveCallback.onSetProfileFailed();
        console.error('parseSetProfile error status: ' + status);
    }
}

function parseGetFirmwareVersion (data) {
    if (!_receiveCallback && !_transferCallback) return;
    var version = bytes2ToInt(data.slice(2, 4));
    if (_receiveCallback && _receiveCallback.onGetFirmwareVersion) _receiveCallback.onGetFirmwareVersion(version);
    if (_transferCallback && _transferCallback.onGetFirmwareVersion) _transferCallback.onGetFirmwareVersion(version);
}

function parseFirmwareUpgradePrepare (data) {
    if (!_receiveCallback && !_transferCallback) return;
    var status = data[2];
    if (status === 0x01) {
        if (_receiveCallback && _receiveCallback.onFirmwareUpgradePrepareSuccess) _receiveCallback.onFirmwareUpgradePrepareSuccess();
        if (_transferCallback && _transferCallback.onFirmwareUpgradePrepareSuccess) _transferCallback.onFirmwareUpgradePrepareSuccess();
    } else if (status === 0x00) {
        if (_receiveCallback && _receiveCallback.onFirmwareUpgradePrepareFailed) _receiveCallback.onFirmwareUpgradePrepareFailed();
        if (_transferCallback && _transferCallback.onFirmwareUpgradePrepareFailed) _transferCallback.onFirmwareUpgradePrepareFailed();
    } else {
        console.error('parseFirmwareUpgradePrepare error status: ' + status);
        if (_receiveCallback && _receiveCallback.onFirmwareUpgradePrepareFailed) _receiveCallback.onFirmwareUpgradePrepareFailed();
        if (_transferCallback && _transferCallback.onFirmwareUpgradePrepareFailed) _transferCallback.onFirmwareUpgradePrepareFailed();
    }
}

function parseOnlineBalls (data) {
    if (!_receiveCallback) return;
    var moduleCount = data[2];
    var batteryCount = data[3];
    var driverCount = data[4];
    var infraredCount = data[5];
    var colorCount = data[6];
    var touchCount = data[7];
    var waistJoinCount = data[8];
    var armJoinCount = data[9];
    if (!_isModuleNumber(moduleCount, 7) || !_isModuleNumber(batteryCount) || !_isModuleNumber(driverCount) ||
      !_isModuleNumber(infraredCount) || !_isModuleNumber(colorCount) || !_isModuleNumber(touchCount) ||
      !_isModuleNumber(waistJoinCount) || !_isModuleNumber(armJoinCount)) {
      return;
    }
    _receiveCallback.onOnlineBalls(moduleCount, batteryCount, driverCount, infraredCount, colorCount,
       touchCount, waistJoinCount, armJoinCount);
}

function _isModuleNumber (param, ref) {
  if (_isUndefined(ref)) {
    return _isNumber(param) && (param <= 15) && (param >= 0);
  } else {
    return _isNumber(param) && (param === ref);
  }
}

function _isNumber (param) {
  return typeof param === 'number';
}

function _isUndefined (param) {
  return typeof param === 'undefined';
}

function parseDebugBattery (data) {
    if (!_receiveCallback) return;
    var module = data[2];
    var battery = data[3];
    if (battery < 0 || battery > 100) {
      return;
    }
    _receiveCallback.onDebugBattery(module, battery);
}

function parseDebugDriver (data) {
    if (!_receiveCallback) return;
    var module = data[2];
    // 转速 有符号char
    var revolution = data[3];
    // 位置 有符号int
    var position = bytes4ToInt(data.slice(4, 8));
    if (_isUndefined(position)) return;
    if (!_isModuleNumber(module)) return;
    _receiveCallback.onDebugDriver(module, revolution, position);
}

function parseDebugColor (data) {
    if (!_receiveCallback) return;
    var module = data[2];
    var mode = data[3]; //  1- environment light 2- reflection light 3- color discrimination
    var number = bytes2ToInt(data.slice(4, 6));
    if (_isUndefined(number)) return;
    if (!_isModuleNumber(module)) return;
    if (mode < 1 || mode > 3) return;
    _receiveCallback.onDebugColor(module, mode, number);
}

function parseDebugInfrared (data) {
    if (!_receiveCallback) return;
    var module = data[2];
    var distance = data[3];
    if (!_isModuleNumber(module)) return;
    _receiveCallback.onDebugInfrared(module, distance);
}

function parseDebugMasterControl (data) {
    if (!_receiveCallback) return;
    var pitch = bytes2ToInt(data.slice(2, 4));
    var roll = bytes2ToInt(data.slice(4, 6));
    var yaw = bytes2ToInt(data.slice(6, 8));
    if (_isUndefined(pitch) || _isUndefined(roll) || _isUndefined(yaw)) return;
    _receiveCallback.onDebugMasterControl(roll, yaw, pitch);
}

function parseDebugTestDriver (data) {
    if (!_receiveCallback) return;
    var module = data[2];
    var status = data[3];
    if (!_isModuleNumber(module)) return;
    if (status === 0x01) {
        _receiveCallback.onDebugTestDriverSuccess(module);
    } else if (status === 0x00) {
        _receiveCallback.onDebugTestDriverFailed(module);
    } else {
        _receiveCallback.onDebugTestDriverFailed(module);
        console.error('parseDebugTestDriver error status: ' + status);
    }
}

function parseSwitchToLua (data) {
    if (!_receiveCallback && !_transferCallback) return;
    var status = data[2];
    if (status === 0x01) {
        if (_receiveCallback.onSwitchToLuaSuccess) _receiveCallback.onSwitchToLuaSuccess();
        if (_transferCallback.onSwitchToLuaSuccess) _transferCallback.onSwitchToLuaSuccess();
    } else if (status === 0x00) {
        if (_receiveCallback.onSwitchToLuaFailed) _receiveCallback.onSwitchToLuaFailed();
        if (_transferCallback.onSwitchToLuaFailed) _transferCallback.onSwitchToLuaFailed();
    } else {
        console.error('parseSwitchToLua error status: ' + status);
        if (_receiveCallback.onSwitchToLuaFailed) _receiveCallback.onSwitchToLuaFailed();
        if (_transferCallback.onSwitchToLuaFailed) _transferCallback.onSwitchToLuaFailed();
    }
}

function parseSwitchToBle (data) {
    if (!_receiveCallback) return;
    var status = data[2];
    if (status === 0x01) {
        _receiveCallback.onSwitchToBleSuccess();
    } else if (status == 0x00) {
        _receiveCallback.onSwitchToBleFailed();
    } else {
        console.error('parseSwitchToBle error status: ' + status);
        _receiveCallback.onSwitchToBleFailed();
    }
}

function parseSingleDriverPolarity (data) {
    if (!_receiveCallback) return;
    var module = data[2];
    var polarity = data[3];
    if (!_isModuleNumber(module)) return;
    _receiveCallback.onSingleDriverPolarity(module, polarity);
}

function parseFileTransferStart(data) {
    if (!_receiveCallback && !_transferCallback) return;
    var success = false;
    // 0x00 0x00 无错误
    if (data[2] === 0x00 && data[3] === 0x00) {
        success = true;
        // 0x01 0x00 帧校验错误，请求重发
    } else if (data[2] === 0x01 && data[3] === 0x00) {

        // 0x02 0x00 超时错误
    } else if (data[2] === 0x02 && data[3] === 0x00) {

        // 0x64 0x00 100严重错误,buff size out of range之类错误
    } else if (data[2] === 0x64 && data[3] === 0x00) {

    } else {
        // ignore: Unknown errors
    }

    if (success) {
      if (_receiveCallback.onFileTransferStartSuccess) _receiveCallback.onFileTransferStartSuccess();
      if (_transferCallback.onFileTransferStartSuccess) _transferCallback.onFileTransferStartSuccess();
    } else {
      _isDownloading = false;
      if (_receiveCallback.onFileTransferStartFailed) _receiveCallback.onFileTransferStartFailed();
      if (_transferCallback.onFileTransferStartFailed) _transferCallback.onFileTransferStartFailed();
    }
}

function parseFileTransferEnd(data) {
    _isDownloading = false;
    if (!_receiveCallback && !_transferCallback) return;
    var success = false;
    // 0x00 0x00 无错误
    if (data[2] === 0x00 && data[3] === 0x00) {
        success = true;
        // 0x01 0x00 帧校验错误，请求重发
    } else if (data[2] === 0x01 && data[3] === 0x00) {

        // 0x02 0x00 超时错误
    } else if (data[2] === 0x02 && data[3] === 0x00) {

        // 0x64 0x00 100严重错误,buff size out of range之类错误
    } else if (data[2] === 0x64 && data[3] === 0x00) {

    } else {
        // ignore: Unknown errors
    }

    if (success) {
      if (_receiveCallback.onFileTransferEndSuccess) _receiveCallback.onFileTransferEndSuccess();
      if (_transferCallback.onFileTransferEndSuccess) _transferCallback.onFileTransferEndSuccess();
    } else {
      if (_receiveCallback.onFileTransferEndFailed) _receiveCallback.onFileTransferEndFailed();
      if (_transferCallback.onFileTransferEndFailed) _transferCallback.onFileTransferEndFailed();
    }
}

function parseFileTransferData(data) {
    if (!_receiveCallback && !_transferCallback) return;
    var success = false;
    // 0x00 0x00 无错误
    if (data[2] === 0x00 && data[3] === 0x00) {
        success = true;
        // 0x01 0x00 帧校验错误，请求重发
    } else if (data[2] === 0x01 && data[3] === 0x00) {

        // 0x02 0x00 超时错误
    } else if (data[2] === 0x02 && data[3] === 0x00) {

        // 0x64 0x00 100严重错误,buff size out of range之类错误
    } else if (data[2] === 0x64 && data[3] === 0x00) {

    } else {
        // ignore: Unknown errors
    }

    if (success) {
      if (_receiveCallback.onFileTransferDataSuccess) _receiveCallback.onFileTransferDataSuccess();
      if (_transferCallback.onFileTransferDataSuccess) _transferCallback.onFileTransferDataSuccess();
    } else {
      _isDownloading = false;
      if (_receiveCallback.onFileTransferDataFailed) _receiveCallback.onFileTransferDataFailed();
      if (_transferCallback.onFileTransferDataFailed) _transferCallback.onFileTransferDataFailed();
    }
}

function parseDebugWaistJoin(data) {
  if (!_receiveCallback) return;
  if (_receiveCallback.onDebugWaistJoin) _receiveCallback.onDebugWaistJoin(data[2]); // 0-180
}

function parseDebugArmJoin(data) {
  if (!_receiveCallback) return;
  if (_receiveCallback.onDebugArmJoin) _receiveCallback.onDebugArmJoin(data[2]); // 0-180
}

function parseDebugTouchSensor(data) {
  if (!_receiveCallback) return;
  var pressed;
  if (data[2] === 0x00) {
    pressed = false;
  } else if (data[2] === 0x01) {
    pressed = true;
  }
  if (_receiveCallback.onDebugTouchSensor) _receiveCallback.onDebugTouchSensor(pressed);
}

function parseSetWaistJoinAngle(data) {
  if (!_receiveCallback) return;
  if (data[2] === 0x01) {
    if (_receiveCallback.onSetWaistJoinAngleSuccess) _receiveCallback.onSetWaistJoinAngleSuccess();
  } else {
    if (_receiveCallback.onSetWaistJoinAngleFailed) _receiveCallback.onSetWaistJoinAngleFailed();
  }
}

function parseSetArmJoinAngle(data) {
  if (!_receiveCallback) return;
  if (data[2] === 0x01) {
    if (_receiveCallback.onSetArmJoinAngleSuccess) _receiveCallback.onSetArmJoinAngleSuccess();
  } else {
    if (_receiveCallback.onSetArmJoinAngleFailed) _receiveCallback.onSetArmJoinAngleFailed();
  }
}

function parseSingleDriverPolarityFetched(data) {
  if (!_receiveCallback) return;
  var polarity;
  if (data[2] === 0x0a) {
    polarity = 0x00;
  } else if (data[2] === 0x0b) {
    polarity = 0x01;
  }
  if (_receiveCallback.onSingleDriverPolarityFetched) _receiveCallback.onSingleDriverPolarityFetched(polarity);
}

function parseSingleDriverReset(data) {
  if (!_receiveCallback) return;
  var sequence = data[2];
  if (_receiveCallback.onSingleDriverReset) _receiveCallback.onSingleDriverReset(sequence);
}

function parseIsRunningLua(data) {
  if (!_receiveCallback) return;
  var running = data[2] === 0x01;
  if (_receiveCallback.isLuaRunning) _receiveCallback.isLuaRunning(running);
}

function parseBatchColor(data) {
  if (!_receiveCallback) return;
  var mode = data[2]; // ~2
  var data = data.slice(3, 3 + 15 * 2); // sub array [3, 33)
  var arr = [];
  for (var i = 0; i < data.length; i += 2) {
    var a = [];
    a.push(data[i]);
    a.push(data[i + 1]);
    arr.push(bytes2ToInt(a));
  }
  if (_receiveCallback.onBatchColor) _receiveCallback.onBatchColor(arr);
}

function parseBatchInfrared(data) {
  if (!_receiveCallback) return;
  var data = data.slice(2, 17); // sub array [2, 17)
  if (_receiveCallback.onBatchInfrared) _receiveCallback.onBatchInfrared(data);
}

function parseBatchTouch(data) {
  if (!_receiveCallback) return;
  var data = data.slice(2, 17);
  if (_receiveCallback.onBatchTouch) _receiveCallback.onBatchTouch(data);
}

function parseBatchWaist(data) {
  if (!_receiveCallback) return;
  var data = data.slice(2, 17);
  if (_receiveCallback.onBatchWaist) _receiveCallback.onBatchWaist(data);
}

function parseBatchArm(data) {
  if (!_receiveCallback) return;
  var data = data.slice(2, 17);
  if (_receiveCallback.onBatchArm) _receiveCallback.onBatchArm(data);
}

function parseBatchBattery(data) {
  if (!_receiveCallback) return;
  var data = data.slice(2, 17);
  for (var i = 0; i < data.length; i++) {
    if (data[i] === 0xff) {
      data[i] = 0
    }
  }
  if (_receiveCallback.onBatchBattery) _receiveCallback.onBatchBattery(data);
}

function parseBatchDriver(data) {
  if (!_receiveCallback) return;
  var data = data.slice(2, 62);
  //[ 0x0C,0x06,0xF0,0x8A,0x02,0x00,0x48,0x5C,0x01,0x00,0xE0,0x57,0x00,0x00,0x95,0xD7,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0x94,0x21 ]
  var res = [];
  for (var i = 0; i < data.length; i+=4) {
    if (data[i] === 0xff && data[i + 1] === 0xff &&
      data[i + 2] === 0xff && data[i + 3] === 0xff) {
      res.push(0)
    } else {
      var n = Number((bytes4ToInt(data.slice(i, i + 4)) / 1600 * 360).toFixed(1));  // angles
      res.push(n)
    }
  }
  if (_receiveCallback.onBatchDriver) _receiveCallback.onBatchDriver(res);
}
