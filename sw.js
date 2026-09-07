const CACHE_NAME = 'vitamet-cache-v1';
const urlsToCache = [
  '/',
  '/user/perfil.html',
  '/user/consultas.html',
  '/user/consultas.css',
  'esqueci-senha.html',
  'esqueci-senha.css',
  '/user/tutor.html',
  '/user/perfil.css',
  'login.html',
  '/user/agendamento.html',
  '/user/agendamento.css',
  '/user/tutor.css',
  'login.css',
  '/admin/inicio.html',
  '/admin/inicio.css',
  '/admin/configuracoes.html',
  '/admin/gestao.html',
  '/admin/pets.html',
  '/admin/veterinarios.html',
  '/admin/publicacoes.html',
  '/admin/logistica.html',
  '/admin/relatorios.html',
  '/user/comunidade.html',
  '/user/comunidade.css'
];

// Instalação do Service Worker e salvamento dos arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de versões antigas de cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições (Estratégia: Network First para API, Cache First para arquivos estáticos)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Se for uma requisição para a API do backend, busca sempre na rede primeiro
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/usuario/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Para o restante, tenta o cache primeiro, se não achar, busca na rede
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});