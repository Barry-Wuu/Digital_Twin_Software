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
    虚拟服务器启动信息（JSON格式）：
    {
        "agentnumber":int类型
        "agents":
        {
           "1":
           {
            "type":string
            "UUID":24461a2c-b0cf-4f4e-8bda-a3b523ef3c5b
            "port":
           } 
           "2":
            {
            "type":string
            "UUID":24461a2c-b0cf-4f4e-8bda-a3b523ef3c5b
            "port":
           } 
           "3":
           .....
        }
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
    global.on("postRequest", async (data: any) => {
      if (!this.allowRequest) return;
      try {
        console.log("发送请求:", data.url, "数据:", data.data);
        const response = await axios.post(data.url, data.data, {
          timeout: 3000 // 3秒超时
        });
        if (!response.data || response.data.NumberOfJobs == 0) {
          console.log("未收到响应", response);
        }
        else {
          console.log("收到响应:", response);
          global.emit("postSuccess", { response, deviceID: data.data.deviceID, rFID: data.data.rFID, serviceType: data.data.serviceType });
        }
      } catch (error) {
        console.error("请求失败:", error.message);
        global.emit("postError", {
          error: error.message,
          context: data.context,
          response: error.response?.data, // <-- 获取服务端返回的错误消息
          status: error.response?.status,
          config: error.config
        });
      }
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
// 演示场景，1单位长度=50mm
// 用DT().traverse(dt=>dt.v0=2)改变所有传送带速度
// 用global.emit("updateTrayPosition", {deviceID:'A', RFID:'a'})向托盘发送消息
// 光电门1物理实体ID：a5197017-c560-4713-aacd-01f097dda18f
// 光电门3物理实体ID：75292a01-6d17-4d50-bb75-d42718f75fe8
// 光电门5物理实体ID：7f698a28-d9d4-456a-9814-19d6c9b2f1a1
// 托盘16物理实体ID：822fbee2-1fe0-45c8-b403-8b5cdb31cb25
// "11fb0bcd-3c2a-8c3d-d4b4-b68bbbb67bf9", //托盘1
//"3449f059-f6db-36d7-53f7-417ce5f92b6e", //托盘2
//"2b8397b3-419a-805a-940d-b148ec861e08", //托盘3
//"b1f19cbd-80fe-89bb-5921-323616956062", //托盘4
//"213c6325-c051-4a7d-d12c-7850113d9111", //托盘5
//"d9ceaf12-2deb-5c88-7e24-a0f5adc04a89", //托盘6
//"0f583e49-d7d8-e030-8517-86ab9d83e6a5", //托盘7
//"bf8314fc-378c-f726-6f58-1db432e22e49", //托盘8
//"86c76c5e-c47d-9521-a505-ea628c2f8617", //托盘9
//"262eee71-4b35-0c81-11d5-73dbf303e528", //托盘10
//"442be666-50db-ba82-7098-b9ea41c02393", //托盘11
//"577ef4c4-edf8-a092-fedc-ca2117e36f0b", //托盘12
//"d65199c5-4e7d-8b94-0579-8489fd571640", //托盘13
//"55bd7aa5-5cd6-4b23-a883-7be122cf1161", //托盘14
//"e6b17e05-4891-48c0-9628-275102e77f4c", //托盘15
//"822fbee2-1fe0-45c8-b403-8b5cdb31cb25", //托盘16
//"c3adb1fc-de7c-4be7-ac54-7f025549d0ec", //托盘17
//"4dfc55dc-891b-42ec-9a17-fb0c01e3ce9c", //托盘18
//"d91b5ed1-8591-498d-917c-2aac71fdf570", //托盘19
//"a14dd99f-e273-44fa-9505-cff7da778bd0"  //托盘20