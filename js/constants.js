

// Scale: 100 units = 1 AU (Astronomical Unit)
// 1 AU = approximately 149.6 million km
// This means 1 unit = 1.496 million km in our simulation

const SCALE = {
    DISTANCE: 100,        // 100 units = 1 AU
    SIZE: 0.000005,       // Scale for celestial body sizes (makes them visible)
    MOON_DISTANCE: 10,    // Reduced from 20 to place moons at a more visually appropriate distance
    
    // Speed conversion constants
    // At 100 units = 1 AU, and 1 AU = 149.6 million km
    // 1 km/s in real space = 0.00000067 units/s in our simulation
    // This is derived from: (100 units / 149.6 million km)
    KM_S_TO_UNITS_S: 0.00000067,
    
    // Scale for the player's spaceship
    // A typical spacecraft might be ~100m in length
    // Earth's diameter: 12,756 km = ~0.42 units at our scale
    // Spaceship should be approximately 1/120,000 the size of Earth
    SPACESHIP_SIZE: 0.000003,
    
    // Minimum distance to maintain from celestial bodies (in units)
    // This represents approximately 100,000 km
    MIN_SAFE_DISTANCE: 0.67
};

// Local texture paths - include all available textures
const LOCAL_TEXTURES = {
    SUN: "textures/2k_sun.jpg",
    MERCURY: "textures/2k_mercury.jpg",
    VENUS: "textures/2k_venus_surface.jpg",
    EARTH: "textures/2k_earth_daymap.jpg",
    MOON: "textures/2k_moon.jpg",
    MARS: "textures/2k_mars.jpg",
    JUPITER: "textures/2k_jupiter.jpg",
    SATURN: "textures/2k_saturn.jpg",
    SATURN_RINGS: "textures/2k_saturn_ring_alpha.png",
    URANUS: "textures/2k_uranus.jpg",
    NEPTUNE: "textures/2k_neptune.jpg"
};

// Fallback colors for celestial bodies without textures
const FALLBACK_COLORS = {
    SUN: 0xffff00,        // Yellow
    MERCURY: 0x8c8c8c,    // Gray
    VENUS: 0xe6e6e6,      // Light gray with yellow tint
    EARTH: 0x2b82bd,      // Blue
    MOON: 0xcecece,       // Light gray
    MARS: 0xc1440e,       // Red-orange
    JUPITER: 0xd8ca9d,    // Beige with orange bands
    SATURN: 0xead6b8,     // Light beige
    URANUS: 0x4fd0e7,     // Light blue
    NEPTUNE: 0x3f58e3,    // Deep blue
    // Moons
    PHOBOS: 0x887979,     // Dark gray
    DEIMOS: 0x887979,     // Dark gray
    IO: 0xffff00,         // Yellow-orange (volcanic)
    EUROPA: 0xffffcc,     // Light cream (icy)
    GANYMEDE: 0xbbbbbb,   // Gray with white streaks
    CALLISTO: 0x888888,   // Dark gray
    TITAN: 0xffd700,      // Golden-orange (thick atmosphere)
    ENCELADUS: 0xffffff,  // Bright white (icy)
    TITANIA: 0xcccccc,    // Light gray
    TRITON: 0xdddddd      // Bluish-white
};

// Function to get texture path or fallback to color
function getTexturePath(localPath, fallbackColor) {
    // Return the local texture path if available
    if (localPath) {
        return localPath;
    }
    
    // If no texture path is provided, return null (will use fallback color)
    return null;
}

