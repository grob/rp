exports.testDescriptors = require("./descriptors_test");
exports.testPackages = require("./packages_test");

if (require.main == module.id) {
    system.exit(require('test').run(exports));
}
