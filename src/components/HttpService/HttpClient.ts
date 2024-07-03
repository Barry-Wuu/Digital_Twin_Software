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
    getData = () => {  // 接收消息
        if(this.thread_num >= this.max_thread_num) return;
        this.thread_num++; console.log("线程数：", this.thread_num)
        axios.get(`http://${this.SITE}:${this.PORT}/${this.PATH}`, {timeout: this.TIMEOUT}).then(
            result => {
                console.log(result, result.data);
                //if(data.ID && data.RFID) global.emit("updateTrayPosition", data);
                this.thread_num--;
            }
        ).catch(error => {
            console.error(error.message, error);
            this.thread_num--;
        });
    };
     
    max_thread_num = 10;  // 最大线程数
    polling;  // 轮询定时器
    thread_num = 0;  // 当前线程数
    INTERVAL: number;  // 轮询间隔（毫秒）
    PATH: string;  // 轮询路径
    PORT: number;  // 轮询端口
    SITE: string;  // 轮询地址
    TIMEOUT: number;  // 轮询超时时间（毫秒）
    constructor({interval, path, port, site="localhost", timeout}){  // 在控制台输入global.emit("sendMessage", {a:1})用于发送消息
        this.INTERVAL = interval;
        this.PATH = path;
        this.PORT = port;
        this.SITE = site;
        this.TIMEOUT = timeout;
        global.on("sendMessage", data => this.postData(data));
    }
    startPolling() {  // 轮询启动，500s超时
        this.polling = setInterval(this.getData, 100);
        // setTimeout(this.fetchData, 500000).then(()=>this.startPolling());
    }
    stopPolling() {  // 轮询停止
        clearInterval(this.polling);
    }
    postData(data) {  // 发送消息
        axios.post(`http://${this.SITE}:${this.PORT}/get`, data).then( result => {
            console.log("数据发送成功");
        }).catch(err => console.error("发送数据失败")); 
    }  
}