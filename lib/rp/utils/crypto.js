var {MessageDigest} = java.security;
var {ByteArray} = require("binary");

export("createSalt", "createDigest");

var createSalt = function() {
    var salt = new ByteArray(8);
    var random = java.security.SecureRandom.getInstance("SHA1PRNG");
    random.nextBytes(salt);
    return ByteArray.wrap(salt);
};

var createDigest = function(str, salt, iterations) {
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