const CELESTIAL_BODIES = {
    SUN: {
        name: "Sun",
        distance: 0, // At the center (0, 0, 0)
        diameter: 1392700, // km
        scaled_diameter: 4.65, // Scaled value for visualization
        color: FALLBACK_COLORS.SUN,
        texture: getTexturePath(LOCAL_TEXTURES.SUN),
        rotationPeriod: 27, // days
        description: "The star at the center of our Solar System.",
        emissive: true,
        children: [],
        type: "star"
    },
    MERCURY: {
        name: "Mercury",
        distance: 0.39, // AU
        diameter: 4879, // km
        scaled_diameter: 0.16, // Scaled value for visualization
        color: FALLBACK_COLORS.MERCURY,
        texture: getTexturePath(LOCAL_TEXTURES.MERCURY),
        orbitalPeriod: 88, // days
        rotationPeriod: 58.6, // days
        description: "The smallest and innermost planet in the Solar System.",
        children: [],
        type: "planet"
    },
    VENUS: {
        name: "Venus",
        distance: 0.72, // AU
        diameter: 12104, // km
        scaled_diameter: 0.4, // Scaled value for visualization
        color: FALLBACK_COLORS.VENUS,
        texture: getTexturePath(LOCAL_TEXTURES.VENUS),
        orbitalPeriod: 225, // days
        rotationPeriod: -243, // days (negative indicates retrograde rotation)
        description: "The second planet from the Sun, known for its thick atmosphere.",
        children: [],
        type: "planet"
    },
    EARTH: {
        name: "Earth",
        distance: 1.00, // AU
        diameter: 12756, // km
        scaled_diameter: 0.42, // Scaled value for visualization
        color: FALLBACK_COLORS.EARTH,
        texture: getTexturePath(LOCAL_TEXTURES.EARTH),
        orbitalPeriod: 365.25, // days
        rotationPeriod: 1, // days
        description: "Our home planet, the third planet from the Sun.",
        children: [
            {
                name: "Moon",
                distance: 0.0015, // AU from Earth - reduced from 0.00257 to bring it closer
                parentDistance: 1.00, // AU from Sun
                diameter: 3475, // km
                scaled_diameter: 0.2, // Increased from 0.11 to make the Moon more visible
                color: FALLBACK_COLORS.MOON,
                texture: getTexturePath(LOCAL_TEXTURES.MOON),
                orbitalPeriod: 27.3, // days
                rotationPeriod: 27.3, // days (tidally locked)
                description: "Earth's only natural satellite.",
                type: "moon"
            }
        ],
        type: "planet"
    },
    MARS: {
        name: "Mars",
        distance: 1.52, // AU
        diameter: 6792, // km
        scaled_diameter: 0.22, // Scaled value for visualization
        color: FALLBACK_COLORS.MARS,
        texture: getTexturePath(LOCAL_TEXTURES.MARS),
        orbitalPeriod: 687, // days
        rotationPeriod: 1.03, // days
        description: "The fourth planet from the Sun, known as the Red Planet.",
        children: [
            {
                name: "Phobos",
                distance: 0.0002, // AU from Mars - increased from 0.00006 to prevent intersection
                parentDistance: 1.52, // AU from Sun
                diameter: 22.2, // km
                scaled_diameter: 0.04, // Scaled value for visualization
                color: FALLBACK_COLORS.PHOBOS,
                texture: null, // No texture available, will use color
                orbitalPeriod: 0.32, // days
                rotationPeriod: 0.32, // days (tidally locked)
                description: "The larger and innermost of Mars's two moons.",
                type: "moon"
            },
            {
                name: "Deimos",
                distance: 0.0004, // AU from Mars - increased from 0.00015 to prevent intersection
                parentDistance: 1.52, // AU from Sun
                diameter: 12.6, // km
                scaled_diameter: 0.03, // Scaled value for visualization
                color: FALLBACK_COLORS.DEIMOS,
                texture: null, // No texture available, will use color
                orbitalPeriod: 1.26, // days
                rotationPeriod: 1.26, // days (tidally locked)
                description: "The smaller and outermost of Mars's two moons.",
                type: "moon"
            }
        ],
        type: "planet"
    },
    ASTEROID_BELT: {
        name: "Asteroid Belt",
        type: "asteroid_belt",
        distance: 2.8, // AU (average)
        innerRadius: 2.2, // AU
        outerRadius: 3.2, // AU
        color: 0x8c8c8c,
        description: "A region between Mars and Jupiter containing numerous asteroids.",
        asteroidCount: 800 // Reduced from 2000 for a more realistic, less dense appearance
    },
    JUPITER: {
        name: "Jupiter",
        type: "planet",
        distance: 5.20, // AU
        diameter: 142984, // km
        scaled_diameter: 1.4, // Scaled value for visualization
        color: FALLBACK_COLORS.JUPITER,
        texture: getTexturePath(LOCAL_TEXTURES.JUPITER),
        orbitalPeriod: 4333, // days
        rotationPeriod: 0.41, // days
        description: "The largest planet in the Solar System.",
        children: [
            {
                name: "Io",
                type: "moon",
                distance: 0.002821, // AU from Jupiter
                parentDistance: 5.20, // AU from Sun
                diameter: 3643, // km
                scaled_diameter: 0.08, // Scaled value for visualization
                color: FALLBACK_COLORS.IO,
                texture: null, // No texture available, will use color
                orbitalPeriod: 1.77, // days
                rotationPeriod: 1.77, // days (tidally locked)
                description: "The innermost of Jupiter's four Galilean moons, known for volcanic activity."
            },
            {
                name: "Europa",
                type: "moon",
                distance: 0.004486, // AU from Jupiter
                parentDistance: 5.20, // AU from Sun
                diameter: 3122, // km
                scaled_diameter: 0.07, // Scaled value for visualization
                color: FALLBACK_COLORS.EUROPA,
                texture: null, // No texture available, will use color
                orbitalPeriod: 3.55, // days
                rotationPeriod: 3.55, // days (tidally locked)
                description: "The smallest of Jupiter's four Galilean moons, has a water-ice crust."
            },
            {
                name: "Ganymede",
                type: "moon",
                distance: 0.007155, // AU from Jupiter
                parentDistance: 5.20, // AU from Sun
                diameter: 5268, // km
                scaled_diameter: 0.12, // Scaled value for visualization
                color: FALLBACK_COLORS.GANYMEDE,
                texture: null, // No texture available, will use color
                orbitalPeriod: 7.15, // days
                rotationPeriod: 7.15, // days (tidally locked)
                description: "Jupiter's largest moon and the largest in the Solar System."
            },
            {
                name: "Callisto",
                type: "moon",
                distance: 0.012585, // AU from Jupiter
                parentDistance: 5.20, // AU from Sun
                diameter: 4821, // km
                scaled_diameter: 0.11, // Scaled value for visualization
                color: FALLBACK_COLORS.CALLISTO,
                texture: null, // No texture available, will use color
                orbitalPeriod: 16.69, // days
                rotationPeriod: 16.69, // days (tidally locked)
                description: "The second-largest of Jupiter's moons and the third-largest in the Solar System."
            }
        ],
        type: "planet"
    },
    SATURN: {
        name: "Saturn",
        type: "planet",
        distance: 9.58, // AU
        diameter: 120536, // km
        scaled_diameter: 1.2, // Scaled value for visualization
        color: FALLBACK_COLORS.SATURN,
        texture: getTexturePath(LOCAL_TEXTURES.SATURN),
        orbitalPeriod: 10759, // days
        rotationPeriod: 0.44, // days
        description: "The second-largest planet, known for its prominent ring system.",
        rings: {
            innerRadius: 0.02, // AU from Saturn
            outerRadius: 0.04, // AU from Saturn
            texture: getTexturePath(LOCAL_TEXTURES.SATURN_RINGS)
        },
        children: [
            {
                name: "Titan",
                type: "moon",
                distance: 0.008168, // AU from Saturn
                parentDistance: 9.58, // AU from Sun
                diameter: 5150, // km
                scaled_diameter: 0.12, // Scaled value for visualization
                color: FALLBACK_COLORS.TITAN,
                texture: null, // No texture available, will use color
                orbitalPeriod: 15.95, // days
                rotationPeriod: 15.95, // days (tidally locked)
                description: "Saturn's largest moon, has a thick atmosphere."
            },
            {
                name: "Enceladus",
                type: "moon",
                distance: 0.001587, // AU from Saturn
                parentDistance: 9.58, // AU from Sun
                diameter: 504, // km
                scaled_diameter: 0.05, // Scaled value for visualization
                color: FALLBACK_COLORS.ENCELADUS,
                texture: null, // No texture available, will use color
                orbitalPeriod: 1.37, // days
                rotationPeriod: 1.37, // days (tidally locked)
                description: "A small, icy moon of Saturn with active geysers."
            }
        ],
        type: "planet"
    },
    URANUS: {
        name: "Uranus",
        type: "planet",
        distance: 19.22, // AU
        diameter: 51118, // km
        scaled_diameter: 0.8, // Scaled value for visualization
        color: FALLBACK_COLORS.URANUS,
        texture: getTexturePath(LOCAL_TEXTURES.URANUS),
        orbitalPeriod: 30688.5, // days
        rotationPeriod: -0.72, // days (negative indicates retrograde rotation)
        description: "The seventh planet from the Sun, rotates on its side.",
        children: [
            {
                name: "Titania",
                type: "moon",
                distance: 0.003487, // AU from Uranus
                parentDistance: 19.22, // AU from Sun
                diameter: 1578, // km
                scaled_diameter: 0.06, // Scaled value for visualization
                color: FALLBACK_COLORS.TITANIA,
                texture: null, // No texture available, will use color
                orbitalPeriod: 8.71, // days
                rotationPeriod: 8.71, // days (tidally locked)
                description: "The largest moon of Uranus."
            }
        ],
        type: "planet"
    },
    NEPTUNE: {
        name: "Neptune",
        type: "planet",
        distance: 30.05, // AU
        diameter: 49528, // km
        scaled_diameter: 0.78, // Scaled value for visualization
        color: FALLBACK_COLORS.NEPTUNE,
        texture: getTexturePath(LOCAL_TEXTURES.NEPTUNE),
        orbitalPeriod: 60195, // days
        rotationPeriod: 0.67, // days
        description: "The eighth and most distant planet from the Sun.",
        children: [
            {
                name: "Triton",
                type: "moon",
                distance: 0.002371, // AU from Neptune
                parentDistance: 30.05, // AU from Sun
                diameter: 2707, // km
                scaled_diameter: 0.07, // Scaled value for visualization
                color: FALLBACK_COLORS.TRITON,
                texture: null, // No texture available, will use color
                orbitalPeriod: 5.88, // days
                rotationPeriod: 5.88, // days (tidally locked)
                description: "The largest moon of Neptune, has retrograde orbit."
            }
        ],
        type: "planet"
    }
};

// These texture URLs would normally point to real texture files. 
// For the simulation, you'd need to either:
// 1. Download these textures or 
// 2. Use URLs to real texture images online 