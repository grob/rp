var system = require("system");

exports.testDescriptors = require("./descriptors_test");
exports.testPackages = require("./packages_test");
exports.testRegistry = require("./registry_test");
exports.testResolver = require("./resolver_test");

if (require.main == module.id) {
    system.exit(require('test').run(exports));
}
