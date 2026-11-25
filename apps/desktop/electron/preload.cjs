const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('huinetDesktop', {
  isDesktop: true,
  platform: process.platform,
});
