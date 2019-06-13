/*
Central Life Cycle

1. initialize
2. scan (if device address is unknown)
3. connect
4. discover OR services/characteristics/descriptors (iOS)
5. read/subscribe/write characteristics AND read/write descriptors
6. disconnect
7. close
*/
var BleApis = {
  // statics
  MODULE_DEFAULT: 'none',
  MODULE_MASTER_CONTROL: 'master_control',
  MODULE_DRIVER: 'driver',
  MODULE_INFRARED: 'infrared',
  MODULE_COLOR: 'color',
  MODULE_BATTERY: 'battery',

  EVENT_DISCONNECT: 'event_disconnect',
  EVENT_CONNECT: 'event_connect',

  devices: [],
  activeDevice: null,
  offlineDevice: null, // 记录最近一次掉线的设备，用于重新连接
  debug: {
    module: 'none',
    data: null,
    sequence: 0, // 1-15
    online_list: {
      // moduleCount, battery, driver, infrared, color, touch, waist, arm
      mc: 0,
      battery: 0,
      driver: 0,
      infrared: 0,
      color: 0,
      touch: 0,
      waist: 0,
      arm: 0
    }
  },
  onlineTaskInternal: null,
  onlineTask: null, // 在线球列表获取interval
  debugTask: null, // 调试球interval
  firmware_version: 0,
  firmware_online_version: 0,
  /**
  @params: success   when initialized successfully
          fail      when initialized failed
  */
  init: function (success, fail) {
    var params = {
      request: true,
      statusReceiver: true,
      // restoreKey: 'bluetoothleplugin',
    };
    bluetoothle.initialize(function (result) {
      if (result && result.status) {
        if (result.status === 'enabled') success();
        else if (result.status === 'disabled') fail();
        else {
          console.error('error for ble initialize: ' + JSON.stringify(result));
          fail();
        }
      } else {
        console.error('error for ble initialize: ' + JSON.stringify(result));
        fail();
      }
    }, params);

    var that = this;
    // bind backbutton listener for cordova
    document.addEventListener('backbutton', function () {
      if (that.activeDevice) {
        that.disconnect(function () {
          navigator.app.exitApp();
        });
      } else {
        navigator.app.exitApp();
      }
    });
  },

  /**
  @params: start    when scanning began
           end    when scanning finished
  NOTE: What we care about is not only the devices list, but also the profiles
  for Mabot such as: nick name & color of the light for the master control.
  So the duration for this scanning should be more than the duration you gave.
  When you scan devices for 5 seconds you may wait for 7 or 8 seconds indeed!
  @author: tinychou
  @date: 2017-02-20 5:30 PM
  */
  scan: function (start, end) {
    var that = this;
    var uuid = Constants.SERVICE_UUID;
    var params = {
      'services': [uuid],
      'allowDuplicates': false,
      'scanMode': bluetoothle.SCAN_MODE_LOW_LATENCY,
      'matchMode': bluetoothle.MATCH_MODE_AGGRESSIVE,
      'matchNum': bluetoothle.MATCH_NUM_MAX_ADVERTISEMENT,
      'callbackType': bluetoothle.CALLBACK_TYPE_ALL_MATCHES
    };

    var addressList = []; // store the results
    if (start) start();
    // NOTE: clear before scan
    that.devices = [];
    bluetoothle.startScan(function (res) {
      if (res && res.status === 'scanResult' && res.address) {
        if (addressList.indexOf(res.address) < 0) {
        	console.log("扫描到的地址" + res.address)
          // got it
          addressList.push(res.address);
        } else {
          // ignore it which is a dulplicated device
        }
      }
    }, function (err) {
      console.error('error for ble scan: ' + JSON.stringify(err));
    }, params);

    // auto stop sanning after 5 seconds
    setTimeout(function () {
      bluetoothle.stopScan(function (res) {
        that._scanProfiles(addressList, end);
      }, function (err) {
        console.error('error for ble stop scan: ' + JSON.stringify(err));
      });
    }, 3000);
  },

  isScanning: false, // 标示正在扫描
  stopScanTask: null,
  stopScanPlus: function () {
    if (!this.isScanning) return;
    if (this.stopScanTask) {
      clearTimeout(this.stopScanTask);
      this.stopScanTask = null;
      this.isScanning = false;
      bluetoothle.stopScan(function (res) { }, function (err) { });
    }
  },
  scanPlus: function (start, end) {
    if (this.isScanning) return;
    this.isScanning = true;
    var that = this;
    var uuid = Constants.SERVICE_UUID;
    var params = {
      'services': [uuid],
      'allowDuplicates': false,
      'scanMode': bluetoothle.SCAN_MODE_LOW_LATENCY,
      'matchMode': bluetoothle.MATCH_MODE_AGGRESSIVE,
      'matchNum': bluetoothle.MATCH_NUM_MAX_ADVERTISEMENT,
      'callbackType': bluetoothle.CALLBACK_TYPE_ALL_MATCHES
    };

    // profile: {
    //    address: 'dadkanda-sankrahr-eqnekqne-0021', // on ios
    //    originAddress: 'AD:CD:EF:01:AA',
    //    originName: '8Mabot',
    //    rssi: '-89', // -89 dbm
    //    color: 'white',
    //    name: 'Mabot',
    // }
    var profileList = []; // store the results
    if (start) start();

    function containsAddress(profileArr, addr) {
      for (var i = 0; i < profileArr.length; i++) {
        if (profileArr[i] && profileArr[i].address == addr) {
          return true;
        }
      }
      return false;
    }

    function parseNameAndColor(originName) {
      var name = 'Mabot';
      var color = 'white';
      // var c = originName.slice(0);
      // var nameBytes = that._string2Bytes(originName.slice[1]); // bytes      
      // name = GbkWrapper.decode(nameBytes);
      // if(!isNaN(parseInt(c))){
      //   color = bytesArr[0];
      // }
      var c = parseInt(originName.substring(0, 1));
      if (isNaN(c)) {
        // name = originName;
        name = GbkWrapper.decode(that._string2Bytes(originName));
      } else {
        color = that.byteToColor(c);
        name = originName.substring(1, originName.length);
        name = GbkWrapper.decode(that._string2Bytes(name));
      }
      return {
        name: name,
        color: color
      };
    }

    bluetoothle.startScan(function (res) {
      if (res && res.status === 'scanResult' && res.address) {
        if (!containsAddress(profileList, res.address)) {
          // console.log('FIND: ' + JSON.stringify(res));
          var addr;
          if (window.cordova.platformId === 'ios') {
            var manufacturerData = bluetoothle.encodedStringToBytes(res.advertisement.manufacturerData);
            var macData = manufacturerData.slice(2, manufacturerData.length);
            var mac = '';
            for (var i = 0; i < macData.length; i++) {
              var ele = macData[i];
              var hex = '0' + ele.toString(16).toUpperCase();
              hex = hex.substring(hex.length - 2, hex.length);
              mac += hex;
              if (i !== macData.length - 1) mac += ':';
            }
            addr = mac;
          } else if (window.cordova.platformId === 'android') {
            addr = res.address;
          }
          var profile = {
            address: res.address,
            originAddress: addr,
            originName: res.name,
            rssi: res.rssi,
            color: 'white',
            name: 'Mabot',
          };
          var nameColor = parseNameAndColor(profile.originName);
          profile.color = nameColor.color;
          profile.name = nameColor.name;
          console.log('Find Mabot: ' + JSON.stringify(profile));
          // got it
          profileList.push(profile);

          // order by rssi high >>> low
          profileList.sort(function (l, r) {
            return r.rssi - l.rssi;
          });
        } else {
          // ignore it which is a dulplicated device
        }
      }
    }, function (err) {
      console.error('error for ble scan: ' + JSON.stringify(err));
      // 停掉停止扫描task
      if (that.stopScanTask) {
        clearTimeout(that.stopScanTask);
        that.stopScanTask = null;
        end([]);
      }
    }, params);

    // auto stop sanning after 3 seconds
    var task = function () {
      bluetoothle.stopScan(function (res) {
        end(profileList);
        that.isScanning = false;
        that.stopScanTask = null;
      }, function (err) {
        console.error('error for ble stop scan: ' + JSON.stringify(err));
        that.isScanning = false;
        that.stopScanTask = null;
        end([]);
      });
    };
    this.stopScanTask = setTimeout(task, 3000);
  },

  // inner api
  _discoverWrapper: function (success, fail, params) {
    if (window.cordova.platformId === 'android') {
      bluetoothle.discover(success, fail, params);
    } else if (window.cordova.platformId === 'ios') {
      var sParams = {
        'address': params.address,
        'services': [Constants.SERVICE_UUID]
      };
      bluetoothle.services(function (res) {
        if (res && res.status == 'services') {
          var cParams = {
            'address': params.address,
            'service': Constants.SERVICE_UUID,
            'characteristics': [Constants.CHARACTERISTIC_UUID]
          };
          bluetoothle.characteristics(success, fail, cParams);
        } else {
          console.error('error for services: ' + JSON.stringify(res));
          if (fail) fail(res);
        }
      }, function (err) {
        console.error('error for services: ' + JSON.stringify(err));
        if (fail) fail(err);
      }, sParams);
    }
  },

  // internal api
  _scanProfiles: function (addresses, callback) {
    var that = this;
    if (!addresses || addresses.length === 0) {
      // no need to scan
      if (callback) callback(this.devices);
      return;
    }
    var address = addresses.shift();
    //====== 缓存逻辑开始 ======
    // 首先从db中读取该地址是否有在本app连接过，连接过的话
    // 直接读取本地缓存的名字和颜色即可，不必重新连接，订阅去获取，然后断开
    var deviceInDb = cc.db.findDeviceByAddress(address);
    if (deviceInDb) {
      that.devices.push(deviceInDb);
      if (addresses.length > 0) {
        that._scanProfiles(addresses, callback);
      } else if (addresses.length === 0) {
        if (callback) callback(that.devices);
      }
      return;
    }
    //====== 缓存逻辑结束 ======
    var params = {
      'address': address,
      'autoConnect': false // for android
    };
    console.log('scanProfiles device => ' + address);
    // 1.连接
    bluetoothle.connect(function (res) {
      console.log('connect success: ' + JSON.stringify(res));
      if (res && res.status == 'connected') {
        // 2.扫描服务以及特征值
        setTimeout(function () {
          var params = {
            'address': address,
            'clearCache': true
          };
          console.log('start discover services...');
          that._discoverWrapper(function (res) {
            // device [status, address, name, services]
            // ---services [uuid, characteristics]
            // -----characteristics [uuid, properties, permissions, descriptors]
            // -------descriptors [uuid]
            console.log('discover success: ' + JSON.stringify(res));
            if (res && (res.status == 'discovered' || res.status == 'characteristics')) {
              // 3.发送获取profile, 这里直接利用 cmdqueue
              var queue = CmdQueue;
              queue.loop();
              queue.bindDevice({ address: address });
              var devices = that.devices;
              var defaultCallback = function () {
                devices.push({
                  address: address,
                  color: 'default',
                  name: 'Mabot'
                });
                // 更新当前缓存名字颜色
                cc.db.updateNameAndColor(address, 'Mabot', 'default');
                if (addresses.length > 0) {
                  that._scanProfiles(addresses, callback);
                } else if (addresses.length === 0) {
                  if (callback) callback(that.devices);
                }
              };
              queue.bindCallback({
                onGetProfileSuccess: function (color, name) {
                  console.log('name: ' + name + ' color: ' + color);
                  queue.release(function () {
                    devices.push({
                      address: address,
                      color: color,
                      name: name
                    });
                    // 更新当前缓存名字颜色
                    cc.db.updateNameAndColor(address, name, color);
                    // 下一个
                    if (addresses.length > 0) {
                      that._scanProfiles(addresses, callback);
                    } else if (addresses.length === 0) {
                      if (callback) callback(that.devices); // done
                    }
                  });
                },
                onGetProfileFailed: function () {
                  queue.release(defaultCallback);
                },
                onNoProfile: function () {
                  queue.release(defaultCallback);
                }
              });
              queue.subscribe(function () {
                queue.pushCmd({
                  cmd: Cmd.CMD_GET_PROFILE,
                  timestamp: new Date().getTime()
                });
              });
            } else {
              // not happen
            }
          }, function (err) {
            // dicover exception
            console.log('error for discover: ' + JSON.stringify(err));
            bluetoothle.disconnect(function () {
              bluetoothle.close(function () {
                if (addresses.length > 0) {
                  that._scanProfiles(addresses, callback);
                } else if (addresses.length === 0) {
                  if (callback) callback(that.devices);
                }
              }, function () {
                if (addresses.length > 0) {
                  that._scanProfiles(addresses, callback);
                } else if (addresses.length === 0) {
                  if (callback) callback(that.devices);
                }
              }, params);
            }, function () {
              bluetoothle.close(function () {
                if (addresses.length > 0) {
                  that._scanProfiles(addresses, callback);
                } else if (addresses.length === 0) {
                  if (callback) callback(that.devices);
                }
              }, function () {
                if (addresses.length > 0) {
                  that._scanProfiles(addresses, callback);
                } else if (addresses.length === 0) {
                  if (callback) callback(that.devices);
                }
              }, params);
            }, params);
          }, params);
        }, 2000);
      } else {
        // connect failed
        bluetoothle.disconnect(function () {
          bluetoothle.close(function () {
            if (addresses.length > 0) {
              that._scanProfiles(addresses, callback);
            } else if (addresses.length === 0) {
              if (callback) callback(that.devices);
            }
          }, function () {
            if (addresses.length > 0) {
              that._scanProfiles(addresses, callback);
            } else if (addresses.length === 0) {
              if (callback) callback(that.devices);
            }
          }, params);
        }, function () {
          bluetoothle.close(function () {
            if (addresses.length > 0) {
              that._scanProfiles(addresses, callback);
            } else if (addresses.length === 0) {
              if (callback) callback(that.devices);
            }
          }, function () {
            if (addresses.length > 0) {
              that._scanProfiles(addresses, callback);
            } else if (addresses.length === 0) {
              if (callback) callback(that.devices);
            }
          }, params);
        }, params);
      }
    }, function (err) {
      // connect exception
      console.log('error for connect: ' + JSON.stringify(err));
      bluetoothle.disconnect(function () {
        bluetoothle.close(function () {
          if (addresses.length > 0) {
            that._scanProfiles(addresses, callback);
          } else if (addresses.length === 0) {
            if (callback) callback(that.devices);
          }
        }, function () {
          if (addresses.length > 0) {
            that._scanProfiles(addresses, callback);
          } else if (addresses.length === 0) {
            if (callback) callback(that.devices);
          }
        }, params);
      }, function () {
        bluetoothle.close(function () {
          if (addresses.length > 0) {
            that._scanProfiles(addresses, callback);
          } else if (addresses.length === 0) {
            if (callback) callback(that.devices);
          }
        }, function () {
          if (addresses.length > 0) {
            that._scanProfiles(addresses, callback);
          } else if (addresses.length === 0) {
            if (callback) callback(that.devices);
          }
        }, params);
      }, params);
    }, params);
  },

  /*
  Indicate that current connection is bound
  */
  isConnected: function () {
    return this.activeDevice != null;
  },

  getConnectedDeviceColor: function () {
    if (this.activeDevice) {
      return this.color2Byte(this.activeDevice.color);
    }
    return cc.bell.lightColor.white; // white when no connection
  },

  getConnectedDeviceNameAndColor: function () {
    if (this.activeDevice) {
      return {
        name: this.activeDevice.name,
        color: this.activeDevice.color
      };
    }
  },

  setConnectedDeviceNameAndColor: function (name, color) {
    if (this.activeDevice) {
      this.activeDevice.name = name;
      this.activeDevice.color = color;
    }
    if (this.offlineDevice) {
      this.offlineDevice.name = name;
      this.offlineDevice.color = color;
    }
  },

  /*
  try to connect the device with the specified ble mac address
  */
  connect: function (profile, success, fail, blinkAndBeep) {
    var prevDevice = this.activeDevice;
    var address = profile.address;
    if (prevDevice && prevDevice.address === address) return; // ignore it
    var that = this;
    var task = function () {
      // set the current device to null from beginning
      // because the connection should take few seconds to be extablished
      that.activeDevice = null;
      var params = {
        'address': address,
      };
      bluetoothle.connect(function (res) {
        console.log('connect success: ' + JSON.stringify(res));
        if (res.status === 'connected') {
          that._bindDevice(profile, blinkAndBeep);
          that.offlineDevice = profile;
          if (success) success();

          // ====== internal online ball fetch task =====
          if (that.onlineTaskInternal) {
            clearInterval(that.onlineTaskInternal);
            that.onlineTaskInternal = null;
          }
          that.onlineTaskInternal = setInterval(function () {
            var q = CmdQueue;
            if (!that.isConnected()) return;
            q.pushCmd({
              cmd: Cmd.CMD_ONLINE_BALLS,
              timestamp: new Date().getTime(),
              priority: Cmd.Priority.LOW,
            });
          }, 3000);
          // ====== ending ===============

          // 连接事件
          // if (cc) {
          //   var event = new cc.EventCustom(that.EVENT_CONNECT);
          //   event.setUserData(res);
          //   cc.eventManager.dispatchEvent(event);
          // }
        } else if (res.status === 'disconnected') {
          that._unbindDevice();
          var empty = function () { };
          bluetoothle.disconnect(function () {
            bluetoothle.close(empty, empty, params);
          }, function () {
            bluetoothle.close(empty, empty, params);
          }, params);
          // dispatch the event using custom event
          // if (cc) {
          //   var event = new cc.EventCustom(that.EVENT_DISCONNECT);
          //   event.setUserData(res);
          //   cc.eventManager.dispatchEvent(event);
          // }
          that.callbackWhenDisconnect(fail);

          // do not call the fail callback because we fire the event to listeners already
          // if (fail) fail();
        } else {
          // should not happen
        }
      }, function (err) {
        console.error('connect failed: ' + JSON.stringify(err));
        var empty = function () { };
        bluetoothle.disconnect(function () {
          bluetoothle.close(empty, empty, params);
        }, function () {
          bluetoothle.close(empty, empty, params);
        }, params);
        if (fail) fail();
      }, params);
    };

    if (prevDevice) {
      var params = { address: prevDevice.address };
      bluetoothle.disconnect(function (res) {
        console.log('disconnect success: ' + JSON.stringify(res));
        if (res.status === 'disconnected') {
          bluetoothle.close(function (res) {
            // DO NOT do the connecting in directly
            // we should pay attentions: it will throw out a disconnect for you do it directly.
            setTimeout(function () { task(); }, 1000);
          }, function (err) { }, params);
        }
      }, function (err) {
        console.error('disconnect failed: ' + JSON.stringify(err));
        var empty = function () { };
        bluetoothle.close(empty, empty, params);
      }, params);
    } else {
      task();
    }
  },

  reconnect: function (success, fail, blinkAndBeep) {
  	console.log(this.offlineDevice)
    var address = this.offlineDevice.address;
    var that = this;
    var task = function () {
      // set the current device to null from beginning
      // because the connection should take few seconds to be extablished
      that.activeDevice = null;
      var params = {
        'address': address,
      };
      bluetoothle.connect(function (res) {
        console.log('connect success: ' + JSON.stringify(res));
        if (res.status === 'connected') {
          that._bindDevice(that.offlineDevice, blinkAndBeep);
          if (success) success();

          // ====== internal online ball fetch task =====
          if (that.onlineTaskInternal) {
            clearInterval(that.onlineTaskInternal);
            that.onlineTaskInternal = null;
          }
          that.onlineTaskInternal = setInterval(function () {
            var q = CmdQueue;
            if (!that.isConnected()) return;
            q.pushCmd({
              cmd: Cmd.CMD_ONLINE_BALLS,
              timestamp: new Date().getTime(),
              priority: Cmd.Priority.LOW,
            });
          }, 3000);
          // ====== ending ===============

          // 连接事件
          // if (cc) {
          //   var event = new cc.EventCustom(that.EVENT_CONNECT);
          //   event.setUserData(res);
          //   cc.eventManager.dispatchEvent(event);
          // }
        } else if (res.status === 'disconnected') {
          that._unbindDevice();
          var empty = function () { };
          bluetoothle.disconnect(function () {
            bluetoothle.close(empty, empty, params);
          }, function () {
            bluetoothle.close(empty, empty, params);
          }, params);
          // dispatch the event using custom event
          // if (cc) {
          //   var event = new cc.EventCustom(that.EVENT_DISCONNECT);
          //   event.setUserData(res);
          //   cc.eventManager.dispatchEvent(event);
          // }
          that.callbackWhenDisconnect(fail);

          // do not call the fail callback because we fire the event to listeners already
          // if (fail) fail();
        } else {
          // should not happen
        }
      }, function (err) {
        console.error('connect failed: ' + JSON.stringify(err));
        var empty = function () { };
        bluetoothle.disconnect(function () {
          bluetoothle.close(empty, empty, params);
        }, function () {
          bluetoothle.close(empty, empty, params);
        }, params);
        if (fail) fail();
      }, params);
    };

    task();
  },

  _bindDevice: function (profile, blinkAndBeep) {
    this.activeDevice = profile;
    var address = profile.address;
    var queue = CmdQueue;
    var that = this;
    queue.quit();// quit previous if needed
    queue.bindDevice({ address: address });
    queue.bindCallback({
      onOnlineBalls: function (moduleCount, battery, driver, infrared, color, touch, waist, arm) {
        that.debug.online_list.mc = 1;
        that.debug.online_list.battery = battery;
        that.debug.online_list.driver = driver;
        that.debug.online_list.infrared = infrared;
        that.debug.online_list.color = color;
        that.debug.online_list.touch = touch;
        that.debug.online_list.waist = waist;
        that.debug.online_list.arm = arm;
        if (that.onlineCallback) that.onlineCallback([1, battery, driver, infrared, color, touch, waist, arm]);
        that.onlineCallback = null;
      },
      onDebugDriver: function (module, revolution, position) {
        // that.debug.data = { revolution: revolution, position: position };
        var angles = (position / 1600 * 360).toFixed(2);
        var rounds = (position / 1600).toFixed(2);
        if (that.debugCallbackDriver) that.debugCallbackDriver(angles, rounds);
        that.debugCallbackDriver = null;
      },
      onDebugColor: function (module, mode, number) {
        // that.debug.data = { number: number };
        if (that.debugCallbackColor) that.debugCallbackColor(mode, number);
        that.debugCallbackColor = null;
      },
      onDebugInfrared: function (module, distance) {
        // that.debug.data = { distance: distance };
        if (that.debugCallbackIR) that.debugCallbackIR(distance);
        that.debugCallbackIR = null;
      },
      onGetFirmwareVersion: function (version) {
        that.firmware_version = version;
        if (typeof that.onGetFirmwareVersionCb === 'function') that.onGetFirmwareVersionCb(version);
        that.onGetFirmwareVersionCb = null;
      },
      onFirmwareUpgradePrepareSuccess: function() {
        if (typeof that.onFirmwareUpgradePrepareSuccess === 'function') that.onFirmwareUpgradePrepareSuccess()
        that.onFirmwareUpgradePrepareSuccess = null
      },
      onFirmwareUpgradePrepareFailed: function() {
        if (typeof that.onFirmwareUpgradePrepareFailed === 'function') that.onFirmwareUpgradePrepareFailed()
        that.onFirmwareUpgradePrepareFailed = null
      },
      onDebugBattery: function (module, battery) {
        if (module === 255) {
          if (that.pollBatteryCallback) that.pollBatteryCallback(battery);
          that.pollBatteryCallback = null;
        } else {
          if (that.debugCallbackBattery) that.debugCallbackBattery(battery);
          that.debugCallbackBattery = null;
        }
      },
      onDebugMasterControl: function (roll, yaw, pitch) {
        if (that.debugCallbackMC) that.debugCallbackMC(roll, yaw, pitch);
        that.debugCallbackMC = null;
      },
      onDebugTestDriverSuccess: function (module) {
        if (that.testDriverCallback && that.testDriverCallback.success) that.testDriverCallback.success();
        // that.testDriverCallback = null;
      },
      onDebugTestDriverFailed: function (module) {
        if (that.testDriverCallback && that.testDriverCallback.fail) that.testDriverCallback.fail();
        // that.testDriverCallback = null;
      },
      onSingleDriverPolarity: function (module, polarity) {
        if (that.driverPolarityCallback) that.driverPolarityCallback();
        that.driverPolarityCallback = null;
      },
      onDebugWaistJoin: function (angle) {
        if (that.debugCallbackWaist) that.debugCallbackWaist(angle);
        that.debugCallbackWaist = null;
      },
      onDebugArmJoin: function (angle) {
        if (that.debugCallbackArm) that.debugCallbackArm(angle);
        that.debugCallbackArm = null;
      },
      onDebugTouchSensor: function (pressed) {
        if (that.debugCallbackTouch) that.debugCallbackTouch(pressed);
        that.debugCallbackTouch = null;
      },
      onSetWaistJoinAngleSuccess: function () {
        if (that.setWaistJoinAngleCallback && that.setWaistJoinAngleCallback.success) that.setWaistJoinAngleCallback.success();
        that.setWaistJoinAngleCallback = null;
      },
      onSetWaistJoinAngleFailed: function () {
        if (that.setWaistJoinAngleCallback && that.setWaistJoinAngleCallback.fail) that.setWaistJoinAngleCallback.fail();
        that.setWaistJoinAngleCallback = null;
      },
      onSetArmJoinAngleSuccess: function () {
        if (that.setArmJoinAngleCallback && that.setArmJoinAngleCallback.success) that.setArmJoinAngleCallback.success();
        that.setArmJoinAngleCallback = null;
      },
      onSetArmJoinAngleFailed: function () {
        if (that.setArmJoinAngleCallback && that.setArmJoinAngleCallback.fail) that.setArmJoinAngleCallback.fail();
        that.setArmJoinAngleCallback = null;
      },
      onSingleDriverPolarityFetched: function (polarity) {
        if (that.getDriverPolarityCallback) that.getDriverPolarityCallback(polarity);
        that.getDriverPolarityCallback = null;
      },
      onSingleDriverReset: function (module) {
        console.log('onSingleDriverReset: module seq -> ' + module);
      },

      // callbacks for all the scenes
      onSetProfileSuccess: function () {
        if (that.setProfileCallbacks && that.setProfileCallbacks.success) that.setProfileCallbacks.success();
        that.setProfileCallbacks = null;
      },
      onSetProfileFailed: function () {
        if (that.setProfileCallbacks && that.setProfileCallbacks.fail) that.setProfileCallbacks.fail();
        that.setProfileCallbacks = null;
      },
      // callbacks for getting profiles
      onGetProfileSuccess: function (color, name) {
        if (that.getProfileCallback) that.getProfileCallback(color, name);
        that.getProfileCallback = null;
      },
      onGetProfileFailed: function () {
        if (that.getProfileCallback) that.getProfileCallback('white', 'Mabot');
        that.getProfileCallback = null;
      },
      onNoProfile: function () {
        this.onGetProfileFailed();
      },
      // callbacks for init
      onInitSuccess: function () {
        if (that.mabotInitCallback && that.mabotInitCallback.success) that.mabotInitCallback.success();
        that.mabotInitCallback = null;
      },
      onInitFailed: function () {
        if (that.mabotInitCallback && that.mabotInitCallback.fail) that.mabotInitCallback.fail();
        that.mabotInitCallback = null;
      },
      onSwitchToBleSuccess: function () {
        console.log('onSwitchToBleSuccess()');
      },
      onSwitchToBleFailed: function () {
        console.log('onSwitchToBleFailed()');
      },
      onSwitchToLuaSuccess: function () {
        console.log('onSwitchToLuaSuccess()');
      },
      onSwitchToLuaFailed: function () {
        console.log('onSwitchToLuaFailed()');
      },
      isLuaRunning: function (run) {
        console.log('isLuaRunning: ' + run); // noused?
      },
      onBatchColor: function (arr) {
        if (that.onBatchColor) that.onBatchColor(arr);
        that.onBatchColor = null;
      },
      onBatchInfrared: function (arr) {
        if (that.onBatchInfrared) that.onBatchInfrared(arr);
        that.onBatchInfrared = null;
      },
      onBatchTouch: function (arr) {
        if (that.onBatchTouch) that.onBatchTouch(arr);
        that.onBatchTouch = null;
      },
      onBatchWaist: function (arr) {
        if (that.onBatchWaist) that.onBatchWaist(arr);
        that.onBatchWaist = null;
      },
      onBatchArm: function (arr) {
        if (that.onBatchArm) that.onBatchArm(arr);
        that.onBatchArm = null;
      },
      onBatchBattery: function(arr) {
        if (that.onBatchBattery) that.onBatchBattery(arr);
        that.onBatchBattery = null;
      },
      onBatchDriver: function(arr) {
        if (that.onBatchDriver) that.onBatchDriver(arr);
        that.onBatchDriver = null;
      }
    });
    queue.loop();

    var subscribeCallback = function () {
      // that.pollOnlineBalls();

      // 1. fetch online firmware version
      // TODO: move it to device ready?
      // that.fetchOnlineFirmwareVersion();
      // 2. fetch mabot firmware version
      that.fetchDeviceFirmwareVersion(); //获取主控版本 

      if (that.activeDevice && blinkAndBeep) that.sendMakeABlinkForBleConnection(that.color2Byte(that.activeDevice.color));
    };
    // NOTE: attentions
    // ble on ios should discover all the related services and characteristics
    // after reconnect it
    if (window.cordova.platformId === 'ios') {
      that._discoverWrapper(function (res) {
        queue.subscribe(subscribeCallback);
      }, function (err) {
        console.error('discoverWrapper error: ' + JSON.stringify(err));
      }, { address: address });
    } else {
      that._discoverWrapper(function (res) {
        queue.subscribe(subscribeCallback);
      }, function (err) {
        console.error('discoverWrapper error: ' + JSON.stringify(err));
      }, { address: address });
    }
  },

  _unbindDevice: function () {
    this.activeDevice = null;
    var queue = CmdQueue;
    queue.unbindDevice(); // should unbind the device
    queue.unbindCallback();
    queue.unbindTransferCallback();
    queue.quit();
  },

  disconnect: function (cb) {
    var that = this;
    var queue = CmdQueue;
    queue.release(function () {
      that._unbindDevice();
      that.callbackWhenDisconnect();
      if (cb) cb();
    });
  },

  byteToColor: function (byte) {
    switch (byte) {
      case 0x00:
        return 'none';
      case 0x01:
        return 'red';
      case 0x02:
        return 'green';
      case 0x03:
        return 'yellow';
      case 0x04:
        return 'blue';
      case 0x05:
        return 'purple';
      case 0x06:
        return 'cyan';
      case 0x07:
        return 'orange';
      case 0x08:
        return 'white';
      default: throw new Error('Unknown color code: ' + byte);
    }
  },

  color2Byte: function (color) {
    switch (color) {
      case 'red':
        return 0x01;
      case 'green':
        return 0x02;
      case 'yellow':
        return 0x03;
      case 'blue':
        return 0x04;
      case 'purple':
        return 0x05;
      case 'cyan':
        return 0x06;
      case 'orange':
        return 0x07;
      case 'white':
        return 0x08;
      default: throw new Error('Unknown color: ' + color);
    }
  },

  // 设置昵称， 颜色
  setProfileCallbacks: null,
  setProfile: function (name, color, success, fail) {
    var that = this;
    if (!this.activeDevice || !name || !color) {
      if (fail) fail();
      return;
    }

    if (name.length > 10) {
      if (fail) fail(new Error('Length limit!'));
      return;
    }
    this.isSettingProfile = true;
    color = this.color2Byte(color);
    var queue = CmdQueue;
    // all the callbacks will be used onece async
    // @see bindCallback when connection established
    this.setProfileCallbacks = {
      success: success,
      fail: fail
    };
    queue.pushCmd({
      cmd: Cmd.CMD_SET_PROFILE,
      data: { color: color, name: name },
      timestamp: new Date().getTime()
    });
  },

  // 查询昵称， 颜色
  getProfileCallback: null,
  getProfile: function (cb) {
    this.getProfileCallback = cb;
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_GET_PROFILE,
      data: null,
      timestamp: new Date().getTime()
    });
  },

  // 查询mabot是否已经init
  mabotInitCallback: null,
  mabotInit: function (success, fail) {
    this.mabotInitCallback = {
      success: success,
      fail: fail
    };
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_INIT,
      data: null,
      timestamp: new Date().getTime()
    });
    var that = this;
    // issue: time out for init
    setTimeout(function () {
      if (that.mabotInitCallback && that.mabotInitCallback.success) that.mabotInitCallback.success();
      that.mabotInitCallback = null;
    }, 1000);
  },

  // 驱动球运动 no callbacks
  // NOTE: all the cmds will sample with a 5Hz frequency internally
  _lastMotionMillis: 0,
  _driverMotionTimer: null,
  driverMotion: function (x, y, speed) {
    if (!this.activeDevice) {
      if (this._driverMotionTimer) clearInterval(this._driverMotionTimer);
      this._driverMotionTimer = null;
      return;
    }
    // 当速度不为0时所有motion指令以采样 3.33Hz (300ms frequency)
    // 进入指令队列, 速度为0时为停止指令，不允许过滤
    x = Number((x * 1).toFixed(0));
    var now = new Date().getTime();
    if (speed !== 0) {
      if (this._lastMotionMillis > 0) {
        var delta = now - this._lastMotionMillis;
        if (delta < 300) {
          // ignore it
          //console.log('motion cmd ignored!');
          return;
        } else {
          this._lastMotionMillis = now;
        }
      } else {
        this._lastMotionMillis = now;
      }
    }
    var queue = CmdQueue;
    if (this._driverMotionTimer) clearInterval(this._driverMotionTimer);
    this._driverMotionTimer = null;
    var cmd = {
      cmd: Cmd.CMD_MOTION,
      data: { x: x, y: y, speed: speed },
      timestamp: new Date().getTime()
    };
    var that = this;
    if (x === 0 && y === 0) {
      queue.pushCmd(cmd);
    } else {
      var task = function () {
        queue.pushCmd(cmd);
      };
      this._driverMotionTimer = setInterval(task, 500);
      task();
    }
  },

  // 陀螺仪传感器，同触摸盘
  sensorMotion: function (x, y, speed) {
    this.driverMotion(x, y, speed);
  },
  // FIXME: more intelligent way?
  _lastJoinMotionMillis: 0,
  joinMotion: function (x, y) {
    var mock = function () {
      console.log('empty!');
    };
    var now = new Date().getTime();
    if (x !== 90 && y !== 90) {
      if (this._lastJoinMotionMillis > 0) {
        var delta = now - this._lastJoinMotionMillis;
        if (delta < 500) {
          return;
        } else {
          this._lastJoinMotionMillis = now;
        }
      }
    } else {
      this._lastJoinMotionMillis = now;
    }
    this.setWaistJoinAngle(1, x, mock, mock);
    this.setArmJoinAngle(1, y, mock, mock);
    // this.setArmJoinAngle(2, 90 + (90 - y), mock, mock);
    // FIXME: more intelligent way
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
      data: { sequence: 2, angle: 90 + (90 - y) },
      timestamp: new Date().getTime()
    });
  },
  // @deprecate noused anymore
  joinMotionPlus: function (x, y) {
    // x = cc.bell.jointMap ? (cc.bell.jointMap.w1 === 1 ? x : -x) : x;
    // y = cc.bell.jointMap ? (cc.bell.jointMap.a1 === 1 ? y : -y) : y;
    this.setWaistJoinAngle(1, x);
    this.setArmJoinAngle(1, y);
  },

  // 定时查询电池总量 (用于主控制界面电量显示)
  pollBatteryCallback: null,
  startPollBattery: function (cb) {
    this.stopPollBattery(); // if needed
    var that = this;
    var task = function () {
      var queue = CmdQueue;
      that.pollBatteryCallback = cb;
      queue.pushCmd({
        cmd: Cmd.CMD_DEBUG_BATTERY,
        data: { sequence: 255 },
        timestamp: new Date().getTime()
      });
    }
    this.batteryTask = setInterval(function () {
      task();
    }, 30 * 1000); // 30 seconds
    task(); // first time right now
  },
  // 停止查询电池总量
  stopPollBattery: function () {
    if (this.batteryTask) clearInterval(this.batteryTask);
    this.batteryTask = null;
    this.pollBatteryCallback = null;
  },

  EMOTION_HAPPY: 0x01,
  EMOTION_SURPRISE: 0x02,
  EMOTION_GLAD: 0x03,
  emotion: function (code) {
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_EMOTIONS,
      data: { emotion: code },
      timestamp: new Date().getTime()
    });
  },

  _light: function (module, mode, color) {
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_LIGHT,
      data: { module: module, mode: mode, color: color },
      timestamp: new Date().getTime()
    });
  },

  LIGHT_MODULE_MASTER_CONTROL: 0x01,
  LIGHT_MODULE_DRIVER: 0x02,
  LIGHT_MODULE_ALL: 0x03,
  masterControlLight: function (mode, color) {
    //console.log('主控灯光: 模式' + mode + ' 颜色' + color);
    this._light(this.LIGHT_MODULE_MASTER_CONTROL, mode, color);
  },

  driverLight: function (mode, color) {
    //console.log('驱动球灯光: 模式' + mode + ' 颜色' + color);
    this._light(this.LIGHT_MODULE_DRIVER, mode, color);
  },

  lightTogether: function (mode, color) {
    this._light(this.LIGHT_MODULE_ALL, mode, color);
  },

  // 下载
  // isScript: true  regard as lua script to download into Mabot
  // isScript: false regard as firmware dispatch to Mabot for upgradation
  downloadProgress: 0,
  LUA_SCRIPTS_MAP: {
    // 避障机器人
    barrier: 'wheel_1 = {0}\r\nwheel_2 = {1}\r\n',
    // 敲敲乐
    cockpeck: 'wheel_1 = {0}\r\nwheel_2 = {1}\r\nwheel_3 = {2}\r\nwheel_4 = {3}\r\nvservo_1 = {4}\r\nvservo_2 = {5}',
    // 跟随机器人
    follow: 'wheel_1 = {0}\r\nwheel_2 = {1}',
    // 镭射枪
    gun: 'wheel_1 = {0}\r\nwheel_2 = {1}',
    // 巡线机器人
    line: 'wheel_1 = {0}\r\nwheel_2 = {1}',
    // 大M机器人
    M: 'wheel_1 = {0}\r\nwheel_2 = {1}\r\nvservo_1 = {2}\r\nvservo_2 = {3}\r\nhservo_1 = 1',
    // 变形摩托机器人
    motorcycle: 'wheel_1 = {0}\r\nwheel_2 = {1}\r\nwheel_3 = {2}\r\nwheel_4 = {3}\r\nvservo_1 = {4}\r\nvservo_2 = {5}',
    // 甩力自平衡
    swing_balance: 'wheel_1 = {0}\r\nwheel_2 = {1}',
    // 小m机器人
    m: 'wheel_1 = {0}\r\nwheel_2 = {1}\r\nvservo_1 = {2}\r\nvservo_2 = {3}',
    // 变速小车
    at_vehicle: 'wheel_1 = {0}\r\nwheel_2 = {1}',
    // 自动抓车
    scratch_at: 'wheel_1 = {0}\r\nwheel_2 = {1}\r\nwheel_3 = {2}\r\nwheel_4 = {3}\r\nhservo_1 = {4}\r\nvservo_1 = {5}',
    // 蛇形车
    snake: 'wheel_1 = {0}\r\nwheel_2 = {1}\r\nwheel_3 = {2}\r\nwheel_4 = {3}\r\nvservo_1 = {4}\r\nvservo_2 = {5}',
  },
  _mapLuaScript: function (template, args) {
    // console.log('_mapLuaScript:( ' + template.length + ' ' + template);
    for (var i = 0; i < args.length; i++) {
      template = template.replace('{' + i + '}', args[i]);
    }
    // console.log('_mapLuaScript:) ' + template.length + ' ' + template);
    return template;
  },
  // util func
  _string2Bytes: function (str) {
    return bluetoothle.stringToBytes(str);
  },
  _bytes2String: function (bytes) {
    return bluetoothle.bytesToString(bytes);
  },
  _overrideScriptHeader: function (srcBytes, headerBytes) {
    console.log('Before: ' + this._bytes2String(Array.prototype.slice.call(srcBytes, 0, headerBytes.length)));
    for (var i = 0; i < headerBytes.length; i++) {
      srcBytes[i] = headerBytes[i];
    }
    console.log('After : ' + this._bytes2String(Array.prototype.slice.call(srcBytes, 0, headerBytes.length)));
  },
  _filterFile: function (scriptType, result) {
    var mapString = null;
    var mapBytes = null;
    switch (scriptType) {
      case cc.bell.scriptType.LUA_BARRIER:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.barrier, [
          cc.bell.demoMap.barrier.m2,
          cc.bell.demoMap.barrier.m1
        ]);
        break;
      case cc.bell.scriptType.LUA_COCKPECK:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.cockpeck, [
          cc.bell.demoMap.cockpeck.m2,
          cc.bell.demoMap.cockpeck.m4,
          cc.bell.demoMap.cockpeck.m3,
          cc.bell.demoMap.cockpeck.m1,
          cc.bell.demoMap.cockpeck.a1,
          cc.bell.demoMap.cockpeck.a2, //v1, v2
        ]);
        break;
      case cc.bell.scriptType.LUA_FOLLOW:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.follow, [
          cc.bell.demoMap.follow.m1,
          cc.bell.demoMap.follow.m2
        ]);
        break;
      case cc.bell.scriptType.LUA_GUN:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.gun, [
          cc.bell.demoMap.gun.m2,
          cc.bell.demoMap.gun.m1
        ]);
        break;
      case cc.bell.scriptType.LUA_LINE:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.line, [
          cc.bell.demoMap.line.m2,
          cc.bell.demoMap.line.m1,
        ]);
        break;
      case cc.bell.scriptType.LUA_M:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.M, [
          cc.bell.demoMap.M.m1,
          cc.bell.demoMap.M.m2,
          cc.bell.demoMap.M.a1,
          cc.bell.demoMap.M.a2, //v1, v2
        ]);
        break;
      case cc.bell.scriptType.LUA_MOTORCYCLE:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.motorcycle, [
          cc.bell.demoMap.motorcycle.m4,
          cc.bell.demoMap.motorcycle.m1,
          cc.bell.demoMap.motorcycle.m3,
          cc.bell.demoMap.motorcycle.m2,
          cc.bell.demoMap.motorcycle.a1,
          cc.bell.demoMap.motorcycle.a2, //v1, v2
        ]);
        break;
      case cc.bell.scriptType.LUA_SWING_BALANCE:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.swing_balance, [
          cc.bell.demoMap.swing_balance.m1,
          cc.bell.demoMap.swing_balance.m2
        ]);
        break;
      case cc.bell.scriptType.LUA_m:
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.m, [
          cc.bell.demoMap.m.m1,
          cc.bell.demoMap.m.m2,
          cc.bell.demoMap.m.a1,
          cc.bell.demoMap.m.a2
        ]);
        break;
      case cc.bell.scriptType.TITAN_DRIVER_MOTION:
        // console.log(this._bytes2String(result));
        break;
      case cc.bell.scriptType.LUA_SNAKE: // 蛇形车
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.snake, [
          cc.bell.demoMap.snake.m2,
          cc.bell.demoMap.snake.m4,
          cc.bell.demoMap.snake.m1,
          cc.bell.demoMap.snake.m3,
          cc.bell.demoMap.snake.a1,
          cc.bell.demoMap.snake.a2
        ]);
        break;
      case cc.bell.scriptType.LUA_SCRATCH_AT: // 自动抓车
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.scratch_at, [
          cc.bell.demoMap.scratch_at.m1,
          cc.bell.demoMap.scratch_at.m3,
          cc.bell.demoMap.scratch_at.m2,
          cc.bell.demoMap.scratch_at.m4,
          cc.bell.demoMap.scratch_at.w1,
          cc.bell.demoMap.scratch_at.a1
        ]);
        break;
      case cc.bell.scriptType.LUA_AT_VEHICLE: // 变速小车
        mapString = this._mapLuaScript(this.LUA_SCRIPTS_MAP.at_vehicle, [
          cc.bell.demoMap.at_vehicle.m2,
          cc.bell.demoMap.at_vehicle.m1
        ]);
        break;
      default:
        // do nothing
        break;
    }
    if (mapString) {
      mapBytes = this._string2Bytes(mapString);
      this._overrideScriptHeader(result, mapBytes);
    }
    return result;
  },
  _readResFile: function (scriptType, path, cb) {
    var that = this;
    resolveLocalFileSystemURL(cordova.file.applicationDirectory + path, function (entry) {
      entry.file(function (file) {
        var reader = new FileReader();
        reader.onloadend = function () {

          var res = new Uint8Array(this.result);
          res = that._filterFile(scriptType, res);
          if (cb) cb(res);
        };
        reader.readAsArrayBuffer(file);
      }, function (err) {
        console.error('read res file error ' + JSON.stringify(err));
      });
    }
    );
  },

  stopLua: function () {
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_ENV_SWITCH_TO_BLE,
      data: null,
      timestamp: new Date().getTime()
    });
  },

  /**
  * change logs:
  * 1. change: Modified the isScript to cc.bell.scriptType @2017-5-12 9:46am
  * by tinychou
  *    change: do not auto-run the script after it downloaded. @2017-5-12 9:54am
  * by tinychou
  *    change: reset the download progress when downloading failed.
  * by tinychou @2017-7-2 4:59pm
  *    change: add parameter instantRun -- run after download it or not
  */
  progressCallback: null,
  fileTransfer: function (scriptType, path, progressCallback, instantRun) {
    var queue = CmdQueue;
    if (!this.isConnected()) { if (progressCallback) progressCallback(-1); return; } // 还没连接呢
    if (this.downloadProgress != 0) { if (progressCallback) progressCallback(-1); return; } // 已经有脚本在下载
    var that = this;
    this.progressCallback = progressCallback;
    this._readResFile(scriptType, path, function (bytes) {
      var raw = Array.from(bytes);
      var length = raw.length;
      console.log('file length: ' + (length / 1024).toFixed(2) + ' Kb. ' + length + ' bytes');

      var CHUNK_SIZE = (window.cordova.platformId === 'android') ? 1024 : 256;//128;
      var TOTAL_SIZE = length;
      var chunkCount = parseInt(TOTAL_SIZE / CHUNK_SIZE) +
        ((Math.round(TOTAL_SIZE % CHUNK_SIZE) == 0) ? 0 : 1);
      var chunkSeq = 1;
      console.log('分块数: ' + chunkCount);
      queue.bindTransferCallback({
        onFileTransferStartSuccess: function () {
          console.log('onFileTransferStartSuccess()');
          // data
          var rawData, chunkSize, seqNumber;
          if (chunkCount === 1) {
            rawData = raw;
            chunkSize = TOTAL_SIZE;
            seqNumber = chunkSeq;
          } else {
            rawData = raw.slice(0, CHUNK_SIZE);
            chunkSize = CHUNK_SIZE;
            seqNumber = chunkSeq;
          }
          queue.pushCmd({
            cmd: Cmd.CMD_FILE_TRANSFER_DATA,
            data: { rawData: rawData, chunkSize: chunkSize, seqNumber: seqNumber },
            timestamp: new Date().getTime()
          });
        },
        onFileTransferStartFailed: function () {
          console.log('onFileTransferStartFailed()');
          if (progressCallback) progressCallback(-1);
          that.progressCallback = null;
        },
        onFileTransferEndSuccess: function () {
          console.log('onFileTransferEndSuccess()');
          that.downloadProgress = 0;
          // 立即执行
          if (instantRun) {
            queue.pushCmd({
              cmd: Cmd.CMD_ENV_SWITCH_TO_LUA,
              data: null,
              timestamp: new Date().getTime()
            });
          }
          if (progressCallback) progressCallback(100); // 真正结束时刻
          that.progressCallback = null;
        },
        onFileTransferEndFailed: function () {
          console.log('onFileTransferEndFailed()');
          that.downloadProgress = 0; // reset for next downloading preparation
          if (progressCallback) progressCallback(-1); // -1 表示下载失败
          that.progressCallback = null;
        },
        onFileTransferDataSuccess: function () {
          console.log('onFileTransferDataSuccess()');
          that.downloadProgress = (chunkSeq * 100 / chunkCount).toFixed(0);
          if (that.downloadProgress < 100 && progressCallback) progressCallback(that.downloadProgress);
          chunkSeq++;
          if (chunkSeq <= chunkCount) {
            if (chunkSeq === chunkCount) {
              queue.pushCmd({
                cmd: Cmd.CMD_FILE_TRANSFER_DATA,
                data: { rawData: raw.slice((chunkSeq - 1) * CHUNK_SIZE, TOTAL_SIZE), chunkSize: TOTAL_SIZE - (chunkSeq - 1) * CHUNK_SIZE, seqNumber: chunkSeq },
                timestamp: new Date().getTime()
              });
            } else {
              queue.pushCmd({
                cmd: Cmd.CMD_FILE_TRANSFER_DATA,
                data: { rawData: raw.slice((chunkSeq - 1) * CHUNK_SIZE, chunkSeq * CHUNK_SIZE), chunkSize: CHUNK_SIZE, seqNumber: chunkSeq },
                timestamp: new Date().getTime()
              });
            }
          } else {
            // delay for 500 ms
            setTimeout(function () {
              // 结束了,发结束帧
              queue.pushCmd({
                cmd: Cmd.CMD_FILE_TRANSFER_END,
                data: { totalChunk: --chunkSeq, totalLength: TOTAL_SIZE },
                timestamp: new Date().getTime()
              });
            }, 500);
          }
        },
        onFileTransferDataFailed: function () {
          console.log('onFileTransferDataFailed()');
        }
      });
      // start
      queue.pushCmd({
        cmd: Cmd.CMD_FILE_TRANSFER_START,
        data: { dataLength: TOTAL_SIZE, chunkCount: chunkCount },
        timestamp: new Date().getTime()
      });
    });
  },

  // 注册断连监听
  // 蓝牙断连监听
  _disconnectListeners: [],
  _reconnectCallbacks: [],
  registerDisconnectNotifyWithConnectIcon: function (context, icon) {
    var isBtn = icon instanceof ccui.Button;
    var isImg = icon instanceof ccui.ImageView;
    if (isBtn) {
      icon.loadTextures(this.isConnected() ? res.Common_connect_png : res.Common_disconnect_png);
    } else if (isImg) {
      icon.loadTexture(this.isConnected() ? res.Common_connect_png : res.Common_disconnect_png);
    }
    this.registerDisconnectNotify(context, function () {
      // 断开
      if (isBtn) {
        icon.loadTextures(res.Common_disconnect_png);
      } else if (isImg) {
        icon.loadTexture(res.Common_disconnect_png);
      }
    }, function () {
      // 重新连接上
      if (isBtn) {
        icon.loadTextures(res.Common_connect_png);
      } else if (isImg) {
        icon.loadTexture(res.Common_connect_png);
      }
    });
  },
  _connectListeners: [],
  registerConnectNotify: function (listener) {
    var that = this;
    var l = cc.EventListener.create({
      event: cc.EventListener.CUSTOM,
      eventName: that.EVENT_CONNECT,
      callback: function (event) {
        if (listener) listener();
      },
    });
    cc.eventManager.addListener(l, 1);
    this._connectListeners.push(l);
  },
  unregisterConnectNotify: function () {
    var l = this._connectListeners.shift();
    cc.eventManager.removeListener(l);
  },
  registerDisconnectWithoutNotify: function (context) {
    var that = this;
    this.registerDisconnectNotify(context, function () {
      setTimeout(function () {
        that.connect(that.offlineDevice, function () {
          var cb = that._reconnectCallbacks.length > 0 ? that._reconnectCallbacks[0] : null;
          if (cb) cb();
        }, null, false);
      }, 1000);
    }, null, true);
  },
  registerDisconnectNotify: function (context, disconnectListener, reconnectSuccessCallback, shouldNotAlert) {
    var that = this;
    var listener = cc.EventListener.create({
        event: cc.EventListener.CUSTOM,
        eventName: BleApis.EVENT_DISCONNECT,
        callback: function (event) {
          // 如果有在下载demo，需要将下载中断，并且通知ui
          that.downloadProgress = 0;
          if (that.progressCallback) {
            that.progressCallback(-1); // failed
            that.progressCallback = null;
          }
          // 清理所有的timer(onlineTask, debugTask, _driverMotionTimer, _testDriverTimer)
          if (that.onlineTask) {
            clearInterval(that.onlineTask);
            that.onlineTask = null;
          }
          if (that.debugTask) {
            clearInterval(that.debugTask);
            that.debugTask = null;
          }
          if (that._driverMotionTimer) {
            clearInterval(that._driverMotionTimer);
            that._driverMotionTimer = null;
          }
          if (that._testDriverTimer) {
            clearInterval(that._testDriverTimer);
            that._testDriverTimer = null;
          }
          // clear all the cmds in the queue
          var queue = CmdQueue;
          queue.clear();

          that.debug.online_list.mc = 0;
          that.debug.online_list.battery = 0;
          that.debug.online_list.driver = 0;
          that.debug.online_list.infrared = 0;
          that.debug.online_list.color = 0;
          that.debug.online_list.touch = 0;
          that.debug.online_list.waist = 0;
          that.debug.online_list.arm = 0;

          if (!shouldNotAlert) that._alertDisconnect(context);
          // 断开连接的自定义回调
          if (disconnectListener) disconnectListener();
      }
    });
    cc.eventManager.addListener(listener, 1);
    this._disconnectListeners.push(listener);
    // 重连接成功后的监听回调，例如主控界面的连接icon需得知重新连接上设备后，更新为已连接图标
    // 此监听将在 #_alertDisconnect 中重新连接成功后消费掉
    if (reconnectSuccessCallback) this._reconnectCallbacks.push(reconnectSuccessCallback);
    else this._reconnectCallbacks.push(null);
  },
  _disconnectDialogIsShown: false,
  _timeoutDialog: null,
  _timeoutTask: null,
  _reconnectDialog: null,
  _alertDisconnect: function (context) {
    var that = this;
    if (this._disconnectDialogIsShown) return;
    if (this._timeoutTask) { clearTimeout(this._timeoutTask); this._timeoutTask = null; }
    if (this._reconnectDialog) {
      this._reconnectDialog.hide();
      this._reconnectDialog = null;
    }
    var dialog = new DoubleActionsMessageDialog(cc.localization.getString('Disconnected'),
      cc.localization.getString('CANCEL'), function () {
        dialog.hide();
        that._disconnectDialogIsShown = false;
      }, cc.localization.getString('Reconnect'), function () {
        dialog.hide();
        that._disconnectDialogIsShown = false;
        // TODO: reconnect the previous device
        var waiting = new LoadingLayer();
        waiting.show(context);
        that.connect(that.offlineDevice, function () {
          waiting.hide();
          if (that._timeoutTask) { clearTimeout(that._timeoutTask); that._timeoutTask = null; }
          if (that._timeoutDialog) { that._timeoutDialog.hide(); that._timeoutDialog = null; }
          var reconnectDialog = new SingleMessageDialog(cc.localization.getString('ReconnectSuccess'), cc.localization.getString('OK'), function () {
            reconnectDialog.hide();
            that._reconnectDialog = null;
          });
          reconnectDialog.show(context);
          that._reconnectDialog = reconnectDialog;
          var cb = that._reconnectCallbacks.length > 0 ? that._reconnectCallbacks[0] : null;
          if (cb) cb();
        }, function () {
          waiting.hide();
          if (that._timeoutTask) { clearTimeout(that._timeoutTask); that._timeoutTask = null; }
          if (that._timeoutDialog) { that._timeoutDialog.hide(); that._timeoutDialog = null; }
          that._alertDisconnect.call(that, context);
        }, false);

        // when the mabot is not turned on by user
        // we shoul tell him we can not reconnect the mabot
        // util him turn on the power.
        // TIME_OUT should be more than 5 seconds that is would be better.
        that._timeoutTask = setTimeout(function () {
          that._timeoutTask = null;
          if (that._disconnectDialogIsShown) return;
          if (!that.isConnected()) {
            waiting.hide();
            var timeoutDialog = new SingleMessageDialog(cc.localization.getString('ConnectTimeout'), cc.localization.getString('OK'), function () {
              timeoutDialog.hide();
              that._timeoutDialog = null;
            });
            timeoutDialog.show(context);
            that._timeoutDialog = timeoutDialog; // 保存超时弹窗引用
          } else {
            // has been reconnected and do nothing
          }
        }, 5000);
      });
    dialog.show(context);
    this._disconnectDialogIsShown = true;
  },
  // 解除断连监听
  unregisterDisconnectNotify: function () {
    var listener = this._disconnectListeners.shift();
    if (listener) cc.eventManager.removeListener(listener);
    this._disconnectDialogIsShown = false;
    this._reconnectCallbacks.shift(); // 移除栈底监听
  },

  // 在线球列表
  onlineCallback: null,
  startPollBallsList: function (cb) {
    this.stopPollBallsList(); // stop if needed
    var that = this;
    var task = function () {
      var queue = CmdQueue;
      that.onlineCallback = cb;
      queue.pushCmd({
        cmd: Cmd.CMD_ONLINE_BALLS,
        timestamp: new Date().getTime()
      });
    };
    this.onlineTask = setInterval(task, 3000); // every 3 seconds
    task(); // first task
  },
  stopPollBallsList: function () {
    if (this.onlineTask) clearInterval(this.onlineTask);
    this.onlineTask = null;
  },
  // 调试
  // module  : @see ../src/MabotConfig.js bell.ballType
  // sequence: 1-15 by default
  // cb      : callback for result data formatted with a plain Object in JSON
  // mode    : only for color ball which have thress modes: color discrimination, reflection, environment
  debugCallback: null, // @deprecate
  debugCallbackMC: null,
  debugCallbackBattery: null,
  debugCallbackDriver: null,
  debugCallbackIR: null,
  debugCallbackColor: null,
  debugCallbackTouch: null,
  debugCallbackWaist: null,
  debugCallbackArm: null,
  startDebugMasterControl: function (cb) {
    this.startDebugBall(cc.bell.ballType.mainControl, 1, cb);
  },
  startDebugBattery: function (index, cb) {
    this.startDebugBall(cc.bell.ballType.battery, index, cb);
  },
  startDebugDriver: function (index, cb) {
    this.startDebugBall(cc.bell.ballType.driver, index, cb);
  },
  startDebugInfrared: function (index, cb) {
    this.startDebugBall(cc.bell.ballType.IR, index, cb);
  },
  startDebugColor: function (index, mode, cb) {
    this.startDebugBall(cc.bell.ballType.color, index, cb, mode);
  },
  startDebugBall: function (module, sequence, cb, mode) {
    this.stopDebugBall();
    var that = this;
    var queue = CmdQueue;
    var task = function () {
      switch (module) {
        case cc.bell.ballType.mainControl: {
          that.debugCallbackMC = cb;
          queue.pushCmd({
            cmd: Cmd.CMD_DEBUG_MASTER_CONTROL,
            data: null,
            timestamp: new Date().getTime()
          });
        }
          break;
        case cc.bell.ballType.battery: {
          that.debugCallbackBattery = cb;
          queue.pushCmd({
            cmd: Cmd.CMD_DEBUG_BATTERY,
            data: { sequence: sequence },
            timestamp: new Date().getTime()
          });
        }
          break;
        case cc.bell.ballType.driver: {
          that.debugCallbackDriver = cb;
          queue.pushCmd({
            cmd: Cmd.CMD_DEBUG_DRIVER,
            data: { sequence: sequence },
            timestamp: new Date().getTime()
          });
        }
          break;
        case cc.bell.ballType.IR: {
          that.debugCallbackIR = cb;
          queue.pushCmd({
            cmd: Cmd.CMD_DEBUG_INFRARED,
            data: { sequence: sequence },
            timestamp: new Date().getTime()
          });
        }
          break;
        case cc.bell.ballType.color: {
          if (!mode) return;
          that.debugCallbackColor = cb;
          queue.pushCmd({
            cmd: Cmd.CMD_DEBUG_COLOR,
            data: { sequence: sequence, mode: mode },
            timestamp: new Date().getTime()
          });
        }
          break;
        case cc.bell.ballType.touch: {
          that.debugCallbackTouch = cb;
          queue.pushCmd({
            cmd: Cmd.CMD_DEBUG_TOUCH_SENSOR,
            data: { sequence: sequence },
            timestamp: new Date().getTime()
          });
        }
          break;
        case cc.bell.ballType.servoH: {
          that.debugCallbackWaist = cb;
          queue.pushCmd({
            cmd: Cmd.CMD_DEBUG_WAIST_JOIN,
            data: { sequence: sequence },
            timestamp: new Date().getTime()
          });
        }
          break;
        case cc.bell.ballType.servoV: {
          that.debugCallbackArm = cb;
          queue.pushCmd({
            cmd: Cmd.CMD_DEBUG_ARM_JOIN,
            data: { sequence: sequence },
            timestamp: new Date().getTime()
          });
        }
          break;
      }
    };
    this.debugTask = setInterval(task,
      module === cc.bell.ballType.driver ? 500 : 200); // every 200 ms
    task();
  },
  stopDebugBall: function () {
    this.debugCallback = null;
    this.debugCallbackMC = null;
    this.debugCallbackBattery = null;
    this.debugCallbackDriver = null;
    this.debugCallbackIR = null;
    this.debugCallbackColor = null;
    this.debugCallbackTouch = null;
    this.debugCallbackWaist = null;
    this.debugCallbackArm = null;
    if (this.debugTask) clearInterval(this.debugTask);
    this.debugTask = null;
  },
  // 测试驱动球
  testDriverCallback: null,
  _testDriverTimer: null,
  testDriver: function (sequence, power, success, fail, priority) {
    if (!this.activeDevice) {
      if (this._testDriverTimer) clearInterval(this._testDriverTimer);
      this._testDriverTimer = null;
      return;
    }
    power = Math.min(100, Math.max(-100, power));
    this.testDriverCallback = {
      success: success,
      fail: fail
    };
    var queue = CmdQueue;
    if (this._testDriverTimer) clearInterval(this._testDriverTimer);
    this._testDriverTimer = null;
    var cmd = {
      cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
      data: { sequence: sequence, power: power },
      timestamp: new Date().getTime(),
      priority: priority
    };
    var that = this;
    if (power === 0) {
      queue.pushCmd(cmd);
    } else {
      var task = function () {
        queue.pushCmd(cmd);
      };
      this._testDriverTimer = setInterval(task, 500);
      task();
    }
  },
  // 设置驱动球极性
  driverPolarityCallback: null,
  driverPolarity: function (sequence, polarity, cb) {
    var queue = CmdQueue;
    this.driverPolarityCallback = cb;
    queue.pushCmd({
      cmd: Cmd.CMD_SINGLE_DRIVER_POLARITY,
      data: { sequence: sequence, polarity: polarity },
      timestamp: new Date().getTime()
    });
    // this.testPolarity = polarity;
    // cb();
  },
  // color for single driver
  sendDebugMakeABlinkForDriver: function (sequence) {
    this._sendDebugMakeABlinkForDriver(sequence, 2);
  },
  _sendDebugMakeABlinkForDriver: function (sequence, color) {
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_SINGLE_DRIVER_LIGHT,
      data: { sequence: sequence, mode: 3/*cc.bell.waveMode.square*/, color: color }, // blink and green
      timestamp: new Date().getTime()
    });
    setTimeout(function () {
      queue.pushCmd({
        cmd: Cmd.CMD_SINGLE_DRIVER_LIGHT,
        data: { sequence: sequence, mode: 1/*cc.bell.waveMode.close*/, color: color }, // off
        timestamp: new Date().getTime()
      });
    }, 2000);
  },
  sendMakeABlinkForBleConnection: function (color) {
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_LIGHT,
      data: { module: 3/* mc and all drivers */, mode: 3/*cc.bell.waveMode.square*/, color: color },
      timestamp: new Date().getTime()
    });
    setTimeout(function () {
      queue.pushCmd({
        cmd: Cmd.CMD_LIGHT,
        data: { module: 3, mode: 4/*cc.bell.waveMode.sine*/, color: color },
        timestamp: new Date().getTime()
      });
    }, 2000);
    this.sendBeepSeqWhenConnected();
  },
  sendBeepSeqWhenConnected: function () {
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_BEEP,
      data: { beep: Beep.BEEP_CONNECTION },
      timestamp: new Date().getTime()
    });
    // setTimeout(function () {
    //   queue.pushCmd({
    //     cmd: Cmd.CMD_BEEP,
    //     data: { beep: Beep.BEEP_H_RE },
    //     timestamp: new Date().getTime()
    //   });
    // }, 250);
    // setTimeout(function () {
    //   queue.pushCmd({
    //     cmd: Cmd.CMD_BEEP,
    //     data: { beep: Beep.BEEP_H_MI },
    //     timestamp: new Date().getTime()
    //   });
    // }, 400);
    // setTimeout(function () {
    //   queue.pushCmd({
    //     cmd: Cmd.CMD_BEEP,
    //     data: { beep: Beep.BEEP_STOP },
    //     timestamp: new Date().getTime()
    //   });
    // }, 650);
  },
  makeABlinkWhenMapping: function (sequence) {
    switch (sequence) {
      case 1:
        this._sendDebugMakeABlinkForDriver(1, cc.bell.lightColor.red);
        break;
      case 2:
        this._sendDebugMakeABlinkForDriver(2, cc.bell.lightColor.green);
        break;
      case 3:
        this._sendDebugMakeABlinkForDriver(3, cc.bell.lightColor.yellow);
        break;
      case 4:
        this._sendDebugMakeABlinkForDriver(4, cc.bell.lightColor.blue);
        break;
    }
  },
  cockPeckHitWithMapping: function (sequence, reverse) {
    var reverseCoefficient = reverse ? -1 : 1;
    var that = this;
    var beltaAngle = 55; // 55度 ~= 0.3s
    var BELTA_MS = 300;
    sequence = cc.bell.jointMap['a' + sequence];
    // 1号球偏转范围为(90, 90 + beltaAngle)
    // 2号球偏转范围为(90, 90 - beltaAngle)
    beltaAngle *= (sequence === 1) ? 1 : -1;
    this.setArmJoinAngle(sequence, 90 + reverseCoefficient * beltaAngle);
    setTimeout(function () {
      that.setArmJoinAngle(sequence, 90);
    }, BELTA_MS);
  },
  makeARotateWhenMappingWaist: function (sequence) {
    var that = this;
    var angle = sequence === 1 ? 135 : 45;
    sequence = cc.bell.jointMap['w' + sequence];
    this.setWaistJoinAngle(sequence, angle);
    setTimeout(function () {
      that.setWaistJoinAngle(sequence, 90);
    }, 1000);
  },
  makeARotateWhenMappingArm: function (sequence) {
    var that = this;
    var angle = 135;
    sequence = cc.bell.jointMap['a' + sequence];
    this.setArmJoinAngle(sequence, 135);
    setTimeout(function () {
      that.setArmJoinAngle(sequence, 90);
    }, 1000);
  },
  lightUpOrDownDriversWhenMapping: function (isUp) {
    var queue = CmdQueue;
    var mode = isUp ? cc.bell.waveMode.open : cc.bell.waveMode.close;

    var m1 = 1;
    var m2 = 2;
    var m3 = 3;
    var m4 = 4;
    // 1号驱动球红色常亮
    queue.pushCmd({
      cmd: Cmd.CMD_SINGLE_DRIVER_LIGHT,
      data: { sequence: m1, mode: mode, color: cc.bell.lightColor.red },
      timestamp: new Date().getTime()
    });
    // 2号驱动球绿色常亮
    queue.pushCmd({
      cmd: Cmd.CMD_SINGLE_DRIVER_LIGHT,
      data: { sequence: m2, mode: mode, color: cc.bell.lightColor.green },
      timestamp: new Date().getTime()
    });
    // 3号驱动球黄色常亮
    queue.pushCmd({
      cmd: Cmd.CMD_SINGLE_DRIVER_LIGHT,
      data: { sequence: m3, mode: mode, color: cc.bell.lightColor.yellow },
      timestamp: new Date().getTime()
    });
    // 4号驱动球蓝色常亮
    queue.pushCmd({
      cmd: Cmd.CMD_SINGLE_DRIVER_LIGHT,
      data: { sequence: m4, mode: mode, color: cc.bell.lightColor.blue },
      timestamp: new Date().getTime()
    });
  },
  // 调试水平关节球
  startDebugWaistJoin: function (index, cb) {
    this.startDebugBall(cc.bell.ballType.servoH, index, cb);
  },
  // 调试摇摆关节球
  startDebugArmJoin: function (index, cb) {
    this.startDebugBall(cc.bell.ballType.servoV, index, cb);
  },
  // 调试触摸球
  startDebugTouchSensor: function (index, cb) {
    this.startDebugBall(cc.bell.ballType.touch, index, cb);
  },
  // 设置水平关节球角度
  setWaistJoinAngleCallback: null,
  _lastWaistJoinMotionMillis: 0,
  setWaistJoinAngle: function (index, angle, level, success, fail) {
    angle = Math.min(165, Math.max(15, angle));
    var queue = CmdQueue;
    var now = new Date().getTime();
    if (angle !== 90) {
      if (this._lastWaistJoinMotionMillis > 0) {
        var delta = now - this._lastWaistJoinMotionMillis;
        if (delta < 300) {
          return;
        } else {
          this._lastWaistJoinMotionMillis = now;
        }
      }
    } else {
      this._lastWaistJoinMotionMillis = now;
    }
    this.setWaistJoinAngleCallback = {
      success: success,
      fail: fail
    }
    queue.pushCmd({
      cmd: Cmd.CMD_SET_WAIST_JOIN_ANGLE,
      data: { sequence: index, angle: angle },
      timestamp: new Date().getTime(),
      riority: level
    });
  },
  // 设置摇摆关节球角度
  setArmJoinAngleCallback: null,
  _lastArmJoinMotionMillis: 0,
  setArmJoinAngle: function (index, angle, level, success, fail) {
    angle = Math.min(165, Math.max(15, angle));
    var queue = CmdQueue;
    var now = new Date().getTime();
    if (angle !== 90) {
      if (this._lastArmJoinMotionMillis > 0) {
        var delta = now - this._lastArmJoinMotionMillis;
        if (delta < 300) {
          return;
        } else {
          this._lastArmJoinMotionMillis = now;
        }
      }
    } else {
      this._lastArmJoinMotionMillis = now;
    }
    this.setArmJoinAngleCallback = {
      success: success,
      fail: fail
    };
    queue.pushCmd({
      cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
      data: { sequence: index, angle: angle },
      timestamp: new Date().getTime(),
      priority: level
    });
  },
  // 获取驱动球极性
  getDriverPolarityCallback: null,
  // testPolarity: 1,
  getDriverPolarity: function (sequence, cb) {
    var queue = CmdQueue;
    this.getDriverPolarityCallback = cb;
    queue.pushCmd({
      cmd: Cmd.CMD_SINGLE_DRIVER_POLARITY_FETCH,
      data: { sequence: sequence },
      timestamp: new Date().getTime()
    });
    // cb(this.testPolarity);
  },
  driverReset: function (sequence) {
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_SINGLE_DRIVER_RESET,
      data: { sequence: sequence },
      timestamp: new Date().getTime()
    });
  },
  //!! ATTENTIONS: alpha version
  // this is function that vector calculate by APP
  // using the testing driver api to drive the motors
  driverMotionPlus: function (x, y, speed) {
    if (!this.activeDevice) {
      if (this._driverMotionTimer) clearInterval(this._driverMotionTimer);
      this._driverMotionTimer = null;
      return;
    }
    // 当速度不为0时所有motion指令以采样 3.33Hz (300ms frequency)
    // 进入指令队列, 速度为0时为停止指令，不允许过滤
    x = Number((x * 1).toFixed(0));
    var now = new Date().getTime();
    if (speed !== 0) {
      if (this._lastMotionMillis > 0) {
        var delta = now - this._lastMotionMillis;
        if (delta < 300) {
          // ignore it
          //console.log('motion cmd ignored!');
          return;
        } else {
          this._lastMotionMillis = now;
        }
      } else {
        this._lastMotionMillis = now;
      }
    }
    var queue = CmdQueue;
    if (this._driverMotionTimer) clearInterval(this._driverMotionTimer);
    this._driverMotionTimer = null;
    var ratio = (speed / 100.0).toFixed(2);
    var vs = vectorCalc(x, y);
    var v1 = (vs.v1 * ratio).toFixed(0); // 左轮
    var v2 = (vs.v2 * ratio).toFixed(0); // 右轮
    console.log(x, y, v1, v2, typeof x, typeof y, typeof v1, typeof v2);
    switch (this.debug.online_list.driver) {
      case 2: {
        var m1 = cc.bell.motorMap.twoDriver.m1;
        var m2 = cc.bell.motorMap.twoDriver.m2;
        var cmd1 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m1, power: v1 },
          timestamp: new Date().getTime()
        };
        var cmd2 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m2, power: v2 },
          timestamp: new Date().getTime()
        };
        var that = this;
        if (x === 0 && y === 0) {
          queue.pushCmd(cmd1);
          queue.pushCmd(cmd2);
        } else {
          var task = function () {
            queue.pushCmd(cmd1);
            queue.pushCmd(cmd2);
          };
          this._driverMotionTimer = setInterval(task, 500);
          task();
        }
      }
        break;
      case 3: {
        var m1 = cc.bell.motorMap.threeDriver.m1;
        var m2 = cc.bell.motorMap.threeDriver.m2;
        var m3 = cc.bell.motorMap.threeDriver.m3;
        var cmd1 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m1, power: v1 },
          timestamp: new Date().getTime()
        };
        var cmd2 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m2, power: v1 },
          timestamp: new Date().getTime()
        };
        var cmd3 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m3, power: v2 },
          timestamp: new Date().getTime()
        }
        var that = this;
        if (x === 0 && y === 0) {
          queue.pushCmd(cmd1);
          queue.pushCmd(cmd2);
          queue.pushCmd(cmd3);
        } else {
          var task = function () {
            queue.pushCmd(cmd1);
            queue.pushCmd(cmd2);
            queue.pushCmd(cmd3);
          };
          this._driverMotionTimer = setInterval(task, 500);
          task();
        }
      }
        break;
      default: {
        var m1 = cc.bell.motorMap.fourDriver.m1;
        var m2 = cc.bell.motorMap.fourDriver.m2;
        var m3 = cc.bell.motorMap.fourDriver.m3;
        var m4 = cc.bell.motorMap.fourDriver.m4;
        var cmd1 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m1, power: v1 },
          timestamp: new Date().getTime()
        };
        var cmd2 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m2, power: v2 },
          timestamp: new Date().getTime()
        };
        var cmd3 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m3, power: v1 },
          timestamp: new Date().getTime()
        }
        var cmd4 = {
          cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
          data: { sequence: m4, power: v2 },
          timestamp: new Date().getTime()
        };
        var that = this;
        if (x === 0 && y === 0) {
          queue.pushCmd(cmd1);
          queue.pushCmd(cmd2);
          queue.pushCmd(cmd3);
          queue.pushCmd(cmd4);
        } else {
          var task = function () {
            queue.pushCmd(cmd1);
            queue.pushCmd(cmd2);
            queue.pushCmd(cmd3);
            queue.pushCmd(cmd4);
          };
          this._driverMotionTimer = setInterval(task, 500);
          task();
        }
      }
        // regard as four drivers count
        break;
    }
  },

  // 猩猩构型中两球的运动
  driverMotionOrangUtan: function (v1, v2) {
    if (!this.activeDevice) return;
    if (Math.abs(v1) < 5) v1 = 0;
    if (Math.abs(v2) < 5) v2 = 0;
    var now = new Date().getTime();
    if (v1 != 0 || v2 != 0) {
      if (this._lastMotionMillis > 0) {
        var delta = now - this._lastMotionMillis;
        if (delta < 300) {
          return;
        } else {
          this._lastMotionMillis = now;
        }
      } else {
        this._lastMotionMillis = now;
      }
    }
    var queue = CmdQueue;
    if (this._driverMotionTimer) clearInterval(this._driverMotionTimer);
    this._driverMotionTimer = null;
    var m1 = cc.bell.demoMap.orangutan.m1;
    var m2 = cc.bell.demoMap.orangutan.m2;
    var cmd1 = {
      cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
      data: { sequence: m1, power: v1 },
      timestamp: new Date().getTime()
    };
    v2 = -v2;
    var cmd2 = {
      cmd: Cmd.CMD_DEBUG_TEST_DRIVER,
      data: { sequence: m2, power: v2 },
      timestamp: new Date().getTime()
    };
    var that = this;
    if (v1 === 0 && v2 === 0) {
      queue.pushCmd(cmd1);
      queue.pushCmd(cmd2);
    } else {
      var that = this;
      var task = function () {
        queue.pushCmd(cmd1);
        queue.pushCmd(cmd2);

        var a1 = cc.bell.demoMap.orangutan.a1;
        var a2 = cc.bell.demoMap.orangutan.a2;
        var angle1 = that._lastArmDirectionForOrangUtan > 0 ? (90 + 15) : (90 - 60);
        var angle2 = that._lastArmDirectionForOrangUtan > 0 ? (90 - 15) : (90 + 60);
        var now = new Date().getTime();
        if (that._lastArmJoinMotionMillis > 0) {
          var delta = now - that._lastArmJoinMotionMillis;
          if (delta < 500) {
            return;
          } else {
            that._lastArmJoinMotionMillis = now;
          }
        } else {
          that._lastArmJoinMotionMillis = now;
        }
        if (v1 === 0) {
          // 动第二个关节球
          queue.pushCmd({
            cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
            data: { sequence: a2, angle: angle2 },
            timestamp: new Date().getTime()
          });
          that._lastArmDirectionForOrangUtan = -that._lastArmDirectionForOrangUtan;
        } else if (v2 === 0) {
          // 动第一个关节球
          queue.pushCmd({
            cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
            data: { sequence: a1, angle: angle1 },
            timestamp: new Date().getTime()
          });
          that._lastArmDirectionForOrangUtan = -that._lastArmDirectionForOrangUtan;
        } else {
          // 一起动
          queue.pushCmd({
            cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
            data: { sequence: a1, angle: angle1 },
            timestamp: new Date().getTime()
          });
          queue.pushCmd({
            cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
            data: { sequence: a2, angle: angle2 },
            timestamp: new Date().getTime()
          });
          that._lastArmDirectionForOrangUtan = -that._lastArmDirectionForOrangUtan;
        }
      };
      this._driverMotionTimer = setInterval(task, 500);
      task();
    }
  },
  _lastArmDirectionForOrangUtan: 1, // 1 positive / -1 negative
  jointMotionOrangUtan: function () {
    if (!this.activeDevice) return;
    var now = new Date().getTime();
    if (this._lastArmJoinMotionMillis > 0) {
      var delta = now - this._lastArmJoinMotionMillis;
      if (delta < 500) {
        return;
      } else {
        this._lastArmJoinMotionMillis = now;
      }
    } else {
      this._lastArmJoinMotionMillis = now;
    }
    var a1 = cc.bell.demoMap.orangutan.a1;
    var a2 = cc.bell.demoMap.orangutan.a2;
    var angle1 = this._lastArmDirectionForOrangUtan > 0 ? (90 - 15) : (90 + 60);
    var angle2 = this._lastArmDirectionForOrangUtan > 0 ? (90 + 15) : (90 - 60);
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
      data: { sequence: a1, angle: angle1 },
      timestamp: new Date().getTime()
    });
    queue.pushCmd({
      cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
      data: { sequence: a2, angle: angle2 },
      timestamp: new Date().getTime()
    });
    queue.pushCmd({
      cmd: Cmd.CMD_MOTION,
      // 单步前进/后退根据当前猩猩demo的驱动球映射来
      data: { x: 0, y: (cc.bell.demoMap.orangutan.m1 === 1) ? 50 : -50, speed: 50 },
      timestamp: new Date().getTime()
    });
    setTimeout(function () {
      queue.pushCmd({
        cmd: Cmd.CMD_MOTION,
        data: { x: 0, y: 0, speed: 0 },
        timestamp: new Date().getTime()
      });
    }, 300);
    this._lastArmDirectionForOrangUtan = -this._lastArmDirectionForOrangUtan;
  },
  // 大m的关节操作盘
  jointMotionM: function (x, y) {
    var mock = function () {
      console.log('empty!');
    };
    var now = new Date().getTime();
    if (x !== 0 && y !== 0) {
      if (this._lastJoinMotionMillis > 0) {
        var delta = now - this._lastJoinMotionMillis;
        if (delta < 500) {
          return;
        } else {
          this._lastJoinMotionMillis = now;
        }
      } else {
        this._lastJoinMotionMillis = now;
      }
    }
    // this.setWaistJoinAngle(cc.bell.jointMap.w1, x, mock, mock);
    // this.setArmJoinAngle(cc.bell.jointMap.a1, y, mock, mock);
    // this.setArmJoinAngle(cc.bell.jointMap.a2, 180 - y, mock, mock);
    // this.setArmJoinAngle(2, 90 + (90 - y), mock, mock);
    // FIXME: more intelligent way
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
      data: { sequence: cc.bell.jointMap.a1, angle: y },
      timestamp: new Date().getTime()
    });
    queue.pushCmd({
      cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
      data: { sequence: cc.bell.jointMap.a2, angle: 90 + (90 - y) },
      timestamp: new Date().getTime()
    });
    queue.pushCmd({
      cmd: Cmd.CMD_SET_WAIST_JOIN_ANGLE,
      data: { sequence: cc.bell.jointMap.w1, angle: x },
      timestamp: new Date().getTime()
    });
  },
  // 甩力平衡倒下
  driverMotionDropdownSwingBalance: function () {
    var queue = CmdQueue;
    // p (0, 100)
    queue.pushCmd({
      cmd: Cmd.CMD_MOTION,
      data: { x: 0, y: 100, speed: 100 },
      timestamp: new Date().getTime()
    });
    // p (0, -100)
    queue.pushCmd({
      cmd: Cmd.CMD_MOTION,
      data: { x: 0, y: -100, speed: 100 },
      timestamp: new Date().getTime()
    });
    // p (0, 0)
    setTimeout(function () {
      queue.pushCmd({
        cmd: Cmd.CMD_MOTION,
        data: { x: 0, y: 0, speed: 0 },
        timestamp: new Date().getTime()
      });
    }, 100);
  },
  // 甩力平衡自动平衡
  // 以100速度前行3s后，速度极速骤降到0
  driverMotionAutoSwingBalance: function () {
    var that = this;
    this.driverMotion(0, 100, 100);
    setTimeout(function () {
      that.driverMotion(0, 0, 100);
    }, 500);
  },

  onlineDriverCount: function () {
    return this.debug.online_list.driver;
  },

  switchToMcContext: function () {
    var q = CmdQueue;
    q.pushCmd({
      cmd: Cmd.CMD_ENV_SWITCH_TO_BLE,
      timestamp: new Date().getTime()
    });
  },

  switchToLuaContext: function () {
    var q = CmdQueue;
    q.pushCmd({
      cmd: Cmd.CMD_ENV_SWITCH_TO_LUA,
      timestamp: new Date().getTime()
    });
  },

  swapTwoArmJointMapOrangutan: function () {
    var a1 = cc.bell.demoMap.orangutan.a1;
    var a2 = cc.bell.demoMap.orangutan.a2;
    var tmp = a1;
    a1 = a2;
    a2 = tmp;
    cc.bell.demoMap.orangutan.a1 = a1;
    cc.bell.demoMap.orangutan.a2 = a2;
  },
};
