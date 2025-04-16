const CACHE_NAME = 'crusader-x-v1';
const ASSETS_TO_CACHE = [
  '/', // Makes sure the root is cached
  '/index.html',
  '/manifest.json',
  '/third_party_licenses.txt',
  '/css/styles.css',
  '/images/cockpit.png',
  '/images/skybox/Starfield_back6.png',
  '/images/skybox/Starfield_bottom4.png',
  '/images/skybox/Starfield_front5.png',
  '/images/skybox/Starfield_left2.png',
  '/images/skybox/Starfield_right1.png',
  '/images/skybox/Starfield_top3.png',
  '/js/app.js',
  '/js/celestialBodies.js',
  '/js/combatHUD.js',
  '/js/constants.js',
  '/js/controls.js',
  '/js/enemyShip.js',
  '/js/events.js',
  '/js/explorationHUD.js',
  '/js/geckosClient.js',
  '/js/introScreen.js',
  '/js/killsTable.js',
  '/js/laserSystem.js',
  '/js/mobileContols.js',
  '/js/networkController.js',
  '/js/pointerLockControls.js',
  '/js/shipController.js',
  '/js/skybox.js',
  '/js/solarSystem.js',
  '/js/uiController.js',
  '/js/utils.js',
  '/js/lib/OBB.js',
  '/models/spaceShip1.glb',
  '/models/spaceStation1.glb',
  '/music/aldebaran.mp3',
  '/soundfx/acceleration.mp3',
  '/soundfx/deceleration.mp3',
  '/soundfx/impact1.mp3',
  '/soundfx/impact2.mp3',
  '/soundfx/kill.mp3',
  '/soundfx/Laser.mp3',
  '/textures/2k_earth_daymap.jpg',
  '/textures/2k_jupiter.jpg',
  '/textures/2k_mars.jpg',
  '/textures/2k_mercury.jpg',
  '/textures/2k_moon.jpg',
  '/textures/2k_neptune.jpg',
  '/textures/2k_saturn.jpg',
  '/textures/2k_saturn_ring_alpha.png',
  '/textures/2k_sun.jpg',
  '/textures/2k_uranus.jpg',
  '/textures/2k_venus_surface.jpg'
];

self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => {
          return Promise.all(
            ASSETS_TO_CACHE.map(url => {
              return fetch(url).then(response => {
                if (!response.ok) {
                  console.error(`Failed to fetch ${url}: ${response.statusText}`);
                  return;
                }
                return cache.put(url, response);
              }).catch(error => {
                console.error(`Error fetching ${url}:`, error);
              });
            })
          );
        })
    );
  });
  

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
