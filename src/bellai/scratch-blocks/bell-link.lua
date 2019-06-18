--[[ 用于本地测试lua脚本执行情况 add by tiny
local stubs = require('stubs_api')
local En_color_sensor = stubs.En_color_sensor
local Dis_color_sensor = stubs.Dis_color_sensor
local Get_color_data = stubs.Get_color_data
local En_gyro = stubs.En_gyro
local Dis_gyro = stubs.Dis_gyro
local Reset_gyro = stubs.Reset_gyro
local Get_gyro_angle = stubs.Get_gyro_angle
local Get_gyro_speed = stubs.Get_gyro_speed
local Get_gyro_accel = stubs.Get_gyro_accel
local Dis_gyro = stubs.Dis_gyro
local En_color_sensor = stubs.En_color_sensor
local Dis_color_sensor = stubs.Dis_color_sensor
local Color_sensor_switch = stubs.Color_sensor_switch
local Get_color_data = stubs.Get_color_data
local En_infrared_sensor = stubs.En_infrared_sensor
local Get_infrared_data = stubs.Get_infrared_data
local Get_motor_data = stubs.Get_motor_data
local Get_time_ms = stubs.Get_time_ms
local Reset_time_ms = stubs.Reset_time_ms
local Led_mode_switch = stubs.Led_mode_switch
local Led_set_color = stubs.Led_set_color
local Led_off = stubs.Led_off
local Two_wheels_straight = stubs.Two_wheels_straight
local Two_wheels_straight_time = stubs.Two_wheels_straight_time
local Two_wheels_straight_length = stubs.Two_wheels_straight_length
local Two_wheels_turn_left = stubs.Two_wheels_turn_left
local Two_wheels_turn_right = stubs.Two_wheels_turn_right
local Two_wheels_vector = stubs.Two_wheels_vector
local Single_wheel_ctrl = stubs.Single_wheel_ctrl
local Single_wheel_time = stubs.Single_wheel_time
local Single_wheel_length = stubs.Single_wheel_length
local Get_wheel_state = stubs.Get_wheel_state
local All_motors_stop = stubs.All_motors_stop
local Single_wheel_stop = stubs.Single_wheel_stop
local Delay_ms = stubs.Delay_ms
local System_yield = stubs.System_yield
local Get_key2_data = stubs.Get_key2_data
local Get_key1_data = stubs.Get_key1_data
local Get_app_cmd = stubs.Get_app_cmd
local Get_vservo_angle = stubs.Get_vservo_angle
local Set_vservo_angle = stubs.Set_vservo_angle
local Get_hservo_angle = stubs.Get_hservo_angle
local Set_hservo_angle = stubs.Set_hservo_angle
local Get_p2p_data = stubs.Get_p2p_data
--]]

-- merge form _coroutine_group.lua

local _cg_func_tab  = {}-- all functions:{name={[function],[function],...}}
local _cg_co_list  = {}-- all coroutines:{[coroutine],[coroutine],...}
local _cg_co_list_count = 0
local _cg_co_queued  = {}-- queued coroutines:{[coroutine],[coroutine],...}
local _cg_co_returned = false
local _cg_curr_ = nil -- current coroutine

-- system help functions
local _cg_sys_coroutine_resume = coroutine.resume
local _cg_sys_coroutine_status = coroutine.status
local _cg_sys_coroutine_yield = coroutine.yield


function cg_def(name,func, first)
  local list = _cg_func_tab[name]
  if list == nil then
    list = {}
    _cg_func_tab[name] = list
  end
  if type(first) == 'boolean' and first then
    table.insert(list, 1, function()
      func()
      _cg_co_returned = true
    end)
  else
    table.insert(list,function()
      func()
      _cg_co_returned = true
    end)
  end
end

