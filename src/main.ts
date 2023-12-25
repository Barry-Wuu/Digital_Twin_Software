import { createApp } from 'vue'
import "./style.css"
import App from './App.vue'
import './samples/node-api'
import ant from 'ant-design-vue'

const app = createApp(App);
app.use(ant);
app.mount("#app");
