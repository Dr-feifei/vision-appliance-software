import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './app/router'
import App from './app/App.vue'
import './app/style.css'
createApp(App).use(createPinia()).use(router).mount('#app')
