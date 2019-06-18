'use strict';

goog.provide('Blockly.Lua.bell_sensor');
goog.require('Blockly.Lua');

// 传感器部分lua
// 颜色传感器（1）[=, ≠] [颜色值]
Blockly.Lua['bell_detect_color_equal_value'] = function(block) {
  var dropdown_index = block.getFieldValue('index');
  var operator = block.getFieldValue('op');
  var colorValue = block.getFieldValue('color');
  var colorSpace = ['#737373', '#000000','#0050dc','#78fa00','#ffff00','#ff1428','#ffffff','#c81eff','#ff9800']
  var colorIndex = colorSpace.indexOf(colorValue);

  var code = `Get_color_data(${dropdown_index}) ${operator} ${colorIndex}`;
  return [code, Blockly.Lua.ORDER_RELATIONAL];
};
// 红外传感器（1）[≤, ≥] 距离（值）
Blockly.Lua['bell_detect_infrared_equal_cm'] = function(block) {
  var dropdown_index = block.getFieldValue('index');
  var operator = block.getFieldValue('op');
  var distance = block.getFieldValue('dis');
  if (distance == 0) {
    distance = 5;
  }

  var code = `Get_infrared_data(${dropdown_index}) ${operator} ${distance}`;
  return [code, Blockly.Lua.ORDER_RELATIONAL];
};
// 触碰球传感器（1）的状态为[按下, 没按下]
Blockly.Lua['bell_detect_touch_press_state'] = function(block) {
  var dropdown_index = block.getFieldValue('index');
  var state = block.getFieldValue('state');

  var code = `Get_touch_state(${dropdown_index}) == ${state}`;
  return [code, Blockly.Lua.ORDER_RELATIONAL];
};
// 陀螺仪的[1，2，3][>,==,<][number]
// ...

// 获取颜色传感器（1）的值
Blockly.Lua['bell_detect_get_color_value'] = function (block) {
  var index = block.getFieldValue('index');
  var code = `Get_color_data(${index})`;
  return [code, Blockly.Lua.ORDER_HIGH];
};
// 获取红外传感器（1）的值
Blockly.Lua['bell_detect_get_infrared_value'] = function (block) {
  var index = block.getFieldValue('index');
  var code = `Get_infrared_data(${index})`;
  return [code, Blockly.Lua.ORDER_HIGH];
};
// 获取陀螺仪（1）的值
// ...