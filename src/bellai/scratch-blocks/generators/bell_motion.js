'use strict';

goog.provide('Blockly.Lua.bell_motion');
goog.require('Blockly.Lua');

// 驱动球（1） stop
Blockly.Lua['bell_motion_stop'] = function (block) {
    var ball = block.getFieldValue('Ball');
    var mode = block.getFieldValue('mode');
    ball = JSON.parse(ball);
    // TODO: Assemble Lua into code variable.
    var code = '';
    for (var i = 0; i < ball[0].length; i++) {
        code += `Single_wheel_stop(${ball[0][i]}, ${mode})\n`
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
// 旋转关节球（1）摆到（度°） ，是否阻塞
Blockly.Lua['bell_motion_waist_joint_deg_concurrence'] = function (block) {
    var ball = block.getFieldValue('MOTOR');
    ball = JSON.parse(ball);
    var number_angle = block.getFieldValue('Angle');
    var blocked = block.getFieldValue('BLOCKED').indexOf('nonblocked') < 0;
    // TODO: Assemble Lua into code variable.

    var code = '';
    var waitForDone = [];
    for (var i = 0; i < ball[0].length; i++) {
        var seq = ball[0][i];
        seq = Math.min(15, Math.max(1, seq));
        waitForDone.push(seq);
        code += `Set_hservo_angle(${seq}, ${number_angle})\n`;
    }
    if (blocked && waitForDone.length) {
        code += 'r_Delay(0.5)\n';
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
// 摇摆关节球（1）摆到（度°） ，是否阻塞
Blockly.Lua['bell_motion_arm_joint_deg_concurrence'] = function (block) {
    var ball = block.getFieldValue('Ball');
    ball = JSON.parse(ball);
    var number_angle = block.getFieldValue('Angle');
    var blocked = block.getFieldValue('BLOCKED').indexOf('nonblocked') < 0;
    // TODO: Assemble Lua into code variable.
    var code = '';
    var waitForDone = [];
    for (var i = 0; i < ball[0].length; i++) {
        // code += `Set_vservo_angle_plus(${ball[0][i]}, ${number_angle}, 300)\n`
        var seq = ball[0][i];
        seq = Math.min(15, Math.max(1, seq));
        waitForDone.push(seq);
        // fix issue: slices to async calling
        // code += `Set_vservo_angle_plus_async(${seq}, ${number_angle}, 1000)\n`;
        code += `Set_vservo_angle(${seq}, ${number_angle})\n`;
    }
    if (blocked && waitForDone.length) {
        /**
        code += `r_wait_for(function() return `;
        for (var i = 0, N = waitForDone.length; i < N; i++) {
          // r_wait_for(function() return Is_vservo_angle_plus_async_done(${seq}) end)\n
          if (i > 0) code += ` and Is_vservo_angle_plus_async_done(${waitForDone[i]})`;
          else code += `Is_vservo_angle_plus_async_done(${waitForDone[i]})`;
        }
        code += ` end)\n`;
        */
        code += 'r_Delay(0.5)\n';
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
// 获取旋转关节球（1）的角度（°）
Blockly.Lua['bell_motion_get_waist_deg'] = function (block) {
    var ball = block.getFieldValue('MOTOR');
    ball = JSON.parse(ball);
    ball = Math.min(15, Math.max(1, ball)); // 确保范围在 [1, 15]
    var code = '';
    code += `Get_hservo_angle(${ball})\n`;
    return [code, Blockly.Lua.ORDER_HIGH];
};
// 获取摇摆关节球（1）的角度（°）
Blockly.Lua['bell_motion_get_arm_deg'] = function (block) {
    var ball = block.getFieldValue('MOTOR');
    ball = JSON.parse(ball);
    ball = Math.min(15, Math.max(1, ball)); // 确保范围在 [1, 15]
    var code = '';
    code += `Get_vservo_angle(${ball})\n`;
    return [code, Blockly.Lua.ORDER_HIGH];
};
// 驱动球（1）,[顺时针, 逆时针] 旋转, 速度（30）转/分
Blockly.Lua['bell_motion_motor_rotate'] = function (block) {
    var code = '';
    var ball = block.getFieldValue('MOTOR');
    ball = JSON.parse(ball)[0];// !Array: [1, 2, 3, ... 15]
    var clockwise = block.getFieldValue('CLOCKWISE');
    var speed = block.getFieldValue('SPEEDS');
    var seconds = block.getFieldValue('SECONDS');

    var models = [];
    models.push({
        seq: ball[0],
        clockwise: clockwise,
        speed: speed,
        seconds: seconds
    });

    if (ball.length > 1) {
        for (var i = 1; i < ball.length; i++) {
            models.push({
                seq: ball[i],
                clockwise: block.getFieldValue('CLOCKWISE' + (i - 1)),
                speed: block.getFieldValue('SPEEDS' + (i - 1)),
                seconds: block.getFieldValue('SECONDS' + (i - 1))
            });
        }
    }

    var distance = Blockly.Blocks['speedDistance'] || 'cm';
    var time = Blockly.Blocks['speedTime'] || 's';
    var circumference = 60.8 / 10 * Math.PI;// (cm)
    var rotationSpeedMin = -3.125; // -3.125 r/s
    var rotationSpeedMax = 3.125; // 3.125 r/s
    rotationSpeedMin *= circumference; // r/s -> cm/s
    rotationSpeedMax *= circumference; // r/s -> cm/s

    for (var i = 0, N = models.length; i < N; i++) {
        var seq = models[i].seq;
        var speed = models[i].speed;
        var seconds = models[i].seconds;

        seq = Math.min(15, Math.max(seq, 1)); // 1-15
        // km/h, km/min, km/s, m/h, m/min, m/s, cm/h, cm/min  -> cm/s
        if (distance == 'km') { // -> cm
            speed *= 1000 * 100;
        } else if (distance == 'm') {
            speed *= 100;
        }
        if (time == 'h') {
            speed /= 60 * 60;
        } else if (time == 'min') {
            speed /= 60;
        }
        if (models[i].clockwise == 1) speed = -speed; // anti-clockwise
        // and now speed is 'cm/s'
        // cm /s -> r/s
        speed /= circumference;
        speed = Math.min(rotationSpeedMax, Math.max(rotationSpeedMin, speed));
        // speed to power
        speed /= 0.03125;
        // ensure integer
        speed = parseInt(speed);
        // [-100, 100]
        speed = Math.min(100, Math.max(-100, speed));
        // seconds should not less than 0
        seconds = Math.max(0, seconds);

        code += 'Motor_Run_A_While(' + seq + ', ' + speed + ', ' + seconds + ')\n';
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
//!!!NOTE: override the generator for
// bell_motion_motor_rotate  重写？？？
Blockly.Lua['bell_motion_motor_rotate'] = function (block) {
    var code = '';

    var ball = block.getFieldValue('ball');
    ball = JSON.parse(ball)[0];// !Array: [1, 2, 3, ... 15]
    var clockwise = block.getFieldValue('clockwise');
    var speed = block.getFieldValue('speed');
    var seconds = block.getFieldValue('seconds');
    var blocked = block.getFieldValue('BLOCKED').indexOf('nonblocked') < 0;

    var models = [];
    models.push({
        seq: ball[0],
        clockwise: clockwise,
        speed: speed,
        seconds: seconds
    });

    if (ball.length > 1) {
        for (var i = 1; i < ball.length; i++) {
            models.push({
                seq: ball[i],
                clockwise: block.getFieldValue('clockwise' + (i - 1)),
                speed: block.getFieldValue('speed' + (i - 1)),
                seconds: block.getFieldValue('seconds' + (i - 1))
            });
        }
    }

    var rotationSpeedMin = -3.125 * 60; // r/min
    var rotationSpeedMax = 3.125 * 60; // r/min

    var waitS = 0;
    for (var i = 0, N = models.length; i < N; i++) {
        var seq = models[i].seq;
        var speed = models[i].speed;
        var seconds = models[i].seconds;

        seq = Math.min(15, Math.max(seq, 1)); // 1-15
        if (models[i].clockwise == 1) speed = -speed; // anti-clockwise
        // and now speed is 'r/min'
        speed = Math.min(rotationSpeedMax, Math.max(rotationSpeedMin, speed));
        // speed to power
        //       speed          power
        // ----------------  =  ----
        // rotationSpeedMax     100
        speed = 100 * speed / rotationSpeedMax;
        // ensure integer
        speed = parseInt(speed);
        // [-100, 100]
        speed = Math.min(100, Math.max(-100, speed));
        // seconds should not less than 0
        seconds = Math.max(0, seconds);

        code += 'Motor_Run_A_While(' + seq + ', ' + speed + ', ' + seconds + ')\n';

        waitS = Math.max(waitS, seconds);
    }

    if (blocked) code += `r_Delay(${waitS})\n`;
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
// 驱动球（1）,[顺时针, 逆时针] 旋转, 速度（30）转/分, （1）秒, 是否阻塞
Blockly.Lua['bell_motion_motor_rotate_concurrence'] = function (block) {
    var code = '';

    var ball = block.getFieldValue('ball');
    ball = JSON.parse(ball)[0];// !Array: [1, 2, 3, ... 15]
    var clockwise = block.getFieldValue('clockwise');
    var speed = block.getFieldValue('speed');

    var models = [];
    models.push({
        seq: ball[0],
        clockwise: clockwise,
        speed: speed
    });

    if (ball.length > 1) {
        for (var i = 1; i < ball.length; i++) {
            models.push({
                seq: ball[i],
                clockwise: block.getFieldValue('clockwise' + (i - 1)),
                speed: block.getFieldValue('speed' + (i - 1))
            });
        }
    }

    var distance = Blockly.Blocks['speedDistance'] || 'cm';
    var time = Blockly.Blocks['speedTime'] || 's';
    var circumference = 60.8 / 10 * Math.PI;// (cm)
    var rotationSpeedMin = -3.125; // -3.125 r/s
    var rotationSpeedMax = 3.125; // 3.125 r/s
    rotationSpeedMin *= circumference; // r/s -> cm/s
    rotationSpeedMax *= circumference; // r/s -> cm/s

    // code += 'Motor_Run_A_While(' + i + ', ' + ball.power + ', ' + ball.seconds + ')\n';
    // code += 'Motor_Run_Forever(' + i + ', ' + ball.power + ')\n';

    for (var i = 0, N = models.length; i < N; i++) {
        var seq = models[i].seq;
        var speed = models[i].speed;

        seq = Math.min(15, Math.max(seq, 1)); // 1-15
        // km/h, km/min, km/s, m/h, m/min, m/s, cm/h, cm/min  -> cm/s
        if (distance == 'km') { // -> cm
            speed *= 1000 * 100;
        } else if (distance == 'm') {
            speed *= 100;
        }
        if (time == 'h') {
            speed /= 60 * 60;
        } else if (time == 'min') {
            speed /= 60;
        }
        if (models[i].clockwise == 1) speed = -speed; // anti-clockwise
        // and now speed is 'cm/s'
        // cm /s -> r/s
        speed /= circumference;
        speed = Math.min(rotationSpeedMax, Math.max(rotationSpeedMin, speed));
        // speed to power
        speed /= 0.03125;
        // ensure integer
        speed = parseInt(speed);
        // [-100, 100]
        speed = Math.min(100, Math.max(-100, speed));

        code += 'Motor_Run_Forever(' + seq + ', ' + speed + ')\n';
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
//!!!NOTE: override the generator for
// bell_motion_motor_rotate_concurrence 重写？？？
Blockly.Lua['bell_motion_motor_rotate_concurrence'] = function (block) {
    var code = '';

    var ball = block.getFieldValue('MOTOR');
    ball = JSON.parse(ball)[0];// !Array: [1, 2, 3, ... 15]
    var clockwise = block.getFieldValue('CLOCKWISE');
    var speed = block.getFieldValue('SPEEDS');

    var models = [];
    models.push({
        seq: ball[0],
        clockwise: clockwise,
        speed: speed
    });

    if (ball.length > 1) {
        for (var i = 1; i < ball.length; i++) {
            models.push({
                seq: ball[i],
                clockwise: block.getFieldValue('CLOCKWISE' + (i - 1)),
                speed: block.getFieldValue('SPEEDS' + (i - 1))
            });
        }
    }

    var rotationSpeedMin = -3.125 * 60; // r/min
    var rotationSpeedMax = 3.125 * 60; // r/min

    for (var i = 0, N = models.length; i < N; i++) {
        var seq = models[i].seq;
        var speed = models[i].speed;

        seq = Math.min(15, Math.max(seq, 1)); // 1-15
        if (models[i].clockwise == 1) speed = -speed; // anti-clockwise
        // and now speed is 'r/min'
        speed = Math.min(rotationSpeedMax, Math.max(rotationSpeedMin, speed));
        // speed to power
        //       speed          power
        // ----------------  =  ----
        // rotationSpeedMax     100
        speed = 100 * speed / rotationSpeedMax;
        // ensure integer
        speed = parseInt(speed);
        // [-100, 100]
        speed = Math.min(100, Math.max(-100, speed));

        code += 'Motor_Run_Forever(' + seq + ', ' + speed + ')\n';
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
// 驱动球 (1), [顺时针, 逆时针] 旋转, 功率 (30), 持续 (1) 秒, 是否阻塞
Blockly.Lua['bell_motion_motor_power_concurrence'] = function (block) {
    var code = '';

    var ball = block.getFieldValue('MOTOR');
    ball = JSON.parse(ball)[0];// !Array: [1, 2, 3, ... 15]
    var clockwise = block.getFieldValue('CLOCKWISE');
    var power = block.getFieldValue('POWER');
    var seconds = block.getFieldValue('SECONDS');
    var blocked = block.getFieldValue('BLOCK').indexOf('nonblocked') < 0;

    var models = [];
    models.push({
        seq: ball[0],
        clockwise: clockwise,
        power: power,
        seconds: seconds
    });

    if (ball.length > 1) {
        for (var i = 1; i < ball.length; i++) {
            models.push({
                seq: ball[i],
                clockwise: block.getFieldValue('CLOCKWISE' + (i - 1)),
                power: block.getFieldValue('POWER' + (i - 1)),
                seconds: block.getFieldValue('SECONDS' + (i - 1))
            });
        }
    }

    var waitS = 0;
    for (var i = 0, N = models.length; i < N; i++) {
        var seq = models[i].seq;
        var power = models[i].power;
        var seconds = models[i].seconds;

        seq = Math.min(15, Math.max(seq, 1)); // 1-15
        power = Math.min(100, Math.max(-100, power)); // [-100, 100]
        if (models[i].clockwise == 1) power = -power; // anti-clockwise
        seconds = Math.max(0, seconds);

        code += 'Motor_Run_A_While(' + seq + ', ' + power + ', ' + seconds + ')\n';
        waitS = Math.max(waitS, seconds);
    }
    if (blocked) code += `r_Delay(${waitS})\n`;
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
// 驱动球 (1), [顺时针, 逆时针] 旋转, 功率 (30), 持续 (1) 秒
Blockly.Lua['bell_motion_motor_power'] = function (block) {
    var code = '';

    var ball = block.getFieldValue('MOTOR');
    ball = JSON.parse(ball)[0];// !Array: [1, 2, 3, ... 15]
    var clockwise = block.getFieldValue('CLOCKWISE');
    var power = block.getFieldValue('POWER');

    var models = [];
    models.push({
        seq: ball[0],
        clockwise: clockwise,
        power: power
    });

    if (ball.length > 1) {
        for (var i = 1; i < ball.length; i++) {
            models.push({
                seq: ball[i],
                clockwise: block.getFieldValue('CLOCKWISE' + (i - 1)),
                power: block.getFieldValue('POWER' + (i - 1))
            });
        }
    }

    for (var i = 0, N = models.length; i < N; i++) {
        var seq = models[i].seq;
        var power = models[i].power;

        seq = Math.min(15, Math.max(seq, 1)); // 1-15
        power = Math.min(100, Math.max(-100, power)); // [-100, 100]
        if (models[i].clockwise == 1) power = -power; // anti-clockwise

        code += 'Motor_Run_Forever(' + seq + ', ' + power + ')\n';
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
        code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
};
