const { exec } = require('child_process');   
import axios from "axios";

export default class HttpClient{
    message = ''
    constructor(){}
    /*
        接收的信息（JSON格式）：
        {
            "ID": ……,  // 光电门ID
            "RFID": ……,  // 托盘ID
            ……
        }
    */
    async postData() {  // 发送消息
        try {  
            const response = await axios.post('https://api.example.com/submit', this.postData);  
            this.message = `数据发送成功，服务器响应: ${response.data.message}`; // 假设服务器返回了一个响应消息  
        } catch (error) {  
            console.error(error);  
            this.message = '发送数据失败';  
        }  
        console.log(this.message);
    }  
    async fetchData() {  // 接收消息
        try {  
            const response = await axios.get('https://api.example.com/data');  
            this.message = response.data; // 假设服务器返回的数据中有一个名为 "message" 的字段  
        } catch (error) {  
            console.error(error);  
            this.message = '获取数据失败';
        }  
        console.log(this.message);
    }
}