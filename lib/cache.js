'use strict';

// aplication-wide缓存数据
module.exports = {
  ready: false, // 是否已经ssh登录完成
  log: null,  // 当前监控的日志文件名，用来在新的客户端接入时告知它当前监听的文件名
  error: '',  // 错误信息
};