local function cg_call(name,...)
  local list = _cg_func_tab[name]
  if _cg_co_queued == nil then
    _cg_co_queued = {}
  end
  --=-print("cg_call:"..name..">"..#list)
  for _, func in ipairs(list) do
    local item = { id = nil, killed = false, src = func, co = nil }
    local co = coroutine.create(item.src)
    item.co = co
    _cg_curr_ = item
    local r,msg = _cg_sys_coroutine_resume(co,...)
    if _cg_sys_coroutine_status (co) == "dead" then
      if r == false then
        -- print("coroutine fail :"..msg)
      end
      --=-print("coroutine returned!")
    else
      table.insert(_cg_co_queued, item)
    end
  end
end

local function cg_current_id()
  if _cg_curr_ == nil then return -1 end
  if _cg_curr_.id == nil then return -1 end
  return _cg_curr_.id
end

local function cg_set_current_id(id)
  if _cg_curr_ == nil then return end
  _cg_curr_.id = id
  System_yield()
end

local function cg_kill(id)
  if id == nil then return end
  for k, v in ipairs(_cg_co_list) do
    if (v.id ~= nil and v.id == id) then
      v.killed = true
      break
    end
  end
  System_yield()
end

local function cg_recover(id)
  if id == nil then return end
  for k, v in ipairs(_cg_co_list) do
    if (v.killed == true and v.id ~= nil and v.id == id) then
      v.killed = false
      v.co = coroutine.create(v.src) -- a new coroutine
      break
    end
  end
  System_yield()
end

local function cg_loop_frame()
  if _cg_co_queued ~=nil then
    for _, item in ipairs(_cg_co_queued) do
      if item.killed == false then
        table.insert(_cg_co_list, item)
        _cg_co_list_count = _cg_co_list_count + 1
      end
    end
    _cg_co_queued = nil
  end
  local i = 1
  while i <= _cg_co_list_count do
    local item = _cg_co_list[i]
    if item.killed then
      i = i + 1--do nothing and continue
    else
      _cg_curr_ = item -- 全局保留当前协程coroutine local,用于设置当前协程id，
      _cg_co_returned = false
      local r,msg = _cg_sys_coroutine_resume(item.co)
      if _cg_co_returned == true or coroutine.status(item.co) == 'dead' then
        -- if r == false then
        --   print("coroutine fail :"..msg)
        -- end
        -- table.remove(_cg_co_list,i)
        -- _cg_co_list_count = _cg_co_list_count - 1
        item.killed = true
        i = i + 1
      else
        i = i + 1
      end
    end
  end

end

exit = false -- 协程里可以通过该标记，退出程序
--[[
  added by tiny
  退出lua执行有三种情况：

  1. System_yield()判断主程序中标记退出，例如app发送退出lua执行指令
  2. lua脚本生成时在对应的协程中将lua flag ‘exit’置为true(这个目前不推荐使用，正常流程，用户不可触)
  3. 协程中没有执行的函数时，自动退出 @see cg_loop()中的_cg_co_list_count=0
--]]
local function cg_loop()

  local quit_flag = 0
  repeat
    cg_loop_frame()
    quit_flag = System_yield()
  until _cg_co_list_count==0 or quit_flag == 1 or exit
end

local mg_yield = _cg_sys_coroutine_yield


local function Get_time_s()
  return Get_time_ms()/1000.0
end
--为了避免协程堵塞，这里使用循环Delay和Yield
local function r_Delay(time_s)
  local time_ms = time_s *1000 - 1
  if(time_ms <1) then
    time_ms = 1
  end
  local startTime = Get_time_ms()
  local nowtime = startTime
  while nowtime - startTime < time_ms do
    mg_yield()
    nowtime = Get_time_ms()
  end
end

local function r_wait_for(func)
  while func()==false do
    mg_yield()
  end
end

local function _wait_for_wheels(no)
  while Get_wheel_state(1,no) ~= 100 do
    r_Delay(0.5)
  end
end

local function r_wait_for_key1()
  while Get_key1_data()~=1 do
    mg_yield()
  end
end
local function r_wait_for_key2()
  while Get_key2_data()~=1 do
    mg_yield()
  end
end
local function r_wait_for_long_key(code)
  local enter_time = 0
  while enter_time > 1000 do
    if Get_key_data()==code then
      enter_time = enter_time + 1
    else
      enter_time = 0
    end
    mg_yield()
  end
end
--added by tinychou @2017-12-10 7:21am
local function _wait_for_condition_times(condition, times, seconds)
  if condition == nil then
    condition = function() return math.random(100) > 50 end
  end
  if times == nil then
    times = 40
  end
  if seconds == nil then
    seconds = 2
  end

  local now = Get_time_ms()
  local start = now
  local future = now + seconds * 1000
  local timesCounter = 0
  while now < future do
    if condition() then
      timesCounter = timesCounter + 1
    end
    now = Get_time_ms()
    mg_yield()
  end

  -- print('wait_for_condition_times result: hope->'..times..
  --   ' in fact->'..timesCounter..
  --   ' duration->'..(Get_time_ms() - start)..' ms')
  return timesCounter == times, timesCounter
end
local function wait_for_condition_times(...)
  local ok, timesCounter = _wait_for_condition_times(...)
  return ok
end
local function wait_for_condition_times_plus(...)
  local ok, timesCounter = _wait_for_condition_times(...)
  return timesCounter
end
local function wait_for_condition_change(condition1, condition2, seconds)
  if condition1 == nil then
    condition1 = function() return math.random(100) > 50 end
  end
  if condition2 == nil then
    condition2 = function() return math.random(100) < 50 end
  end
  if seconds == nil then
    seconds = 2 --2s by default
  end

  --wait for condition1
  local now = Get_time_ms()
  local timeout = function() return (Get_time_ms() - now) > (seconds * 1000) end
  while true do
    if condition1() then
      break
    end
    if timeout() then
      -- print('wait_for_condition_change timeout for condition1 :(')
      return false
    end
    mg_yield()
  end
  -- print('wait_for_condition_change done condition1 cost: '..(Get_time_ms() - now)..' ms')
  -- wait for condition2
  while true do
    if condition2() then
      break
    end
    if timeout() then
      -- print('wait_for_condition_change timeout for condition2 :(')
      return false
    end
    mg_yield()
  end
  -- print('wait_for_condition_change done condition2 cost: '..(Get_time_ms() - now)..' ms')
  return true
end
--added by tinychou @2017-12-9 12:51am
local function Set_vservo_angle_plus(seq, angle, v)
  -- v: 度/s eg: 60度/s
  -- angle [-90, 90] , get angle [-90, 90]
  local startAngle = Get_vservo_angle(seq)
  local targetAngle = angle
  -- print('startAngle: '..startAngle..' targetAngle: '..targetAngle)
  if startAngle == targetAngle then
    return --do nothing
  end

  if v <= 0 then -- no v
    return Set_vservo_angle(seq, targetAngle)
  end

  local angles = math.abs(targetAngle - startAngle)
  local ms = (angles / v) * 1000
  -- print('angles: '..angles..' ms: '..ms)

  if ms == 0 then
    return Set_vservo_angle(seq, targetAngle)
  end

  local times = math.ceil(ms / 50) -- count for 50ms
  if times == 0 then
    return Set_vservo_angle(seq, targetAngle)
  end

  local deltaAngles = angles / times -- angles/50ms
  local positive = 1
  if startAngle > targetAngle then
    positive = -1
  end
  local startTime = Get_time_ms()

  if deltaAngles == 0 then
    return Set_vservo_angle(seq, targetAngle)
  end

  -- print('times: '..times)
  -- print('deltaAngles: '..deltaAngles)
  -- print('positive: '..positive)
  for i = 1, times do
    local angle = math.ceil(startAngle + deltaAngles * i * positive)
    if positive > 0 and angle > targetAngle then
      angle = targetAngle
    elseif positive < 0 and angle < targetAngle then
      angle = targetAngle
    end

    Set_vservo_angle(seq, angle)

    if angle == targetAngle then
      break
    end

    r_Delay(0.05)
  end
  Set_vservo_angle(seq, targetAngle)
  -- print('cost: '..(Get_time_ms() - startTime)..' ms.')
  r_Delay(0.05)
  r_Delay(0.3)
end

local function Set_hservo_angle_plus(seq, angle, v)
  local startAngle = Get_hservo_angle(seq)
  local targetAngle = angle
  if startAngle == targetAngle then
    return
  end

  if v <= 0 then
    return Set_hservo_angle(seq, targetAngle)
  end

  local angles = math.abs(targetAngle - startAngle)
  local ms = (angles / v) * 1000

  if ms == 0 then
    return Set_hservo_angle(seq, targetAngle)
  end

  local times = math.ceil(ms / 50)
  if times == 0 then
    return Set_hservo_angle(seq, targetAngle)
  end

  local deltaAngles = angles / times
  local positive = 1
  if startAngle > targetAngle then
    positive = -1
  end
  local startTime = Get_time_ms()

  if deltaAngles == 0 then
    return Set_hservo_angle(seq, targetAngle)
  end

  for i = 1, times do
    local angle = math.ceil(startAngle + deltaAngles * i * positive)
    if positive > 0 and angle > targetAngle then
      angle = targetAngle
    elseif positive < 0 and angle < targetAngle then
      angle = targetAngle
    end

    Set_hservo_angle(seq, angle)

    if angle == targetAngle then
      break
    end

    r_Delay(0.05)
  end
  Set_hservo_angle(seq, targetAngle)
  -- print('cost: '..(Get_time_ms() - startTime)..' ms.')
  r_Delay(0.05)
  r_Delay(0.3)
end
--added by tinychou @2018-7-26 2:28pm
local vservo_list = {
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 1
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 2
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 3
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 4
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 5
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 6
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 7
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 8
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 9
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 10
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 11
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 12
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 13
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 14
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 15
}
local hservo_list = {
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 1
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 2
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 3
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 4
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 5
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 6
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 7
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 8
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 9
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 10
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 11
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 12
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 13
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 14
  { startTime=0, speed=0, targetAngle=nil, startAngle=nil }, -- 15
}
local sound_queue = {
  -- { tone=1/2/3, scale=1/2/3/4/5/6/7, seconds=0, startTime=0, done=true/false }
}
local function Set_vservo_angle_plus_async(seq, angle, v)
  if seq > 15 or seq < 1 then return -1 end
  angle = math.min(90, math.max(-90, angle))
  v = math.max(0, v)
  v = v * 4
  local now = Get_time_ms()
  vservo_list[seq].startTime = now
  vservo_list[seq].speed = v
  vservo_list[seq].targetAngle = angle
  vservo_list[seq].startAngle = Get_vservo_angle(seq)
  mg_yield()
end
local function Is_vservo_angle_plus_async_done(seq)
  return vservo_list[seq].targetAngle == nil
end
local function Set_hservo_angle_plus_async(seq, angle, v)
  if seq > 15 or seq < 1 then return -1 end
  angle = math.min(90, math.max(-90, angle))
  v = math.max(0, v)
  v = v * 4
  local now = Get_time_ms()
  hservo_list[seq].startTime = now
  hservo_list[seq].speed = v
  hservo_list[seq].targetAngle = angle
  hservo_list[seq].startAngle = Get_hservo_angle(seq)
  mg_yield()
end
local function Is_hservo_angle_plus_async_done(seq)
  return hservo_list[seq].targetAngle == nil
end
local function Beep_play_async(tone, scale, seconds)
  table.insert(sound_queue, {
    tone=tone,
    scale=scale,
    seconds=seconds,
    startTime=Get_time_ms(),
    done=false
  })
  mg_yield()
end
function table_leng(t)
  local leng=0
  for k, v in pairs(t) do
    leng=leng+1
  end
  return leng;
end
cg_def("Start", function()
  while true do
    --vservo 遍历
    for k, v in ipairs(vservo_list) do
      if v.startTime > 0 and v.speed > 0 and v.targetAngle ~= nil and v.startAngle ~= nil then
        local nowTime = Get_time_ms()
        local deltaTimeS = (nowTime - v.startTime) / 1000
        local currAngle = 0

        if v.startAngle > v.targetAngle then
          currAngle = v.startAngle - deltaTimeS * v.speed
          currAngle = math.floor(currAngle)
          currAngle = math.max(v.targetAngle, currAngle)
        else
          currAngle = v.startAngle + deltaTimeS * v.speed
          currAngle = math.ceil(currAngle)
          currAngle = math.min(v.targetAngle, currAngle)
        end

        Set_vservo_angle(k, currAngle)
        r_Delay(0.05)

        if currAngle == v.targetAngle then
          --结束
          v.startTime = 0
          v.speed = 0
          v.targetAngle = nil
          v.startAngle = nil
        end
      else
        v.startTime = 0
        v.speed = 0
        v.targetAngle = nil
        v.startAngle = nil
      end
    end

    mg_yield()

    -- hservo 遍历
    for k, v in ipairs(hservo_list) do
      if v.startTime > 0 and v.speed > 0 and v.targetAngle ~= nil then
        local nowTime = Get_time_ms()
        local deltaTimeS = (nowTime - v.startTime) / 1000
        local currAngle = 0

        if v.startAngle > v.targetAngle then
          currAngle = v.startAngle - deltaTimeS * v.speed
          currAngle = math.floor(currAngle)
          currAngle = math.max(v.targetAngle, currAngle)
        else
          currAngle = v.startAngle + deltaTimeS * v.speed
          currAngle = math.ceil(currAngle)
          currAngle = math.min(v.targetAngle, currAngle)
        end

        Set_hservo_angle(k, currAngle)
        r_Delay(0.05)

        if currAngle == v.targetAngle then
          --结束
          v.startTime = 0
          v.speed = 0
          v.targetAngle = nil
          v.startAngle = nil
        end
      else
        v.startTime = 0
        v.speed = 0
        v.targetAngle = nil
        v.startAngle = nil
      end
    end
    mg_yield()

    --异步声音队列
    for k = 1, table_leng(sound_queue), 1 do
      local v = sound_queue[k]
      if v.done == false and k == 1 then --未完成的，且在队列首位
        local offset = 0
        if v.tone == 1 then
          offset = 24
        elseif v.tone == 2 then
          offset = 17
        else
          offset = 10
        end
        Beep_play(offset + v.scale)
        r_Delay(0.02)

        local now = Get_time_ms()
        local delta = now - v.startTime
        if delta >= v.seconds * 1000.0 then
          v.done = true
          break
        end
      else
        break
      end
    end
    --清除已经列队中已完成的
    for i = table_leng(sound_queue), 1, -1 do
      if sound_queue[i].done then
        Beep_play(32)--turn off
        table.remove(sound_queue, i)
      end
    end
    mg_yield()

  end
end)
--added by tinychou @2017-5-9 21:40pm
local motor_list = {
  { deadline=0, power=0 }, --1
  { deadline=0, power=0 }, --2
  { deadline=0, power=0 }, --3
  { deadline=0, power=0 }, --4
  { deadline=0, power=0 }, --5
  { deadline=0, power=0 }, --6
  { deadline=0, power=0 }, --7
  { deadline=0, power=0 }, --8
  { deadline=0, power=0 }, --9
  { deadline=0, power=0 }, --10
  { deadline=0, power=0 }, --11
  { deadline=0, power=0 }, --12
  { deadline=0, power=0 }, --13
  { deadline=0, power=0 }, --14
  { deadline=0, power=0 }, --15
}
local Ori_Single_wheel_stop = Single_wheel_stop
--override the stopping for a specific motor reset the motor_list table
Single_wheel_stop = function(n, brake)
  Ori_Single_wheel_stop(n, brake)
  motor_list[n].power = 0
  motor_list[n].deadline = 0
end
--coroutine for motor_list
cg_def("Start", function()
  for i = 1, 15 do
    En_infrared_sensor(i)
    Color_sensor_switch(i, 2)
    En_color_sensor(i)
  end
  while true do
    for k, v in ipairs(motor_list) do
      local now = Get_time_ms()
      if v.power == 0 or v.deadline == 0 then
        --do nothing
      elseif v.deadline == -1 or v.deadline > now then
        Single_wheel_ctrl(k, v.power)
      elseif v.deadline < now then
        Single_wheel_stop(k, 1)
      else
        --do nothing
      end
    end
    mg_yield()
  end
end)
-- key listener for exit lua
cg_def("Start", function ()
  while (Get_key1_data()~=1 and Get_key2_data()~=1) do
    mg_yield()
  end
  exit = true
end)
--for listener the app cmds
local cmd1, cmd2, cmd3, cmd4 = -1, -1, -1, -1
cg_def("Start", function()
  while true do
    cmd1, cmd2, cmd3, cmd4 = Get_app_cmd()
    mg_yield()
  end
end)
local function On_App_Cmd(c1, c2, c3, c4)
  if cmd1 == c1 and cmd2 == c2 and cmd3 == c3 and cmd4 == c4 then
    cmd1, cmd2, cmd3, cmd4 = -1, -1, -1, -1 -- reset
    return true
  end
  return false
end
--p2p communication relavant
local function P2p_Send(seq, c1, c2, c3, c4, c5, c6)
  Set_p2p_data(seq, c1, c2, c3, c4, c5, c6)
end
local p2p_data = {
  { c1=0, c2=0, c3=0, c4=0, c5=0, c6=0 }, --1
  { c1=0, c2=0, c3=0, c4=0, c5=0, c6=0 }, --2
  { c1=0, c2=0, c3=0, c4=0, c5=0, c6=0 }, --3
  { c1=0, c2=0, c3=0, c4=0, c5=0, c6=0 }, --4
  { c1=0, c2=0, c3=0, c4=0, c5=0, c6=0 }, --5
  { c1=0, c2=0, c3=0, c4=0, c5=0, c6=0 }, --6
  { c1=0, c2=0, c3=0, c4=0, c5=0, c6=0 }, --7
  { c1=0, c2=0, c3=0, c4=0, c5=0, c6=0 } ---8
}
cg_def("Start", function()
  while true do
    for k, v  in ipairs(p2p_data) do
      local c1, c2, c3, c4, c5, c6 = Get_p2p_data(k)
      v.c1 = c1
      v.c2 = c2
      v.c3 = c3
      v.c4 = c4
      v.c5 = c5
      v.c6 = c6
    end
    mg_yield()
  end
end)
local function On_P2p_Receive(seq, c1, c2, c3, c4, c5, c6)
  local cmd = p2p_data[seq]
  if cmd.c1 == c1 and cmd.c2 == c2 and cmd.c3 == c3 and
    cmd.c4 == c4 and cmd.c5 == c5 and cmd.c6 == c6 then
    cmd.c1 = 0
    cmd.c2 = 0
    cmd.c3 = 0
    cmd.c4 = 0
    cmd.c5 = 0
    cmd.c6 = 0
    return true
  end
  return false
end
-- motor run forever
local function Motor_Run_Forever(n, power)
  if n > 15 or n < 1 then
    return -1
  end

  if power == 0 then
    Single_wheel_stop(n, 1)
    return - 1
  end

  motor_list[n].power = power
  motor_list[n].deadline = -1
end
--motor run a while
local function Motor_Run_A_While(n, power, seconds)
  if n > 15 or n < 1 then
    return -1
  end

  if seconds <= 0 then
    return -1
  end

  if power == 0 then
    Single_wheel_stop(n, 1)
    return -1
  end

  local now = Get_time_ms()
  local endTime = now + seconds * 1000
  motor_list[n].power = power
  motor_list[n].deadline = endTime
end

-- send message
local function msg_fire(msg)
  cg_kill(msg)
  mg_yield()
  cg_recover(msg)
  mg_yield()
end

local function msg_def(msg, func)
  --   创建一个协程并且以msg为id,但不运行它
  --   这里使用cg_def创建它，然后用msg作为id标示它
  --   然后进入就先杀掉它
  -- NOTE: 注意，这里我们需要cg_def传入first为true
  -- 因为我们cg_def msg线程排到队列首部优先于其他Start
  cg_def("Start", function()
    if cg_current_id() == -1 or cg_current_id() == nil then
      cg_set_current_id(msg)
      cg_kill(msg)
      mg_yield()
      return
    end

    func()
  end, true)

end

-- link point start
-- cg_def("Start", function()
--   cg_set_current_id(1)
--   if cg_current_id() == 1 then
--     while (true) do
--       Led_mode_switch(0, 1)
--       Led_set_color(0, 1)
--       r_Delay(0.5)
--       mg_yield()
--     end
--   end
-- end)
-- cg_def("Start", function()
--   cg_set_current_id(2)
--   if cg_current_id() == 2 then
--     while(true) do
--       Led_mode_switch(0, 1)
--       Led_set_color(0, 2)
--       r_Delay(0.8)
--       mg_yield()
--     end
--   end
-- end)
-- cg_def("Start", function()
--   cg_set_current_id(3)
--   r_Delay(1)
--   cg_kill(2)
--   r_Delay(1)
--   cg_recover(2)
-- end)
-- cg_def("Start", function()
--   cg_set_current_id(1988)
--   Set_hservo_angle_plus(1, 60, 60)
-- end)
-- cg_def("Start", function()
--   while true do
--     mg_yield()
--   end
-- end)
-- cg_def("Start", function()
--   local result = wait_for_condition_times(function() return wait_for_condition_change(
--     function() return Get_key1_data() == 1 end,
--     function() return Get_key1_data() == 0 end
--   ) end, 3, 2)
--   if result then
--     print('result: true')
--   else
--     print('result: false')
--   end
-- end)
-- cg_def("Start", function()
--   while true do
--     Set_vservo_angle_plus_async(1, -90, 1)
--     print('DONE 1')
--     r_Delay(9)
--     print('DO 2')
--     Set_vservo_angle_plus_async(1, 0, 30)
--     print('DONE 2')
--     Beep_play_async(3, 2, 5);
--     r_Delay(5.5)
--   end
-- end)
-- link point content

-- link point end

cg_call("Start")
cg_loop()
