import axios from "axios";
import global from "../../Global"
/*
    接收的信息（JSON格式）：
    {
        "ID": ……,  // 光电门ID
        "RFID": ……,  // 托盘ID
        ……
    }
    机械臂设备信息（JSON格式）：
    {
        "NodeID": 24461a2c-b0cf-4f4e-8bda-a3b523ef3c5b,  // 机械臂ID
        "value":1,  // 机械臂状态
        ....
    }
*/
export default class HttpClient {
    allowConnect = false;  // 允许连接
    allowRequest = false;  // 允许请求
    axios = axios;  // axios库
    callback;  // 回调函数
    max_thread_num = 10;  // 最大线程数
    polling;  // 连接定时器
    thread_num = 0;  // 当前线程数
    INTERVAL: number;  // 连接间隔（毫秒）
    PATH: string;  // 连接路径
    PORT: number;  // 连接端口
    SITE: string;  // 连接地址
    TIMEOUT: number;  // 连接超时时间（毫秒）  

    // 在控制台输入global.emit("postRequest", {a:1})用于发送消息
    constructor({ interval, max_thread_num, path, port, site = "localhost", timeout, callback }) {
        this.INTERVAL = interval;
        if (max_thread_num) this.max_thread_num = max_thread_num;
        this.PATH = path;
        this.PORT = port;
        this.SITE = site;
        this.TIMEOUT = timeout;
        this.callback = callback;
        global.on("changeAllowRequest", (value: boolean) => { this.allowRequest = value });
        global.on("getRequest", (url: string) => {  // 发送GET请求
            if (!this.allowRequest) return;
            console.log("尝试发送GET请求至：", url);
            axios.get(url)
                .then(() => console.log("已发送：", url))
                .catch(err => console.error(err));
        });
        global.on("postRequest", (data: any) => {  // 发送POST请求
            if (!this.allowRequest) return;
            console.log("尝试发送POST请求至：", data);
            axios.post(data.url, data.data)
                .then(() => console.log("已发送：", data.data))
                .catch(err => console.error(err));
        });
        global.on("startConnect", () => {  // 连接启动
            this.allowConnect = true;
            this.callback(axios, this);
        });
        global.on("stopConnect", () => {  // 连接停止
            this.allowConnect = false;
        });
    }
}
// global.emit("postRequest", {
//     url: "http://192.168.137.155:8888/nodedatafeedback",
//     data: {
//         writenumber: "1",
//         writerequestjson: {
//             "1": {
//                 ip: ip,
//                 port: port,
//                 suffix: "",
//                 namspaceindex: "3",
//                 nodeID: uri,
//                 value: speed.toFixed(2),
//                 datatype: "String"
//             }
//         }
//     }
// });
// 演示场景，1单位长度=50mm
// 用DT().traverse(dt=>dt.v0=2)改变所有传送带速度
// 用global.emit("updateTrayPosition", {deviceID:'A', RFID:'a'})向托盘发送消息
// 光电门1物理实体ID：a5197017-c560-4713-aacd-01f097dda18f
// 光电门3物理实体ID：75292a01-6d17-4d50-bb75-d42718f75fe8
// 光电门5物理实体ID：7f698a28-d9d4-456a-9814-19d6c9b2f1a1
// 托盘16物理实体ID：822fbee2-1fe0-45c8-b403-8b5cdb31cb25  