'use strict';

const Connection = require('ssh2');

// 一个ssh stream包装类
// 执行ssh登录，执行一个tail命令获得原始的stream
// 只保留一个ssh connect

let LogStream = function() {
  this.host = null;
  this.combo = {};
  this.clients = {}; // 当前监听这个ssh流的socket客户端{socketId: socket}
  this.stream = null; // 当前监听的流
  this.conn = null; // 当前建立的ssh2连接
};

// 创建ssh连接，并添加当前请求的客户端socket监听流
LogStream.prototype.create = function(host, user, logPath, socket) {
  const conn = new Connection();

  this.host = host;
  this.clients[socket.id] = socket;
  this.combo.username = user.name;
  this.combo.password = user.password;
  this.conn = conn;

  const sshConfig = {
    host: this.host,
    port: 22,
    username: this.combo.username,
    password: this.combo.password,
  };

  return new Promise((resolve, reject) => {
    conn.connect(sshConfig);

    conn.on('ready', () => {
      let cmd = 'tail -F ' + logPath;
      conn.exec(cmd, (err, stream) => {
        if (err) {
          reject(err);
        }
        resolve();

        this.stream = stream;

        let result = '';
        stream.on('close', () => {
          conn.end();
        }).on('data', (data) => {
          result += data.toString('utf8');
          let lines = result.split('\n');
          socket.emit('log-data', {data: lines});
          result = lines[lines.length - 1];
        }).stderr.on('data', (data) => {
          console.log('========== STDERR: ' + data);
        });
      });
    });

    conn.on('error', (err) => {
      console.log('================ Connection :: error :: ' + err);
      reject(err);
    });
  });
};

// 有新的socketio客户端接入到ssh返回的流
LogStream.prototype.join = function(socket) {
  this.clients[socket.id] = socket;
  this.stream.removeAllListeners('data'); // 因为没有handler的句柄，因此暴力处理

  this.stream.on('data', (data) => {
    const socketIds = Object.keys(this.clients);
    socketIds.forEach(id => {
      this.clients[id].emit('log-data', {data: data.toString()});
    });
  });
};

// socketio客户端断开连接
LogStream.prototype.leave = function(socketId) {
  delete this.clients[socketId];
  this.stream.removeAllListeners('data'); // 因为没有handler的句柄，因此暴力处理

  this.stream.on('data', (data) => {
    const socketIds = Object.keys(this.clients);
    socketIds.forEach(id => {
      this.clients[id].emit('log-data', {data: data.toString()});
    });
  });
};

// 某个socketio客户端切换监听的文件，所有客户端都切换
// 因为要重新创建ssh连接，生成新的流
LogStream.prototype.changeFile = function(logPath) {
  // 关闭当前监听的stream和ssh连接
  this.stream && this.stream.close();
  this.stream = null;
  this.conn.end();

  const conn = new Connection();
  this.conn = conn;

  const sshConfig = {
    host: this.host,
    port: 22,
    username: this.combo.username,
    password: this.combo.password,
  };

  return new Promise((resolve, reject) => {
    conn.connect(sshConfig);

    conn.on('ready', () => {
      let cmd = 'tail -F ' + logPath;
      conn.exec(cmd, (err, stream) => {
        if (err) {
          reject(err);
        }
        resolve();

        this.stream = stream;

        let result = '';
        stream.on('close', () => {
          conn.end();
        }).on('data', (data) => {
          result += data.toString('utf8');
          let lines = result.split('\n');
          const socketIds = Object.keys(this.clients);
          socketIds.forEach(id => {
            this.clients[id].emit('log-data', {data: lines});
          });
          result = lines[lines.length - 1];
        }).stderr.on('data', (data) => {
          console.log('========== STDERR: ' + data);
        });
      });
    });

    conn.on('error', (err) => {
      console.log('================ Connection :: error :: ' + err);
      reject(err);
    });
  });
};

// 监听指定日期的文件，使用cat命令查看
LogStream.prototype.checkFile = function(logPath, filter) {
  // 关闭当前监听的stream和ssh连接
  this.stream && this.stream.close();
  this.stream = null;
  this.conn.end();

  const conn = new Connection();
  this.conn = conn;

  const sshConfig = {
    host: this.host,
    port: 22,
    username: this.combo.username,
    password: this.combo.password,
  };

  return new Promise((resolve, reject) => {
    conn.connect(sshConfig);

    conn.on('ready', () => {
      let cmd = 'cat ' + logPath;
      conn.exec(cmd, (err, stream) => {
        if (err) {
          reject(err);
        }
        resolve();

        this.stream = stream;

        let result = '';
        stream.on('close', () => {
          conn.end();
        }).on('data', (data) => {
          result += data.toString('utf8');
          let lines = result.split('\n');
          // 如果设置了filter，则过滤日志数据
          if (filter) {
            let i = lines.length - 1;
            for (; i >= 0; i--) {
              if (lines[i].indexOf(filter) === -1) {
                lines.splice(i, 1);
              }
            }
          }

          if (lines.length > 0) {
            const socketIds = Object.keys(this.clients);
            socketIds.forEach(id => {
              this.clients[id].emit('log-data', {data: lines});
            });
            result = lines[lines.length - 1];
          } else {
            result = '';
          }
        }).stderr.on('data', (data) => {
          console.log('========== STDERR: ' + data);
        });
      });
    });

    conn.on('error', (err) => {
      console.log('================ Connection :: error :: ' + err);
      reject(err);
    });
  });
};

LogStream.prototype.end = function() {
  this.conn && this.conn.end();
};

module.exports = LogStream;
