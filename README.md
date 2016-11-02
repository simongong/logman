## Logman

Logman is a web app to monitor your log files.

If your web app is deployed on multiple distributed servers and you want a single entry point to inspect your log files all over the servers, logman will be a good choice.

Built on [Socket.io](http://socket.io/) and [React](https://facebook.github.io/react/).

## Features

1. One monitor, all logs
2. Keyword filtering
3. Specify a history log by date (log file name convention required)

... and more

## How to Run

#### Prepare
```
git clone https://github.com/simongong/logman.git
cd logman
npm install
```

#### Config (Required)

Set config values that lies in `config.js` as your preference.

#### Run
```
npm start
```

#### Open in web browser
http://127.0.0.1:5001

## License
[MIT](LICENSE)
