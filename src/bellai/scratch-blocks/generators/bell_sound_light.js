'use strict';

goog.provide('Blockly.Lua.bell_light');
goog.require('Blockly.Lua');

// 设置 主控驱动球(1) 灯光颜色为 [颜色],  模式为[呼吸,渐变,变化]
Blockly.Lua['bell_light_color_mode'] = function (block) {
  var dropdown_index = block.getFieldValue('index');
  dropdown_index = JSON.parse(dropdown_index);
  var dropdown_mode = block.getFieldValue('mode');
  var colorValue = block.getFieldValue('color');
  var colorSpace = ['#f45d5d', '#0eef53', '#f6f550', '#4d9edc', '#d451f8', '#07edfb', '#f29450', '#fcfcfb'];
  var colorIndex = colorSpace.indexOf(colorValue) + 1;

  var code = '';
  //设置主控
  var controlIndex = dropdown_index.indexOf(0);
  if (controlIndex != -1) {
    code += `Led_mode_switch(0, ${dropdown_mode})\n`;
    code += `Led_set_color(0, ${colorIndex})\n`;
    dropdown_index.splice(controlIndex, 1);
  }
  dropdown_index.sort((a, b) => { return a - b });
  //设置驱动
  for (var i = 0; i < dropdown_index.length; i++) {
    code += `Set_motor_led(${dropdown_index[i]}, ${dropdown_mode}, ${colorIndex})\n`
  }
  var nextBlock = block.getNextBlock();
  if (nextBlock) {
    code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
  }
  return code;
};
// 设置 主控驱动球(1) 灯光颜色为 [颜色],  模式为[呼吸,渐变,变化],是否阻塞
Blockly.Lua['bell_light_color_mode_concurrence'] = function (block) {
    var dropdown_index = block.getFieldValue('index');
    dropdown_index = JSON.parse(dropdown_index);
    var dropdown_mode = block.getFieldValue('mode');
    var colorValue = block.getFieldValue('color');
    var colorSpace = ['#f45d5d', '#0eef53', '#f6f550', '#4d9edc', '#d451f8', '#07edfb', '#f29450', '#fcfcfb'];
    var colorIndex = colorSpace.indexOf(colorValue) + 1;
    var blocked = block.getFieldValue('BLOCKED').indexOf('nonblocked') < 0; // 是否阻塞
    // ...

    var code = '';
    //设置主控
    var controlIndex = dropdown_index.indexOf(0);
    if (controlIndex != -1) {
      code += `Led_mode_switch(0, ${dropdown_mode})\n`;
      code += `Led_set_color(0, ${colorIndex})\n`;
      dropdown_index.splice(controlIndex, 1);
    }
    dropdown_index.sort((a, b) => { return a - b });
    //设置驱动
    for (var i = 0; i < dropdown_index.length; i++) {
      code += `Set_motor_led(${dropdown_index[i]}, ${dropdown_mode}, ${colorIndex})\n`
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
      code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
  };

// 主控或驱动球(1) 灯光关闭
Blockly.Lua['bell_light_closed'] = function (block) {
  var offIndex = block.getFieldValue('index');
  offIndex = JSON.parse(offIndex);

  var code = '';
  //设置主控
  var controlIndex = offIndex.indexOf(0);
  if (controlIndex != -1) {
    code += 'Led_off(0)\n';
    offIndex.splice(controlIndex, 1);
  }
  offIndex.sort((a, b) => { return a - b });
  //设置驱动
  for (var i = 0; i < offIndex.length; i++) {
    code += `Set_motor_led(${offIndex[i]}, 0, 1)\n`
  }
  // NOTE: 手动+10ms延迟
  code += 'r_Delay(0.01)\n';
  var nextBlock = block.getNextBlock();
  if (nextBlock) {
    code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
  }
  return code;
};
// 播放蜂鸣器, 音调 [高,中,低], 音阶[1,2,...,9]
Blockly.Lua['bell_light_play_buzzer'] = function (block) {
  var tone = parseInt(block.getFieldValue('tone'));
  var name = block.getFieldValue('name');
  var seconds = block.getFieldValue('seconds');
  var blocked = block.getFieldValue('BLOCKED').indexOf('nonblocked') < 0;

  // check
  if ([1, 2, 3].indexOf(tone) < 0) throw new TypeError('Invalid tone: ' + tone);
  if (['1', '2', '3', '4', '5', '6', '7'].indexOf(name) < 0) throw new TypeError('Invalid name: ' + name);
  if (isNaN(seconds)) seconds = 0;
  seconds = Math.max(0, seconds);

  var code = '';
  if (blocked) {
    code += `Beep_play_async(${tone}, ${name}, ${seconds})\n`;
    code += `r_Delay(${seconds})\n`;
  } else {
    code += `Beep_play_async(${tone}, ${name}, ${seconds})\n`;
  }
  var nextBlock = block.getNextBlock();
  if (nextBlock) {
    code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
  }
  return code;
};
// 播放蜂鸣器, 音调 [高,中,低], 音阶[1,2,...,9]
Blockly.Lua['bell_light_play_buzzer_concurrence'] = function (block) {
    var tone = parseInt(block.getFieldValue('tone'));
    var name = block.getFieldValue('name');
    var seconds = block.getFieldValue('seconds');
    var blocked = block.getFieldValue('BLOCKED').indexOf('nonblocked') < 0;
  
    // check
    if ([1, 2, 3].indexOf(tone) < 0) throw new TypeError('Invalid tone: ' + tone);
    if (['1', '2', '3', '4', '5', '6', '7'].indexOf(name) < 0) throw new TypeError('Invalid name: ' + name);
    if (isNaN(seconds)) seconds = 0;
    seconds = Math.max(0, seconds);
  
    var code = '';
    if (blocked) {
      code += `Beep_play_async(${tone}, ${name}, ${seconds})\n`;
      code += `r_Delay(${seconds})\n`;
    } else {
      code += `Beep_play_async(${tone}, ${name}, ${seconds})\n`;
    }
    var nextBlock = block.getNextBlock();
    if (nextBlock) {
      code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
    }
    return code;
  };