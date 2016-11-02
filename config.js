'use strict';

module.exports = {
  domain: 'www.abc.com',  // 日志所属web应用的域名（重要，请替换成真实域名）
  portIndex: 9527,  // socket.io监听的端口
  logRootFolder: '/path/to/your/log/folder/', // 日志文件所在目录
  servers: ['127.0.0.1'], // web应用所在服务器的ip地址
  logs: ['a.log', 'b.log'], // 你需要监控的日志文件名（请替换成你的日志名）
};
