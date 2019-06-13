BleApis._disconnectListeners = [];
BleApis.registerDisconnectListener = function (l) {
  this._disconnectListeners.push(l);
};
BleApis.unregisterDisconnectListener = function () {
  this._disconnectListeners.shift();
};
BleApis.readFileAsBytesFromNativeAppDir = function(path, ok, fail) {
  resolveLocalFileSystemURL(cordova.file.applicationDirectory + path, function (entry) {
    entry.file(function(file) {
      var reader = new FileReader();
      reader.onloadend = function() {
        var res = new Uint8Array(this.result)
        if (ok) ok(res)
      }
      reader.readAsArrayBuffer(file)
    }, function(err) {
      if (fail) fail()
    })
  })
}
BleApis.fileTransferBin = function (bytes, progressCallback, isScript) {
  var queue = CmdQueue;
  if (!this.isConnected()) { if (progressCallback) progressCallback(-1); return; } // 还没连接呢
  if (this.downloadProgress != 0) { if (progressCallback) progressCallback(-1); return; } // 已经有脚本在下载
  var that = this;
  var raw = Array.from(bytes);
  var length = raw.length;
  console.log('file length: ' + (length / 512).toFixed(2) + ' Kb. ' + length + ' bytes');

  var CHUNK_SIZE = 512;//128;
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
      that.downloadProgress = 0;
      if (progressCallback) progressCallback(-1); // -1 表示下载失败
    },
    onFileTransferEndSuccess: function () {
      console.log('onFileTransferEndSuccess()');
      that.downloadProgress = 0;
      // 立即执行
      if (isScript) {
        queue.pushCmd({
          cmd: Cmd.CMD_ENV_SWITCH_TO_LUA,
          data: null,
          timestamp: new Date().getTime()
        });
      }
      if (progressCallback) progressCallback(100); // 真正结束时刻
    },
    onFileTransferEndFailed: function () {
      console.log('onFileTransferEndFailed()');
      that.downloadProgress = 0;
      if (progressCallback) progressCallback(-1); // -1 表示下载失败
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
      that.downloadProgress = 0;
      if (progressCallback) progressCallback(-1); // -1 表示下载失败
    }
  });
  // start
  queue.pushCmd({
    cmd: Cmd.CMD_FILE_TRANSFER_START,
    data: { dataLength: TOTAL_SIZE, chunkCount: chunkCount },
    timestamp: new Date().getTime()
  });
};

BleApis.callbackWhenDisconnect = function (fail) {
  var that = this;
  if (that._disconnectListeners) {
    if (!that.isSettingProfile) {
      for (var i = 0; i < that._disconnectListeners.length; i++) {
        var l = that._disconnectListeners[i];
        if (typeof l === 'function') l();
      }
      if (fail) fail();
    } else {
      that.isSettingProfile = false;
      setTimeout(function () {
        that.connect(that.offlineDevice, function () {
          // empty
        }, null, false);
      }, 1000);
    }
  }
  that.clearWhenDisconnect();
};

BleApis.isSettingProfile = false;

// fix issue: #863
// we should do something cleanning when device is disconnected.
// also the downloading task should reset
BleApis.clearWhenDisconnect = function () {
  var that = this;
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
};

