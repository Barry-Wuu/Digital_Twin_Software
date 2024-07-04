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
    getData = () => {  // 使用阻塞的方式连接并接收消息，全局超时时间为this.TIMEOUT=500s
        if(!this.connect) return;
        if(this.thread_num >= this.max_thread_num) return;
        this.thread_num++; 
        console.log("线程数：", this.thread_num)
        axios.get(
            `http://${this.SITE}:${this.PORT}/${this.PATH}`, 
            {timeout: this.TIMEOUT}
        ).then(
            result => {
                let data = result.data;
                if(data.RFID && data.deviceID) global.emit("updateTrayPosition", data);
                this.thread_num--;
                this.getData();
            }
        ).catch(error => {
            console.error(error.message, error);
            this.thread_num--;
            this.getData();
        });
    };
     
    connect = true;  // 允许连接
    max_thread_num = 10;  // 最大线程数
    polling;  // 连接定时器
    thread_num = 0;  // 当前线程数
    INTERVAL: number;  // 连接间隔（毫秒）
    PATH: string;  // 连接路径
    PORT: number;  // 连接端口
    SITE: string;  // 连接地址
    TIMEOUT: number;  // 连接超时时间（毫秒）

    constructor({interval, path, port, site="localhost", timeout}){  // 在控制台输入global.emit("sendMessage", {a:1})用于发送消息
        this.INTERVAL = interval;
        this.PATH = path;
        this.PORT = port;
        this.SITE = site;
        this.TIMEOUT = timeout;
        global.on("sendMessage", data => this.postData(data));
    }
    startConnect() {  // 连接启动
        this.connect = true;
        this.getData();
        // this.polling = setInterval(this.getData, 100);
        // setTimeout(this.fetchData, 500000).then(()=>this.startPolling());
    }
    stopConnect() {  // 连接停止
        this.connect = false;
    }
    postData(data) {  // 发送消息
        axios.post(`http://${this.SITE}:${this.PORT}/get`, data).then( result => {
            console.log("数据发送成功");
        }).catch(err => console.error("发送数据失败")); 
    }  
}