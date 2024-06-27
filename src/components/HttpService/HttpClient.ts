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
    fetchData = () => {  // 接收消息
        axios.get(`http://localhost:${this.PORT}/get`).then(
            result => {
                let data = result.data;
                if(data.ID && data.RFID) global.emit("updateTrayPosition", data);
            }
        ).catch(
            err => console.error(err)
        );
    }
    message = '';
    polling;
    PORT: number;
    constructor(port: number){  // 在控制台输入global.emit("sendMessage", {a:1})用于发送消息
        this.PORT = port;
        global.on("sendMessage", data => this.postData(data));
    }
    startPolling() {  // 轮询启动
        this.polling = setInterval(this.fetchData, 100);
    }
    stopPolling() {  // 轮询停止
        clearInterval(this.polling);
    }
    postData(data) {  // 发送消息
        axios.post(`http://localhost:${this.PORT}/send`, data).then( result => {
            console.log("数据发送成功");
        }).catch(err => console.error("发送数据失败")); 
    }  
}