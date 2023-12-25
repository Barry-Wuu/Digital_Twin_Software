import { createApp } from 'vue'
import "./style.css"
import App from './App.vue'
import './samples/node-api'
<<<<<<< HEAD
import ant from 'ant-design-vue'

const app = createApp(App);
app.use(ant);
app.mount("#app");
=======

createApp(App)
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })
>>>>>>> 0f2e3a320f3eaa672ce2b6dddf77bfe6ca56dec9
