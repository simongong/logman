'use strict';

// 用户输入ssh用户名和密码
const SshUserForm = React.createClass({
  displayName: 'sshUser',

  getInitialState() {
    return {
      name: '',
      password: '',
      error: '',
    };
  },

  changeName(event) {
    this.setState({
      name: event.target.value,
      error: ''
    });
  },

  changePwd(event) {
    this.setState({
      password: event.target.value,
      error: ''
    });
  },

  login() {
    if (!this.state.name || !this.state.password) {
      this.setState({error: '缺少用户名或密码'});
    } else {
      let loginUrl = '/start';
      let cb = (res) => {
        if (res.success) {
          window.location.reload();
        } else {
          this.setState({error: res.error});
        }
      };
      ajaxCall(loginUrl, cb, 'POST', {name: this.state.name, password: this.state.password});
    }
  },

  listenEnterKey(event) {
    switch(event.keyCode) {
      case 13:
        this.login();
        break;
      default:
        break;
    }
  },

  // 绑定回车按键的点击
  componentDidMount() {
    window.addEventListener("keyup", this.listenEnterKey, true);
  },

  componentWillUnmount() {
    window.removeEventListener("keyup", this.listenEnterKey);
  },

  render() {
    return (
      <div style={{padding: "5px 10px"}}>
        <h2>请输入ssh登录用户名和密码</h2>
        <div style={{marginTop: 10}}>
          <span style={{color: '#c7c7c7'}}>用户名：</span>
          <input ref="name" type="text" tabIndex="1" value={this.state.name}
            onChange={this.changeName} />
          <span style={{marginLeft: 10, color: '#c7c7c7'}}>密码：</span>
          <input ref="password" type="password" tabIndex="2" value={this.state.password}
            onChange={this.changePwd} />
          <input style={{marginLeft: 20}} type="button" tabIndex="3" onClick={this.login} value="ssh登录" />
        </div>
        <div style={{color: 'red', marginTop: 10}}>{this.state.error}</div>
      </div>
    );
  }
});

// 定义日志显示区域
const LogScreen = React.createClass({
  displayName: 'LogScreen',

  sockets: [],
  maxLogStack: 500, // 最多保留最近的500条日志
  logs: [],
  filter: '', // 过滤关键字

  getInitialState() {
    return {
      logs: this.logs,
    };
  },

  componentDidMount() {
    const schema = 'http://';
    const port = parseInt(this.props.port, 10);


    const servers = this.props.servers;
    for(let i = 0; i < servers.length; i++) {
      let socketUrl = schema + this.props.domain + ':' + (port + i);
      let socket = io.connect(socketUrl);
      socket.on('connect', () => {
        console.log('Socket client conneted to ' + socketUrl);
      });

      let _this = this;
      socket.on('log-data', (data) => {
        console.log('got data from ', socketUrl, new Date(), data);
        _this.logs = _this.logs.concat(data.data);
        _this.clearOld();
        _this.setState({logs: _this.logs});
      });
      this.sockets.push(socket);
    }

    // 绑定窗口关闭事件
    window.addEventListener("beforeunload", this.closeSockets);
  },

  // 如果查看的是当天的日志，则清除超过最大限额的旧日志
  clearOld() {
    if (this.props.isToday) {
      while(this.logs.length > this.maxLogStack) {
        this.logs.shift();
      }
    }
  },

  // 解绑socket事件
  closeSockets() {
    this.sockets.forEach(socket => {
      socket.emit('leave');
    });
  },

  setLogFile(fileName) {
    // 清空当前旧的log
    while(this.logs.length > 0) this.logs.pop();
    this.setState({log: this.logs});

    // 向socket server端发送事件
    this.sockets.forEach(socket => {
      socket.emit('change-log', {log: fileName});
    });
  },

  setFilter(filter) {
    this.filter = filter;
    this.setState({log: this.logs});  // 使filter立即生效，不用等待下一次来data
  },

  setDate(date, filter) {
    // 清空当前旧的log
    while(this.logs.length > 0) this.logs.pop();
    this.setState({log: this.logs});

    // 向socket server端发送事件
    this.sockets.forEach(socket => {
      socket.emit('set-date', {date: date, filter: filter});
    });
  },

  resetDate() {
    // 清空当前旧的log
    while(this.logs.length > 0) this.logs.pop();
    this.setState({log: this.logs});

    // 向socket server端发送事件
    this.sockets.forEach(socket => {
      socket.emit('reset-date');
    });
  },

  // 每次有日志更新之后，自动滚动窗口到底部
  componentDidUpdate() {
    document.body.scrollTop = document.body.scrollHeight - window.innerHeight;
  },

  render() {
    let logLines = [];
    this.state.logs.forEach((log, index) => {
      if (log.indexOf('WARN') !== -1) {
        logLines.push(<span style={{color: 'yellow'}} key={'line' + index}><br/>{log}</span>);
      } else if (log.indexOf('Error') !== -1){
        logLines.push(<span style={{color: 'red'}} key={'line' + index}><br/>{log}</span>);
      } else if (this.filter && log.indexOf(this.filter) !== -1) {
        logLines.push(<span style={{color: '#0c0'}} key={'line' + index}><br/>{log}</span>);
      } else {
        logLines.push(<span key={'line' + index}><br/>{log}</span>);
      }
    });

    if (logLines.length === 0) {
      return null;
    } else {
      return (<div ref="msgBox" style={{padding: '80px 5px 10px 5px'}}>{logLines}</div>);
    }
  }
});

