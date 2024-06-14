const { exec } = require('child_process');   

export default class HttpServer{
    httpServerProcess = null;  // 服务进程
    port = 0;  // 端口号

    constructor(port=0){
        this.port = port;
        this.kill(()=>{  // 开始服务
            this.httpServerProcess = exec(`http-server.cmd ${port ? '-p ' + port : ''}`); 
            this.httpServerProcess.stdout.on("data", data => {  // 未指定端口则自动获取端口
                if(data.includes("Hit")) this.port = data.split(':').slice(-1)[0];
            })
            return this.httpServerProcess;
        });
    }
    /*
        接收的信息（JSON格式）：
        {
            "ID": ……,  // 光电门ID
            "RFID": ……,  // 托盘ID
            ……
        }
    */
    kill(callBack: Function = null){  // 结束服务
        let result = exec(`netstat -ano | findstr :${this.port}`);
        result.stdout.on("data", (data) => {  
            let PID = data.trim().split(/[\s\n\r]+/);  
            PID = PID[PID.indexOf("LISTENING") + 1];
            exec(`taskkill /pid ${PID} /f`, callBack);
            return;
        });  
        callBack();
    }
}