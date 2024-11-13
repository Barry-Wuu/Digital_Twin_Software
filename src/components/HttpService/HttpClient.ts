const { exec } = require('child_process');   
import axios from "axios";
import global from "../../Global"
/*
    接收的信息（JSON格式）：
    {
        "ID": ……,  // 光电门ID
        "RFID": ……,  // 托盘ID
        ……
    }
*/
export default class HttpClient{
    getData;  // 回调函数
    connect = true;  // 允许连接
    max_thread_num = 10;  // 最大线程数
    polling;  // 连接定时器
    thread_num = 0;  // 当前线程数
    INTERVAL: number;  // 连接间隔（毫秒）
    PATH: string;  // 连接路径
    PORT: number;  // 连接端口
    SITE: string;  // 连接地址
    TIMEOUT: number;  // 连接超时时间（毫秒）

    constructor({interval, path, port, site="localhost", timeout, callback}){  // 在控制台输入global.emit("sendMessage", {a:1})用于发送消息
        this.INTERVAL = interval;
        this.PATH = path;
        this.PORT = port;
        this.SITE = site;
        this.TIMEOUT = timeout;
        this.getData = callback;
        global.on("sendMessage", data => this.postData(data));
    }
    startConnect() {  // 连接启动
        this.connect = true;
        this.getData(axios, this);
        // this.polling = setInterval(this.getData, 100);
        // setTimeout(this.fetchData, 500000).then(()=>this.startPolling());
    }
    stopConnect() {  // 连接停止
        this.connect = false;
    }
    postData(data) {  // 发送消息
        axios.post(data.site, data.data).then( result => {
            console.log(result);
        }).catch(err => console.error(err)); 
    }  
}