// 1.驱动球反馈
// 先将所有驱动球灯设置为灭, 然后设置单个指定驱动球为闪烁
BleApis.feedbackMotor = function (seq) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  var cmdLightsOn = [0xb0, 0xed, 0x02, 0x02, 0x02];
  var cmdLightsOff = [0xb0, 0xed, 0x02, 0x01, 0x02];
  var singleLightGreenBlink = [0xb1, 0xed, seq, 0x03, 0x02];
  concatCrc(cmdLightsOn);
  concatCrc(cmdLightsOff);
  concatCrc(singleLightGreenBlink);
  q.pushCmd({
    cmd: Cmd.CMD_RAW,
    data: cmdLightsOn.concat(cmdLightsOff).concat(singleLightGreenBlink),
    timestamp: new Date().getTime()
  });
};
// 批量设置驱动球灯闪烁，这里目前没有自定义批量设置，只能单个组成序列去设置 @FIXME: more intelligent way?
BleApis.feedbackMotorBatch = function (seqs) {
  if (!this.isConnected()) return;
  if (!seqs) return;
  if (seqs.length === 0) return;
  var q = CmdQueue;
  var cmdLightsOn = [0xb0, 0xed, 0x02, 0x02, 0x02];
  var cmdLightsOff = [0xb0, 0xed, 0x02, 0x01, 0x02];
  var data = [];
  concatCrc(cmdLightsOn);
  data = data.concat(cmdLightsOn);
  concatCrc(cmdLightsOff);
  data = data.concat(cmdLightsOff);
  for (var i = 1; i <= 15; i++) {
    if (seqs.indexOf(i) >= 0) {
      var cmd = [0xb1, 0xed, i, 0x03, 0x02];
      concatCrc(cmd);
      data = data.concat(cmd);
    }
  }
  q.pushCmd({
    cmd: Cmd.CMD_RAW,
    data: data,
    timestamp: new Date().getTime()
  });
};
// 多选情况下，unselect某一个item时，将该球灭掉
BleApis.feedbackMotorSingleTurnOff = function (seq) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  q.pushCmd({
    cmd: Cmd.CMD_SINGLE_DRIVER_LIGHT,
    data: { sequence: seq, mode: 0x01, color: 0x02 },
    timestamp: new Date().getTime()
  });
};
BleApis.feedbackMotorSingleTurnOn = function (seq) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  q.pushCmd({
    cmd: Cmd.CMD_SINGLE_DRIVER_LIGHT,
    data: { sequence: seq, mode: 0x03, color: 0x02 },
    timestamp: new Date().getTime()
  });
};
// 当弹窗退出，需要将之前焦点球点灭，当然我们没有记忆之前是那个驱动球点亮，所以直接发送全灭指令
BleApis.feedbackMotorTurnOffAll = function () {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  var cmdLightsOn = [0xb0, 0xed, 0x02, 0x02, 0x02];
  var cmdLightsOff = [0xb0, 0xed, 0x02, 0x01, 0x02];
  concatCrc(cmdLightsOn);
  concatCrc(cmdLightsOff);
  q.pushCmd({
    cmd: Cmd.CMD_RAW,
    data: cmdLightsOn.concat(cmdLightsOff),
    timestamp: new Date().getTime()
  });
};
// 2.水平关节反馈
// 首先查询当前关节球角度
// 1) 如果[15, 25]: angle + 10 -> angle + 20 -> angle + 10 -> angle
// 2) 如果(25, 155): angle + 10 -> angle - 10 -> angle
// 3) 如果[155, 165]: angle - 10 -> angle - 20 -> angle - 10 -> angle
BleApis.feedbackWaist = function (seq) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  var that = this;

  this.debugCallbackWaist = function (ang) {
    if (ang <= 25) {
      var arr = [
        { angle: ang + 10, delay: 0 },
        { angle: ang + 20, delay: 100 },
        { angle: ang + 10, delay: 100 },
        { angle: ang, delay: 100 }
      ];
      that.feedbackWaistInternal(arr, seq);
    } else if (ang < 155) {
      var arr = [
        { angle: ang + 10, delay: 0 },
        { angle: ang - 10, delay: 100 },
        { angle: ang, delay: 100 }
      ];
      that.feedbackWaistInternal(arr, seq);
    } else {
      var arr = [
        { angle: ang - 10, delay: 0 },
        { angle: ang - 20, delay: 100 },
        { angle: ang - 10, delay: 100 },
        { angle: ang, delay: 100 }
      ];
      that.feedbackWaistInternal(arr, seq);
    }
  }; // callback will be removed in the future
  q.pushCmd({
    cmd: Cmd.CMD_DEBUG_WAIST_JOIN,
    data: { sequence: seq },
    timestamp: new Date().getTime()
  });
};
// eg: args -> [
//  { angle: 40, delay: 0 }, { angle: 50, delay: 200 },
//  { angle: 60, delay: 200 }, { angle: 50, delay: 200 },
//  { angle: 40, delay: 200 }
// ]
BleApis.feedbackWaistInternal = function (args, seq) {
  if (!this.isConnected()) return;
  if (!args) return;
  var that = this;

  var q = CmdQueue;
  var delaySum = 0;
  for (let i = 0; i < args.length; i++) {// 用let简单，避免closure
    var task = function () {
      var angle = args[i].angle;
      angle = Math.min(165, Math.max(15, angle));

      q.pushCmd({
        cmd: Cmd.CMD_SET_WAIST_JOIN_ANGLE,
        data: { sequence: seq, angle: angle },
        timestamp: new Date().getTime()
      });
    };
    var delay = delaySum + args[i].delay;
    if (args[i].delay === 0) task(); // 没有延迟，直接执行
    else if (args[i].delay > 0) setTimeout(task, delay); // 有延迟按照累计序列delay做叠加
    else console.warn('Invalid delay parameter: ' + args[i].delay);
    delaySum += args[i].delay;
  }
};
// 3.垂直关节反馈
// @see 水平关节
BleApis.feedbackArm = function (seq) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  var that = this;

  this.debugCallbackArm = function (ang) {
    if (ang <= 25) {
      var arr = [
        { angle: ang + 10, delay: 0 },
        { angle: ang + 20, delay: 100 },
        { angle: ang + 10, delay: 100 },
        { angle: ang, delay: 100 }
      ];
      that.feedbackArmInternal(arr, seq);
    } else if (ang < 155) {
      var arr = [
        { angle: ang + 10, delay: 0 },
        { angle: ang - 10, delay: 100 },
        { angle: ang, delay: 100 }
      ];
      that.feedbackArmInternal(arr, seq);
    } else {
      var arr = [
        { angle: ang - 10, delay: 0 },
        { angle: ang - 20, delay: 100 },
        { angle: ang - 10, delay: 100 },
        { angle: ang, delay: 100 }
      ];
      that.feedbackArmInternal(arr, seq);
    }
  }; // callback will be removed in the future
  q.pushCmd({
    cmd: Cmd.CMD_DEBUG_ARM_JOIN,
    data: { sequence: seq },
    timestamp: new Date().getTime()
  });
};
BleApis.feedbackArmInternal = function (args, seq) {
  if (!this.isConnected()) return;
  if (!args) return;
  var that = this;

  var q = CmdQueue;
  var delaySum = 0;
  for (let i = 0; i < args.length; i++) { // 用let简单，避免closure
    var task = function () {
      var angle = args[i].angle;
      angle = Math.min(165, Math.max(15, angle));

      q.pushCmd({
        cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
        data: { sequence: seq, angle: angle },
        timestamp: new Date().getTime()
      });
    };
    var delay = delaySum + args[i].delay;
    if (args[i].delay === 0) task(); // 没有延迟，直接执行
    else if (args[i].delay > 0) setTimeout(task, delay); // 有延迟按照累计序列delay做叠加
    else console.warn('Invalid delay parameter: ' + args[i].delay);
    delaySum += args[i].delay;
  }
};

