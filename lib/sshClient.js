'use strict';

// 按配置对每个Server启动一个socketio
// 返回一个promise，在web应用里yield调用

const SocketIO = require('socket.io');
const LogStream = require('./logStream');
const Configs = require('../config');
const Cache = require('./cache');

// 顺序执行多个promise任务
const PromiseAll = (promiseTasks) => {
  let result = {resolved: {}, rejected: {}};

  return new Promise((resolve) => {
    let status = Promise.resolve();

    promiseTasks.forEach((promiseTask, index) => {
      status = status.then(promiseTask)
      .then((data) => {
        result.resolved[index] = data;
      })
      .catch((err) => {
        result.rejected[index] = err.message;
      });
    });
    status.then(() => resolve(result));
  });
};

// 传入参数：应用名，logman插件配置
module.exports = {
  conn: function(combo) {
    const logFolder = Configs.logRootFolder;
    const servers = Configs.servers;
    const port = Configs.portIndex || 9527;

    const _makeSocket = (host, i) => new Promise((resolve, reject) => {
      const logStream = new LogStream();
      const io = SocketIO();

      // 该端口上的socketio server监听客户端传来的socket连接请求
      // 每个客户端传来的新请求，都拿到客户端socket的引用
      io.sockets.on('connection', (client) => {
        console.log('======== socket :: connected :: ' + client.id);
        if (logStream.conn) { // ssh连接已建立，则直接加入
          logStream.join(client);
        } else {  // ssh连接还未建立，创建之
          logStream.create(host, combo, logFolder + Configs.logs[0], client)
          .then(() => {
            resolve();
          })
          .catch((err) => { reject(err); });
        }

        // 监听客户端发起的日志文件的切换事件
        client.on('change-log', data => {
          // client.emit('selected', {log: data.log}); // 通知其他客户端修改当前选中的日志文件
          Cache.log = data.log;  // 设置当前监控的日志文件名
          logStream.changeFile(logFolder + data.log)
          .then(() => {})
          .catch((err) => {
            console.log('======== socket :: change-log :: err', err);
          });
        });

        // 监听客户端发起的按日期查看日志文件的事件
        client.on('set-date', data => {
          logStream.checkFile(logFolder + Cache.log + '.' + data.date, data.filter)
          .then(() => {})
          .catch((err) => {
            console.log('======== socket :: change-log :: err', err);
          });
        });

        // 监听客户端发起的日志文件的切换事件
        client.on('reset-date', () => {
          logStream.changeFile(logFolder + Cache.log)
          .then(() => {})
          .catch((err) => {
            console.log('======== socket :: change-log :: err', err);
          });
        });

        // 监听客户端的关闭事件
        client.on('leave', () => {
          console.log('======== socket :: close connection :: ' + client.id);
          logStream.leave(client.id);
        });
      });

      // 按照配置的端口号启动socket，前端的socket按约定来监听
      io.listen(port + i);
    });

    // 创建socketio实例
    let createSockets = [];
    for (let i = 0; i < servers.length; i++) {
      let socket = _makeSocket(servers[i], i);
      createSockets.push(socket);
    }

    // 创建socket，然后设置logman中socket.io的状态
    return PromiseAll(createSockets)
    .then((result) => {
      const errKeys = Object.keys(result.rejected); // 检查是否有出错任务
      if (errKeys.length > 0) {
        return Promise.reject(result.rejected[errKeys[0]]);  // 返回第一个出错的信息
      } else {
        return Promise.resolve(true);
      }
    });
  },
};
