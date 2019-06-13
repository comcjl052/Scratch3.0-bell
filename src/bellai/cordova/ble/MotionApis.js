var MotionApis = {

  motionIfNeeded: function () {
    if (!BleApis.activeDevice) {
      return false;
    }
    return true;
  },

  // 所有2轮驱动demo驱动球操作盘
  _driverMotion: function (x, y, speed, priority) {
    if (!this.motionIfNeeded()) return;

    x = Number(x);
    y = Number(y);
    speed = Number(speed);

    var cmd = {
      cmd: Cmd.CMD_MOTION,
      data: { x: x, y: y, speed: speed },
      timestamp: new Date().getTime(),
      priority: priority,
    };
    var queue = CmdQueue;
    queue.pushCmd(cmd);
  },
  // 自由操作驱动操作盘
  driverMotionPlus: function (x, y, speed, priority) {
    if(!this.motionIfNeeded()) return;

    x = Number(x);
    y = Number(y);
    speed = Number(speed);

    var ratio = Number((speed / 100.0).toFixed(2));
    var vs = vectorCalcPlus(x, y);
    var v1 = Number((vs.v1 * ratio).toFixed(0)); // 左轮
    var v2 = Number((vs.v2 * ratio).toFixed(0)); // 右轮
    var queue = CmdQueue;

    switch (BleApis.onlineDriverCount()) {
      case 2: {
        var m1 = cc.bell.motorMap.twoDriver.m1;
        var m2 = cc.bell.motorMap.twoDriver.m2;
        var ms = new Date().getTime();

        /*
        var c1 = [0xb1, 0x02, m1, v1];
        concatCrc(c1); // 添加crc bytes
        var c2 = [0xb1, 0x02, m2, v2];
        concatCrc(c2); // 添加crc bytes
        var c = c1.concat(c2);
        var cmd = {
          cmd: Cmd.CMD_RAW,
          data: c1.concat(c2),
          timestamp: ms,
          priority: priority,
        };
        queue.pushCmd(cmd);*/

        var mapping = {};
        mapping['m' + m1] = v1;
        mapping['m' + m2] = v2;
        var powers = [];
        powers.push(mapping.m1); // 1
        powers.push(mapping.m2); // 2
        for (var i = 1; i <= 13; i++) {
          powers.push(0xff);
        }
        var cmd = {
          cmd: Cmd.CMD_BATCH_DRIVER_MOTION,
          data: { powers: powers },
          timestamp: ms,
          priority: priority
        };
        queue.pushCmd(cmd);
      }
      break;
      case 3: {
        var m1 = cc.bell.motorMap.threeDriver.m1;
        var m2 = cc.bell.motorMap.threeDriver.m2;
        var m3 = cc.bell.motorMap.threeDriver.m3;
        var ms = new Date().getTime();

        var mapping = {};
        mapping['m' + m1] = v1;
        mapping['m' + m2] = v1;
        mapping['m' + m3] = v2;
        var powers = [];
        powers.push(mapping.m1); // 1
        powers.push(mapping.m2); // 2
        powers.push(mapping.m3); // 3
        for (var i = 1; i <= 12; i++) {
          powers.push(0xff);
        }
        var cmd = {
          cmd: Cmd.CMD_BATCH_DRIVER_MOTION,
          data: { powers: powers },
          timestamp: ms,
          priority: priority
        };
        queue.pushCmd(cmd);
      }
      break;
      default: {
        var m1 = cc.bell.motorMap.fourDriver.m1;
        var m2 = cc.bell.motorMap.fourDriver.m2;
        var m3 = cc.bell.motorMap.fourDriver.m3;
        var m4 = cc.bell.motorMap.fourDriver.m4;
        var ms = new Date().getTime();

        var mapping = {};
        mapping['m' + m1] = v1;
        mapping['m' + m2] = v2;
        mapping['m' + m3] = v1;
        mapping['m' + m4] = v2;
        var powers = [];
        powers.push(mapping.m1); // 1
        powers.push(mapping.m2); // 2
        powers.push(mapping.m3); // 3
        powers.push(mapping.m4); // 4
        for (var i = 1; i <= 11; i++) {
          powers.push(0xff);
        }
        var cmd = {
          cmd: Cmd.CMD_BATCH_DRIVER_MOTION,
          data: { powers: powers },
          timestamp: ms,
          priority: priority
        };
        queue.pushCmd(cmd);
      }
      break;
    }
  },
  // 单个水平关节操作
  setWaistJoinAngle: function (index, angle, priority) {
    if (!this.motionIfNeeded()) return;

    index = Number(index);
    angle = Number(angle);

    var DELTA = 15;
    angle = Math.min(180 - DELTA, Math.max(DELTA, angle));
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_SET_WAIST_JOIN_ANGLE,
      data: { sequence: index, angle: angle },
      timestamp: new Date().getTime(),
      priority: priority,
    });
  },
  // 单个摇摆关节操作
  setArmJoinAngle: function (index, angle, priority) {
    if (!this.motionIfNeeded()) return;

    index = Number(index);
    angle = Number(angle);

    var DELTA = 15;
    angle = Math.min(180 - DELTA, Math.max(DELTA, angle));
    var queue = CmdQueue;
    queue.pushCmd({
      cmd: Cmd.CMD_SET_ARM_JOIN_ANGLE,
      data: { sequence: index, angle: angle },
      timestamp: new Date().getTime(),
      priority: priority,
    });
  },
  // 大M构型中组合关节球操作
  jointMotionM: function (x, y, priority) {
    if (!this.motionIfNeeded()) return;

    x = Number(x);
    y = Number(y);
    var DELTA = 15;
    x = Math.min(180 - DELTA, Math.max(DELTA, x));
    y = Math.min(180 - DELTA, Math.max(DELTA, y));
    var queue = CmdQueue;
    var ms = new Date().getTime();

    var a1 = cc.bell.demoMap.M.a1;
    var a2 = cc.bell.demoMap.M.a2;
    var w1 = cc.bell.demoMap.M.w1;
    var armAngles = [];
    var waistAngles = [];
    var armMap = {};
    var waistMap = {};
    armMap['a' + a1] = y;
    armMap['a' + a2] = 180 - y - 2 * DELTA;
    waistMap['w' + w1] = x;

    armAngles.push(armMap.a1);
    armAngles.push(armMap.a2);
    for (var i = 1; i <= 13; i++) {
      armAngles.push(0xff);
    }
    waistAngles.push(waistMap.w1);
    for (var j = 1; j <= 14; j++) {
      waistAngles.push(0xff);
    }

    /*
    queue.pushCmd({
      cmd: Cmd.CMD_BATCH_ARM_MOTION,
      data: { angles: armAngles },
      timestamp: ms,
      priority: priority,
    });
    queue.pushCmd({
      cmd: Cmd.CMD_BATCH_WAIST_MOTION,
      data: { angles: waistAngles },
      timestamp: ms,
      priority: priority,
    });*/

    // NOTE:
    // 此处为了防止batch_waist被batch_arm指令清除
    // 使用CMD_RAW合并指令
    var armCmd = [0x02, 0x06].concat(armAngles);
    var waistCmd = [0x03, 0x06].concat(waistAngles);
    concatCrc(armCmd);
    concatCrc(waistCmd);
    queue.pushCmd({
      cmd: Cmd.CMD_RAW,
      data: armCmd.concat(waistCmd),
      timestamp: ms,
      priority: priority,
    });
  },
  // 弹出映射窗，点亮驱动灯光
  lightUpOrDownDriversWhenMapping: function (on) {
    if (!this.motionIfNeeded()) return;

    var queue = CmdQueue;
    var mode = on ? cc.bell.waveMode.open : cc.bell.state.waveMode;

    var m1 = 1;
    var m2 = 2;
    var m3 = 3;
    var m4 = 4;
    var cmd1 = [0xb1, 0xed, m1, mode, on ? cc.bell.lightColor.red : cc.bell.state.lightColor];
    var cmd2 = [0xb1, 0xed, m2, mode, on ? cc.bell.lightColor.green : cc.bell.state.lightColor];
    var cmd3 = [0xb1, 0xed, m3, mode, on ? cc.bell.lightColor.yellow : cc.bell.state.lightColor];
    var cmd4 = [0xb1, 0xed, m4, mode, on ? cc.bell.lightColor.blue : cc.bell.state.lightColor];
    concatCrc(cmd1);
    concatCrc(cmd2);
    concatCrc(cmd3);
    concatCrc(cmd4);
    queue.pushCmd({
      cmd: Cmd.CMD_RAW,
      data: cmd1.concat(cmd2).concat(cmd3).concat(cmd4),
      timestamp: new Date().getTime(),
    });
  },
  _lastCockPeckHitMs: 0, // 记录上次敲时间戳
  // 敲敲乐按钮控制关节
  cockPeckHitWithMapping: function (sequence) {
    if (!this.motionIfNeeded()) return;
    var now = new Date().getTime();
    if (this._lastCockPeckHitMs > 0) {
      var delta = now - this._lastCockPeckHitMs;
      if (delta < 500) { // much more than 300 ms will be OK
        return; // ignore it
      } else {
        this._lastCockPeckHitMs = now;
      }
    } else {
      this._lastCockPeckHitMs = now;
    }

    var that = this;
    var deltaAngle = 55; // 55度 ~= 0.3s
    var DELTA_MS = 300;
    // 1号球偏转范围为(90, 90 + deltaAngle)
    // 2号球偏转范围为(90, 90 - deltaAngle)
    deltaAngle *= (sequence === 1) ? 1 : -1;
    // 极性
    deltaAngle *= this._lastPolarityForTickTick > 0 ? 1 : -1;
    this.setArmJoinAngle(sequence, 90 + deltaAngle);
    setTimeout(function () {
      that.setArmJoinAngle(sequence, 90);
    }, DELTA_MS);
  },
  _lastPolarityForTickTick: 1, // 1 positive / -1 negative
  swapTwoArmJointPolarityTickTick: function () {
    this._lastPolarityForTickTick = -this._lastPolarityForTickTick;
  },
  _lastPolarityForOrangutan: 1, // 1 positive / -1 negative
  swapTwoArmJointPolarityOrangutan: function () {
    this._lastPolarityForOrangutan = -this._lastPolarityForOrangutan;
  },
  // @deprecated using polarity instead
  // see #swapTwoArmJointPolarityTickTick for more
  // 敲敲乐构型修改摇摆关节映射(互换)
  swapTwoArmJointMapTickTick: function () {
    var a1 = cc.bell.demoMap.cockpeck.a1;
    var a2 = cc.bell.demoMap.cockpeck.a2;
    var tmp = a1;
    a1 = a2;
    a2 = tmp;
    cc.bell.demoMap.cockpeck.a1 = a1;
    cc.bell.demoMap.cockpeck.a2 = a2;
  },
  // @deprecated using polarity instead
  swapTwoArmJointMapOrangutan: function () {
    var a1 = cc.bell.demoMap.orangutan.a1;
    var a2 = cc.bell.demoMap.orangutan.a2;
    var tmp = a1;
    a1 = a2;
    a2 = tmp;
    cc.bell.demoMap.orangutan.a1 = a1;
    cc.bell.demoMap.orangutan.a2 = a2;
  },
  // 甩力自平衡倒下
  driverMotionDropdownSwingBalance: function () {
    if (!this.motionIfNeeded()) return;

    var queue = CmdQueue;
    var cmd1 = [0xb0, 0xc0, 100, 0, 100];
    var cmd2 = [0xb0, 0xc0, 100, 0, -100];
    var cmd3 = [0xb0, 0xc0, 0, 0, 0];
    concatCrc(cmd1);
    concatCrc(cmd2);
    concatCrc(cmd3);
    queue.pushCmd({
      cmd: Cmd.CMD_RAW,
      data: cmd1.concat(cmd2).concat(cmd3),
      timestamp: new Date().getTime(),
    });
  },
  // 猩猩构型单步动作
  _lastArmDirectionForOrangUtan: 1, // 1 positive / -1 negative
  _lastJointMotionOrangUtanMs: 0, // 上次猩猩单步时间戳
  jointMotionOrangUtan: function () {
    if (!this.motionIfNeeded()) return;
    var now = new Date().getTime();
    if (this._lastJointMotionOrangUtanMs > 0) {
      var delta = now - this._lastJointMotionOrangUtanMs;
      if (delta < 500) { // much more than 300 ms will be OK
        return;
      } else {
        this._lastJointMotionOrangUtanMs = now;
      }
    } else {
      this._lastJointMotionOrangUtanMs = now;
    }

    var a1 = cc.bell.demoMap.orangutan.a1;
    var a2 = cc.bell.demoMap.orangutan.a2;
    var angle1 = this._lastArmDirectionForOrangUtan > 0 ? (90 + 15) : (90 - 60);
    var angle2 = this._lastArmDirectionForOrangUtan > 0 ? (90 - 15) : (90 + 60);
    // 极性
    if (this._lastPolarityForOrangutan < 0) {
      var tmp = angle1;
      angle1 = angle2;
      angle2 = tmp;
    }
    var queue = CmdQueue;

    var armMap = {};
    armMap['a' + a1] = angle1;
    armMap['a' + a2] = angle2;
    var angles = [];
    angles.push(armMap.a1);
    angles.push(armMap.a2);
    for (var i = 1; i <= 13; i++) {
      angles.push(0xff);
    }
    var cmd1 = [0x02, 0x06].concat(angles);
    var cmd2 = [0xb0, 0xc0, 50, 0, (cc.bell.demoMap.orangutan.m1 === 1) ? 50 : -50];
    concatCrc(cmd1);
    concatCrc(cmd2);
    queue.pushCmd({
      cmd: Cmd.CMD_RAW,
      data: cmd1.concat(cmd2),
      timestamp: new Date().getTime(),
    });
    setTimeout(function () {
      queue.pushCmd({
        cmd: Cmd.CMD_MOTION,
        data: { x: 0, y: 0, speed: 0 },
        timestamp: new Date().getTime(),
      });
    }, 300);
    this._lastArmDirectionForOrangUtan = -this._lastArmDirectionForOrangUtan;
  },
  // 猩猩slider位移动作
  driverMotionOrangUtan: function (v1, v2, priority) {
    if (!this.motionIfNeeded()) return;
    v1 = Number(v1);
    v2 = Number(v2);
    v1 = Math.max(100, Math.min(-100, v1));
    v2 = Math.max(100, Math.min(-100, v2));
    if (Math.abs(v1) < 5) v1 = 0;
    if (Math.abs(v2) < 5) v2 = 0;
    var m1 = cc.bell.demoMap.orangutan.m1;
    var m2 = cc.bell.demoMap.orangutan.m2;
    var driverMap = {};
    driverMap['m' + m1] = v1;
    driverMap['m' + m2] = -v2;
    var powers = [];
    powers.push(driverMap.a1);
    powers.push(driverMap.a2);
    for (var i = 1; i <= 13; i++) {
      powers.push(0xff);
    }
    var cmd1 = [0x01, 0x06].concat(powers);
    concatCrc(cmd1);

    var a1 = cc.bell.demoMap.orangutan.a1;
    var a2 = cc.bell.demoMap.orangutan.a2;
    var angle1 = this._lastArmDirectionForOrangUtan > 0 ? (90 + 15) : (90 - 60);
    var angle2 = this._lastArmDirectionForOrangUtan > 0 ? (90 - 15) : (90 + 60);
    // 极性
    if (this._lastPolarityForOrangutan < 0) {
      var tmp = angle1;
      angle1 = angle2;
      angle2 = tmp;
    }
    var armMap = {};
    armMap['a' + a1] = angle1;
    armMap['a' + a2] = angle2;
    var angles = [];
    angles.push(armMap.a1);
    angles.push(armMap.a2);
    for (var i = 1; i <= 13; i++) {
      angles.push(0xff);
    }
    var cmd2 = [0x02, 0x06].concat(angles);
    concatCrc(cmd2);

    var queue = CmdQueue;
    // queue.pushCmd({
    //   cmd: Cmd.CMD_BATCH_DRIVER_MOTION,
    //   data: { powers: powers },
    //   timestamp: new Date().getTime(),
    //   priority: priority,
    // });
    queue.pushCmd({
      cmd: Cmd.CMD_RAW,
      data: cmd1.concat(cmd2),
      timestamp: new Date().getTime(),
      priority: priority
    });
    this._lastArmDirectionForOrangUtan = -this._lastArmDirectionForOrangUtan;
  },

  // 所有demo驱动球操作盘
  // 2轮驱动会调用#_driverMotion
  // 4轮驱动将获取demo驱动球映射，进行映射驱动
  demoDriverMotion: function (demoType, x, y, speed, priority) {
    if (!this.motionIfNeeded()) return;
    var TYPES = cc.bell.demoType;
    switch (demoType) {
      case TYPES.TYPE_BARRIER: // 避障
      case TYPES.TYPE_COCKPECK: // 敲敲乐
      case TYPES.TYPE_FOLLOW: // 跟随
      case TYPES.TYPE_GUN: // 镭射枪
      case TYPES.TYPE_LINE: // 巡线
      case TYPES.TYPE_MOTORCYCLE: // 变形摩托
      case TYPES.TYPE_ORANG_UTAN: // 猩猩

      case TYPES.TYPE_SNAKE: // 蛇形车
      case TYPES.TYPE_SCRATCH_AT: // 抓车自动
      case TYPES.TYPE_AT_VEHICLE: // 变速小车
        break;
      case TYPES.TYPE_M: // 大M
      case TYPES.TYPE_SWING_BALANCE: // 甩力自平衡
      case TYPES.TYPE_m: // 小m
        this._driverMotion(x, y, speed, priority);
        break;
      case TYPES.TYPE_SCRATCH_MT: {// 抓车手动 方向 ->
        this._driverMotionWithMap(
          cc.bell.demoMap.scratch_mt.m2,
          cc.bell.demoMap.scratch_mt.m4,
          cc.bell.demoMap.scratch_mt.m1,
          cc.bell.demoMap.scratch_mt.m3,
          x, y, speed, priority
        );
      }
        break;
      case TYPES.TYPE_MINING_TRUCK: // 斗车 方向 ->
        this._driverMotionWithMap(
          cc.bell.demoMap.mining_truck.m2,
          cc.bell.demoMap.mining_truck.m4,
          cc.bell.demoMap.mining_truck.m1,
          cc.bell.demoMap.mining_truck.m3,
          x, y, speed, priority
        );
        break;
    }
  },

  // 针对4轮驱动(带映射)的所有demo
  _driverMotionWithMap: function (m1, m2, m3, m4, x, y, speed, priority) {
    x = Number(x);
    y = Number(y);
    speed = Number(speed);

    var ratio = Number((speed / 100.0).toFixed(2));
    var vs = vectorCalcPlus(x, y);
    var v1 = Number((vs.v1 * ratio).toFixed(0)); // 左轮
    var v2 = Number((vs.v2 * ratio).toFixed(0)); // 右轮
    var queue = CmdQueue;

    var mapping = {};
    mapping['m' + m1] = v1;
    mapping['m' + m2] = v2;
    mapping['m' + m3] = v1;
    mapping['m' + m4] = v2;
    var powers = [];
    powers.push(mapping.m1);
    powers.push(mapping.m2);
    powers.push(mapping.m3);
    powers.push(mapping.m4);
    for (var i = 1; i <= 11; i++) {
      powers.push(0xff);
    }

    var cmd = {
      cmd: Cmd.CMD_BATCH_DRIVER_MOTION,
      data: { powers: powers },
      timestamp: new Date().getTime(),
      priority: priority
    };
    queue.pushCmd(cmd);
  },

  // 进入翻斗车demo获取当前角度的正负（获取正负后，就能知道85度角往那边走）
  getMiningTruckArmJointPolarity: function (cb) {
    if (!this.motionIfNeeded()) return;
    var queue = CmdQueue;
    BleApis.debugCallbackArm = cb;
    queue.pushCmd({
      cmd: Cmd.CMD_DEBUG_ARM_JOIN,
      data: { sequence: cc.bell.demoMap.mining_truck.a1 },
      timestamp: new Date().getTime()
    });
  },

  driverMotion: function () {
    this._driverMotion(arguments);
  },
};
