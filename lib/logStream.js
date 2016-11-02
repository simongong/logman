'use strict';

const Connection = require('ssh2');

// a wrapper of ssh stream
// use `tail -F logfile` by default

let LogStream = function() {
  this.host = null;
  this.combo = {};
  this.clients = {}; // an object of socket clients: {socketId: socket}
  this.stream = null; // current stream
  this.conn = null; // current ssh connection
};

// create a ssh connection
// and open a file stream with a tail command
LogStream.prototype.connect = function(logPath, filter) {
  // close the current stream and connection
  this.stream && this.stream.close();
  this.stream = null;
  this.conn && this.conn.end();

  const conn = new Connection();
  this.conn = conn;
    conn.on('ready', () => {
      let cmd = 'tail -F ' + logPath; // use `tail -F` by default
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
          if (filter) { // if filter set
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
}

// initialize ssh connection
LogStream.prototype.create = function(host, user, logPath, socket) {

  this.host = host;
  this.clients[socket.id] = socket;
  this.combo.username = user.name;
  this.combo.password = user.password;

  return this.connect(logPath);
};

// a new socket client join in
LogStream.prototype.join = function(socket) {
  this.clients[socket.id] = socket;
  this.stream.removeAllListeners('data');

  this.stream.on('data', (data) => {
    const socketIds = Object.keys(this.clients);
    socketIds.forEach(id => {
      this.clients[id].emit('log-data', {data: data.toString()});
    });
  });
};

// a socket client leave off
LogStream.prototype.leave = function(socketId) {
  delete this.clients[socketId];
  this.stream.removeAllListeners('data');

  this.stream.on('data', (data) => {
    const socketIds = Object.keys(this.clients);
    socketIds.forEach(id => {
      this.clients[id].emit('log-data', {data: data.toString()});
    });
  });
};

LogStream.prototype.end = function() {
  this.conn && this.conn.end();
};

module.exports = LogStream;