// 获取水平关节角度
BleApis.getWaistAngle = function (seq, callback) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  this.debugCallbackWaist = function (ang) {
    if (typeof callback == "function") callback(ang);
  }; // callback will be removed in the future
  q.pushCmd({
    cmd: Cmd.CMD_DEBUG_WAIST_JOIN,
    data: { sequence: seq },
    timestamp: new Date().getTime()
  });
};

// 获取多个水平关节球角度
BleApis.getWaistAngles = function (callback) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  this.onBatchWaist = function (arr) {
    if (typeof callback == "function") callback(arr);
  }; // callback will be removed in the future
  q.pushCmd({
    cmd: Cmd.CMD_BATCH_WAIST_FETCH,
    timestamp: new Date().getTime()
  });
};

// 设置多个水平关节球角度
BleApis.setWaistAngles = function (arr) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  q.pushCmd({
    cmd: Cmd.CMD_BATCH_WAIST_MOTION,
    data: { angles: arr },
    timestamp: new Date().getTime()
  });
};

//获取垂直关节球角度
BleApis.getArmAngle = function (seq, callback) {
  if (!this.isConnected()) return;
  var q = CmdQueue; var that = this;
  this.debugCallbackArm = function (ang) {
    if (typeof callback == "function") callback(ang);
  }; // callback will be removed in the future
  q.pushCmd({
    cmd: Cmd.CMD_DEBUG_ARM_JOIN,
    data: { sequence: seq },
    timestamp: new Date().getTime()
  });
};

