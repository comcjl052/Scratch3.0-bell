# coding=utf-8

'''
脚本运行简介：
脚本以单线程协程方式运行，IDE添加的`start` || `event`语句块为 Generator 函数
脚本存在两个队列，`main_queue` && `event_queue`，程序将循环执行`main_queue`
每次`main_queue`让出资源，将循环一遍`event_queue`。当`main_queue`全部执行完毕
（len(main_queue) == 0)，结束程序。
`main_queue`总共执行一次，`event_queue`则可能执行若干次
'''

# 主队列。执行完毕后程序退出
__bell_main_queue = []
# 事件队列。无限循环处理
__bell_event_queue = []
# 退出程序标记
__bell_main_loop_done = False

def r_Delay(time_s):
  time_ms = time_s * 1000 - 1
  if time_ms < 1:
    time_ms = 1
  start_time = Get_time_ms()
  now_time = start_time
  while now_time - start_time < time_ms:
    yield
    now_time = Get_time_ms()

def __bell_register_event(fn_condition, fn_action):
  '''
  注册事件

  @param fn_condition: 条件函数
  @param fn_action: 是一个 Generator 函数
  @return None
  '''
  __bell_event_queue.append({
    'c': fn_condition,
    'a': fn_action()
  })

def __bell_register_main(fn):
  '''
  添加主函数

  @param fn: 必须是 Generator 函数
  @return None
  '''
  __bell_main_queue.append(fn())

def __bell_main_loop():
  '''
  主循环。循环`main_queue`，执行完毕后退出。也就是只会执行一次

  @return None
  '''
  while len(__bell_main_queue):
    for main in __bell_main_queue:
      try:
        main.next()
      except StopIteration:
        __bell_main_queue.remove(main)
      finally:
        yield
  __bell_main_loop_done = True

def __bell_event_loop():
  '''
  事件循环。循环`event_queue`，这是一个死循环，主程序不退出就会一直执行
  '''
  while True:
    for event in __bell_event_queue:
      if event['c']():
        try:
          event['a'].next()
        finally:
          yield
    yield

# Generator 实例
_i_bell_main_loop = __bell_main_loop()
_i_bell_event_loop = __bell_event_loop()

# link point

# 程序运行，开启主循环
while not __bell_main_loop_done:
  try:
    _i_bell_main_loop.next()
  except StopIteration:
    break
  _i_bell_event_loop.next()
