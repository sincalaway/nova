import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = () => reject(new Error(`无法加载 ${src}`))
    document.head.append(script)
  })
}

async function start() {
  for (const src of [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    '/sync-config.js'
  ]) {
    try {
      await loadScript(src)
    } catch (error) {
      console.error(error)
    }
  }
  createApp(App).mount('#app')
}

start()
