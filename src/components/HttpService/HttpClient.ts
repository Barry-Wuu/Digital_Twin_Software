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
    callback;  // 回调函数
    connect = true;  // 允许连接
    max_thread_num = 10;  // 最大线程数
    polling;  // 连接定时器
    thread_num = 0;  // 当前线程数
    INTERVAL: number;  // 连接间隔（毫秒）
    PATH: string;  // 连接路径
    PORT: number;  // 连接端口
    SITE: string;  // 连接地址
    TIMEOUT: number;  // 连接超时时间（毫秒）  
    
    // 在控制台输入global.emit("postRequest", {a:1})用于发送消息
    constructor({interval, path, port, site="localhost", timeout, callback}){
        this.INTERVAL = interval;
        this.PATH = path;
        this.PORT = port;
        this.SITE = site;
        this.TIMEOUT = timeout;
        this.callback = callback;
        global.on("getRequest", data => this.getRequest(data));
        global.on("postRequest", data => this.postRequest(data));
    }
    startConnect() {  // 连接启动
        this.connect = true;
        this.callback(axios, this);
    }
    stopConnect() {  // 连接停止
        this.connect = false;
    }
    getRequest(site) {  // 发送get请求
        axios.get(site, {timeout: this.TIMEOUT})
        .then(res => console.log(res.data))
        .catch(err => console.log(err));
    }  
    postRequest(data) {  // 发送post请求
        axios.post(data.site, data.data)
        .then(res => console.log(res))
        .catch(err => console.error(err)); 
    }  
}