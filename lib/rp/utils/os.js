/**
 * @fileoverview Provides some information about the JVM, the computer
 * it's running on and the operating system
 */
const OS_NAME = java.lang.System.getProperty("os.name").toLowerCase();
const OS_NAMES = {
    "windows": "Windows",
    "freebsd": "FreeBSD",
    "sunos": "SunOS",
    "linux": "Linux",
    "mac": "Mac"
};
const OS_KEYS = Object.keys(OS_NAMES);
const OS_UNKNOWN = "Unknown";

/**
 * Returns the type of operating system
 * @returns The type of operating system
 * @type String
 */
var getType = exports.getType = function() {
    for each (let key in OS_KEYS) {
        if (OS_NAME.indexOf(key) === 0) {
            return OS_NAMES[key];
        }
    }
    return OS_UNKNOWN;
};

/**
 * Returns true if running on Windows
 * @returns True if running on Windows
 * @type Boolean
 */
exports.isWindows = function() {
    return getType() === OS_NAMES.windows;
};

/**
 * Returns true if running on Linux
 * @returns True if running on Linux
 * @type Boolean
 */
exports.isLinux = function() {
    return getType() === OS_NAMES.linux;
};

/**
 * Returns true if running on FreeBSD
 * @returns True if running on FreeBSD
 * @type Boolean
 */
exports.isFreeBSD = function() {
    return getType() === OS_NAMES.freebsd;
};

/**
 * Returns true if running on SunOS
 * @returns True if running on SunOS
 * @type Boolean
 */
exports.isSunOS = function() {
    return getType() === OS_NAMES.sunos;
};

/**
 * Returns true if running on Mac OS X
 * @returns True if running on Mac OS X
 * @type Boolean
 */
exports.isMac = function() {
    return getType() === OS_NAMES.mac;
};

Object.defineProperties(exports, {
    /**
     * The free memory of the JVM in bytes
     * @type Number
     */
    "freeMemory": {
        "get": function() {
            return java.lang.Runtime.getRuntime().freeMemory();
        },
        "enumerable": true
    },
    /**
     * The maximum used memory of the JVM in bytes
     * @type Number
     */
    "maxMemory": {
        "get": function() {
            return java.lang.Runtime.getRuntime().maxMemory();
        },
        "enumerable": true
    },
    /**
     * The total amount of memory of the JVM in bytes
     * @type Number
     */
    "totalMemory": {
        "get": function() {
            return java.lang.Runtime.getRuntime().totalMemory();
        },
        "enumerable": true
    },
    /**
     * The number of processors
     * @type Number
     */
    "processors": {
        "get": function() {
            return java.lang.Runtime.getRuntime().availableProcessors();
        },
        "enumerable": true
    }
});
