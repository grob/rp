var {MessageDigest, SecureRandom} = java.security;
var {ByteArray} = require("binary");

exports.createSalt = function() {
    var salt = new ByteArray(8);
    var random = SecureRandom.getInstance("SHA1PRNG");
    random.nextBytes(salt);
    return salt;
};

exports.createDigest = function(str, salt, iterations) {
    var digest = MessageDigest.getInstance("SHA-1");
    digest.reset();
    digest.update(salt);
    var input = digest.digest(str.toByteString());
    for (var i = 0; i < (iterations || 1000); i += 1) {
        digest.reset();
        input = digest.digest(input);
    }
    return ByteArray.wrap(input);
};