// 定义最外围wrapper
const LogViewer = React.createClass({
  displayName: 'LogViewer',

  LOG_FILES: {
    [Symbol('log:alp')]: 'lego2-pagegen-web.log',
    [Symbol('log:hsf')]: 'alp-hsf-web.log',
    [Symbol('log:error')]: 'common-error.log',
  },

  cpStyle: {
    backgroundColor: '#333',
    padding: 10,
    color: '#eee',
    position: 'fixed',
    left: 0,
    top: 0,
    width: '100%',
    height: 70,
  },

  btnStyle: {
    padding: '3px 5px 5px 5px',
    height: 15,
    marginLeft: 10,
    display: 'inline-block',
    backgroundColor: '#111',
    border: '1px solid #555',
    borderRadius: 2,
    color: '#ccc',
    cursor: 'pointer',
  },

  getInitialState() {
    return {
      logFile: data.log || 'lego2-pagegen-web.log',  // 查看的日志文件名
      filter: '',  // 过滤关键字
      date: '', // 指定日期
      error: '',
    };
  },

  getToday() {
    const today = new Date();
    return today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  },

  // 切换查看的文件，从客户端向服务端发socket事件
  setLog(event) {
    const logFile = event.target.value;
    this.refs.logScreen.setLogFile(logFile);
    this.setState({
      logFile: logFile,
      date: '', // 设置了文件名之后，日期自动被重置
    });
  },

  updateFilter(event) {
    const filter = event.target.value;
    this.setState({filter});
  },

  // 设置filter
  setFilter() {
    const filter = this.state.filter;
    this.refs.logScreen.setFilter(filter);
  },

  updateDate(event) {
    const date = event.target.value;
    this.setState({date});
  },

  // 按日期查看日志
  // 由于按日期查看是不受限制全部显示，量会比较大，容易导致浏览器卡死，因此把filter也带过去
  checkByDate() {
    this.refs.logScreen.setDate(this.state.date, this.state.filter);
  },

  // 取消按日期查看日志
  resetDate() {
    this.refs.logScreen.resetDate(this.state.date);
    this.setState({date: ''});
  },

  listenEnterKey(event) {
    switch(event.keyCode) {
      case 13:
        this.setFilter();
        break;
      default:
        break;
    }
  },

  // 绑定回车按键的点击
  componentDidMount() {
    window.addEventListener("keyup", this.listenEnterKey, true);
  },

  componentWillUnmount() {
    window.removeEventListener("keyup", this.listenEnterKey);
  },

  render() {
    // 根据servers的配置来生成logScreen组件
    if (data.ready) {
      let logNodes = Object.getOwnPropertySymbols(this.LOG_FILES).map((symbol, index) => {
        let checked = this.LOG_FILES[symbol] === this.state.logFile;
        return (<span key={index} >
          <input type="radio" checked={checked} onChange={this.setLog} value={this.LOG_FILES[symbol]}/>
          {this.LOG_FILES[symbol]}
          </span>);
      });
      let todayTip = this.state.date === '' ? '当前查看的是今天的日志' : '';
      return (
        <div>
          <div className="control-panel" style = {this.cpStyle}>
            <div style={{marginBottom: 5}}>日志文件：{logNodes}</div>
            <div style={{marginBottom: 5}}>过滤关键字：
              <input type="text" placeholder="敲回车后生效" onChange={this.updateFilter} value={this.state.filter}/>
            </div>
            <div>查看某天的日志：
              <input type="text" placeholder={this.getToday()} onChange={this.updateDate} value={this.state.date}/>
              <div style={this.btnStyle} onClick={this.checkByDate}>确定</div>
              <div style={this.btnStyle} onClick={this.resetDate}>重置</div>
              <span style={{color: "#999", marginLeft: 10}}>{todayTip}</span>
            </div>
          </div>
          <LogScreen ref="logScreen" servers={data.servers} domain={data.domain}
            port={data.port} isToday={this.state.date === '' ? true : false}/>
        </div>
      );
    } else {
      // 显示用户登录
      return (
        <SshUserForm />
      );
    }
  }
});

const container = document.getElementById('container');
ReactDOM.render(<LogViewer />, container);

function ajaxCall(url, cb, type, data) {
  let xmlhttp;
  type = type || 'GET';

  if (window.XMLHttpRequest) {
    // code for IE7+, Firefox, Chrome, Opera, Safari
    xmlhttp = new XMLHttpRequest();
  } else {
    // code for IE6, IE5
    xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');
  }

  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
     if(xmlhttp.status == 200){
       cb && cb(JSON.parse(xmlhttp.responseText));
     } else {
       alert('ajax请求没有正常返回数据: ' + xmlhttp.responseText);
     }
    }
  };

  switch(type) {
    case 'GET':
      xmlhttp.open('GET', url, true);
      xmlhttp.send();
      break;
    case 'POST':
      xmlhttp.open('POST', url);
      xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xmlhttp.send('combo=' + JSON.stringify(data));
      break;
    default:
      console.log('unknown ajax request type');
      break;
  }
}