//获取多个垂直关节球角度
BleApis.getArmAngles = function (callback) {
  if (!this.isConnected()) return;
  var q = CmdQueue; var that = this;
  this.onBatchArm = function (arr) {
    if (typeof callback == "function") callback(arr);
  }; // callback will be removed in the future
  q.pushCmd({
    cmd: Cmd.CMD_BATCH_ARM_FETCH,
    timestamp: new Date().getTime()
  });
};

// 设置多个垂直关节球角度
BleApis.setArmAngles = function (arr) {
  if (!this.isConnected()) return;
  var q = CmdQueue;
  q.pushCmd({
    cmd: Cmd.CMD_BATCH_ARM_MOTION,
    data: { angles: arr },
    timestamp: new Date().getTime()
  });
};

// 4.颜色反馈
// 红色闪烁: 交替设置为反射模式(红色常亮)、环境光模式(灭)
BleApis.feedbackColorIntervalId = null;
BleApis.feedbackColor = function (seq) {
  var q = CmdQueue;
  if (this.feedbackColorIntervalId) {
    clearInterval(this.feedbackColorIntervalId);
    this.feedbackColorIntervalId = null;
  }
  // 把所有灯点亮红色，常亮
  q.pushCmd({
    cmd: Cmd.CMD_BATCH_COLOR_FETCH,
    data: { mode: 0x02 }, // 反射光
    timestamp: new Date().getTime()
  });

  if (!this.isConnected()) return;

  var isEnv = true; // 标示交替
  var task = function () {
    q.pushCmd({
      cmd: Cmd.CMD_DEBUG_COLOR,
      data: { sequence: seq, mode: isEnv ? 0x01 : 0x02 },
      timestamp: new Date().getTime()
    });
    isEnv = !isEnv;
  };
  this.feedbackColorIntervalId = setInterval(task, 500); // 0.5s frequency -> 2Hz
};
BleApis.feedbackColorBatch = function (seqs) {
  var q = CmdQueue;
  if (this.feedbackColorIntervalId) {
    clearInterval(this.feedbackColorIntervalId);
    this.feedbackColorIntervalId = null;
  }
  // 把所有灯点亮红色，常亮
  q.pushCmd({
    cmd: Cmd.CMD_BATCH_COLOR_FETCH,
    data: { mode: 0x02 }, // 反射光
    timestamp: new Date().getTime()
  });
  if (!this.isConnected()) return;

  var cmdEnv = []; // 环境光指令集合
  var cmdRef = []; // 反射光指令集合
  for (var i = 0; i < seqs.length; i++) {
    var seq = seqs[i];
    var tmp = [];
    tmp.push(0xb0);
    tmp.push(0x03);
    tmp.push(seq); // sequence
    tmp.push(0x01); // mode
    concatCrc(tmp); // crc

    cmdEnv = cmdEnv.concat(tmp);

    tmp = []; // clear the tmp
    tmp.push(0xb0);
    tmp.push(0x03);
    tmp.push(seq); // sequence
    tmp.push(0x02); // mode
    concatCrc(tmp); // crc

    cmdRef = cmdRef.concat(tmp);
  }

  var isEnv = false; // 标示交替 开始是环境光(灭)
  var counter = 0; // 灭-亮 * 5
  var that = this;
  var task = function () {
    q.pushCmd({
      cmd: Cmd.CMD_RAW,
      data: isEnv ? cmdEnv : cmdRef,
      timestamp: new Date().getTime()
    });
    isEnv = !isEnv;
    counter++;

    if (counter === 10) {
      clearInterval(that.feedbackColorIntervalId);
      that.feedbackColorIntervalId = null;
      // 把所有灯点亮红色，常亮
      q.pushCmd({
        cmd: Cmd.CMD_BATCH_COLOR_FETCH,
        data: { mode: 0x02 }, // 反射光
        timestamp: new Date().getTime()
      });
    }
  };
  this.feedbackColorIntervalId = setInterval(task, 500); // 0.5s frequency -> 2Hz
};
BleApis.feedbackColorTurnOff = function () {
  var q = CmdQueue;
  if (this.feedbackColorIntervalId) {
    clearInterval(this.feedbackColorIntervalId);
    this.feedbackColorIntervalId = null;
  }
  // 可能，我们要设置成反射光模式
  q.pushCmd({
    cmd: Cmd.CMD_BATCH_COLOR_FETCH,
    data: { mode: 0x02 }, // 反射光，亮红灯
    timestamp: new Date().getTime()
  });
};
// 5.触摸反馈
// 监听哪个触摸球被按压即可, 给一个回调
BleApis.feedbackTouchIntervalId = null;
BleApis.feedbackTouch = function (cb) {
  if (this.feedbackTouchIntervalId) {
    clearInterval(this.feedbackTouchIntervalId);
    this.feedbackTouchIntervalId = null;
  }
  if (!this.isConnected()) return;

  var that = this;
  var q = CmdQueue;
  var task = function () { // arr -> [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
    that.onBatchTouch = function (arr) { if (cb) cb(arr); };

    q.pushCmd({
      cmd: Cmd.CMD_BATCH_TOUCH_FETCH,
      timestamp: new Date().getTime()
    });
  };
  this.feedbackTouchIntervalId = setInterval(task, 200);
};
BleApis.feedbackTouchTurnOff = function () {
  if (this.feedbackTouchIntervalId) {
    clearInterval(this.feedbackTouchIntervalId);
    this.feedbackTouchIntervalId = null;
  }
};
// 6.红外反馈
// @see 触摸反馈
BleApis.feedbackInfraredIntervalId = null;
BleApis.feedbackInfrared = function (cb) {
  if (this.feedbackInfraredIntervalId) {
    clearInterval(this.feedbackInfraredIntervalId);
    this.feedbackInfraredIntervalId = null;
  }
  if (!this.isConnected()) return;

  var that = this;
  var q = CmdQueue;
  var task = function () {
    that.onBatchInfrared = function (arr) { if (cb) cb(arr); };

    q.pushCmd({
      cmd: Cmd.CMD_BATCH_INFRARED_FETCH,
      timestamp: new Date().getTime()
    });
  }
  this.feedbackInfraredIntervalId = setInterval(task, 200);
};
BleApis.feedbackInfraredTurnOff = function () {
  if (this.feedbackInfraredIntervalId) {
    clearInterval(this.feedbackInfraredIntervalId);
    this.feedbackInfraredIntervalId = null;
  }
};
// 添加：批量反馈当前已经选中的水平关节
BleApis.feedbackWaistBatch = function (seqs) {
  if (!this.isConnected()) return;
  if (!seqs || seqs.length === 0) return;
  var q = CmdQueue;
  var that = this;

  this.onBatchWaist = function (angs) {
    var snapshot = [];
    for (var i = 0; i < angs.length; i++) {
      var ang = angs[i];
      if (ang <= 180 && ang >= 0) {
        snapshot.push({ ang: ang, ignore: seqs.indexOf(i + 1) < 0 });
      } else {
        // ignore
        snapshot.push(null);
      }
    }
    console.log('snapshot: ' + snapshot);

    var stage1 = {
      angles: [],
      delay: 0
    }, stage2 = {
      angles: [],
      delay: 100,
    }, stage3 = {
      angles: [],
      delay: 100,
    }, stage4 = {
      angles: [],
      delay: 100
    };
    for (var i = 0; i < snapshot.length; i++) {
      if (!snapshot[i]) { // 不在线的，补0
        stage1.angles.push(0);
        stage2.angles.push(0);
        stage3.angles.push(0);
        stage4.angles.push(0);
        continue;
      }
      if (!snapshot[i].ignore) {
        if (snapshot[i].ang < 0) {
          stage1.angles.push(0);
          stage2.angles.push(0);
          stage3.angles.push(0);
          stage4.angles.push(0);
        } else if (snapshot[i].ang < 25) {
          stage1.angles.push(snapshot[i].ang + 10);

          stage2.angles.push(snapshot[i].ang + 20);

          stage3.angles.push(snapshot[i].ang + 10);

          stage4.angles.push(snapshot[i].ang);
        } else if (snapshot[i].ang < 155) {
          stage1.angles.push(snapshot[i].ang + 10);

          stage2.angles.push(snapshot[i].ang - 10);

          stage3.angles.push(snapshot[i].ang);

          stage4.angles.push(snapshot[i].ang);
        } else {
          stage1.angles.push(snapshot[i].ang - 10);

          stage2.angles.push(snapshot[i].ang - 20);

          stage3.angles.push(snapshot[i].ang - 10);

          stage4.angles.push(snapshot[i].ang);
        }
      } else {
        stage1.angles.push(snapshot[i].ang);
        stage2.angles.push(snapshot[i].ang);
        stage3.angles.push(snapshot[i].ang);
        stage4.angles.push(snapshot[i].ang);
      }
    }
    that.feedbackWaistBatchInternal([
      stage1, stage2, stage3, stage4
    ]);
  }

  q.pushCmd({
    cmd: Cmd.CMD_BATCH_WAIST_FETCH,
    timestamp: new Date().getTime()
  });
};
/*
  eg: args -> [
    { angles: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], delay: 100 },
    { angles: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40], delay: 100 },
    { angles: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], delay: 100 }
  ]
*/
BleApis.feedbackWaistBatchInternal = function (args) {
  if (!this.isConnected()) return;
  if (!args || args.length === 0) return;
  var that = this;

  var q = CmdQueue;
  var delaySum = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i].angles.length !== 15) {
      console.warn('frame angles size error: ' + args[i].angles);
      continue;
    }
    var task = function () {
      var angles = args[i].angles;
      for (var j = 0; j < angles.length; j++) {
        if (angles[j] > 0) angles[j] = Math.min(165, Math.max(15, angles[j]));
      }
      console.log('frame ' + (i + 1) + ': ' + args[i].angles);
      q.pushCmd({
        cmd: Cmd.CMD_BATCH_WAIST_MOTION,
        data: { angles: angles },
        timestamp: new Date().getTime()
      });
    };
    var delay = delaySum + args[i].delay;
    if (args[i].delay === 0) task();
    else if (args[i].delay > 0) setTimeout(task, delay);
    else console.warn('Invalid delay parameter: ' + args[i].delay);
    delaySum += args[i].delay;
  }
};
BleApis.feedbackArmBatch = function (seqs) {
  if (!this.isConnected()) return;
  if (!seqs || seqs.length === 0) return;
  var q = CmdQueue;
  var that = this;

  this.onBatchArm = function (angs) {
    var snapshot = [];
    for (var i = 0; i < angs.length; i++) {
      var ang = angs[i];
      if (ang <= 180 && ang >= 0) {
        snapshot.push({ ang: ang, ignore: seqs.indexOf(i + 1) < 0 });
      } else {
        snapshot.push(null);
      }
    }

    var stage1 = { angles: [], delay: 0 };
    var stage2 = { angles: [], delay: 100 };
    var stage3 = { angles: [], delay: 100 };
    var stage4 = { angles: [], delay: 100 };
    for (var i = 0; i < snapshot.length; i++) {
      if (!snapshot[i]) { // 不在线的，补0
        stage1.angles.push(0);
        stage2.angles.push(0);
        stage3.angles.push(0);
        stage4.angles.push(0);
        continue;
      }
      if (!snapshot[i].ignore) {
        if (snapshot[i].ang < 0) {
          stage1.angles.push(0);
          stage2.angles.push(0);
          stage3.angles.push(0);
          stage4.angles.push(0);
        } else if (snapshot[i].ang < 25) {
          stage1.angles.push(snapshot[i].ang + 10);

          stage2.angles.push(snapshot[i].ang + 20);

          stage3.angles.push(snapshot[i].ang + 10);

          stage4.angles.push(snapshot[i].ang);
        } else if (snapshot[i].ang < 155) {
          stage1.angles.push(snapshot[i].ang + 10);

          stage2.angles.push(snapshot[i].ang - 10);

          stage3.angles.push(snapshot[i].ang);

          stage4.angles.push(snapshot[i].ang);
        } else {
          stage1.angles.push(snapshot[i].ang - 10);

          stage2.angles.push(snapshot[i].ang - 20);

          stage3.angles.push(snapshot[i].ang - 10);

          stage4.angles.push(snapshot[i].ang);
        }
      } else {
        stage1.angles.push(snapshot[i].ang);
        stage2.angles.push(snapshot[i].ang);
        stage3.angles.push(snapshot[i].ang);
        stage4.angles.push(snapshot[i].ang);
      }
    }
    that.feedbackArmBatchInternal([
      stage1, stage2, stage3, stage4
    ]);
  };

  q.pushCmd({
    cmd: Cmd.CMD_BATCH_ARM_FETCH,
    timestamp: new Date().getTime()
  });
};
BleApis.feedbackArmBatchInternal = function (args) {
  if (!this.isConnected()) return;
  if (!args || args.length === 0) return;
  var that = this;

  var q = CmdQueue;
  var delaySum = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i].angles.length !== 15) {
      console.warn('frame angles size error: ' + args[i].angles);
      continue;
    }
    var task = function () {
      var angles = args[i].angles;
      for (var j = 0; j < angles.length; j++) {
        if (angles[j] > 0) angles[j] = Math.min(165, Math.max(15, angles[j]));
      }
      console.log('frame ' + (i + 1) + ': ' + args[i].angles);
      q.pushCmd({
        cmd: Cmd.CMD_BATCH_ARM_MOTION,
        data: { angles: angles },
        timestamp: new Date().getTime()
      });
    };
    var delay = delaySum + args[i].delay;
    if (args[i].delay === 0) task();
    else if (args[i].delay > 0) setTimeout(task, delay);
    else console.warn('Invalid delay parameter: ' + args[i].delay);
    delaySum += args[i].delay;
  }
};
BleApis.checkPermissionLolipop = function (cb) {
  if (window.cordova.platformId !== 'android') {
    cb();
    return;
  }

  bluetoothle.hasPermission(function (res) {
    if (res.hasPermission) {
      bluetoothle.isLocationEnabled(function (res) {
        if (res.isLocationEnabled) cb();
        else {
          // 请求位置权限
          bluetoothle.requestLocation(function(res){
            if (res && res.requestLocation) { // 有权限
              if (typeof cb === 'function') cb();
            } else {
              BleApis.checkPermissionLolipop(cb);
            }
          }, function(err){
            BleApis.checkPermissionLolipop(cb);
          });
        }
      }, function () {
        BleApis.checkPermissionLolipop(cb);
      });
    } else {
      bluetoothle.requestPermission(function () {
        BleApis.checkPermissionLolipop(cb);
      }, function () {
        BleApis.checkPermissionLolipop(cb);
      });
    }
  });
};
BleApis.init_ = BleApis.init;
BleApis.init = function (success, fail) {
  this.checkPermissionLolipop(function () {
    BleApis.init_(success, fail);
  });
};

