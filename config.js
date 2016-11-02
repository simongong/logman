'use strict';

module.exports = {
  domain: 'www.abc.com',  // domain of you web app (Important!)
  portIndex: 9527,  // port that socket.io will listen to
  logRootFolder: '/path/to/your/log/folder/', // folder path of your log files
  servers: ['127.0.0.1'], // ip of your servers
  logs: ['a.log', 'b.log'], // log file name
};
