import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/index.scss';

const app = createApp(App)

app.use(router)

// 全局滚动入场指令：v-reveal 淡入上移，v-reveal:150 可传延迟(ms)
let io = null
const observer = () => {
  if (!io && 'IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target
          el.classList.add('is-in')
          el.style.setProperty('--rv-delay', String(el.getAttribute('data-rv-delay') || 0) + 'ms')
          io.unobserve(el)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
  }
  return io
}

app.directive('reveal', {
  mounted(el, binding) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in')
      return
    }
    el.classList.add('rv')
    if (binding.value != null) el.setAttribute('data-rv-delay', String(binding.value))
    const obs = observer()
    if (obs) obs.observe(el)
  }
})

app.mount('#app')
