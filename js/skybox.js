/**
 * skybox.js
 * 
 * SpaceSkybox module - creates and sets a skybox using a cube texture.
 * It loads 6 images (one per cube face) and sets the scene background.
 */
const Skybox = (function() {
    'use strict';
    
    let skyboxTexture = null;
    
    /**
     * Initializes the skybox.
     * @param {THREE.Scene} scene - The scene where the skybox will be added.
     * @param {string} path - The folder path where the skybox images are located.
     * @param {Array} fileNames - Optional. An array of 6 image file names in the order:
     * [px, nx, py, ny, pz, nz]. Defaults to the common names.
     * @returns {THREE.CubeTexture} The loaded cube texture.
     */
    function init(scene, path, fileNames) {
        fileNames = fileNames || [
            'Starfield_right1.png',  // px
            'Starfield_left2.png',   // nx
            'Starfield_top3.png',    // py
            'Starfield_bottom4.png', // ny
            'Starfield_front5.png',  // pz
            'Starfield_back6.png'    // nz
          ];
        const loader = new THREE.CubeTextureLoader();
        loader.setPath(path);
        skyboxTexture = loader.load(
            fileNames,
            () => { console.log("Skybox images loaded successfully"); },
            undefined,
            (error) => { console.error("Error loading skybox images:", error); }
        );
        scene.background = skyboxTexture;
        console.log("Skybox set as scene background");
        return skyboxTexture;
    }
    
    return {
        init: init,
        getTexture: () => skyboxTexture
    };
})();