// debug mc
BleApis.startDebugMasterControl = function (cb) {
  var q = CmdQueue;
  this.stopDebugBall();
  var that = this;
  var task = function () {
    that.debugCallbackMC = cb;
    q.pushCmd({
      cmd: Cmd.CMD_DEBUG_MASTER_CONTROL,
      data: null,
      timestamp: new Date().getTime()
    });
  };
  this.debugTask = setInterval(task, 200);
  task();
}
// debug battery: 挨个获取每一个电池球的电量
BleApis.startDebugBattery_ = function (count, cb) {
  var that = this;
  var q = CmdQueue;

  var c = 1;
  var batterys = [];
  if (count <= 0) {
    if (cb) cb(batterys);
    return;
  }
  var callback = function (battery) {
    batterys.push(battery);
    c++;

    if (c <= count) {
      setTimeout(function () {
        that.debugCallbackBattery = callback;
        q.pushCmd({
          cmd: Cmd.CMD_DEBUG_BATTERY,
          data: { sequence: c },
          timestamp: new Date().getTime()
        });
      }, 0);
    } else {
      if (cb) cb(batterys);
    }
  }
  this.debugCallbackBattery = callback;
  q.pushCmd({
    cmd: Cmd.CMD_DEBUG_BATTERY,
    data: { sequence: c },
    timestamp: new Date().getTime()
  });
}
BleApis.startDebugBattery = function (cb) {
  this.stopDebugBall();
  var that = this;
  var task = function () {
    that.startDebugBattery_(15, cb); // all the battery modules
  };
  this.debugTask = setInterval(task, 5000);
  task();
}
// v2.2.5 added 使用批量获取指令替代之前挨个获取
BleApis.startDebugBattery_ = function (count, cb) {
  var that = this;
  var q = CmdQueue;

  this.onBatchBattery = cb
  q.pushCmd({
    cmd: Cmd.CMD_BATCH_BATTERY_FETCH,
    data: null,
    timestamp: new Date().getTime(),
    priority: Cmd.Priority.LOW
  })
}
// debug driver
BleApis.startDebugDriver = function (count, cb) {
  var that = this;
  var q = CmdQueue;

  var c = 1;
  var angles = [];
  var circles = [];
  if (count <= 0) {
    if (cb) cb(angles, circles);
  }
  var callback = function (angle, circle) {
    angles.push(angle);
    circles.push(circle);
    c++;

    if (c <= count) {
      setTimeout(function () {
        that.debugCallbackDriver = callback;
        q.pushCmd({
          cmd: Cmd.CMD_DEBUG_DRIVER,
          data: { sequence: c },
          timestamp: new Date().getTime()
        });
      }, 0);
    } else {
      if (cb) cb(angles, circles);
    }
  };
  this.debugCallbackDriver = callback;
  q.pushCmd({
    cmd: Cmd.CMD_DEBUG_DRIVER,
    data: { sequence: c },
    timestamp: new Date().getTime()
  });
}
// v2.2.5 added 使用批量获取驱动球数值代替挨个获取
BleApis.startDebugDriver = function (count, cb) {
  this.stopDebugBall();
  var that = this;
  var q = CmdQueue;
  var task = function () {
    that.onBatchDriver = function (angles) {
      var circles = [];
      for (var i = 0; i < angles.length; i++) {
        circles.push(Number((angles[i] / 360).toFixed(1)))
      }
      cb(angles, circles)
    };
    q.pushCmd({
      cmd: Cmd.CMD_BATCH_DRIVER_FETCH,
      data: null,
      timestamp: new Date().getTime(),
      priority: Cmd.Priority.LOW
    })
  }
  this.debugTask = setInterval(task, 500);
  task()
}
// debug waist - using BleApis.setWaistJoinAngle
// debug arm - using BleApis.setArmJoinAngle
// debug infrared
BleApis.startDebugInfrared = function (cb) {
  var q = CmdQueue;
  var that = this;
  this.stopDebugBall();

  var task = function () {
    that.onBatchInfrared = cb;
    q.pushCmd({
      cmd: Cmd.CMD_BATCH_INFRARED_FETCH,
      data: null,
      timestamp: new Date().getTime()
    });
  };
  this.debugTask = setInterval(task, 200);
  task();
}
// debug color
BleApis.startDebugColor = function (mode, cb) {
  var q = CmdQueue;
  var that = this;
  this.stopDebugBall();

  var task = function () {
    that.onBatchColor = cb;
    q.pushCmd({
      cmd: Cmd.CMD_BATCH_COLOR_FETCH,
      data: { mode: mode },
      timestamp: new Date().getTime()
    });
  };
  this.debugTask = setInterval(task, 200);
  task();
};
// debug touch
BleApis.startDebugTouchSensor = function (cb) {
  var q = CmdQueue;
  var that = this;
  this.stopDebugBall();

  var task = function () {
    that.onBatchTouch = cb;
    q.pushCmd({
      cmd: Cmd.CMD_BATCH_TOUCH_FETCH,
      data: null,
      timestamp: new Date().getTime()
    });
  };
  this.debugTask = setInterval(task, 200);
  task();
}
// fetch mabot firmware version
BleApis.fetchDeviceFirmwareVersion = function(cb) {
  var q = CmdQueue;
  var that = this;
  this.onGetFirmwareVersionCb = function (version) {
    if (typeof cb === 'function') cb(version)
    that.onGetFirmwareVersionCb = null;
  }

  q.pushCmd({
    cmd: Cmd.CMD_GET_FIRMWARE_VERSION,
    timestamp: new Date().getTime()
  })
}
// prepare mabot firmware upgrade
BleApis.prepareFirmwareUpgrade = function(success, fail) {
  var q = CmdQueue;
  var that = this;
  this.onFirmwareUpgradePrepareSuccess = function () {
    if (typeof success === 'function') success()
    that.onFirmwareUpgradePrepareFailed = null
    that.onFirmwareUpgradePrepareSuccess = null
  }
  this.onFirmwareUpgradePrepareFailed = function () {
    if (typeof fail === 'function') fail()
    that.onFirmwareUpgradePrepareFailed = null
    that.onFirmwareUpgradePrepareSuccess = null
  }

  q.pushCmd({
    cmd: Cmd.CMD_FIRMWARE_UPGRADE_PREPARE,
    data: { version: 1025 },
    timestamp: new Date().getTime()
  })
}

// issue: window.location.reload when one device has been connected
// the device will be lost and can not find it unless turn off the power and rescan
// TODO:
